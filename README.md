# Page Stats Plugin
![](screenshot.png)

The **Page Stats** Plugin is an extension for [Grav CMS](http://github.com/getgrav/grav).

Enhaced statistics for grav

This plugin will create a new entry in the admin plugin sidebar to display enhaced page stats about your site!


Stats Available:
* Page Views
* Unique IP's
* Unique Users
* Top users (by page views)
* Latest viewed pages
* Top Pages (by page views)
* Top country (by page views)
* Top browser (by page views)
* Top platform / device (by page views)
* Detailed Page Statistics

## First Run
When you first run this plugin it will:
1. unzip the 300Mb geolocation database
2. create a new sqlite database to store the data, it's location can be defined in the plugin config, defaults to ```user/data/page-data.sqlite```

>
> Please note the geolocation DB is 300Mb, make sure you have enough space on your server.
>
> It is distributed as a zip file, this means the first run will be a bit slow as the plugin will unzip the geolocation db.
>
> If you do not have the php zip exptension, or are unable to unzip files due to serve policies, unzip the file and upload it to `<plugin root>/data/geolocation.sqlite` the zip file can be found at `<plugin root>/data/geolocation.sqlite.zip`
>

## Configuration

Before configuring this plugin, you should copy the `user/plugins/page-stats/page-stats.yaml` to `user/config/plugins/page-stats.yaml` and only edit that copy.

Here is the default configuration and an explanation of available options:

```yaml
enabled: true
db: user/data/page-data.sqlite
log_admin: false
log_bot: false
show_top_users_widget: true
show_unique_users_widget: true
```


| parameter | default | explanation |
| --------- | ------- | ----------- |
| db | ```user/data/page-data.sqlite``` | db is the path to the stats database file, relative to grav root. |
| log_admin | ```false``` | if true admin user activity on main website will be logged |
| log_bot   | ```false``` | if true bot activity on main website will be logged |
| show_top_users_widget | ```true``` | Show the top users list (users with the most pageview |
| show_unique_users_widget | ```true``` | Show unique users chart (count of unique logged in users) |


> Note:
> If DB file does not exists it will be created on first run
>
> Bot detection is based on user agent, it is not perfect, but it does work well


Note that if you use the Admin Plugin, a file with your configuration named page-stats.yaml will be saved in the `user/config/plugins/`-folder once the configuration is saved in the Admin.

### Front Matter
You can exclude pages from analytics by disabling the plugin in the page front matter as follows:
```
---
page-stats:
    process: false
---
```




## Installation

Installing the Page Stats plugin can be done in one of three ways: The GPM (Grav Package Manager) installation method lets you quickly install the plugin with a simple terminal command, the manual method lets you do so via a zip file, and the admin method lets you do so via the Admin Plugin.

### GPM Installation (Preferred)

To install the plugin via the [GPM](http://learn.getgrav.org/advanced/grav-gpm), through your system's terminal (also called the command line), navigate to the root of your Grav-installation, and enter:

    bin/gpm install page-stats

This will install the Page Stats plugin into your `/user/plugins`-directory within Grav. Its files can be found under `/your/site/grav/user/plugins/page-stats`.

### Manual Installation

To install the plugin manually, download the zip-version of this repository and unzip it under `/your/site/grav/user/plugins`. Then rename the folder to `page-stats`. You can find these files on [GitHub](https://github.com//grav-plugin-page-stats) or via [GetGrav.org](http://getgrav.org/downloads/plugins#extras).

You should now have all the plugin files under

    /your/site/grav/user/plugins/page-stats

> NOTE: This plugin is a modular component for Grav which may require other plugins to operate, please see its [blueprints.yaml-file on GitHub](https://github.com//grav-plugin-page-stats/blob/master/blueprints.yaml).

### Admin Plugin

If you use the Admin Plugin, you can install the plugin directly by browsing the `Plugins`-menu and clicking on the `Add` button.


## Usage

Just install and have fun!
There is notnhing you need to do, plugin will work out of the box

Have a look at the Grav Error log to ensure plugin is working fine

## Credits

This plugin includes IP2Location LITE data available from <a href="https://lite.ip2location.com">https://lite.ip2location.com</a>.

Flags from https://flagpedia.net

## To Do

- [ ] World map view
- [X] Browser / device stats (based on user agent)
- [ ] User behaviour (select user and see the session history and page flows)
- [X] Top country stats
- [ ] Update geolocation db from csv user can download


