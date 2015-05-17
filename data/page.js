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
        interop: {
            ps: {
                getTrackInfo: null
            }
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
                        element: this.utils.getNode(document.querySelector('#main'))
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

                if(player == null) {
                    console.warn('GMS-PS - Called with invalid "player" parameter');
                    return;
                }

                if(parameters.length !== 4 || typeof parameters[0].track === 'undefined') {
                    console.warn('GMS-PS - Called with invalid "parameters" parameter');
                    return;
                }

                if(Object.keys(player).length > 15) {
                    console.warn('GMS-PS - Called with "player" in an invalid state');
                    return;
                }

                var track = parameters[0].track;

                if(this.interop.ps.getTrackInfo === null) {
                    // Search for `trackInfo` attribute
                    for(var key in track) {
                        if(!track.hasOwnProperty(key)) {
                            continue;
                        }

                        if(Array.isArray(track[key])) {
                            // Found `trackInfo` array, build getter function
                            this.interop.ps.getTrackInfo = (function(key) {
                                return function(track) {
                                    return track[key];
                                };
                            })(key);
                            break;
                        }
                    }

                    if(this.interop.ps.getTrackInfo === null) {
                        console.warn('GMS-PS - Unable to find track info array');
                        return;
                    }
                }

                // Store current `player` object
                this.current.player = player;

                // Retrieve track details
                this.current.track = this.utils.parseTrack(
                    this.interop.ps.getTrackInfo(track)
                );

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

                    if(typeof value !== 'object') {
                        continue;
                    }

                    if(typeof value.nodeType !== 'undefined') {
                        return value;
                    }
                }

                return element;
            },
            parseTrack: function(info) {
                if(info == null || info.length !== 60) {
                    // Invalid track info format
                    return null;
                }

                var result = {
                    track:          info[1],
                    artist:         info[3],

                    album:          info[4],
                    albumArtist:    info[5],

                    duration:       info[13] / 1000,
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
        }
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
