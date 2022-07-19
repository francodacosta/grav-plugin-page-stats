<?php

declare(strict_types=1);

namespace Grav\Plugin\PageStats\Geolocation;

use \PDO;
use Grav\Plugin\PageStats\Geolocation\GeolocationData;

class Geolocation
{

    private $db;

    public function __construct($dbPath)
    {
        $migrate = !file_exists($dbPath);

        if ($migrate) {
            $zip = new \ZipArchive;
            $res = $zip->open($dbPath . '.zip');
            if ($res === TRUE) {
                // extract it to the path we determined above
                $zip->extractTo(dirname($dbPath));
                $zip->close();
            }
        }

        $this->db  = new PDO(
            'sqlite:' . $dbPath,
            null,
            null,
            []
        );
    }

    public function locate($ip): GeolocationData
    {
        // $ipNum = (int) Ip::toNumber('51.7.60.155');
        $ipNum = Ip::toNumber($ip);

        $s = $this->db->query('
                SELECT * FROM geolocation
                WHERE '. $ipNum .' between ip_from AND ip_to 
                LIMIT 1
        ');

        if (!$s) {
            $msg = implode("\n| ", $this->db->errorInfo());
            throw new \RuntimeException($msg);
        }

        $result = $s->fetch();
        if (!$result) {
            $msg = implode("\n| ", $this->db->errorInfo());
            throw new \RuntimeException($msg);
        }
        return new GeolocationData(
            $result['country_code'] ?? 'unkown',
            $result['country_name'] ?? 'unkown',
            $result['region'] ?? 'unkown',
            $result['city'] ?? 'unkown'
        );
    }
}
