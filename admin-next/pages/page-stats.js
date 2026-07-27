const TAG = window.__GRAV_PAGE_TAG || 'grav-page-stats--page-stats';

/**
 * Admin2 component-mode page for the Page Stats plugin.
 *
 * Talks to the REST endpoints registered by
 * classes/Api/PageStatsApiController.php (see page-stats.php ->
 * onApiRegisterRoutes) to render an overview dashboard, plus small
 * lookup tools for a single page or a single user.
 *
 * This intentionally consolidates the nine separate classic-admin pages
 * (stats / page-details / user-details / all-pages / top-countries /
 * top-browsers / top-platforms / top-users / recently-viewed-pages) into
 * one dashboard with inline lookups, since Admin2 component pages are a
 * single route rather than a set of admin-theme templates.
 *
 * Page/User Detail sub-views: Admin2's client-side router only defines a
 * single dynamic segment for plugin pages (/plugin/[slug]) - no catch-all
 * for anything deeper, so an actual extra path segment would 404 client-
 * side on a hard reload. Instead, sub-views live on the exact same route
 * and are addressed purely via query string (?view=page-detail&route=...),
 * driven by plain history.pushState()/popstate (this custom element has no
 * access to SvelteKit's $app/navigation, only the native History API - but
 * that's what SvelteKit's own helpers wrap anyway, and this route has no
 * +page.ts load function tied to it, so query-string-only navigation never
 * triggers SvelteKit's own router). Currently only empty placeholder shells
 * - the point of this pass is establishing the routing/back-button/deep-
 * link behaviour and wiring up the overview's links, not the detail
 * content itself (see docs/FORK-NOTES.md / session notes).
 */
