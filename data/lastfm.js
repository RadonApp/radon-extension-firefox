//
// last.fm API handler
//

var LFM = (function() {
    var apiKey = '2c794d3b3415a2fb072f41fc8a8edcc7',
        secret = '92a0a2adaf14f954e8d8999a9fb95524',
        apiBase = '//ws.audioscrobbler.com/2.0/';

    function createSignature(parameters) {
        var sig = "";
        Object.keys(parameters).sort().forEach(function(key) {
            if (key != "format") {
                var value = typeof parameters[key] !== "undefined" && parameters[key] !== null ? parameters[key] : "";
                sig += key + value;
            }
        });
        sig += secret;
        return CryptoJS.MD5(sig).toString(CryptoJS.enc.Hex);
    }

    function call(method, args) {
        console.log('LFM.call - method: "' + method + '", args:', args);

        args = args || {};

        args.parameters = args.parameters || {};
        args.write = typeof args.write != 'undefined' ? args.write : true;

        args.parameters.method = method;
        args.parameters.api_key = apiKey;
        args.parameters.format = 'json';

        args.parameters.api_sig = createSignature(args.parameters);

        var request = null;

        if(args.write) {
            request = $.ajax(apiBase, {
                type: 'POST',
                data: args.parameters
            });
        } else {
            var paramString = "";
            Object.keys(args.parameters).forEach(function(key) {
                paramString += key + '=' + args.parameters[key] + '&';
            });
            paramString = paramString.substring(0, paramString.length - 2);

            request = $.ajax(apiBase + '?' + paramString);
        }

        request.done(function(data, status) {
            // Fire `onSuccess` callback
            if(typeof args.onSuccess != 'undefined' && args.onSuccess !== null) {
                args.onSuccess(status, data);
            }
        });

        request.fail(function(jqxhr, status) {
            var data = jqxhr.responseJSON;

            console.log('[call] failed: ' + status, data);

            // Fire `onError` callback
            if(typeof args.onError != 'undefined' && args.onError !== null) {
                args.onError(status, data);
            }
        });
    }

    return {
        apiKey: apiKey,
        session: null,

        call: call
    };
})();

LFM.track = {
    updateNowPlaying: function(current, onSuccess, onError) {
        var params = this._buildParams(current);

        if(params === null) {
            // Unable to build parameters (invalid track or session)
            return;
        }

        // Call `track.updateNowPlaying` at last.fm
        LFM.call('track.updateNowPlaying', {
            parameters: params,

            onSuccess: onSuccess,
            onError: onError
        });
    },
    scrobble: function(current, timestamp, onSuccess, onError) {
        var params = this._buildParams(current);

        if(params === null) {
            // Unable to build parameters (invalid track or session)
            return;
        }

        params.timestamp = timestamp;

        // Call `track.scrobble` at last.fm
        LFM.call('track.scrobble', {
            parameters: params,

            onSuccess: onSuccess,
            onError: onError
        });
    },
    _buildParams: function(current) {
        if(LFM.session === null || current === null) {
            return null;
        }

        var result = {
            sk: LFM.session.key,

            // Track details
            track:          current.track,
            artist:         current.artist,

            album:          current.album,

            duration:       current.duration,
            trackNumber:    current.trackNumber
        };

        // Only add `albumArtist` parameter if it exists
        if(typeof current.albumArtist !== 'undefined') {
            result.albumArtist = current.albumArtist;
        }

        return result;
    }
};

LFM.auth = {
    getToken: function(callback) {
        LFM.call('auth.getToken', {
            write: false,

            onSuccess: function(status, result) {
                callback(result.token);
            }
        });
    },
    getSession: function(token, callback) {
        LFM.call('auth.getSession', {
            parameters: {
                token: token
            },

            onSuccess: function(status, result) {
                if(result.session !== undefined) {
                    LFM.session = result.session;
                } else {
                    LFM.session = null;
                }

                callback(result);
            }
        });
    }
};
