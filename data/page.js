function dispatchEvent(type, detail) {
	var event = document.createEvent('CustomEvent');
	event.initCustomEvent(type, true, true, detail);
    document.documentElement.dispatchEvent(event);
}

var capture_events = [
    'playSong',
    'playPause',
    'songUnPaused',
    'navigate',
    'showPanel'
];

window.gms_event = function(event) {
    if(capture_events.indexOf(event.eventName) > -1) {
        dispatchEvent('gm.' + event.eventName, event.payload);
    }
};