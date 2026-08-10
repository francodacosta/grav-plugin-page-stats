<?php

declare(strict_types=1);

namespace Grav\Plugin\PageStats\Api;

use DateTimeImmutable;
use Grav\Common\Grav;
use Grav\Plugin\Api\Controllers\AbstractApiController;
use Grav\Plugin\Api\Exceptions\ValidationException;
use Grav\Plugin\Api\Response\ApiResponse;
use Grav\Plugin\PageStats\Stats;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Exposes the Page Stats data layer (classes/Stats.php) as a set of read-only
 * REST endpoints consumed by the Admin2 (grav-plugin-admin2) dashboard page
 * shipped in admin-next/pages/page-stats.js.
 *
 * The stored/collected data itself is untouched - this class is purely a
 * presentation-layer bridge between the existing Stats class and the new
 * Grav 2.0 API/Admin2 architecture, which replaced the classic Admin's
 * onAdminDashboard / onAdminPage / plugins_hooked_nav mechanism used by
 * versions of this plugin prior to 2.8.
 */
class PageStatsApiController extends AbstractApiController
{
    private const READ_PERMISSION = 'api.system.read';

    /**
     * GET /page-stats/overview
     *
     * Compact summary used to populate the dashboard's KPI cards and
     * "top N" widgets in a single request.
     */
    public function overview(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, self::READ_PERMISSION);

        [$dateFrom, $dateTo] = $this->getDateRange($request);
        $stats = $this->getStats();

        $totalViews = $stats->totalPageViews($dateFrom, $dateTo);
        $totalVisitors = $stats->totalUniqueVisitors($dateFrom, $dateTo);
        $totalUsers = $stats->totalUniqueUsers($dateFrom, $dateTo);

