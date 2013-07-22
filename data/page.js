function dispatchEvent(type, detail) {
	var event = document.createEvent('CustomEvent');
	event.initCustomEvent(type, true, true, detail);
    document.documentElement.dispatchEvent(event);
}

function dispatchGMEvent(ev) {
	dispatchEvent('gm.' + ev.eventName, ev.payload);
}

if(window.SJBaddListener !== undefined) {
	// Bind Events
	window.SJBaddListener('playSong', dispatchGMEvent);
	window.SJBaddListener('playPause', dispatchGMEvent);
	window.SJBaddListener('songUnPaused', dispatchGMEvent);
	window.SJBaddListener('navigate', dispatchGMEvent);
	window.SJBaddListener('showPanel', dispatchGMEvent);
} else {
	console.error('window.SJBaddListener method not available');
}