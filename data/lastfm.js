var port = self.port;

//
// last.fm API handler
//

var lastfm = {
    apiKey: '2c794d3b3415a2fb072f41fc8a8edcc7',
    secret: '92a0a2adaf14f954e8d8999a9fb95524',
    apiBase: '//ws.audioscrobbler.com/2.0/',

    session: null,

    call: function(method, callback, parameters, write) {
        console.log('[call] method: ' + method);
        parameters = parameters || {};
        write = typeof write != 'undefined' ? write : true;

        parameters.method = method;
        parameters.api_key = lastfm.apiKey;
        parameters.format = 'json';

        parameters.api_sig = lastfm.createSignature(parameters);

        var request = null;

        if(write) {
            request = $.ajax(lastfm.apiBase, {
                type: 'POST',
                data: parameters
            });
        } else {
            var paramString = "";
            Object.keys(parameters).forEach(function(key) {
                paramString += key + '=' + parameters[key] + '&';
            });
            paramString = paramString.substring(0, paramString.length - 2);

            request = $.ajax(lastfm.apiBase + '?' + paramString);
        }

        request.done(callback);

        request.fail(function(jqxhr, status) {
            console.log('[call] failed: ' + status);
        })
    },
    createSignature: function(parameters) {
        var sig = "";
        Object.keys(parameters).sort().forEach(function(key) {
            if (key != "format") {
                var value = typeof parameters[key] !== "undefined" && parameters[key] !== null ? parameters[key] : "";
                sig += key + value;
            }
        });
        sig += lastfm.secret;
        return CryptoJS.MD5(sig).toString(CryptoJS.enc.Hex);
    },
    saveSession: function() {
        port.emit('gms.store', {
            lastfm: {
                session: lastfm.session
            }
        });
    },

    track: {
        updateNowPlaying: function() {
            if(lastfm.session === null || current === null) {
                return;
            }

            params = {
                sk: lastfm.session.key,
                track: current.title,
                artist: current.artist,
                album: current.album,
                trackNumber: current.track,
                duration: current.durationMillis / 1000
            };

            // Add albumArtist if it differs from artist
            if(current.artist != current.albumArtist) {
                params.albumArtist = current.albumArtist;
            }

            lastfm.call('track.updateNowPlaying', function(result) {
                // TODO check result
            }, params);
        },
        scrobble: function() {
            if(lastfm.session === null || current === null) {
                return;
            }

            params = {
                sk: lastfm.session.key,
                track: current.title,
                artist: current.artist,
                album: current.album,
                trackNumber: current.track,
                duration: current.durationMillis / 1000,

                timestamp: currentTimestamp
            };

            lastfm.call('track.scrobble', function(result) {
                // TODO check result
            }, params);
        }
    },
    auth: {
        getToken: function(callback) {
            lastfm.call('auth.getToken', function(result) {
                callback(result.token);
            }, {}, false);
        },
        getSession: function(token, callback) {
            lastfm.call('auth.getSession', function(result) {
                if(result.session !== undefined) {
                    lastfm.session = result.session;
                    lastfm.saveSession();
                } else {
                    lastfm.session = null;
                }

                callback(result);
            }, {
                token: token
            });
        }
    }
};

port.on('gms.construct', function(data) {
    var storage = data.storage;

    if(storage !== undefined) {
        // Load stored lastfm session
        if(storage.lastfm !== undefined &&
           storage.lastfm.session !== undefined) {
            lastfm.session = storage.lastfm.session;
        }
    }
});