        return ApiResponse::create([
            'db' => $stats->dbStats(),
            'total_page_views' => (int) ($totalViews[0]['hits'] ?? 0),
            'total_unique_visitors' => (int) ($totalVisitors[0]['visitors'] ?? 0),
            'total_unique_users' => (int) ($totalUsers[0]['users'] ?? 0),
            'top_pages' => $stats->pagesSummary(5, $dateFrom, $dateTo),
            'top_countries' => $stats->topCountries(5, $dateFrom, $dateTo),
            'top_browsers' => $stats->topBrowsers(5, $dateFrom, $dateTo),
            'top_platforms' => $stats->topPlatforms(5, $dateFrom, $dateTo),
            'top_users' => $stats->topUsers(5, $dateFrom, $dateTo),
            'recent_pages' => $stats->recentPages(10, $dateFrom, $dateTo),
        ]);
    }

    /**
     * GET /page-stats/pages
     */
    public function pages(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, self::READ_PERMISSION);

        [$dateFrom, $dateTo] = $this->getDateRange($request);
        $limit = $this->getLimit($request, 50);

        return ApiResponse::create([
            'pages' => $this->getStats()->pagesSummary($limit, $dateFrom, $dateTo),
        ]);
    }

    /**
     * GET /page-stats/pages/detail?route=/some/route
     */
    public function pageDetail(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, self::READ_PERMISSION);

        $route = $this->getQueryParam($request, 'route');
        if (!$route) {
            throw new ValidationException('A "route" query parameter is required.', [
                ['field' => 'route', 'message' => 'This field is required.'],
            ]);
        }

        [$dateFrom, $dateTo] = $this->getDateRange($request);
        $limit = $this->getLimit($request, 100);

        $views = $this->getStats()->recentPages($limit, $dateFrom, $dateTo, ['route' => $route]);

        return ApiResponse::create([
            'route' => $route,
            'hits' => count($views),
            'visitors' => count(array_unique(array_column($views, 'ip'))),
            'views' => $views,
        ]);
    }

    /**
     * GET /page-stats/countries
     */
    public function countries(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, self::READ_PERMISSION);

        [$dateFrom, $dateTo] = $this->getDateRange($request);
        $limit = $this->getLimit($request, 50);

        return ApiResponse::create([
            'countries' => $this->getStats()->topCountries($limit, $dateFrom, $dateTo),
        ]);
    }

    /**
     * GET /page-stats/browsers
     */
    public function browsers(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, self::READ_PERMISSION);

        [$dateFrom, $dateTo] = $this->getDateRange($request);
        $limit = $this->getLimit($request, 50);

        return ApiResponse::create([
            'browsers' => $this->getStats()->topBrowsers($limit, $dateFrom, $dateTo),
        ]);
    }

    /**
     * GET /page-stats/platforms
     */
    public function platforms(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, self::READ_PERMISSION);

        [$dateFrom, $dateTo] = $this->getDateRange($request);
        $limit = $this->getLimit($request, 50);

        return ApiResponse::create([
            'platforms' => $this->getStats()->topPlatforms($limit, $dateFrom, $dateTo),
        ]);
    }

    /**
     * GET /page-stats/users
     */
    public function users(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, self::READ_PERMISSION);

        [$dateFrom, $dateTo] = $this->getDateRange($request);
        $limit = $this->getLimit($request, 50);

        return ApiResponse::create([
            'users' => $this->getStats()->topUsers($limit, $dateFrom, $dateTo),
        ]);
    }

    /**
     * GET /page-stats/users/detail?user=someuser
     */
    public function userDetail(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, self::READ_PERMISSION);

        $user = $this->getQueryParam($request, 'user');
        if (!$user) {
            throw new ValidationException('A "user" query parameter is required.', [
                ['field' => 'user', 'message' => 'This field is required.'],
            ]);
        }

        [$dateFrom, $dateTo] = $this->getDateRange($request);
        $limit = $this->getLimit($request, 100);

        $views = $this->getStats()->recentPages($limit, $dateFrom, $dateTo, ['user' => $user]);

        return ApiResponse::create([
            'user' => $user,
            'hits' => count($views),
            'views' => $views,
        ]);
    }

    /**
     * GET /page-stats/recent
     */
    public function recent(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, self::READ_PERMISSION);

        [$dateFrom, $dateTo] = $this->getDateRange($request);
        $limit = $this->getLimit($request, 50);

        return ApiResponse::create([
            'by_day' => $this->getStats()->recentPagesByDay($limit, $dateFrom, $dateTo),
        ]);
    }

    /**
     * GET /page-stats/summary
     *
     * Time series data (hits/visitors/users per day) used to draw the trend
     * chart on the dashboard.
     */
    public function summary(ServerRequestInterface $request): ResponseInterface
    {
        $this->requirePermission($request, self::READ_PERMISSION);

        [$dateFrom, $dateTo] = $this->getDateRange($request);

        return ApiResponse::create($this->getStats()->siteSummary($dateFrom, $dateTo));
    }

    private function getStats(): Stats
    {
        $grav = Grav::instance();
        $config = (array) $grav['config']->get('plugins.page-stats');

        return new Stats($config['db'], $config);
    }

    private function getLimit(ServerRequestInterface $request, int $default): int
    {
        $limit = $this->getQueryParam($request, 'limit');

        return $limit !== null && (int) $limit > 0 ? (int) $limit : $default;
    }

    /**
     * @return array{0: ?DateTimeImmutable, 1: ?DateTimeImmutable}
     */
    private function getDateRange(ServerRequestInterface $request): array
    {
        $from = $this->getQueryParam($request, 'date_from');
        $to = $this->getQueryParam($request, 'date_to');

        try {
            $dateFrom = $from ? new DateTimeImmutable($from) : null;
            $dateTo = $to ? new DateTimeImmutable($to) : null;
        } catch (\Throwable $e) {
            $dateFrom = null;
            $dateTo = null;
        }

        return [$dateFrom, $dateTo];
    }

    private function getQueryParam(ServerRequestInterface $request, string $name): ?string
    {
        $params = $request->getQueryParams();

        return isset($params[$name]) && $params[$name] !== '' ? (string) $params[$name] : null;
    }
}
