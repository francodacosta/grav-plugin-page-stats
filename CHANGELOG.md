# v2.5.3
## 09/01/2023

1. [New Features](#new)
1. [Bug Fixes](#bugfix)
    * fix: Undefined index: HTTP_USER_AGENT (#32)
1. [Improvements](#improvements)

# v2.5.2
## 09/01/2023

1. [New Features](#new)
1. [Bug Fixes](#bugfix)
    * dummy release to correct typo in release versions (#33)
1. [Improvements](#improvements)

# v2.5.1
## 05/01/2023

1. [New Features](#new)
1. [Bug Fixes](#bugfix)
    * click on view all on recently pages viewed will now show you a list of recently viewed pages grouped by date
1. [Improvements](#improvements)

# v2.5.0
## 26/09/2022

1. [New Features](#new)
    * You can noe define a list of user agents to classify as bots/crawlers
1. [Bug Fixes](#bugfix)
1. [Improvements](#improvements)

# v2.4.1
## 21/09/2022

1. [New Features](#new)
1. [Bug Fixes](#bugfix)
    *   Add missing translation strings
1. [Improvements](#improvements)

    # v2.4.0
## 20/09/2022

1. [New Features](#new)
    * configuration option to show page title our route
1. [Bug Fixes](#bugfix)
    * don't error out if ip2location lib throws exception when geolocating ip
    * add debug message with IP on error
1. [Improvements](#improvements)
    * page stats now shows details about all page views, not only the last 10 views
    * time on page collect metrics once a second until the first `ping interval` value you specified and then every `ping interval` seconds, this is so that initial time on page is more accurate


# v2.3.0
## 5/09/2022

1. [New Features](#new)
    * Show user agent on user detail page
1. [Bug Fixes](#bugfix)
    * Top country pages not showing

# v2.2.0
## 31/08/2022

1. [New Features](#new)
    * Front End event collection support
    * time on page
    * top browsers as table or pie chart
    * top platforms as table or pie chart
    * top countries as table or pie chart
    * View stats for all countries
    * View stats for all browsers
    * View stats for all platforms
    * View stats for all users
    * recently viewed page has link to user stats page
    * list of urls to exclude from processing
1. [Bug Fixes](#bugfix)
    * fix error message when http_referer is not set
    *  do not include FE tracker is not enabled for that page
    * page stats widget not displaying on main dashboard page if url does not end in `/dasboard`
1. [Improvements](#improvements)
    * moved sidebar menu entry to bottom of list
    * top users only shows user name, page views are shown on hover

# v2.1.0
## 27/08/2022

1. [](#new)
    * Log http referer ([65a006](https://github.com/francodacosta/grav-plugin-page-stats/commit/65a0060c4ff55646e9c7eec32ba14109a30b7fa2))
    * Show page view widget instead of grav default one ([3361fd](https://github.com/francodacosta/grav-plugin-page-stats/commit/3361fd39e69ce0e7b96c438808370664e5b87667))
1. [](#bugfix)
    * Db file and size not were shown after refactoring ([bb5e07](https://github.com/francodacosta/grav-plugin-page-stats/commit/bb5e0748120bf0ab985738520ea8dceac377c2fb))
    * Migrate was not detecting version properly if migration happened at same time ([5691a5](https://github.com/francodacosta/grav-plugin-page-stats/commit/5691a5d3fae4f1ddc855266befecc4e5774aa509))
    * fix typo in plugin settings translation keys #20
    * fix typo in geolocation #21
    * fix Platform and browser column labels were switched #22

# v2.0.0
## 27/08/2022

1. [](#new)
    * ⚠ BREAKING CHANGES = Using bin geolocation db ([54b6a9](https://github.com/francodacosta/grav-plugin-page-stats/commit/54b6a9e40e6b8c4ff8ad66d4aa3632d90635b843))
    * Show all pages on most recent ([3c0784](https://github.com/francodacosta/grav-plugin-page-stats/commit/3c07842e1be491f99dce7b0264167417f0af0c20))
    * View all pages ([7cf039](https://github.com/francodacosta/grav-plugin-page-stats/commit/7cf0396f451896c16b7d4fdd80224fbac81fb416))
1. [](#bugfix)
    * No limit on all pages ([cf3513](https://github.com/francodacosta/grav-plugin-page-stats/commit/cf3513c47ff25c748c1a09324284fd05e4840444))

# v1.10.0
## 16/08/2022

1. [](#new)
    * Show all pages on most recent ([3c0784](https://github.com/francodacosta/grav-plugin-page-stats/commit/3c07842e1be491f99dce7b0264167417f0af0c20))
    * View all pages ([7cf039](https://github.com/francodacosta/grav-plugin-page-stats/commit/7cf0396f451896c16b7d4fdd80224fbac81fb416))

# v1.9.3
## 18/08/2022

1. [](#bugfix)
    * Display date only on user detail page ([b4fb45](https://github.com/francodacosta/grav-plugin-page-stats/commit/b4fb4537ce87a44a31246ea878e170009841c48c))


# v1.9.2
## 16/08/2022

1. [](#bugfix)
    * Show correct day instead of current day in user details recent page views ([bf1329](https://github.com/francodacosta/grav-plugin-page-stats/commit/bf13292f1f152efbea1d9bccc2320a740b37673d))

# v1.9.1
## 16/08/2022

1. [](#bugfix)
    * Removed user name from recently viewed pages of user details screen ([13e612](https://github.com/francodacosta/grav-plugin-page-stats/commit/13e6123d4369225b93ea6d4196a55a8286476ffa))

# v1.9.0
## 16/08/2022

1. [](#new)
    * Group page views by day in user detail page ([184489](https://github.com/francodacosta/grav-plugin-page-stats/commit/1844899445f7d6c894720214c32225f8e2d57bf2))


# v1.8.2
## 15/08/2022

1. [](#bugfix)
    * Show platform data on user detail page ([d510cd](https://github.com/francodacosta/grav-plugin-page-stats/commit/d510cd38a5a3d6a36cd009946286cf418a3cbdb5))


# v1.8.1
## 15/08/2022

1. [](#bugfix)
    * Better user vs ip detection ([9d2216](https://github.com/francodacosta/grav-plugin-page-stats/commit/9d2216bc98bda86cdfea6c23104739d39b25f79e))

# v1.8.0
## 11/08/2022

1. [](#new)
    * Show location on recent views of page details ([ea7d29](https://github.com/francodacosta/grav-plugin-page-stats/commit/ea7d290aae6dd783a570c50604835bd6d18adeac))
    * User Details Page ([91fed4](https://github.com/francodacosta/grav-plugin-page-stats/commit/91fed4f7702bb47a5ca132ec60472eb2f0719c88))

# v1.7.0
## 11/08/2022

1. [](#new)
    * add stats icon to pages listing, so when you click on the stats icon you go to the stats page
    * Show paltform and browser on recently viewed pages
    * Show recent views on page details stats

# v1.6.1
## 05/08/2022

1. [](#new)
   * Click on icon to open page in new tab ([701820](https://github.com/francodacosta/grav-plugin-page-stats/commit/7018206c7986ad2c2322e88c3a37b01c9698c437))
2. [](#bugfix)
    * Error with double $$; make migrations more forgiving if updating from dev version (pre migrations) ([90a027](https://github.com/francodacosta/grav-plugin-page-stats/commit/90a027f94174549fe6529b7ec60b8dff7f87575d))

# v1.6.0
## 05/08/2022

1. [](#bugfix)
    * Fixed wrong labelled plugin setting ([6f8ca2](https://github.com/francodacosta/grav-plugin-page-stats/commit/6f8ca29443bf42685ffc85bed9b821c9f6153910))


# v1.5.0
## 05/08/2022

1. [](#new)
   * Click on icon to open page in new tab ([701820](https://github.com/francodacosta/grav-plugin-page-stats/commit/7018206c7986ad2c2322e88c3a37b01c9698c437))

# v1.4.0
## 05/08/2022

1. [](#new)
    * Detailed page stats ([7672be](https://github.com/francodacosta/grav-plugin-page-stats/commit/7672bee5ac9b9f54dc5735ab407d455d0d7b8b9b))


# v1.3.0
## 05/08/2022

1. [](#new)
    * Collect browser stats ([97e89f](https://github.com/francodacosta/grav-plugin-page-stats/commit/97e89f30f096d9ccc4becab1037c851edb1e1577))
    * Display route instead of title ([2feb0e](https://github.com/francodacosta/grav-plugin-page-stats/commit/2feb0ef862a08af027e846cb4390e0a209ba991b))
    * Setting to throw exception on errors, or ignore them (log them) ([6a4bd2](https://github.com/francodacosta/grav-plugin-page-stats/commit/6a4bd2e9c80b8e2ba3ee615d761f69a95423a502))
    * Top countries ([1d2913](https://github.com/francodacosta/grav-plugin-page-stats/commit/1d29130f0d589f66c07769e98387d697fb5d0724))

# v1.2.0
## 05/08/2022

1. [](#new)
    * Configure viewed pages ([b3a0b2](https://github.com/francodacosta/grav-plugin-page-stats/commit/b3a0b28cbb282f6b173d3166ceb0f889ab4dd0de))
    * Select widget size [#17](https://github.com/francodacosta/grav-plugin-page-stats/issues/17) ([4f01da](https://github.com/francodacosta/grav-plugin-page-stats/commit/4f01da6d19db2253ff015f064a6ce477c0577e17))
    * Specify number of top users to fetch ([c55a01](https://github.com/francodacosta/grav-plugin-page-stats/commit/c55a01b22f6c2ec36e696d537f83de50ad40cf21))
    * Toggle page views widget [#14](https://github.com/francodacosta/grav-plugin-page-stats/issues/14) ([686085](https://github.com/francodacosta/grav-plugin-page-stats/commit/6860859c60d478a3f2c68dbc22d698f04ec042e3))
    * Toggle unique visitors [#15](https://github.com/francodacosta/grav-plugin-page-stats/issues/15) ([93fde2](https://github.com/francodacosta/grav-plugin-page-stats/commit/93fde20f6a953841cbcc4b600754631885829ce0))
    * Top pages: toggle display, configure size and records to show ([65be4c](https://github.com/francodacosta/grav-plugin-page-stats/commit/65be4c89701a53ab4da12782815682196fae9d8c))

# v1.1.0
## 04/08/2022

1. [](#new)
    * Exclude ips from processinf [#5](https://github.com/francodacosta/grav-plugin-page-stats/issues/5) ([c07ea4](https://github.com/francodacosta/grav-plugin-page-stats/commit/c07ea4e71c1f026bc0c0c3b884b1c56777e29ed3))
    * Recreate geolocation db from zip file ([3ed6e8](https://github.com/francodacosta/grav-plugin-page-stats/commit/3ed6e8934ae02d95e518b3b1a137e0a390ece255))
    * Toggle plugin from front matter [#6](https://github.com/francodacosta/grav-plugin-page-stats/issues/6) ([bd65ca](https://github.com/francodacosta/grav-plugin-page-stats/commit/bd65ca388cdb53c641796f0b993fc615ec71681b))
    * Toggle unique users widgets ([3196bc](https://github.com/francodacosta/grav-plugin-page-stats/commit/3196bcc6968d83eae3d6da2c5e3f4423c4ff71f6))
    * Top users ([4e18f7](https://github.com/francodacosta/grav-plugin-page-stats/commit/4e18f7fef961e64285d990759aa7ad47eccdd31d))
2. [](#bugfix)
    * #1 non standard admin page [#1](https://github.com/francodacosta/grav-plugin-page-stats/issues/1) ([5de885](https://github.com/francodacosta/grav-plugin-page-stats/commit/5de885359789fb0751e255a819dd8b6d19eb3a8e))
    * Fixed plugin links in blueprints ([ab5474](https://github.com/francodacosta/grav-plugin-page-stats/commit/ab5474cc01513492fc38696fdd04a934cfbe682a))
    * Remove weirdly named folder ([ff3707](https://github.com/francodacosta/grav-plugin-page-stats/commit/ff37078fdce36fb982fb23f2749344c31595e609))
    * Unique users ([428004](https://github.com/francodacosta/grav-plugin-page-stats/commit/428004a9c1731faa98e3147580d4b42488eaddfd))

##