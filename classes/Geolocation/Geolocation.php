<?php

declare(strict_types=1);

namespace Grav\Plugin\PageStats\Geolocation;

use \PDO;
use Grav\Plugin\PageStats\Geolocation\GeolocationData;
use IP2Location\Database;

class Geolocation
{

    private $db;

    public function __construct(Database $db)
    {
              $this->db  = $db;
    }

    /*
     * returns GeoLocation data for the passed ip
     *
     * @param string $ip
     * @return GeolocationData
     */
    public function locate($ip): GeolocationData
    {
        try {
            $result = $this->db->lookup($ip);
        } catch (\Throwable $e) {
            error_log('could not locate ip ' . $ip . ' because of ' . $e->getMessage());
        }

        return new GeolocationData(
            $result['countryCode'] ?? 'unknown',
            $result['countryName'] ?? 'unknown',
            $result['regionName'] ?? 'unknown',
            $result['cityName'] ?? 'unknown'
        );
    }
}
