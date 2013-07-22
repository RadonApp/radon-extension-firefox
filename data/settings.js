//
// Google Music Scrobbler - Settings
//

function initialize(elem) {
	// Add Settings Header
	$('<div class="settings-section-header settings-lastfm" style="margin-top: 20px;">' + 
	  	'<div class="settings-title">Last.fm</div>' + 
	  '</div>'
	).insertBefore($('.settings-manager-my-device', elem));

	// Add Settings Option
	var $settings = $('<div class="settings-section-content">' +
		'<div class="lastfm-username">' + 
			'<span class="settings-name">Username: </span>' + 
			'<span class="settings-value">not linked</span>' + 
			' - <a id="authorization" class="primary" href="#lastfm-authorization" data-state="link">Link</a>' + 
		'</div>' + 
	  '</div>'
	).insertAfter($('.settings-lastfm', elem));


	var $authorizationLink = $('a#authorization', $settings),
		$authorizationStatus = $('.lastfm-username .settings-value'),
		currentToken = null;

	// Update element state if we have an existing session
	if(lastfm.session !== null) {
		$authorizationStatus.text(lastfm.session.name);
		$authorizationLink.attr('data-state', 'unlink').text('Unlink');
	}

	// On authorization link clicked
	$authorizationLink.click(function(event) {
		event.preventDefault();

		var buttonState = $authorizationLink.attr('data-state');

		if(buttonState == 'link') {
			// Get token from last.fm and open authorization url in new tab
			lastfm.auth.getToken(function(token) {
				currentToken = token;
				$authorizationLink.attr('data-state', 'confirm').text('Confirm');
				port.emit('gms.open', 'http://www.last.fm/api/auth/?api_key=' + lastfm.apiKey + '&token=' + token);
			});
		} else if(buttonState == 'confirm') {
			// Validate session with last.fm and update UI with result
			lastfm.auth.getSession(currentToken, function(result) {
				if(result.error === undefined) {
					$authorizationStatus.text(lastfm.session.name);
					$authorizationLink.attr('data-state', 'unlink').text('Unlink');
				} else {
					$authorizationStatus.text('link failed: "' + result.message + '" (' + result.error + ')');
					$authorizationLink.attr('data-state', 'link').text('Link');
				}
			});
		} else if(buttonState == 'unlink') {
			// Reset stored lastfm session and update UI
			lastfm.session = null;
			lastfm.saveSession();
			$authorizationStatus.text('not linked');
			$authorizationLink.attr('data-state', 'link').text('Link');
		}
	});
}

// Initialize when the settings panel is opened
document.documentElement.addEventListener('gm.showPanel', function(event) {
	var elem = event.detail.element;

	if(elem === undefined) {
		return;
	}

	if(elem.baseURI.endsWith('#/settings')) {
		initialize($(elem));
	}
});