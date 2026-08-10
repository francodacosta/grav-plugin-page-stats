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
 */
class PageStatsPage extends HTMLElement {
    #range = '30';
    #overview = null;
    #loading = false;

    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this._render();
        this._load();
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

    _dateRangeParams() {
        if (this.#range === 'all') return {};
        const days = parseInt(this.#range, 10);
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - days);
        return {
            date_from: from.toISOString(),
            date_to: to.toISOString(),
        };
    }

    async _load() {
        this.#loading = true;
        this._renderBody();
        try {
            this.#overview = await this._apiGet('/page-stats/overview', this._dateRangeParams());
        } catch (err) {
            this.#overview = null;
            this._error = err.message;
            window.__GRAV_TOAST?.error(err.message || 'Could not load page stats');
        } finally {
            this.#loading = false;
            this._renderBody();
        }
    }

    _render() {
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
                    <button class="refresh" title="Refresh">&#8635; Refresh</button>
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

        body.innerHTML = `
            <div class="kpis">
                ${this._kpi('Page views', o.total_page_views)}
                ${this._kpi('Unique visitors', o.total_unique_visitors)}
                ${this._kpi('Unique users', o.total_unique_users)}
                ${this._kpi('Database size', `${o.db?.mb ?? 0} MB`)}
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
                        (o.top_users || []).map((u) => [this._esc(u.user || '(anonymous)'), u.hits])
                    )}
                </div>

                <div class="card wide">
                    <h3>Recently viewed pages</h3>
                    ${this._table(
                        ['Route', 'User', 'Date'],
                        (o.recent_pages || []).map((r) => [
                            this._esc(r.route),
                            this._esc(r.user || '(anonymous)'),
                            `${this._esc(r.day || '')} ${this._esc(r.time || '')}`,
                        ])
                    )}
                </div>
            </div>
        `;
    }

    _kpi(label, value) {
        return `<div class="kpi"><div class="kpi-value">${this._esc(String(value ?? '0'))}</div><div class="kpi-label">${this._esc(label)}</div></div>`;
    }

    _bars(items, key) {
        if (!items || !items.length) return `<div class="state">No data.</div>`;
        const max = Math.max(...items.map((i) => Number(i.hits) || 0), 1);
        return `<div class="bars">${items
            .map((i) => {
                const pct = Math.max(4, Math.round(((Number(i.hits) || 0) / max) * 100));
                return `
                    <div class="bar-row">
                        <span class="bar-label">${this._esc(String(i[key] || 'unknown'))}</span>
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
                        this._esc(v.user || '(anonymous)'),
                        `${this._esc(v.day || '')} ${this._esc(v.time || '')}`,
                        this._esc(v.browser || ''),
                    ])
                )}`;
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
                    (data.views || []).map((v) => [this._esc(v.route || ''), `${this._esc(v.day || '')} ${this._esc(v.time || '')}`])
                )}`;
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
            :host { display: block; color: var(--foreground); font-family: inherit; }
            .wrap { display: flex; flex-direction: column; gap: 16px; }
            .toolbar { display: flex; justify-content: space-between; align-items: center; }
            .range { display: flex; gap: 4px; }
            .range button, .refresh, .lookup-row button {
                background: var(--background);
                color: var(--foreground);
                border: 1px solid var(--border);
                border-radius: 6px;
                padding: 6px 12px;
                cursor: pointer;
                font-size: 13px;
            }
            .range button.active { background: var(--primary); color: var(--primary-foreground, #fff); border-color: var(--primary); }
            .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
            .kpi { border: 1px solid var(--border); border-radius: 8px; padding: 14px; text-align: center; }
            .kpi-value { font-size: 22px; font-weight: 700; }
            .kpi-label { font-size: 12px; color: var(--muted-foreground); margin-top: 4px; }
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
            .bar-track { background: var(--border); border-radius: 4px; height: 8px; overflow: hidden; }
            .bar-fill { background: var(--primary); height: 100%; }
            .bar-value { text-align: right; color: var(--muted-foreground); }
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
