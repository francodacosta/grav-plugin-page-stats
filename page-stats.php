<?php

namespace Grav\Plugin;

use Composer\Autoload\ClassLoader;
use DateTimeImmutable;
use Grav\Common\Page\Page;
use Grav\Common\Plugin;
use RocketTheme\Toolbox\Event\Event;;

use Grav\Plugin\PageStats\Geolocation\Geolocation;
use Grav\Plugin\PageStats\Stats;
use Grav\Plugin\PageStats\Api\PageStatsApiController;
use RocketTheme\Toolbox\Event\EventSubscriberInterface;
use IP2Location\Database;

/**
 * Class PageStatsPlugin
 * @package Grav\Plugin
 */
class PageStatsPlugin extends Plugin
{
    // const GEO_DB = __DIR__ . '/data/geolocation.sqlite';
    const GEO_DB = __DIR__ . '/data/IP2LOCATION-LITE-DB3.BIN';

    const PATH_ADMIN_STATS = '/page-stats';
    const PATH_ADMIN_PAGE_DETAIL = '/page-details';
    const PATH_ADMIN_USER_DETAIL = '/user-details';
    const PATH_ADMIN_ALL_PAGES = '/all-pages';
    const PATH_ADMIN_TOP_COUNTRIES = '/top-countries';
    const PATH_ADMIN_TOP_BROWSERS = '/top-browsers';
    const PATH_ADMIN_TOP_PLATFORMS = '/top-platforms';
    const PATH_ADMIN_TOP_USERS = '/top-users';
    const PATH_EVENTS_COLLECTION = '/event-collection';
    const PATH_ADMIN_RECENTLY_VIEWED_PAGES = '/recently-viewed-pages';

    // Admin2 sidebar id / route / API prefix (see onApiSidebarItems,
    // onApiPluginPageInfo, onApiRegisterRoutes)
    const ADMIN2_PAGE_ID = 'page-stats';
    const ADMIN2_ROUTE = '/plugin/page-stats';
    const API_PREFIX = '/page-stats';

    /**
     * @return array
     *
     * The getSubscribedEvents() gives the core a list of events
     *     that the plugin wants to listen to. The key of each
     *     array section is the event that the plugin listens to
     *     and the value (in the form of an array) contains the
     *     callable (or function) as well as the priority. The
     *     higher the number the higher the priority.
     */
    public static function getSubscribedEvents(): array
    {
        return [
            'onPluginsInitialized' => [
                // Uncomment following line when plugin requires Grav < 1.7
                // ['autoload', 100000],
                ['onPluginsInitialized', 0]
            ],
            // Classic Admin (Grav < 2.0 / Admin plugin). No-op when the
            // classic Admin plugin isn't installed.
            'onAdminTwigTemplatePaths' => ['onAdminTwigTemplatePaths', 0],

            // Admin2 / grav-plugin-api (Grav 2.0+). No-op when the API
            // plugin isn't installed - Grav simply never fires these events.
            'onApiRegisterRoutes' => ['onApiRegisterRoutes', 0],
            'onApiSidebarItems' => ['onApiSidebarItems', 0],
            'onApiPluginPageInfo' => ['onApiPluginPageInfo', 0],
        ];
    }

    /**
     * Composer autoload
     *
     * @return ClassLoader
     */
    public function autoload(): ClassLoader
    {
        return require __DIR__ . '/vendor/autoload.php';
    }

    /**
     * Initialize the plugin
     */
    public function onPluginsInitialized(): void
    {

        // Don't proceed if we are in the admin plugin
        if ($this->isAdmin()) {
            $this->enable([
                'onAdminDashboard' => ['onAdminDashboard', 1000],
                'onAdminPage' => ['onAdminPage', 0],
                'onTwigSiteVariables' => ['onTwigAdminVariables', 0],

            ]);
            return;
        }

        // Enable the main events we are interested in
        $this->enable([
            'onPageInitialized' => ['onPageInitialized', 990],

        ]);
    }

    public function onAdminTwigTemplatePaths($event): void
    {
        $paths = $event['paths'];
        $paths[] = __DIR__ . '/themes/admin/templates';
        $event['paths'] = $paths;
    }

