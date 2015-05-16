//
// Google Music Scrobbler - Settings
//

GMS.AuthorizationSettings = (function() {
    var $button = null,
        $buttonContent = null,
        $status = null,
        currentToken = null;

    var $container = $(
        '<div id="gms-actions">' +
            '<sj-paper-button role="button" class="material-primary" data-state="link">' +
                '<div class="button-content" relative="" layout="" horizontal="" center-center="">' +
                    'Link Account' +
                '</div>' +
            '</sj-paper-button>' +
            '<span class="status"></span>' +
        '</div>'
    );

    function setStatus(status, backgroundColor, textColor, disabled) {
        backgroundColor = backgroundColor !== undefined ? backgroundColor : '';
        textColor = textColor !== undefined ? textColor : '#AAAAAA';
        disabled = disabled !== undefined ? disabled : false;

        $status.html(status);
        $status.css('color', textColor);
        $container.css('background-color', backgroundColor);

        if(disabled) {
            $buttonContent.attr('disabled', 'disabled');
        } else {
            $buttonContent.removeAttr('disabled');
        }
    }

    function setState(state, error) {
        $button.attr('data-state', state);

        if(state == 'unlink') {
            setStatus('Currently linked with account <b>' + LFM.session.name + '</b>');
        } else if(state == 'link') {
            if(error !== undefined) {
                setStatus(error, '#E86B6B', '#E8E8E8');
            } else {
                setStatus('');
            }
        } else if(state == 'confirm') {
            setStatus('Linking <b>not finished yet</b>, please confirm the link.', '#FFF196', '#AAAAAA');
        }

        if(state == 'unlink') {
            $buttonContent.text('Unlink Account');
        } else if(state == 'link') {
            $buttonContent.text('Link Account');
        } else if(state == 'confirm') {
            $buttonContent.text('Confirm Link');
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
        construct: function($card) {
            $card.prepend($container);

            $button = $('sj-paper-button', $container);
            $buttonContent = $('.button-content', $button);

            $status = $('.status', $container);

            // Update element state if we have an existing session
            if(LFM.session !== null) {
                setState('unlink');
            }

            $button.unbind('click').bind('click', authorizationClick);
        }
    };
})();

GMS.MiscSettings = (function() {
    function checkbox_change($checkbox) {
        var $label = $checkbox.parents('core-label');

        GMS.setOption($label.attr('data-key'), $checkbox.hasClass('checked'));
    }

    function create_checkbox($card, key, id, label) {
        if($('#gms-' + id + '-label').length > 0) {
            // checkbox already exists
            return;
        }

        var $control = $(
            '<core-label center="" horizontal="" layout="" id="gms-' + id + '-label" data-key="' + key + '">' +
                '<paper-checkbox tabindex="0" aria-checked="false" role="checkbox" id="gms-' + id + '-checkbox" aria-labelledby="gms-' + id + '-label">' +
                    '<div id="checkboxContainer" class="">' +
                        '<div id="checkbox"><div id="checkmark" class=""></div></div>' +
                    '</div>' +
                    '<div id="checkboxLabel" hidden=""></div>' +
                '</paper-checkbox>' +
                '<div flex="">' + label + '</div>' +
            '</div>'
        );

        var $paperCheckbox = $('paper-checkbox', $control),
            $checkbox = $('#checkbox', $control);

        if(GMS.getOption(key) === true) {
            $checkbox.addClass('checked');
        }

        $paperCheckbox.click(function() {
            if($checkbox.hasClass('checked')) {
                $checkbox.removeClass('checked');
            } else {
                $checkbox.addClass('checked');
            }

            checkbox_change($checkbox);
        });

        $card.append($control);
        return $control;
    }

    return {
        construct: function($card) {
            create_checkbox($card, 'display_icon', 'status-icon', 'Display status icon');
        }
    };
})();

GMS.Settings = (function() {
    var $card = $(
        '<div class="gms-settings-card settings-card material-shadow-z1">' +
            '<h1 class="settings-card-title">Google Music Scrobbler</h1>' +
            '<div class="controls"></div>' +
        '</div>'
    );

    var $options = null;

    function construct(panel, retry_num) {
        var $cards = $('.material-settings-view .settings-card', panel);

        // Settings haven't finished loading, retry in 200ms
        if($cards.length === 0) {
            if(retry_num === undefined) {
                retry_num = 0;
            }

            // Settings haven't loaded in 10 seconds, stop trying to inject.
            if(retry_num > 50) {
                return;
            }

            console.log("settings haven't finished loading, retry #" + retry_num);
            setTimeout(function() { construct(panel, retry_num + 1); }, 200);
            return;
        }

        // Insert our settings just before the last header (Manage My Devices)
        $card.insertAfter($cards[1]);

        var $controls = $('.controls', $card);

        GMS.AuthorizationSettings.construct($controls);
        GMS.MiscSettings.construct($controls);
    }

    // Construct when the settings panel is opened
    document.addEventListener('gm.showPanel', function(event) {
        var elem = event.detail.element;

        if(elem === undefined) {
            return;
        }

        if(elem.baseURI.endsWith('#/accountsettings')) {
            construct($(elem));
        }
    });
})();