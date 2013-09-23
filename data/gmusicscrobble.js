$ = jQuery;

var port = self.port,
    data = null,
    setup = {
        parent: null,
        dependant_scripts: null
    },
	current = null,
    playing = false,
	currentTimestamp = null,
	currentSubmitted = false;

const RE_LEX_ANCHOR = /var\s(\w)=\{eventName:.*?,eventSrc:.*?,payload:.*?\},\w=.*?;/i;

//
// Player event handlers
//

function unpack_song(song) {
    song = song.a;

    return {
        title: song[1],
        album: song[4],
        artist: song[3],
        albumArtist: song[3], // TODO fix this
        track: song[14],
        durationMillis: song[13]
    }
}

document.documentElement.addEventListener('gm.playSong', function(event) {
	console.log('gm.playSong');

	if(event.detail !== null && event.detail.song !== undefined) {
		current = unpack_song(event.detail.song);
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
        lastfm.track.updateNowPlaying();
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

function insert_lex_hook(lex_data) {
    var match = RE_LEX_ANCHOR.exec(lex_data);
    var slice_start = match.index + match[0].length;

    var head = lex_data.slice(0, slice_start);
    var tail = lex_data.slice(slice_start, lex_data.length);

    return head + "if(window.gms_event !== undefined){window.gms_event(" + match[1] + ");}" + tail;
}

function create_lex(lex_data) {
    var node = document.createElement("script");
    node.type = "text/javascript";
    node.text = insert_lex_hook(lex_data);

    return node;
}

function setup_client() {
    console.log("Using \"" + data.lex_location + "\" url for listen_extended");

    var lex_node = $('script[blocked=true]')[0];
    setup.parent = lex_node.parentNode;

    // Pull out all the following dependant script nodes
    setup.dependant_scripts = [];

    var cur = lex_node.nextSibling;
    while(cur != null) {
        if(cur.tagName == 'SCRIPT') {
            setup.dependant_scripts.push(cur);
            setup.parent.removeChild(cur);
        }
        cur = cur.nextSibling;
    }
    console.log('pulled out ' + setup.dependant_scripts.length + ' dependant script nodes');

    // Remove lex node from the document
    setup.parent.removeChild(lex_node);

    // Request lex script, then rebuild the client
    console.log('Requesting lex...');

    port.emit('gms.lex_request', {
        url: data.lex_location
    });
}

function rebuild_client(lex_data) {
    console.log('Rebuilding client...');

    // Re-insert new lex and dependant scripts into the document
    setup.parent.appendChild(create_lex(lex_data));

    for(var i = 0; i < setup.dependant_scripts.length; i++) {
        setup.parent.appendChild(setup.dependant_scripts[i]);
    }

    console.log('Client rebuilt, finished.')
}

port.on('gms.lex_response', rebuild_client);

// Addon (main.js) events
port.on('gms.construct', function(_data) {
    data = _data;

    // Setup the client
    setup_client();

    // INSERT page.js
    $('body').append('<script type="text/javascript" src="' + data.pageUrl + '"></script>');
});

// We are now ready
port.emit('gms.ready');