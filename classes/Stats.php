<?php

declare(strict_types=1);

namespace Grav\Plugin\PageStats;

use DateTimeImmutable;
use Grav\Common\Browser;
use Grav\Common\Page\Interfaces\PageInterface;
use Grav\Common\Page\Page;
use Grav\Common\User\Interfaces\UserInterface;
use Grav\Plugin\PageStats\Geolocation\GeolocationData;
use \PDO;

class Stats
{
    private $db;
    private $dbPath;
    private $config;
    private $botRegExp = '';

    const FORCE_MIGRATION_FLAG = '/../data/migrations/MUST_MIGRATE';

    public function __construct($dbPath, $config)
    {
        $this->config = $config;
        $this->botRegExp = implode('|', $this->config['bot_regexp']);

        $this->dbPath = new \SplFileInfo($dbPath);
        $migrate = !$this->dbPath->isWritable() || file_exists(__DIR__ . self::FORCE_MIGRATION_FLAG);
        $this->db  = new PDO(
            'sqlite:' . $dbPath,
            null,
            null,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );


        if ($migrate) {
            $this->migrate();
        }
    }

    private function getUserAgent()
    {
        if (array_key_exists('HTTP_USER_AGENT', $_SERVER)) {
            return $_SERVER['HTTP_USER_AGENT'];
        }

        return '';
    }

    /**
     * executes a db migration by running the <int>.sql files not executted yet
     */
    public function migrate()
    {
        $version = 0;
        try {
            $q = 'SELECT version FROM migrations ORDER BY id Desc LIMIT 1';

            $q = $this->query($q);

            if ($q) {
                $version = $q[0]['version'];
            }
        } catch (\Throwable $e) {
            $version = 0;
        }

        error_log("==> page-stats:last-migration " . $version);

        while (true) {
            $version++;
            $file = new \SplFileInfo(__DIR__ . '/../data/migrations/' . $version . '.sql');
            error_log("==> page-stats:migrate " . $file->getBasename());
            if (!$file->isFile()) {
                break;
            }
            $contents = file_get_contents((string) $file);
            $this->db->exec($contents);
            $this->db->exec('INSERT INTO migrations (version) VALUES(' . $version . ');');
        }

        unlink(__DIR__ . self::FORCE_MIGRATION_FLAG);
    }

    /**
     * tries to detect if an user agent belongs to a bot
     */
    private function isBot()
    {

        return preg_match('/'. $this->botRegExp .'/i', $this->getUserAgent());
    }

    /**
     * Database statistics
     * currently file path and size
     */
    public function dbStats()
    {
        return [
            'mb' => round($this->dbPath->getSize() / 1024 / 1024, 1),
            'path' => (string) $this->dbPath,
        ];
    }

