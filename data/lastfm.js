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

    function call(method, callback, parameters, write) {
        console.log('[call] method: ' + method);
        parameters = parameters || {};
        write = typeof write != 'undefined' ? write : true;

        parameters.method = method;
        parameters.api_key = apiKey;
        parameters.format = 'json';

        parameters.api_sig = createSignature(parameters);

        var request = null;

        if(write) {
            request = $.ajax(apiBase, {
                type: 'POST',
                data: parameters
            });
        } else {
            var paramString = "";
            Object.keys(parameters).forEach(function(key) {
                paramString += key + '=' + parameters[key] + '&';
            });
            paramString = paramString.substring(0, paramString.length - 2);

            request = $.ajax(apiBase + '?' + paramString);
        }

        request.done(callback);

        request.fail(function(jqxhr, status) {
            console.log('[call] failed: ' + status);
        });
    }

    return {
        apiKey: apiKey,
        session: null,

        call: call
    };
})();

LFM.track = {
    updateNowPlaying: function(track) {
        if(LFM.session === null || track === null) {
            return;
        }

        var params = {
            sk: LFM.session.key,
            track: track.title,
            artist: track.artist,
            album: track.album,
            trackNumber: track.track,
            duration: track.durationMillis / 1000
        };

        // Add albumArtist if it differs from artist
        if(track.artist != track.albumArtist) {
            params.albumArtist = track.albumArtist;
        }

        LFM.call('track.updateNowPlaying', function(result) {
            // TODO check result
        }, params);
    },
    scrobble: function(track, timestamp) {
        if(LFM.session === null || track === null) {
            return;
        }

        var params = {
            sk: LFM.session.key,
            track: track.title,
            artist: track.artist,
            album: track.album,
            trackNumber: track.track,
            duration: track.durationMillis / 1000,

            timestamp: timestamp
        };

        LFM.call('track.scrobble', function(result) {
            // TODO check result
        }, params);
    }
};

LFM.auth = {
    getToken: function(callback) {
        LFM.call('auth.getToken', function(result) {
            callback(result.token);
        }, {}, false);
    },
    getSession: function(token, callback) {
        LFM.call('auth.getSession', function(result) {
            if(result.session !== undefined) {
                LFM.session = result.session;
            } else {
                LFM.session = null;
            }

            callback(result);
        }, {
            token: token
        });
    }
};