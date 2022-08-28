pageStats.createEvent = function(name, value){
    return {
        session_id: pageStats.sid,
        event: name,
        value: value
    }
}

console.log('PageStats::ping', {interval: pageStats.config.ping*1000})
window.setInterval(function(){
    fetch(pageStats.url, {
        method: 'POST',
        body: JSON.stringify(pageStats.createEvent('ping', true))
    });
}, pageStats.config.ping * 1000);