    /**
     * collects stats about a page event
     */
    public function collectEvent(string $sid, string $name, string $value): void
    {
        $s = $this->db->prepare('
            INSERT INTO events
                ("session_id", "event", "value")
            VALUES
                (:session_id, :event, :value)
        ');

        $s->bindValue(':session_id', $sid);
        $s->bindValue(':event', $name);
        $s->bindValue(':value', $value);

        $s->execute();
    }

    /**
     * save stats into db.
     * It returns the last inserted id on the table, this can be used and a FK for logging events for that session
     *
     * @returns string "0" on error or the last insert id otherwise
     */
    public function collect(string $ip, GeolocationData $geo, PageInterface $page, $uri,  UserInterface $user, DateTimeImmutable $date, Browser $browser): string
    {
        if ($this->isBot()) {
            if (false === $this->config['log_bot']) {
                error_log('Bot detected and we are configured to not log bot activiy');
                return "0";
            }
        }

        if ($this->config['log_admin'] == false &&  $user->authorize('admin.login')) {
            error_log('=====>> Admin user detected, we are configured not to log admin activity.');
            return "0";
        }

        $s = $this->db->prepare('
            INSERT INTO data
                ("ip", "country", "city", "region", "route", "page_title", "user", "date", "user_agent", "is_bot", "browser", "browser_version", "platform", "referer")
             VALUES
                (:ip, :country, :city, :region, :route, :title, :user, :date, :user_agent, :is_bot, :browser, :browser_version, :platform, :referer)
        ');


        if ('notfound' == $page->template()) {
            $pageTitle = (string) $uri;
        }
        $s->bindValue(':ip', $ip);
        $s->bindValue(':country', $geo->countryCode());
        $s->bindValue(':city', $geo->city());
        $s->bindValue(':region', $geo->region());
        $s->bindValue(':route', (string) $uri);
        $s->bindValue(':title', $pageTitle ?? $page->title());
        $s->bindValue(':user', $user->username);
        $s->bindValue(':date', $date->format('c'));
        $s->bindValue(':user_agent', $this->getUserAgent());
        $s->bindValue(':is_bot', $this->isBot());
        $s->bindValue(':browser', $browser->getBrowser());
        $s->bindValue(':browser_version', $browser->getVersion());
        $s->bindValue(':platform', $browser->getPlatform());
        $s->bindValue(':referer', $_SERVER['HTTP_REFERER']??'');

        $s->execute();

        return $this->db->lastInsertId();
    }

    private function query(string $q, array $params = [], ?int $limit = null, ?DateTimeImmutable $dateFrom = null, ?DateTimeImmutable $dateTo = null)
    {
        $where = [];
        if ($dateFrom && $dateTo) {
            $where[] = ' date BETWEEN :date_from AND :dateTo';
            $params['date_from'] = $dateFrom;
            $params['date_to'] = $dateTo;
        }

        foreach ($params as $key => $value) {
            $where[] = "$key = :$key";
        }

        if (count($where)) {
            $q =  str_replace('%where', ' WHERE ' . implode(' AND ', $where), $q);
        } else {
            $q = str_replace('%where', '', $q);
        }

        if ($limit && (int) $limit > 0) {
            $q .= ' LIMIT :limit';
            $params['limit'] = $limit;
        }

        $s = $this->db->prepare($q);

        foreach ($params as $key => $value) {
            $s->bindValue(':' . $key, $value);
        }


        $s->execute();

        return $s->fetchAll(PDO::FETCH_ASSOC);
    }


    /**
     * gets most viewed pages
     */
    public function pagesSummary(int $limit = 10, ?DateTimeImmutable $dateFrom = null, ?DateTimeImmutable $dateTo = null)
    {
        $q = 'SELECT route, page_title, count(route) as hits, count(distinct ip) as visitors, count(distinct user) as users FROM data GROUP BY page_title ORDER BY hits DESC';

        return $this->query($q, [], $limit, $dateFrom, $dateTo);
    }

    /**
     * returns the users with the most page views
     */
    public function topUsers(int $limit = 10, ?DateTimeImmutable $dateFrom = null, ?DateTimeImmutable $dateTo = null, array $params = [])
    {
        $q = '/* top users */ select user, count(route) as hits from data %where group by user order by hits desc';


        return $this->query($q, $params, $limit, $dateFrom, $dateTo);
    }

    /**
     * returns the countries with the most page views
     */
    public function topCountries(int $limit = 10, ?DateTimeImmutable $dateFrom = null, ?DateTimeImmutable $dateTo = null, array $params = [])
    {

        $totalPages = $this->totalPageViews($dateFrom, $dateTo, $params)[0]['hits'];

        $q = 'select country, count(country) as hits from data %where group by country order by hits desc';

        $countries = $this->query($q, $params, $limit, $dateFrom, $dateTo);


        $result = [];
        foreach ($countries as  $country) {
            if (empty($country['country'])) {
                $country['country'] = 'unknown';
            }
            $result[] = [
                'country' => $country['country'],
                'hits' => $country['hits'],
                'share' => round($country['hits'] * 100 / $totalPages, 2)
            ];
        }

        return $result;
    }


    /**
     * returns the total page views
     */
    public function totalPageViews(?DateTimeImmutable $dateFrom = null, ?DateTimeImmutable $dateTo = null, array $params = [])
    {
        $q = 'select count(route) as hits from data %where';

        return $this->query($q, $params, null, $dateFrom, $dateTo);
    }

    /**
     * returns the browsers with the most pageviews
     */
    public function topBrowsers(int $limit = 10, ?DateTimeImmutable $dateFrom = null, ?DateTimeImmutable $dateTo = null, array $params = [])
    {
        $totalPages = $this->totalPageViews($dateFrom, $dateTo, $params)[0]['hits'];

        $q = 'select browser, count(ip) as hits from data %where group by browser order by hits desc';

        $browsers = $this->query($q, $params, $limit, $dateFrom, $dateTo);


        $result = [];
        foreach ($browsers as  $browser) {
            if (empty($browser['browser'])) {
                $browser['browser'] = 'unknown';
            }
            $result[] = [
                'browser' => $browser['browser'],
                'hits' => $browser['hits'],
                'share' => round($browser['hits'] * 100 / $totalPages, 2)
            ];
        }

        return $result;
    }

    /**
     * returns the platforms/os with the most pageviews
     */
    public function topPlatforms(int $limit = 10, ?DateTimeImmutable $dateFrom = null, ?DateTimeImmutable $dateTo = null, array $params = [])
    {
        $totalPages = $this->totalPageViews($dateFrom, $dateTo, $params)[0]['hits'];

        $q = 'select platform, count(ip) as hits from data %where group by platform order by hits desc';

        $platforms = $this->query($q, $params, $limit, $dateFrom, $dateTo);


        $result = [];
        foreach ($platforms as  $platform) {
            if (empty($platform['platform'])) {
                $platform['platform'] = 'unknown';
            }
            $result[] = [
                'platform' => $platform['platform'],
                'hits' => $platform['hits'],
                'share' => round($platform['hits'] * 100 / $totalPages, 2)
            ];
        }

        return $result;
    }

    /**
     * returns the most recently viewed pages
     */
    public function recentPages(int $limit = 10, ?DateTimeImmutable $dateFrom = null, ?DateTimeImmutable $dateTo = null, array $params = [])
    {
        // $q = 'SELECT route, page_title, count(route) as hits, date FROM data GROUP BY route ORDER BY date DESC';
        $q = 'SELECT *, date(data.date) as day, time(data.date) as time  FROM data %where ORDER BY date DESC';

        return $this->query($q, $params, $limit, $dateFrom, $dateTo);
    }

    /**
     * returns recently viewd pages groupes by day
     */
    public function recentPagesByDay(int $limit = 10, ?DateTimeImmutable $dateFrom = null, ?DateTimeImmutable $dateTo = null, array $params = [])
    {
        $pages = $this->recentPages($limit, $dateFrom, $dateTo, $params);

        $result = [];
        foreach ($pages as $p) {
            if (!array_key_exists($p['day'], $result)) {
                $result[$p['day']] = [];
            }
            $result[$p['day']][] = $p;
        }

        return $result;
    }

    /**
     * returns the  statistics used for the charts
     */
    public function siteSummary(?DateTimeImmutable $dateFrom = null, ?DateTimeImmutable $dateTo = null, array $params = [])
    {
        $hits = $this->query('SELECT date(date) as date, route, page_title, count(route) as hits FROM data %where GROUP BY date(date)', $params, $dateFrom, $dateTo);
        $visitors = $this->query('SELECT date(date) as date, route, page_title, ip, count(distinct ip) as hits FROM data %where GROUP BY date(date)',  $params, $dateFrom, $dateTo);
        $users = $this->query('SELECT date(date) as date, route, page_title, ip, count(distinct user) as hits FROM data %where GROUP BY date(date)',  $params, $dateFrom, $dateTo);

        return [
            'hits' => $hits,
            'visitors' => $visitors,
            'users' => $users,
        ];
    }


    public function timeOnPage(?string $sid)
    {
        if (!$sid) {
            return;
        }
        $params = [
            'session_id' => $sid,
            'event' => 'ping',
        ];

        return $this->query('select min(date) as start, max(date) as end, ROUND((JULIANDAY(max(date)) - JULIANDAY(min(date))) * 86400) AS seconds from events %where', $params)[0];
    }
}
