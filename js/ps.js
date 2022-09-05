pageStats.createEvent = function(name, value){
    return {
        session_id: pageStats.sid,
        event: name,
        value: value
    }
}

pageStats.pingCount = 0;

/**
 * incremental time on page metrics.
 * first pageStats.config.ping seconds send ping once per second, then only
 * every pageStats.config.ping seconds
 */
function time_on_page() {
    fetch(pageStats.url, {
        method: 'POST',
        body: JSON.stringify(pageStats.createEvent('ping', true))
    });

    pageStats.pingCount++;

    interval = pageStats.pingCount < pageStats.config.ping ? 1 : pageStats.config.ping;
    window.setTimeout(time_on_page, interval * 1000);

}

//collect stats on page load
time_on_page()