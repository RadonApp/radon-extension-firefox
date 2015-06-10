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
    this.version_number = [0, 8, 6];
    this.version_branch = 'beta';
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

        console.log('GMS.Scrobbler.setPlayingState', playing);

        if(playing === true) {
            LFM.track.updateNowPlaying(current);
        }
    }

    function setPlaying(track) {
        console.log('GMS.Scrobbler.setPlaying', track);

        current = track;
        currentTimestamp = Math.round(new Date().getTime() / 1000);
        currentSubmitted = false;

        lastPosition = null;

        // Update now playing status
        setPlayingState(true);
    }

    document.addEventListener('gms.ps.playSong', function(ev) {
        var track = ev.detail.track;

        setPlaying(track);
    });

    document.addEventListener('gms.ev2.timeUpdate', function(ev) {
        var now = ev.detail.currentTime;

        // Convert `now` to seconds
        now = now / 1000;

        // Ignore updates until we reach 2 seconds played
        if(now <= 2) {
            return;
        }

        if(current !== null && lastPosition !== null) {
            var change = now - lastPosition,
                span = (new Date().getTime()) - lastTimestamp,
                diff = (span / 1000) - change;

            if(diff > 10) {
                // 10 seconds since last update, re-send now playing status
                console.log('GMS.Scrobbler - ' + diff.toFixed(2) + 's since last time update, updating now playing status');

                // Update now playing status
                setPlayingState(true);
            }
        }

        lastPosition = now;
        lastTimestamp = new Date().getTime();

        // Ignore already submitted tracks
        if(currentSubmitted) {
            return;
        }

        // Ignore songs shorter than 30 seconds
        if(current.duration < 30) {
            return;
        }

        var perc = now / current.duration;

        // If over 50% played, submit it
        if(perc >= 0.50) {
            LFM.track.scrobble(current, currentTimestamp);
            currentSubmitted = true;
        }
    });

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