    function getUserIP(): ?string
    {
        // Get real visitor IP behind CloudFlare network
        if (isset($_SERVER["HTTP_CF_CONNECTING_IP"])) {
            $_SERVER['REMOTE_ADDR'] = $_SERVER["HTTP_CF_CONNECTING_IP"];
            $_SERVER['HTTP_CLIENT_IP'] = $_SERVER["HTTP_CF_CONNECTING_IP"];
        }
        $client  = $_SERVER['HTTP_CLIENT_IP'] ?? null;
        $forward = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null;
        // Not every request context has a real client IP (e.g. `bin/grav`
        // CLI commands such as page-system-validator, which still fire
        // onPageInitialized). REMOTE_ADDR is simply unset there.
        $remote  = $_SERVER['REMOTE_ADDR'] ?? null;

        if (filter_var($client, FILTER_VALIDATE_IP)) {
            $ip = $client;
        } elseif (filter_var($forward, FILTER_VALIDATE_IP)) {
            $ip = $forward;
        } else {
            $ip = $remote;
        }

        return $ip;
    }


    /**
     * returns the value for front matter property that controls processing of a page
     * or true otherwise.
     * We return true as the default behaviour is to be enabled for all pages
     *
     * eg:
     * page-stats:
     *      process: true
     *
     * @param array $headers
     * @return bool
     */
    private function isEnabledForPage(array $headers): bool
    {
        if (isset($headers['page-stats']['process'])) {
            return $headers['page-stats']['process'];
        }

        return true;
    }

    /**
     * returns false if IP (or regexp) are in the plugin config list
     *
     * @param string|null $ip
     * @return bool
     */
    private function isEnabledForIp(?string $ip): bool
    {
        if ($ip === null) {
            // No real client IP available (e.g. a CLI context like
            // `bin/grav page-system-validator`, which still fires
            // onPageInitialized) - nothing meaningful to log.
            return false;
        }

        $config  = $this->config();
        if (isset($config['ignored_ips']) && is_array($config['ignored_ips'])) {
            $ips = array_map(function ($a) {
                return isset($a['ip']) ? $a['ip'] : '';
            }, $config['ignored_ips']);

            $regexp = implode('|', $ips);

            return 0 === preg_match("/$regexp/", $ip);
        }


        return true;
    }

        /**
     * returns false if Url (or regexp) are in the plugin config list
     *
     * @param string $url
     * @return bool
     */
    private function isEnabledForUrl(string $url): bool
    {
        $config  = $this->config();


        if (isset($config['ignored_urls']) && is_array($config['ignored_urls'])) {

            if (count($config['ignored_urls']) === 0 ) {
                return true;
            }

            $urls = array_map(function ($a) {
                return isset($a['url']) ?  $a['url'] : '';
            }, $config['ignored_urls']);

            $regexp = implode('|', $urls);

            return 0 === preg_match("#$regexp#", $url);
        }


        return true;
    }


    /**
     * collecs stats about page data
     */
    private function collectPageData()
    {
        try {
            $config  = $this->config();
            $collectorRoute =  self::PATH_ADMIN_STATS . self::PATH_EVENTS_COLLECTION;

            $page = $this->grav['page'];
            $ip = $this->getUserIP();
            $geo = (new Geolocation(new Database(self::GEO_DB)))->locate($ip);
            $uri = $this->grav['uri']->uri(false);
            $user = $this->grav['user'];
            $now = new DateTimeImmutable();
            $browser = $this->grav['browser'];
            $dbPath = $config['db'];

            if ($config['anonymize_ips']) {
                if (str_contains($ip, ':')) {
                    // IPv6 (truncate after second ':', i.e. after 4 bytes)
                    $ip = substr($ip, 0, strpos($ip, ':', strpos($ip, ':')+1)) . '::0';
                } else {
                    // IPv4 (truncate after second '.', i.e. after 2 bytes)
                    $ip = substr($ip, 0, strpos($ip, '.', strpos($ip, '.')+1)) . '.0.0';
                }
            }

            $stats = new Stats($dbPath, $this->config());

            $sessionId = $stats->collect($ip, $geo, $page, $uri, $user, $now, $browser);

            if ($config['log_time_on_page']) {
                $vars = json_encode([
                    'sid' => $sessionId,
                    'url' => $collectorRoute,
                    'config' => [
                        'ping' => $config["collector_ping_interval"],
                    ]
                ]);

                $this->grav['assets']->addInlineJs('var pageStats = ' . $vars, ['position' => 'before']);
                $this->grav['assets']->addJs('plugins://page-stats/js/ps.js', []);
            }
        } catch (\Throwable $e) {
            error_log($e->getmessage());
            $this->grav['log']->addDebug('IP : ' . $ip);

            $this->grav['log']->addError('PageStats plugin : ' . $e->getMessage() . ' - File: ' . $e->getFile() . ' - Line: ' . $e->getLine() . ' - Trace: ' . $e->getTraceAsString());
            // $this->grav['log']->addDebug('GEO DB : ' . self::GEO_DB);
            // $this->grav['log']->addDebug('STATS DB : ' . $dbPath);

            if (false === $config['ignore_errors']) {
                throw $e;
            }
        }
    }

