/*jshint moz:true */

$ = jQuery;

var EventHelper = (function() {
    function getPrefix(obj) {
        if(obj.eventPrefix === null) {
            return 'GMS.Unknown';
        }

        return obj.eventPrefix;
    }

    return {
        trigger: function (obj, eventType, extraParameters) {
            if(obj.$object === undefined) {
                return;
            }

            obj.$object.trigger(getPrefix(obj) + '.' + eventType, extraParameters);
        },
        bind: function (obj, eventType, eventData, handler) {
            if(obj.$object === undefined) {
                return;
            }

            obj.$object.bind(getPrefix(obj) + '.' + eventType, eventData, handler);
        }
    };
})();

var GMS = (function(port) {
    this.version_number = [0, 7, 5];
    this.version_branch = 'dev';
    this.version = this.version_number.join('.') + '-' + this.version_branch;

    this.eventPrefix = 'GMS';
    this.ownerDocument = document;

    this.options = {};
    this.option_defaults = {};

    return {
        version: this.version,
        options: this.options,
        option_defaults: this.option_defaults,

        $object: $(this),

        construct: function(data) {
            EventHelper.trigger(GMS, 'construct', [data, data.storage !== undefined ? data.storage : {}]);
        },

        open: function(url) {
            port.emit('gms.open', url);
        },
        store: function(data) {
            port.emit('gms.store', data);
        },
        storeSession: function() {
            GMS.store({
                lastfm: {
                    session: LFM.session
                }
            });
        },

        getOption: function(key) {
            if(GMS.options[key] !== undefined) {
                return GMS.options[key];
            }

            return GMS.option_defaults[key];
        },
        setOption: function(key, value) {
            GMS.options[key] = value;

            GMS.store({
                options: GMS.options
            });

            EventHelper.trigger(GMS, 'option_changed', [key, value]);
        },

        bind: function(eventType, eventData, handler) {
            EventHelper.bind(GMS, eventType, eventData, handler);
        }
    };
})(self.port);

GMS.SliderMonitor = (function() {
    this.eventPrefix = 'GMS.SliderMonitor';
    this.ownerDocument = document;

    var sliderMin = null,
        sliderMax = null;

    function change(event) {
        if(event.attribute == 'aria-valuenow') {
            EventHelper.trigger(GMS.SliderMonitor, 'positionChange', [sliderMin, sliderMax, event.value]);
        } else if(event.attribute == 'aria-valuemin') {
            sliderMin = event.value;
        } else if(event.attribute == 'aria-valuemax') {
            sliderMax = event.value;
            EventHelper.trigger(GMS.SliderMonitor, 'maxChange', [sliderMax]);
        }
    }

    document.documentElement.addEventListener('gm.pageLoaded', function() {
        $('#slider').attrmonitor({
            attributes: ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
            interval: 1000,
            start: true,
            callback: change
        });
    });

    return {
        $object: $(this),

        bind: function(eventType, eventData, handler) {
            EventHelper.bind(GMS.SliderMonitor, eventType, eventData, handler);
        }
    };
})();

GMS.Scrobbler = (function() {
    var current = null,
        playing = false,
        currentTimestamp = null,
        currentSubmitted = false,
        lastPosition = null,
        lastTimestamp = null;

    function setPlayingState(value) {
        if(value === undefined) {
            value = !playing;
        }
        playing = value;

        console.log('setPlayingState, playing: ' + playing);

        if(playing === true) {
            LFM.track.updateNowPlaying(current);
        }
    }

    GMS.SliderMonitor.bind('maxChange', function(event, max) {
        current = null;
    });

    GMS.SliderMonitor.bind('positionChange', function(event, min, max, now) {
        if(now <= 2000) {
            current = null;
            return;
        }

        if(current !== null && lastPosition !== null) {
            var change = now - lastPosition,
                span = (new Date().getTime()) - lastTimestamp,
                diff = span - change;

            if(diff > 10000) {
                console.log('Song was probably paused, rebuilding state (to trigger now-playing update)');
                current = null;
            }
        }

        lastPosition = now;
        lastTimestamp = new Date().getTime();

        if(current === null) {
            updateCurrentMedia(max);
        }

        if(currentSubmitted) {
            return;
        }

        // Ignore songs shorter than 30 seconds
        if(max < 30 * 1000) {
            return;
        }

        var perc = now / max;

        // If over 50% played, submit it
        if(perc >= 0.50) {
            LFM.track.scrobble(current, currentTimestamp);
            currentSubmitted = true;
        }
    });

    function setPlaying(song) {
        current = song;
        currentTimestamp = Math.round(new Date().getTime() / 1000);
        currentSubmitted = false;
        lastPosition = null;

        console.log('    title: ' + current.title);
        console.log('    album: ' + current.album);
        console.log('    artist: ' + current.artist);
        console.log('    durationMillis: ' + current.durationMillis);

        setPlayingState(true);
    }

    function updateCurrentMedia(durationMillis) {
        var $playerSongInfo = $('#playerSongInfo');

        setPlaying({
            'title': $('.playerSongTitle', $playerSongInfo).text(),
            'album': $('.player-album', $playerSongInfo).text(),
            'artist': $('.player-artist', $playerSongInfo).text(),
            'durationMillis': durationMillis
        });
    }

    return {};
})();

// Addon (main.js) events
self.port.on('gms.construct', function(data) {
    var storage = data.storage;

    if(storage !== undefined) {
        // Load stored lastfm session
        if(storage.lastfm !== undefined &&
           storage.lastfm.session !== undefined) {
            LFM.session = storage.lastfm.session;
        }

        // Load configuration
        if(storage.options !== undefined) {
            Object.keys(storage.options).forEach(function(key) {
                GMS.options[key] = storage.options[key];
            });
        }
    }

    GMS.construct(data);

    // INSERT page.js
    $('body').append('<script type="text/javascript" src="' + data.pageUrl + '"></script>');
});