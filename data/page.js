(function() {
    var ev1_events = [
        'playPause',
        'songUnPaused',
        'navigate',
        'showPanel',
        'pageLoaded'
    ];

    var GMS = {
        current: {
            player: null,
            track: null
        },
        event: {
            fire: function(name, detail) {
                //console.log('GMS.event.fire', name, detail);

                var event = new CustomEvent(name, {
                    detail: detail
                });

                document.dispatchEvent(event);
            }
        },
        on: {
            ev1: function(event) {
                if(ev1_events.indexOf(event.eventName) > -1) {
                    this.event.fire('gms.ev1.' + event.eventName, event.payload);
                }

                // trigger initial 'gm.showPanel' event
                if(event.eventName == 'pageLoaded') {
                    this.event.fire('gms.ev1.showPanel', {
                        element: GMS.utils.getNode(document.querySelector('#main'))
                    });
                }
            },
            ev2: function(event) {
                if(event === 'timeUpdate') {
                    if(this.current.player === null || typeof this.current.player.getCurrentTime == 'undefined') {
                        // No `player` or `getCurrentTime` function available
                        return;
                    }

                    this.event.fire('gms.ev2.timeUpdate', {
                        currentTime: this.current.player.getCurrentTime()
                    });
                }
            },
            ps: function(player, parameters) {
                console.log('GMS-PS', player, parameters);

                if(player === null) {
                    console.warn('GMS-PS - Called with invalid "player" parameter');
                    return;
                }

                if(parameters.length !== 4 || typeof parameters[0] !== 'object') {
                    console.warn('GMS-PS - Called with invalid parameters');
                    return;
                }

                // Find track info in parameters
                var track = GMS.utils.findTrack(parameters[0]);

                if(typeof track === 'undefined' || track === null) {
                    console.warn('GMS-PS - Unable to find track info');
                    return;
                }

                // Store current `player` object
                this.current.player = player;

                // Retrieve track details
                this.current.track = GMS.utils.parseTrack(track);

                // Fire `playSong` event
                this.event.fire('gms.ps.playSong', {
                    track: this.current.track
                });
            }
        },
        utils: {
            getNode: function(element) {
                if(typeof element !== 'object') {
                    return element;
                }

                for(var key in element) {
                    if (!element.hasOwnProperty(key)) {
                        continue;
                    }

                    var value = element[key];

                    if(typeof value !== 'object' || value === null) {
                        continue;
                    }

                    if(typeof value.nodeType !== 'undefined' && value.nodeType !== null) {
                        return value;
                    }
                }

                return element;
            },
            findTrack: function(data, depth) {
                // Set default `depth`
                if(typeof depth === 'undefined' || depth === null) {
                    depth = 0;
                }

                // Limit findTrack() `depth` to 5
                if(depth >= 5) {
                    return null;
                }

                var children = [];

                // Try find track in `data`
                for(var key in data) {
                    if(!data.hasOwnProperty(key)) {
                        continue;
                    }

                    var value = data[key];

                    if(Array.isArray(value)) {
                        // Only return if the array has over 50 items
                        if(value.length >= 50) {
                            return value;
                        }
                    } else if(value !== null && typeof value === 'object') {
                        // Store object for further searching
                        children.push(value);
                    }
                }

                // Search children for track
                for(var i = 0; i < children.length; ++i) {
                    var child = children[i],
                        result = GMS.utils.findTrack(child, depth + 1);

                    if(typeof result !== 'undefined' && result !== null) {
                        return result;
                    }
                }

                return null;
            },
            parseTrack: function(info) {
                if(info === null || info.length < 60) {
                    // Invalid track info format
                    return null;
                }

                var result = {
                    track:          info[1],
                    artist:         info[3],

                    album:          info[4],
                    albumArtist:    info[5],

                    duration:       Math.floor(info[13] / 1000),
                    trackNumber:    info[14]
                };

                if(result.albumArtist == result.artist) {
                    // Remove `albumArtist` if it matches the `artist`
                    delete result.albumArtist;
                }

                return result;
            }
        }
    };

    // Bind to GMS hooks
    function hook(name, callback) {
        window[name] = function() {
            try {
                callback.apply(GMS, arguments);
            } catch(error) {
                console.warn('GMS - Exception raised in "%s" callback', name, error);
            }
        };
    }

    hook('gms_ev1', GMS.on.ev1);
    hook('gms_ev2', GMS.on.ev2);
    hook('gms_ps', GMS.on.ps);

    // Bind to window events
    window.onhashchange = function () {
        GMS.event.fire('gms.ev1.showPanel', {
            element: GMS.utils.getNode(document.querySelector('#main'))
        });
    };
})();
