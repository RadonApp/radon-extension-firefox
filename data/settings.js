//
// Google Music Scrobbler - Settings
//

GMS.Settings = (function() {
    var $header = $(
        '<div class="settings-section-header settings-lastfm" style="margin-top: 20px;">' +
            '<div class="settings-title">Google Music Scrobbler</div>' +
        '</div>'
    );

    var $options = $(
        '<div class="settings-section-content">' +
            '<div class="lastfm-action-section" style="display: inline-block;border-bottom-right-radius: 2px;border-top-right-radius: 2px;">' +
                '<button id="authorization" class="button" data-state="link">Link Account</button>' +
                '<span id="authorization-status" style="margin: 0 10px 0 5px;font-style: italic;color: #AAAAAA;"></span>' +
            '</div>' +
        '</div>'
    );

    var $myDevice = null,
        $actionSection = null,
        $authorizationButton = null,
        $authorizationStatus = null,
        currentToken = null;

    function setStatus(status, backgroundColor, textColor, disabled) {
        backgroundColor = backgroundColor !== undefined ? backgroundColor : '';
        textColor = textColor !== undefined ? textColor : '#AAAAAA';
        disabled = disabled !== undefined ? disabled : false;

        $authorizationStatus.html(status);
        $authorizationStatus.css('color', textColor);
        $actionSection.css('background-color', backgroundColor);

        if(disabled) {
            $authorizationButton.attr('disabled', 'disabled');
        } else {
            $authorizationButton.removeAttr('disabled');
        }
    }

    function setState(state, error) {
        $authorizationButton.attr('data-state', state);

        if(state == 'unlink') {
            setStatus('Currently linked with account <b>' + LFM.session.name + '</b>');
        } else if(state == 'link') {
            if(error !== undefined) {
                setStatus(error, '#E86B6B', '#E8E8E8');
            } else {
                setStatus('');
            }
        } else if(state == 'confirm') {
            setStatus('Linking <b>not finished yet</b>, Please confirm authorization.', '#FFF196', '#AAAAAA');
        }

        if(state == 'unlink') {
            $authorizationButton
                .text('Unlink Account')
                .removeClass('primary');
        } else if(state == 'link') {
            $authorizationButton
                .text('Link Account')
                .removeClass('primary');
        } else if(state == 'confirm') {
            $authorizationButton
                .text('Confirm Link')
                .addClass('primary');
        }
    }

    function link() {
        LFM.auth.getToken(function(token) {
            currentToken = token;
            setState('confirm');

            GMS.open('http://www.last.fm/api/auth/?api_key=' + LFM.apiKey + '&token=' + token);
        });
    }

    function unlink() {
        // Reset stored lastfm session and update UI
        LFM.session = null;
        GMS.storeSession();

        // Reset setup reminder
        GMS.store({
            setup_remind: true
        });

        setState('link');
    }

    function confirm() {
        setStatus('Checking authorization status...', undefined, undefined, true);

        // Validate session with last.fm and update UI with result
        LFM.auth.getSession(currentToken, function(result) {
            GMS.storeSession();

            if(result.error === undefined) {
                setState('unlink');
            } else {
                setState('link', 'Link error "' + result.message + '" (' + result.error + ')');
            }
        });
    }

    function authorizationClick(event) {
        event.preventDefault();

        var buttonState = $(this).attr('data-state');

        if(buttonState == 'link') {
            link();
        } else if(buttonState == 'unlink') {
            unlink();
        } else if(buttonState == 'confirm') {
            confirm();
        }
    }

    function construct(panel) {
        $myDevice = $('.settings-manager-my-device', panel);
        $header.insertBefore($myDevice);
        $options.insertAfter($header);

        $actionSection = $('.lastfm-action-section', $options);
        $authorizationButton = $('button#authorization', $options);
        $authorizationStatus = $('span#authorization-status', $options);

        // Update element state if we have an existing session
        if(LFM.session !== null) {
            setState('unlink');
        }

        $authorizationButton.unbind('click').bind('click', authorizationClick);
    }

    // Construct when the settings panel is opened
    document.documentElement.addEventListener('gm.showPanel', function(event) {
        var elem = event.detail.element;

        if(elem === undefined) {
            return;
        }

        if(elem.baseURI.endsWith('#/settings')) {
            construct($(elem));
        }
    });
})();