class PageStatsPage extends HTMLElement {
    #range = '30';
    #overview = null;
    #summary = null;
    #loading = false;
    #recentLimit = 10;
    #recentPages = [];
    #recentHasMore = true;
    #view = 'dashboard'; // 'dashboard' | 'page-detail' | 'user-detail'
    #viewParams = {};
    #onPopState = null;

    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this._syncViewFromLocation();
        this.#onPopState = () => this._handlePopState();
        window.addEventListener('popstate', this.#onPopState);
        this._render();
        if (this.#view === 'dashboard') this._load();
    }

    disconnectedCallback() {
        if (this.#onPopState) window.removeEventListener('popstate', this.#onPopState);
    }

    /**
     * Reads ?view=...&route=...|user=...|ip=... from the current URL into
     * #view/#viewParams. Falls back to 'dashboard' for anything malformed
     * (missing/unknown view, or a detail view without its required param)
     * rather than showing a broken detail shell.
     */
    _syncViewFromLocation() {
        const params = new URLSearchParams(location.search);
        const view = params.get('view');

        if (view === 'page-detail' && params.get('route')) {
            this.#view = 'page-detail';
            this.#viewParams = { route: params.get('route') };
            return;
        }
        if (view === 'user-detail' && (params.get('user') || params.get('ip'))) {
            this.#view = 'user-detail';
            this.#viewParams = params.get('user') ? { user: params.get('user') } : { ip: params.get('ip') };
            return;
        }
        this.#view = 'dashboard';
        this.#viewParams = {};
    }

    _handlePopState() {
        this._syncViewFromLocation();
        this._render();
        if (this.#view === 'dashboard') this._load();
    }

    /**
     * Internal navigation between the dashboard and a detail sub-view.
     * Pushes a real history entry (so the browser Back button works) but
     * never changes the path, only the query string - see class doc
     * comment for why that matters here.
     */
    _navigate(view, params = {}) {
        this.#view = view;
        this.#viewParams = params;

        let search = '';
        if (view !== 'dashboard') {
            search = `?${new URLSearchParams({ view, ...params }).toString()}`;
        }
        history.pushState({ view, params }, '', `${location.pathname}${search}`);

        this._render();
        if (view === 'dashboard') this._load();
    }

    /**
     * Delegated click handling for internal nav links (data-nav="...",
     * optionally data-nav-route/-user/-ip). Real <a href> elements so
     * right-click / middle-click / ctrl-click "open in new tab" keeps
     * working (a fresh tab re-syncs from the URL via _syncViewFromLocation
     * on connectedCallback); a plain left click is intercepted to do an
     * in-place SPA navigation instead of a full page reload.
     */
    _bindNavLinks(root) {
        root.querySelectorAll('[data-nav]').forEach((el) => {
            el.addEventListener('click', (e) => {
                if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                const view = el.dataset.nav;
                const params = {};
                if (el.dataset.navRoute) params.route = el.dataset.navRoute;
                if (el.dataset.navUser) params.user = el.dataset.navUser;
                if (el.dataset.navIp) params.ip = el.dataset.navIp;
                this._navigate(view, params);
            });
        });
    }

    _apiUrl(path) {
        const base = window.__GRAV_API_SERVER_URL || '';
        const prefix = window.__GRAV_API_PREFIX || '/api/v1';
        return `${base}${prefix}${path}`;
    }

    _apiHeaders() {
        const headers = {};
        const token = window.__GRAV_API_TOKEN;
        if (token) headers['X-API-Token'] = token;
        return headers;
    }

    async _apiGet(path, params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = this._apiUrl(path) + (query ? `?${query}` : '');
        const resp = await fetch(url, { headers: this._apiHeaders() });
        if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            throw new Error(body.detail || body.title || `Request failed (${resp.status})`);
        }
        const json = await resp.json();
        return json.data !== undefined ? json.data : json;
    }

    /**
     * @returns {{from: Date|null, to: Date|null}} 'all time' is represented
     * as {from: null, to: null} - there's no meaningful start date to zero-fill
     * a chart from.
     */
    _currentDateRange() {
        if (this.#range === 'all') return { from: null, to: null };
        const days = parseInt(this.#range, 10);
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - days);
        return { from, to };
    }

    _dateRangeParams() {
        const { from, to } = this._currentDateRange();
        if (!from || !to) return {};
        return {
            date_from: from.toISOString(),
            date_to: to.toISOString(),
        };
    }

    async _load() {
        if (this.#view !== 'dashboard') return;

        this.#loading = true;
        this.#recentLimit = 10;
        this._renderBody();

        const params = this._dateRangeParams();
        const [overviewResult, summaryResult] = await Promise.allSettled([
            this._apiGet('/page-stats/overview', params),
            this._apiGet('/page-stats/summary', params),
        ]);

        this.#overview = overviewResult.status === 'fulfilled' ? overviewResult.value : null;
        this.#summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
        this.#recentPages = this.#overview?.recent_pages || [];
        this.#recentHasMore = this.#recentPages.length >= this.#recentLimit;

        if (overviewResult.status === 'rejected') {
            this._error = overviewResult.reason?.message || 'Could not load page stats';
            window.__GRAV_TOAST?.error(this._error);
        } else if (summaryResult.status === 'rejected') {
            // Non-fatal: the KPI numbers and top lists come from /overview
            // and still work, only the trend sparklines are missing.
            window.__GRAV_TOAST?.error(summaryResult.reason?.message || 'Could not load trend data');
        }

        this.#loading = false;
        this._renderBody();
    }

    _render() {
        if (this.#view === 'dashboard') {
            this._renderDashboardShell();
        } else {
            this._renderDetailShell();
        }
    }

    _renderDashboardShell() {
        this.shadowRoot.innerHTML = `
            <style>${this._styles()}</style>
            <div class="wrap">
                <div class="toolbar">
                    <div class="range">
                        <button data-range="7">7d</button>
                        <button data-range="30">30d</button>
                        <button data-range="90">90d</button>
                        <button data-range="all">All time</button>
                    </div>
                    <div class="toolbar-end">
                        <span class="db-size" title="SQLite database file size"></span>
                        <button class="refresh" title="Refresh">&#8635; Refresh</button>
                    </div>
                </div>
                <div class="body"></div>

                <div class="lookup">
                    <div class="lookup-box">
                        <h3>Page lookup</h3>
                        <div class="lookup-row">
                            <input type="text" class="page-route" placeholder="/blog/some-article" />
                            <button class="page-search">Search</button>
                        </div>
                        <div class="page-result"></div>
                    </div>
                    <div class="lookup-box">
                        <h3>User lookup</h3>
                        <div class="lookup-row">
                            <input type="text" class="user-name" placeholder="username" />
                            <button class="user-search">Search</button>
                        </div>
                        <div class="user-result"></div>
                    </div>
                </div>
            </div>
        `;

        const root = this.shadowRoot;
        root.querySelectorAll('.range button').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.#range = btn.dataset.range;
                this._highlightRange();
                this._load();
            });
        });
        root.querySelector('.refresh').addEventListener('click', () => this._load());
        root.querySelector('.page-search').addEventListener('click', () => this._searchPage());
        root.querySelector('.user-search').addEventListener('click', () => this._searchUser());
        root.querySelector('.page-route').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._searchPage();
        });
        root.querySelector('.user-name').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._searchUser();
        });

        this._highlightRange();
    }

    /**
     * Empty skeleton for Page Detail / User Detail. Deliberately just a
     * back-link + title for now (this pass is about establishing routing/
     * linking, not the detail content) - see class doc comment.
     */
    _renderDetailShell() {
        this.shadowRoot.innerHTML = `
            <style>${this._styles()}</style>
            <div class="wrap">
                <div class="detail-header">
                    <a href="${this._esc(location.pathname)}" class="back-link" data-nav="dashboard">&larr; Back to dashboard</a>
                    <h2>${this._esc(this._detailTitle())}</h2>
                </div>
                <div class="card">
                    <div class="state">This view is coming in a future session - for now it only wires up the URL, back-button and links from the overview.</div>
                </div>
            </div>
        `;
        this._bindNavLinks(this.shadowRoot);
    }

    _detailTitle() {
        if (this.#view === 'page-detail') {
            return `Page detail: ${this.#viewParams.route || ''}`;
        }
        if (this.#view === 'user-detail') {
            if (this.#viewParams.user) return `User detail: ${this.#viewParams.user}`;
            if (this.#viewParams.ip) return `User detail: ${this.#viewParams.ip} (anonymous)`;
        }
        return '';
    }

    _highlightRange() {
        this.shadowRoot.querySelectorAll('.range button').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.range === this.#range);
        });
    }

    _renderBody() {
        const body = this.shadowRoot.querySelector('.body');
        if (!body) return;

        if (this.#loading) {
            body.innerHTML = `<div class="state">Loading…</div>`;
            return;
        }

        if (!this.#overview) {
            body.innerHTML = `<div class="state error">${this._error || 'No data available.'}</div>`;
            return;
        }

        const o = this.#overview;
        const dbBadge = this.shadowRoot.querySelector('.db-size');
        if (dbBadge) dbBadge.textContent = o.db?.mb !== undefined ? `Database size: ${o.db.mb} MB` : '';

        const { from, to } = this._currentDateRange();
        const hitsSeries = this._buildDailySeries(this.#summary?.hits, from, to);
        const visitorsSeries = this._buildDailySeries(this.#summary?.visitors, from, to);
        const usersSeries = this._buildDailySeries(this.#summary?.users, from, to);

        body.innerHTML = `
            <div class="charts">
                ${this._chartCard('Page views', o.total_page_views, hitsSeries, 'var(--primary)')}
                ${this._chartCard('Unique visitors', o.total_unique_visitors, visitorsSeries, '#22d3ee')}
                ${this._chartCard('Unique users', o.total_unique_users, usersSeries, '#f59e0b')}
            </div>

            <div class="grid">
                <div class="card wide">
                    <h3>Top pages</h3>
                    ${this._table(
                        ['Page', 'Hits', 'Visitors'],
                        (o.top_pages || []).map((p) => [
                            `<span title="${this._esc(p.route)}">${this._esc(p.page_title || p.route)}</span>`,
                            p.hits,
                            p.visitors,
                        ])
                    )}
                </div>

                <div class="card">
                    <h3>Top countries</h3>
                    ${this._bars(o.top_countries, 'country')}
                </div>

                <div class="card">
                    <h3>Top browsers</h3>
                    ${this._bars(o.top_browsers, 'browser')}
                </div>

                <div class="card">
                    <h3>Top platforms</h3>
                    ${this._bars(o.top_platforms, 'platform')}
                </div>

                <div class="card">
                    <h3>Top users</h3>
                    ${this._table(
                        ['User', 'Hits'],
                        (o.top_users || []).map((u) => [
                            u.user ? this._userCellHtml({ user: u.user }) : this._esc('(anonymous)'),
                            u.hits,
                        ])
                    )}
                </div>

                <div class="card wide">
                    <h3>Recently viewed pages</h3>
                    ${this._table(
                        ['Page', 'User', 'Browser', 'Platform', 'Date'],
                        this.#recentPages.map((r) => [
                            this._pageCellHtml(r.route),
                            this._userCellHtml({ user: r.user, ip: r.ip }),
                            this._esc(r.browser || 'unknown'),
                            this._esc(r.platform || 'unknown'),
                            `${this._esc(r.day || '')} ${this._esc(r.time || '')}`,
                        ])
                    )}
                    ${this.#recentPages.length && this.#recentHasMore ? `<button class="load-more-recent">Load more</button>` : ''}
                </div>
            </div>
        `;

        body.querySelector('.load-more-recent')?.addEventListener('click', () => this._loadMoreRecent());
        this._bindNavLinks(body);
    }

    /**
     * "Page" cell for the Recently viewed pages table: a small trend icon
     * linking to the (currently empty) Page Detail sub-view, the existing
     * "open in a new tab" icon linking to the real site page, then the
     * route text itself (unlinked, see _externalLinkIcon() doc comment for
     * why the text stays plain). Mirrors the classic-admin 1.7 "Recently
     * Viewed Pages" widget, which showed the same pair of icons per row.
     */
    _pageCellHtml(route) {
        const encoded = encodeURIComponent(route || '');
        return `<span class="recent-page-cell">
            <a href="${this._esc(route)}" target="_blank" rel="noopener noreferrer" class="recent-page-link" title="${this._esc(route)} in neuem Tab öffnen">${this._externalLinkIcon()}</a>
            <a href="?view=page-detail&route=${encoded}" class="recent-page-link nav-link" data-nav="page-detail" data-nav-route="${this._esc(route)}" title="View page detail">${this._trendIcon()}</a>
            <span class="recent-page-route" title="${this._esc(route)}">${this._esc(route)}</span>
        </span>`;
    }

    /**
     * "User" cell shared by Recently viewed pages and Top users: a trend
     * icon linking to User Detail plus the label. Links by username when
     * available; falls back to linking by IP for anonymous-but-identifiable
     * visitors (see PageStatsApiController::userDetail(), which accepts
     * either param). Pass neither (Top users' aggregated anonymous bucket)
     * to get a plain, unlinked "(anonymous)" label.
     */
    _userCellHtml({ user, ip } = {}) {
        const label = user || ip || '(anonymous)';
        if (!user && !ip) {
            return this._esc(label);
        }
        const param = user ? `user=${encodeURIComponent(user)}` : `ip=${encodeURIComponent(ip)}`;
        const navAttr = user ? `data-nav-user="${this._esc(user)}"` : `data-nav-ip="${this._esc(ip)}"`;
        return `<span class="recent-page-cell">
            <a href="?view=user-detail&${param}" class="recent-page-link nav-link" data-nav="user-detail" ${navAttr} title="View user detail">${this._trendIcon()}</a>
            <span class="recent-page-route">${this._esc(label)}</span>
        </span>`;
    }

    /**
     * Re-requests /page-stats/recent with a larger `limit` (10 -> 20 -> 30 ...)
     * and re-renders just the body. Deliberately not an offset/cursor-based
     * pagination: re-fetching the whole newest-first list with a bigger
     * limit avoids duplicate/missing rows if new hits arrive between clicks,
     * and needs no extra server-side state.
     */
    async _loadMoreRecent() {
        const nextLimit = this.#recentLimit + 10;
        try {
            const data = await this._apiGet('/page-stats/recent', {
                ...this._dateRangeParams(),
                limit: nextLimit,
            });
            this.#recentPages = data.pages || [];
            this.#recentLimit = nextLimit;
            this.#recentHasMore = this.#recentPages.length >= nextLimit;
        } catch (err) {
            window.__GRAV_TOAST?.error(err.message || 'Could not load more recently viewed pages');
        }
        this._renderBody();
    }

    _chartCard(title, total, series, color) {
        const chart = series.length ? this._lineChart(series, color) : `<div class="state">No data.</div>`;
        return `
            <div class="card chart-card">
                <div class="chart-head">
                    <h3>${this._esc(title)}</h3>
                    <span class="chart-total">${this._esc(String(total ?? '0'))}</span>
                </div>
                ${chart}
            </div>`;
    }

    /**
     * 'YYYY-MM-DD' -> 'DD.MM.' for compact axis labels.
     */
    _formatDayLabel(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        return m ? `${m[3]}.${m[2]}.` : iso || '';
    }

    /**
     * A proper axis chart (y-axis gridlines/labels, x-axis date labels,
     * hover tooltips via native SVG <title> per point) rather than a bare
     * sparkline - closer to what the classic-admin version of this plugin
     * showed (three full charts with axes), while still fitting a
     * dashboard card instead of a whole separate admin page.
     */
    _lineChart(series, color) {
        const width = 480;
        const height = 170;
        const padLeft = 34;
        const padRight = 8;
        const padTop = 10;
        const padBottom = 20;
        const plotW = width - padLeft - padRight;
        const plotH = height - padTop - padBottom;

        const max = Math.max(...series.map((p) => p.value), 1);
        const yTickCount = 4;
        const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => Math.round((max / yTickCount) * i));

        const stepX = series.length > 1 ? plotW / (series.length - 1) : plotW;
        const points = series.map((p, i) => ({
            ...p,
            x: padLeft + i * stepX,
            y: padTop + plotH - (p.value / max) * plotH,
        }));

        const linePath = `M${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`;
        const baseline = (padTop + plotH).toFixed(1);
        const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${baseline} L${points[0].x.toFixed(1)},${baseline} Z`;

        const gridlines = yTicks
            .map((v) => {
                const y = padTop + plotH - (v / max) * plotH;
                return `
                    <line class="grid-line" x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}"></line>
                    <text class="axis-label y-label" x="${padLeft - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${v}</text>`;
            })
            .join('');

        // A handful of evenly spaced x-axis labels rather than one per day -
        // that many labels overlap on anything but a 7-day range.
        const labelCount = Math.min(6, points.length);
        const labelStep = points.length > 1 ? (points.length - 1) / Math.max(1, labelCount - 1) : 0;
        const seenX = new Set();
        const xAxisLabels = Array.from({ length: labelCount }, (_, i) => points[Math.round(i * labelStep)])
            .filter((p) => {
                if (seenX.has(p.x)) return false;
                seenX.add(p.x);
                return true;
            })
            .map((p) => {
                // Middle labels can grow symmetrically; the first/last one
                // would grow past the viewBox edge with text-anchor="middle"
                // and get clipped (seen with the rightmost date, e.g.
                // "24.07." showing as "24.0"), so they anchor toward the
                // inside instead.
                const isFirst = p === points[0];
                const isLast = p === points[points.length - 1];
                const anchor = isLast ? 'end' : isFirst ? 'start' : 'middle';
                return `<text class="axis-label x-label" x="${p.x.toFixed(1)}" y="${height - 4}" text-anchor="${anchor}">${this._esc(this._formatDayLabel(p.date))}</text>`;
            })
            .join('');

        const dots = points
            .map(
                (p) =>
                    `<circle class="chart-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5"><title>${this._esc(this._formatDayLabel(p.date))}: ${p.value}</title></circle>`
            )
            .join('');

        return `
            <svg class="line-chart" viewBox="0 0 ${width} ${height}" style="color:${color}">
                ${gridlines}
                <path class="chart-area" d="${areaPath}"></path>
                <path class="chart-line" d="${linePath}"></path>
                ${dots}
                ${xAxisLabels}
            </svg>`;
    }

    /**
     * Turns the raw rows from Stats::siteSummary() (one row per day *that
     * has data*, in no guaranteed order - see classes/Stats.php) into a
     * chronologically sorted array of {date, value}. When we know the
     * selected range (from/to), missing days are filled in with 0 so the
     * sparkline has an evenly spaced timeline instead of gaps wherever a
     * day had zero visits. For 'all time' (from/to unknown) we just sort
     * whatever days came back, without filling - the range could span
     * years and the exact start date isn't known client-side.
     */
    _buildDailySeries(rows, from, to) {
        const byDate = new Map();
        (rows || []).forEach((r) => {
            if (r && r.date) byDate.set(r.date, Number(r.hits) || 0);
        });

        if (!from || !to) {
            return [...byDate.entries()]
                .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
                .map(([date, value]) => ({ date, value }));
        }

        const series = [];
        const cursor = new Date(from);
        cursor.setHours(0, 0, 0, 0);
        const end = new Date(to);
        end.setHours(0, 0, 0, 0);
        while (cursor <= end) {
            const key = cursor.toISOString().slice(0, 10);
            series.push({ date: key, value: byDate.get(key) || 0 });
            cursor.setDate(cursor.getDate() + 1);
        }
        return series;
    }

    /**
     * Converts a 2-letter ISO country code (as stored by Geolocation /
     * classes/Stats.php: $geo->countryCode(), empty falls back to the
     * literal string "unknown") into a small flag image.
     *
     * Deliberately NOT using the Unicode "flag" emoji (combined regional
     * indicator symbols) here: whether that renders as an actual flag
     * depends entirely on the OS/browser having a matching color-emoji
     * font installed, and on several common desktop Linux setups it just
     * shows as two plain letters or a blank box. An <img> renders
     * consistently everywhere. flagcdn.com is the same kind of external,
     * free flag source the classic-admin version of this plugin used
     * (flagpedia.net, per its README credits) - current CSP
     * (img-src 'self' https:, both public and /admin blocks, see
     * grav-chat-2026-07-18-user-folder-exposure-csp-htaccess.md) already
     * allows this without further Apache changes.
     */
    _flagIcon(code) {
        if (typeof code === 'string' && /^[A-Za-z]{2}$/.test(code)) {
            const lower = code.toLowerCase();
            return `<img class="bar-flag" src="https://flagcdn.com/${lower}.svg" alt="${this._esc(code.toUpperCase())}" loading="lazy" width="18" height="13">`;
        }
        return `<span class="bar-flag bar-flag-unknown" title="Unknown">${this._globeIcon()}</span>`;
    }

    _globeIcon() {
        return `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.2"></circle>
            <ellipse cx="8" cy="8" rx="3" ry="7" fill="none" stroke="currentColor" stroke-width="1.2"></ellipse>
            <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.2"></line>
        </svg>`;
    }

    /**
     * Small "open in new tab" glyph used in front of a route in the
     * "Recently viewed pages" table. Deliberately only this icon is
     * wrapped in the <a>, not the route text itself - a full-text link
     * would pick up the browser's default link color/underline, which
     * looks out of place next to plain-text table cells (route text stays
     * themed via .recent-page-route, see _styles()).
     */
    _externalLinkIcon() {
        return `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M6.5 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V9.5" fill="none" stroke="currentColor" stroke-width="1.3"></path>
            <path d="M9.5 2H14v4.5M14 2 7 9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>`;
    }

    /**
     * Small "trending up" glyph used as the Page/User Detail link icon in
     * "Recently viewed pages" and "Top users" - the same role the small
     * chart icon played next to each row in the classic-admin 1.7 widget.
     */
    _trendIcon() {
        return `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M2 12 6 7 9 9.5 14 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M10.5 3H14v3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>`;
    }

    _bars(items, key) {
        if (!items || !items.length) return `<div class="state">No data.</div>`;
        const max = Math.max(...items.map((i) => Number(i.hits) || 0), 1);
        return `<div class="bars">${items
            .map((i) => {
                const pct = Math.max(4, Math.round(((Number(i.hits) || 0) / max) * 100));
                const flag = key === 'country' ? this._flagIcon(i[key]) : '';
                return `
                    <div class="bar-row">
                        <span class="bar-label">${flag}${this._esc(String(i[key] || 'unknown'))}</span>
                        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
                        <span class="bar-value">${this._esc(String(i.hits))}${i.share !== undefined ? ` (${i.share}%)` : ''}</span>
                    </div>`;
            })
            .join('')}</div>`;
    }

    _table(headers, rows) {
        if (!rows.length) return `<div class="state">No data.</div>`;
        return `
            <table>
                <thead><tr>${headers.map((h) => `<th>${this._esc(h)}</th>`).join('')}</tr></thead>
                <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>`;
    }

    async _searchPage() {
        const route = this.shadowRoot.querySelector('.page-route').value.trim();
        const resultEl = this.shadowRoot.querySelector('.page-result');
        if (!route) return;
        resultEl.innerHTML = `<div class="state">Searching…</div>`;
        try {
            const data = await this._apiGet('/page-stats/pages/detail', { route, limit: 50 });
            resultEl.innerHTML = `
                <p>${data.hits} hits, ${data.visitors} unique visitors</p>
                ${this._table(
                    ['User', 'Date', 'Browser'],
                    (data.views || []).map((v) => [
                        this._userCellHtml({ user: v.user, ip: v.ip }),
                        `${this._esc(v.day || '')} ${this._esc(v.time || '')}`,
                        this._esc(v.browser || ''),
                    ])
                )}`;
            this._bindNavLinks(resultEl);
        } catch (err) {
            resultEl.innerHTML = `<div class="state error">${this._esc(err.message)}</div>`;
        }
    }

    async _searchUser() {
        const user = this.shadowRoot.querySelector('.user-name').value.trim();
        const resultEl = this.shadowRoot.querySelector('.user-result');
        if (!user) return;
        resultEl.innerHTML = `<div class="state">Searching…</div>`;
        try {
            const data = await this._apiGet('/page-stats/users/detail', { user, limit: 50 });
            resultEl.innerHTML = `
                <p>${data.hits} hits</p>
                ${this._table(
                    ['Route', 'Date'],
                    (data.views || []).map((v) => [this._pageCellHtml(v.route), `${this._esc(v.day || '')} ${this._esc(v.time || '')}`])
                )}`;
            this._bindNavLinks(resultEl);
        } catch (err) {
            resultEl.innerHTML = `<div class="state error">${this._esc(err.message)}</div>`;
        }
    }

    _esc(str) {
        const div = document.createElement('div');
        div.textContent = str ?? '';
        return div.innerHTML;
    }

    _styles() {
        return `
            :host { display: block; color: var(--foreground); font-family: inherit; padding-top: 16px; }
            .wrap { display: flex; flex-direction: column; gap: 16px; }
            .body { display: flex; flex-direction: column; gap: 16px; }
            .toolbar { display: flex; justify-content: space-between; align-items: center; }
            .range { display: flex; gap: 4px; }
            .range button, .refresh, .lookup-row button, .load-more-recent {
                background: var(--background);
                color: var(--foreground);
                border: 1px solid var(--border);
                border-radius: 6px;
                padding: 6px 12px;
                cursor: pointer;
                font-size: 13px;
            }
            .range button.active { background: var(--primary); color: var(--primary-foreground, #fff); border-color: var(--primary); }
            .toolbar-end { display: flex; align-items: center; gap: 10px; }
            .db-size { font-size: 12px; color: var(--muted-foreground); white-space: nowrap; }
            .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
            .chart-card { display: flex; flex-direction: column; }
            .chart-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
            .chart-head h3 { margin: 0; }
            .chart-total { font-size: 15px; font-weight: 700; }
            .line-chart { display: block; width: 100%; height: auto; }
            .grid-line { stroke: var(--border); stroke-width: 1; }
            .axis-label { font-size: 9px; fill: var(--muted-foreground); }
            .chart-area { fill: currentColor; opacity: 0.15; stroke: none; }
            .chart-line { fill: none; stroke: currentColor; stroke-width: 1.75; }
            .chart-dot { fill: currentColor; }
            .sparkline { width: 100%; height: 36px; margin-top: 10px; }
            .spark-area { fill: var(--primary); opacity: 0.12; }
            .spark-line { fill: none; stroke: var(--primary); stroke-width: 1.5; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
            .card { border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
            .card.wide { grid-column: 1 / -1; }
            .card h3 { margin: 0 0 10px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); }
            th { color: var(--muted-foreground); font-weight: 600; }
            .bars { display: flex; flex-direction: column; gap: 8px; }
            .bar-row { display: grid; grid-template-columns: 90px 1fr 70px; align-items: center; gap: 8px; font-size: 13px; }
            .bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .bar-flag { margin-right: 4px; }
            .bar-track { background: var(--border); border-radius: 4px; height: 8px; overflow: hidden; }
            .bar-fill { background: var(--primary); height: 100%; }
            .bar-value { text-align: right; color: var(--muted-foreground); }
            .recent-page-cell { display: inline-flex; align-items: center; gap: 6px; }
            .recent-page-link { color: var(--muted-foreground); display: inline-flex; text-decoration: none; }
            .recent-page-link:hover { color: var(--foreground); }
            .recent-page-route { color: var(--foreground); }
            .load-more-recent { display: block; margin-top: 12px; }
            .detail-header { display: flex; flex-direction: column; gap: 6px; margin-bottom: 4px; }
            .back-link { color: var(--muted-foreground); text-decoration: none; font-size: 13px; align-self: flex-start; }
            .back-link:hover { color: var(--foreground); }
            .detail-header h2 { margin: 0; font-size: 16px; font-weight: 600; word-break: break-all; }
            .state { color: var(--muted-foreground); font-size: 13px; padding: 8px 0; }
            .state.error { color: var(--destructive, #dc2626); }
            .lookup { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
            .lookup-box { border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
            .lookup-box h3 { margin: 0 0 10px; font-size: 14px; }
            .lookup-row { display: flex; gap: 8px; margin-bottom: 10px; }
            .lookup-row input {
                flex: 1;
                background: var(--background);
                color: var(--foreground);
                border: 1px solid var(--border);
                border-radius: 6px;
                padding: 6px 8px;
                font-size: 13px;
            }
        `;
    }
}

customElements.define(TAG, PageStatsPage);
