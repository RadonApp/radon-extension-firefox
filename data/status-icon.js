GMS.StatusIcon = (function() {
    var data = null,
        $icon = null,
        $iconContainer = null,
        $iconContainerDivider = null,
        $errorPopup = null,
        $expiredPopup = null,
        $setupPopup = null,
        remind = true;

    GMS.option_defaults.display_icon = true;

    function show(type, message) {
        if($icon === null) {
            return;
        }

        // Retrieve content element
        var content = null;

        if(type == 'error') {
            content = $errorPopup;
        } else if(type == 'expired') {
            content = $expiredPopup;
        } else if(type == 'setup') {
            content = $setupPopup;
        }

        if(content === null) {
            return;
        }

        // Destroy existing popups
        destroy();

        // Setup content
        content.css('display', 'block');

        if(typeof message !== 'undefined') {
            $('.message', content).text(message);
        }

        // Show popup
        $icon.qtip({
            suppress: false,

            content: {
                text: content
            },
            position: {
                my: 'bottom left',
                at: 'bottom left',
                target: $(window)
            },
            show: {
                ready: true
            },
            hide: {
                event: ''
            },
            style: {
                classes: 'qtip-fixed',
                tip: false,

                width: 480
            }
        });
    }

    function destroy() {
        $('.qtip').css('display', 'none')
                  .qtip('destroy');

        $errorPopup.css('display', 'none');
        $expiredPopup.css('display', 'none');
        $setupPopup.css('display', 'none');
    }

    function onDismiss() {
        GMS.StatusIcon.destroy();
    }

    function onRefreshAuthorization() {
        GMS.Settings.refreshAuthorization();
        onDismiss();
    }

    function onSetup() {
        location.hash = '#/accountsettings';
        onDismiss();
    }

    function onStopSetupReminder() {
        GMS.store({setup_remind: false});
        onDismiss();
    }

    function set_visibility(visible) {
        if(visible) {
            if($('#gms-icon', $iconContainer).length > 0) {
                return;
            }

            $icon = $(
                '<img id="gms-icon" src="' + data.urls.icon24 + '" ' +
                'style="display: none;" ' +
                'title="Google Music Scrobbler - ' + GMS.version + '"/>'
            );

            $iconContainer.append($icon);

            $iconContainerDivider.css('display', 'block');
            $iconContainer.css('display', 'block');
        } else {
            if($icon !== null) {
                $icon.remove();
            }
            $icon = null;

            if($iconContainer.children().length < 1) {
                $iconContainerDivider.css('display', 'none');
                $iconContainer.css('display', 'none');
            }
        }
    }

    function construct() {
        if($('#playlists #gmm-icon-container').length < 1) {
            $('#nav').append(
                '<div id="gmm-divider" class="nav-section-divider"></div>' +
                '<div id="gmm-icon-container"></div>'
            );
        }

        $iconContainerDivider = $('#gmm-divider');
        $iconContainer = $('#gmm-icon-container');

        set_visibility(GMS.getOption('display_icon'));

        $('body').append(
            '<div id="gms-popup-setup" class="gms-popup" style="display: none;">' +
                "<p>Looks like you haven't finished setting up <b>Google Music Scrobbler</b></p>" +
                '<div class="actions">' +
                    '<button class="button small primary setup">Setup now</button>' +
                    '<button class="button small dismiss">Remind me later</button>' +
                    '<button class="button small stop">Stop bothering me</button>' +
                '</div>' +
            '</div>' +
            '<div id="gms-popup-error" class="gms-popup" style="display: none;">' +
                '<h2>Google Music Scrobbler</h2>' +
                '<p class="message"></p>' +
                '<div class="actions">' +
                    '<button class="button small dismiss">Dismiss</button>' +
                '</div>' +
            '</div>' +
            '<div id="gms-popup-expired" class="gms-popup" style="display: none;">' +
                '<h2>Google Music Scrobbler</h2>' +
                '<p class="message">Your last.fm session has expired or been revoked, would you like to refresh your last.fm session?</p>' +
                '<div class="actions">' +
                    '<button class="button small primary refresh">Refresh</button>' +
                    '<button class="button small dismiss">Dismiss</button>' +
                '</div>' +
            '</div>'
        );

        // Initialize setup popup
        $setupPopup = $('#gms-popup-setup');

        $('.button.setup', $setupPopup).bind('click', onSetup);
        $('.button.dismiss', $setupPopup).bind('click', onDismiss);
        $('.button.stop', $setupPopup).bind('click', onStopSetupReminder);

        // Initialize error popup
        $errorPopup = $('#gms-popup-error');

        $('.button.dismiss', $errorPopup).bind('click', onDismiss);

        // Initialize expired popup
        $expiredPopup = $('#gms-popup-expired');

        $('.button.refresh', $expiredPopup).bind('click', onRefreshAuthorization);
        $('.button.dismiss', $expiredPopup).bind('click', onDismiss);
    }

    GMS.bind('construct', function(event, _data, storage) {
        data = _data;
        remind = storage.setup_remind === true || storage.setup_remind === undefined;

        document.addEventListener('gms.ev1.pageLoaded', function(event) {
            try {
                construct();
            } catch(ex) {
                console.log("Unable to construct status icon", ex.stack, ex.message);
            }

            if(LFM.session === null && remind === true) {
                show('setup');
            }
        });
    });

    GMS.bind('lfm.error', function(event, code, message) {
        show('error', message);
    });

    GMS.bind('lfm.expired', function(event, code, message) {
        show('expired');
    });

    GMS.bind('option_changed', function(event, key, value) {
        if(key == 'display_icon') {
            set_visibility(value);
        }
    });

    return {
        show: show,
        destroy: destroy
    };
})();