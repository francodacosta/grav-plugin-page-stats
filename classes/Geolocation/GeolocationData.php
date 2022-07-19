<?php
declare (strict_types=1);

namespace Grav\Plugin\PageStats\Geolocation;


class GeolocationData {
    private  $countryCode;
    private  $countryName;
    private  $region;
    private  $city;

    public function __construct(
         $countryCode,
         $countryName,
         $region,
         $city
    ) {
        $this->countryCode = $countryCode;
        $this->countryName = $countryName;
        $this->region = $region;
        $this->city = $city;
    }


    public function countryCode(): string
    {
        return $this->countryCode;
    }

    public function countryName(): string
    {
        return $this->countryName;
    }

    public function city(): string
    {
        return $this->city;
    }

    public function region(): string
    {
        return $this->region;
    }
}