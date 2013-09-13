//
// Google Music Scrobbler - Settings
//

var GMS_Settings = {
    $header: $(
        '<div class="settings-section-header settings-lastfm" style="margin-top: 20px;">' +
            '<div class="settings-title">Google Music Scrobbler</div>' +
        '</div>'
    ),
    $options: $(
        '<div class="settings-section-content">' +
            '<div class="lastfm-action-section" style="margin: 12px 0px;">' +
                '<button id="authorization" class="button" data-state="link">Link Account</button>' +
                '<span id="authorization-status" style="margin-left: 10px;font-style: italic;color: rgb(170, 170, 170);"></span>' +
            '</div>' +
        '</div>'
    ),

    $_myDevice: null,

    $authorizationButton: null,
    $authorizationStatus: null,

    currentToken: null,

    initialize: function(panel) {
        this.$_myDevice = $('.settings-manager-my-device', panel);
        this.$header.insertBefore(this.$_myDevice);
        this.$options.insertAfter(this.$header);

        this.$authorizationButton = $('button#authorization', this.$options);
        this.$authorizationStatus = $('span#authorization-status', this.$options);

        // Update element state if we have an existing session
        if(lastfm.session !== null) {
            this.setState('unlink');
        }

        this.$authorizationButton.click(this._authorizationClick);
    },

    setState: function(state, error) {
        this.$authorizationButton.attr('data-state', state);

        if(state == 'unlink') {
            this.$authorizationStatus.html('Currently linked with account <b>' + lastfm.session.name + '</b>');
        } else if(state == 'link') {
            if(error !== undefined) {
                this.$authorizationStatus.html(error);
            } else {
                this.$authorizationStatus.html('');
            }
        } else if(state == 'confirm') {
            this.$authorizationStatus.html('Linking <b>not finished yet</b>, Please confirm authorization.');
        }

        if(state == 'unlink') {
            this.$authorizationButton
                .text('Unlink Account')
                .removeClass('primary');
        } else if(state == 'link') {
            this.$authorizationButton
                .text('Link Account')
                .removeClass('primary');
        } else if(state == 'confirm') {
            this.$authorizationButton
                .text('Confirm Link')
                .addClass('primary');
        }
    },

    _authorizationClick: function(event) {
        event.preventDefault();

        var buttonState = $(this).attr('data-state');

        if(buttonState == 'link') {
            GMS_Settings._link();
        } else if(buttonState == 'unlink') {
            GMS_Settings._unlink();
        } else if(buttonState == 'confirm') {
            GMS_Settings._confirm();
        }
    },

    _link: function() {
        lastfm.auth.getToken(function(token) {
            GMS_Settings.currentToken = token;
            GMS_Settings.setState('confirm');

            port.emit('gms.open', 'http://www.last.fm/api/auth/?api_key=' + lastfm.apiKey + '&token=' + token);
        });
    },

    _unlink: function() {
        // Reset stored lastfm session and update UI
        lastfm.session = null;
        lastfm.saveSession();

        GMS_Settings.setState('link');
    },

    _confirm: function() {
        // Validate session with last.fm and update UI with result
        lastfm.auth.getSession(GMS_Settings.currentToken, function(result) {
            if(result.error === undefined) {
                GMS_Settings.setState('unlink');
            } else {
                GMS_Settings.setState('link', 'link error "' + result.message + '" (' + result.error + ')');
            }
        });
    }
};

// Initialize when the settings panel is opened
document.documentElement.addEventListener('gm.showPanel', function(event) {
	var elem = event.detail.element;

	if(elem === undefined) {
		return;
	}

	if(elem.baseURI.endsWith('#/settings')) {
        GMS_Settings.initialize($(elem));
	}
});