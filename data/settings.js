//
// Google Music Scrobbler - Settings
//

GMS.AuthorizationSettings = (function() {
    var $authorizationButton = null,
        $authorizationStatus = null,
        currentToken = null;

    var $section = $(
        '<div class="lastfm-action-section">' +
            '<button id="authorization" class="button" data-state="link">Link Account</button>' +
            '<span id="authorization-status"></span>' +
        '</div>'
    );

    function setStatus(status, backgroundColor, textColor, disabled) {
        backgroundColor = backgroundColor !== undefined ? backgroundColor : '';
        textColor = textColor !== undefined ? textColor : '#AAAAAA';
        disabled = disabled !== undefined ? disabled : false;

        $authorizationStatus.html(status);
        $authorizationStatus.css('color', textColor);
        $section.css('background-color', backgroundColor);

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

    return {
        construct: function($options) {
            $options.append($section);

            $authorizationButton = $('button#authorization', $section);
            $authorizationStatus = $('span#authorization-status', $section);

            // Update element state if we have an existing session
            if(LFM.session !== null) {
                setState('unlink');
            }

            $authorizationButton.unbind('click').bind('click', authorizationClick);
        }
    };
})();

GMS.MiscSettings = (function() {
    var $section = null;

    function checkbox_change(event) {
        var $control = $('#' + event.data.id, $section);

        GMS.setOption(event.data.key, $control.prop('checked'));
    }

    function create_checkbox(key, id, label) {
        var $control = $(
            '<div class="lastfm-control" key="' + key + '">' +
                '<input id="' + id + '" type="checkbox">' +
                '<label for="' + id + '">' + label + '</label>' +
            '</div>'
        );

        if(GMS.getOption(key) === true) {
            $('input[type="checkbox"]', $control).prop('checked', true);
        }

        $control.change({
            key: key,
            id: id
        }, checkbox_change);

        $section.append($control);
        return $control;
    }

    return {
        construct: function($options) {
            $section = $('<div class="lastfm-misc-section"></div>');

            create_checkbox('display_icon', 'lastfm-display-icon', 'Display status icon');

            $options.append($section);
        }
    };
})();

GMS.Settings = (function() {
    var $header = $(
        '<div class="settings-cluster">' +
            '<div class="header">' +
                '<div class="title">Google Music Scrobbler</div>' +
            '</div>' +
        '</div>'
    );

    var $options = null;

    function construct(panel, retry_num) {
        var headers = $('.settings-cluster', panel);

        // Settings haven't finished loading, retry in 200ms
        if(headers.length === 0) {
            if(retry_num === undefined) {
                retry_num = 0;
            }

            // Settings haven't loaded in 10 seconds, stop trying to inject.
            if(retry_num > 50) {
                return;
            }

            console.log("settings haven't finished loading, retry #" + retry_num);
            setTimeout(function() { construct(panel, retry_num + 1); }, 200);
        }

        // Insert our settings just before the last header (Manage My Devices)
        $header.insertBefore(headers[headers.length - 1]);

        $options = $('<div class="settings-section-content" style="padding-top: 5px;"></div>');
        $options.insertAfter($header);

        GMS.AuthorizationSettings.construct($options);
        GMS.MiscSettings.construct($options);
    }

    // Construct when the settings panel is opened
    document.addEventListener('gm.showPanel', function(event) {
        var elem = event.detail.element;

        if(elem === undefined) {
            return;
        }

        if(elem.baseURI.endsWith('#/settings')) {
            construct($(elem));
        }
    });
})();