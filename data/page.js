function dispatchEvent(type, detail) {
    var event = new CustomEvent(type, {
        detail: detail
    });

    document.dispatchEvent(event);

    console.log(type, detail);
}

function processEvent(event) {
    if(capture_events.indexOf(event.eventName) > -1) {
        dispatchEvent('gm.' + event.eventName, event.payload);
    }

    // trigger initial 'gm.showPanel' event
    if(event.eventName == 'pageLoaded') {
        dispatchEvent('gm.showPanel', {
            element: document.querySelector('#main')
        });
    }
}

var capture_events = [
    'playPause',
    'songUnPaused',
    'navigate',
    'showPanel',
    'pageLoaded'
];

window.gms_event = function(event) {
    try {
        processEvent(event);
    } catch(error) {
        console.warn('GMS', error);
    }
};

window.onhashchange = function () {
    dispatchEvent('gm.showPanel', {
        element: document.querySelector('#main')
    });
};