    /**
     * Collect event data passed to us by front end
     */
    private function collectEventData(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) {
            exit;
        }

        if (!isset($data['session_id'])) {
            echo 'sid';
            http_response_code(400);
            exit();
        }

        if (!isset($data['event'])) {
            echo 'event';
            http_response_code(400);
            exit();
        }
        if (!isset($data['value'])) {
            echo 'value';
            http_response_code(400);
            exit();
        }

        $config  = $this->config();
        $dbPath = $config['db'];


        $stats = new Stats($dbPath, $this->config());
        $stats->collectEvent($data['session_id'], $data['event'], $data['value']);

        exit();
    }

    public function onPageInitialized()
    {
        $uri = $this->grav['uri'];

        $collectorRoute =  self::PATH_ADMIN_STATS . self::PATH_EVENTS_COLLECTION;


        $page = $this->grav['page'];
        if (false === $this->isEnabledForPage((array)$page->header())) {
            return;
        }

        $ip = $this->getUserIP();
        if (false === $this->isEnabledForIp($ip)) {
            return;
        }

        $url = (string) $uri;
        if (false === $this->isEnabledForUrl($url)) {
            return;
        }


        switch ($uri->path()) {
            case $collectorRoute:
                $this->collectEventData();
                break;
            default:
                $this->collectPageData();
                break;
        }
    }


    public function onAdminDashboard()
    {
        $twig = $this->grav['twig'];

        // Dashboard
        $twig->plugins_hooked_nav['PLUGIN_PAGE_STATS.PAGE_STATS'] = [
            'route' => 'page-stats',
            'icon' => 'fa-line-chart',
            'authorize' => ['admin.login', 'admin.super'],
            'priority' => 900
        ];
    }

    public function onTwigAdminVariables(): void
    {
        $uri = $this->grav['uri'];
        $config = $this->config();
        $dbPath = $config['db'];

        $routes = $this->getPluginRoutes();

        if (in_array($uri->path(), $routes)) {
            $this->grav['twig']->twig_vars['pageStats'] = [
                'db' =>  new Stats($dbPath, $this->config()),
                'urls' => $this->getPluginRoutes(),
            ];
        }
    }

    private function getPluginRoutes(): array
    {
        $config = $this->config();

        $adminHomeRule = rtrim($this->config->get('plugins.admin.route'), '/');
        $dashboardRoute = $adminHomeRule . '/dashboard';
        $adminRoute = $adminHomeRule . self::PATH_ADMIN_STATS;
        $pageStatsRoute = $adminRoute;
        $pageDetailsRoute = $adminRoute . self::PATH_ADMIN_PAGE_DETAIL;
        $userDetailsRoute = $adminRoute . self::PATH_ADMIN_USER_DETAIL;
        $allPagesRoute = $adminRoute . self::PATH_ADMIN_ALL_PAGES;
        $topCountriesRoute = $adminRoute . self::PATH_ADMIN_TOP_COUNTRIES;
        $topBrowsersRoute = $adminRoute . self::PATH_ADMIN_TOP_BROWSERS;
        $topPlatformsRoute = $adminRoute . self::PATH_ADMIN_TOP_PLATFORMS;
        $topUsersRoute = $adminRoute . self::PATH_ADMIN_TOP_USERS;
        $recentlyedViewdPagesRoute = $adminRoute . self::PATH_ADMIN_RECENTLY_VIEWED_PAGES;

        return [
            'adminHome' => $adminHomeRule,
            'dashboard' => $dashboardRoute,
            'base' => $pageStatsRoute,
            'pageDetails' =>  $pageDetailsRoute,
            'userDetails' => $userDetailsRoute,
            'allPages' => $allPagesRoute,
            'topCountries' => $topCountriesRoute,
            'topBrowsers' => $topBrowsersRoute,
            'topPlatforms' => $topPlatformsRoute,
            'topUsers' => $topUsersRoute,
            'recentlyedViewdPages' => $recentlyedViewdPagesRoute,
        ];
    }

    public function onAdminPage(Event $event)
    {
        $uri = $this->grav['uri'];
        $routes = $this->getPluginRoutes();
        $page = new Page;

        switch ($uri->path()) {
            case $routes['base']:
                $page = $event['page'];
                $page->init(new \SplFileInfo(__DIR__ . '/pages/stats.md'));
                break;

            case $routes['pageDetails']:
                $page = $event['page'];
                $page->init(new \SplFileInfo(__DIR__ . '/pages/page-details.md'));
                break;

            case $routes['userDetails']:
                $page = $event['page'];
                $page->init(new \SplFileInfo(__DIR__ . '/pages/user-details.md'));
                break;

            case $routes['allPages']:
                $page = $event['page'];
                $page->init(new \SplFileInfo(__DIR__ . '/pages/all-pages.md'));
                break;

            case $routes['topCountries']:
                $page = $event['page'];
                $page->init(new \SplFileInfo(__DIR__ . '/pages/top-countries.md'));
                break;

            case $routes['topBrowsers']:
                $page = $event['page'];
                $page->init(new \SplFileInfo(__DIR__ . '/pages/top-browsers.md'));
                break;

            case $routes['topPlatforms']:
                $page = $event['page'];
                $page->init(new \SplFileInfo(__DIR__ . '/pages/top-platforms.md'));
                break;

            case $routes['topUsers']:
                $page = $event['page'];
                $page->init(new \SplFileInfo(__DIR__ . '/pages/top-users.md'));
                break;

            case $routes['recentlyedViewdPages']:
                $page = $event['page'];
                $page->init(new \SplFileInfo(__DIR__ . '/pages/recently-viewed-pages.md'));
                break;
        }
    }

    /**
     * Admin2 / grav-plugin-api: registers the REST endpoints consumed by the
     * Admin2 dashboard page (admin-next/pages/page-stats.js). Fired by the
     * API plugin's router; never fired if the API plugin isn't installed.
     */
    public function onApiRegisterRoutes(Event $event): void
    {
        $routes = $event['routes'];
        $controller = PageStatsApiController::class;

        $routes->group(self::API_PREFIX, function ($group) use ($controller) {
            $group->get('/overview', [$controller, 'overview']);
            $group->get('/summary', [$controller, 'summary']);
            $group->get('/pages', [$controller, 'pages']);
            $group->get('/pages/detail', [$controller, 'pageDetail']);
            $group->get('/countries', [$controller, 'countries']);
            $group->get('/browsers', [$controller, 'browsers']);
            $group->get('/platforms', [$controller, 'platforms']);
            $group->get('/users', [$controller, 'users']);
            $group->get('/users/detail', [$controller, 'userDetail']);
            $group->get('/recent', [$controller, 'recent']);
        });
    }

    /**
     * Admin2: adds the "Page Stats" entry to the Admin2 sidebar.
     */
    public function onApiSidebarItems(Event $event): void
    {
        $items = $event['items'] ?? [];
        $items[] = [
            'id' => self::ADMIN2_PAGE_ID,
            'plugin' => 'page-stats',
            'label' => $this->grav['language']->translate('PLUGIN_PAGE_STATS.PAGE_STATS'),
            'icon' => 'fa-line-chart',
            'route' => self::ADMIN2_ROUTE,
            'authorize' => ['admin.login', 'admin.super'],
            'priority' => 10,
        ];
        $event['items'] = $items;
    }

    /**
     * Admin2: declares the "Page Stats" page as a component-mode page,
     * rendered by admin-next/pages/page-stats.js.
     */
    public function onApiPluginPageInfo(Event $event): void
    {
        if ($event['plugin'] !== 'page-stats') {
            return;
        }

        $event['definition'] = [
            'id' => self::ADMIN2_PAGE_ID,
            'plugin' => 'page-stats',
            'title' => $this->grav['language']->translate('PLUGIN_PAGE_STATS.PAGE_STATS'),
            'icon' => 'fa-line-chart',
            'page_type' => 'component',
            'actions' => [],
        ];
    }
}
