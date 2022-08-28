pageStats.createEvent = function(name, value){
    return {
        session_id: pageStats.sid,
        event: name,
        value: value
    }
}

console.log('PageStats::ping', {interval: pageStats.config.ping*1000})
function time_on_page() {
    fetch(pageStats.url, {
        method: 'POST',
        body: JSON.stringify(pageStats.createEvent('ping', true))
    });
}
window.setInterval(time_on_page, pageStats.config.ping * 1000);

//collect stats on page load
time_on_page()