var port = self.port,
	current = null,
    playing = false,
	currentTimestamp = null,
	currentSubmitted = false;

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
			}

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
}

//
// Player event handlers
//

document.documentElement.addEventListener('gm.playSong', function(event) {
	console.log('gm.playSong');

	if(event.detail !== null && event.detail.song !== undefined) {
		current = event.detail.song;
		currentTimestamp = Math.round(new Date().getTime() / 1000);
		currentSubmitted = false;

		console.log('    title: ' + current.title);
		console.log('    album: ' + current.album);
		console.log('    artist: ' + current.artist);
		console.log('    albumArtist: ' + current.albumArtist);
		console.log('    track: ' + current.track);
		console.log('    durationMillis: ' + current.durationMillis);

        setPlayingState(true);
	}
});

document.documentElement.addEventListener('gm.songUnPaused', function(event) {
	lastfm.track.updateNowPlaying();
});

 document.documentElement.addEventListener('gm.playPause', function(event) {
     setPlayingState();
 });

function setPlayingState(value) {
    if(value === undefined) {
        value = !playing;
    }
    playing = value;

    if(playing == true) {
        $('#slider').attrmonitor('start');
    } else if(playing == false) {
        $('#slider').attrmonitor('stop');
    }
}

function sliderPositionChanged(min, max, now) {
	if(current === null || currentSubmitted) {
		return;
	}

	// Ignore songs shorter than 30 seconds
	if(max < 30 * 1000) {
		return;
	}

	var perc = now / max;

	// If over 50% played, submit it
	if(perc >= .50) {
		lastfm.track.scrobble();
		currentSubmitted = true;
	}
}

//
// Loading
//

function loaded() {
    console.log('loaded');

	var sliderMin = null,
		sliderMax = null;

	$('#slider').attrmonitor({
        attributes: ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
        interval: 1000,
        start: false,
        callback: function(event) {
			if(event.attribute == 'aria-valuenow') {
				sliderPositionChanged(sliderMin, sliderMax, event.value);
			} else if(event.attribute == 'aria-valuemin') {
				sliderMin = event.value;
			} else if(event.attribute == 'aria-valuemax') {
				sliderMax = event.value;
			}
		}
	});
}

$('#loading-progress').attrmonitor({
    attributes: ['style'],
    callback: function(event) {
		if(event.attribute == 'style' &&
           event.value !== null &&
		   event.value.replace(' ', '').indexOf('display:none;') !== -1)
        {
			loaded();
            $('#loading-progress').attrmonitor('destroy');
		}
	}
});

// Addon (main.js) events
self.port.on('gms.construct', function(data) {
	$('body').append('<script type="text/javascript" src="' + data.pageUrl + '"></script>');

	// Load Settings
	var storage = data.storage;
	if(storage !== undefined) {
		// Load stored lastfm session
		if(storage.lastfm !== undefined && 
		   storage.lastfm.session !== undefined) {
		   	lastfm.session = storage.lastfm.session;
		}
	}
});

// We are now ready
self.port.emit('gms.ready');