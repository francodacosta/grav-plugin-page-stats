<?php

declare(strict_types=1);

namespace Grav\Plugin\PageStats\Geolocation;

class Ip
{
    /**
     * converts an IPv4 Address into a number
     * from https://lite.ip2location.com/faq
     */
    public static function toNumber(string $IPaddr): int
    {
        if ($IPaddr == "") {
            return 0;
        } else {
            $ips = explode(".", "$IPaddr");
            return ($ips[3] + $ips[2] * 256 + $ips[1] * 256 * 256 + $ips[0] * 256 * 256 * 256);
        }
    }

        /**
     * converts a number into an IPv4 Address
     * from https://lite.ip2location.com/faq
     */
    public static function toIP($IPNum)
    {
        if ($IPNum == "") {
            return "0.0.0.0";
        } else {
            return (($IPNum / 16777216) % 256) . "." . (($IPNum / 65536) % 256) . "." . (($IPNum / 256) % 256) . "." . ($IPNum % 256);
        }
    }
}
