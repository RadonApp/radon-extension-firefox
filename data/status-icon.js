GMS.StatusIcon = (function() {
    var data = null,
        $icon = null,
        $iconContainer = null,
        $setupPopup = null,
        remind = true;

    function show(type) {
        var content = null;
        if(type == 'setup') {
            content = $setupPopup;
        }

        if(content === null) {
            return;
        }

        $icon.qtip({
            content: {
                text: content
            },
            position: {
                my: 'bottom left',
                at: 'top right',
                target: $icon
            },
            show: {
                ready: true
            },
            hide: {
                event: ''
            },
            style: {
                width: 480
            }
        });
    }

    function buttonClick(event) {
        if($(this).hasClass('setup')) {
            location.hash = '#/settings';
        } else if($(this).hasClass('stop')) {
            GMS.store({
                setup_remind: false
            });
        }

        GMS.StatusIcon.destroy();
    }

    function construct() {
        if($('#playlists #gmm-icon-container').length < 1) {
            $('#playlists').after(
                '<div id="gmm-divider" class="nav-section-divider"></div>' +
                '<div id="gmm-icon-container"></div>'
            );
        }

        $iconContainer = $('#gmm-icon-container');

        $icon = $(
            '<img id="gms-icon" src="' + data.urls.icon24 + '" ' +
            'style="display: none;" ' +
            'title="Google Music Scrobbler - ' + GMS.version + '"/>'
        );
        $iconContainer.append($icon);

        $('body').append(
            '<div id="gms-popup-setup">' +
                "<p>Looks like you haven't finished setting up <b>Google Music Scrobbler</b></p>" +
                '<div class="actions">' +
                    '<button class="button small primary setup">Setup now</button>' +
                    '<button class="button small remind">Remind me later</button>' +
                    '<button class="button small stop">Stop bothering me</button>' +
                '</div>' +
            '</div>'
        );

        $setupPopup = $('#gms-popup-setup');

        $('.button.setup', $setupPopup).bind('click', buttonClick);
        $('.button.remind', $setupPopup).bind('click', buttonClick);
        $('.button.stop', $setupPopup).bind('click', buttonClick);
    }

    GMS.bind('construct', function(event, _data, storage) {
        data = _data;
        remind = storage.setup_remind === true || storage.setup_remind === undefined;

        construct();
    });

    GMS.LoadingMonitor.bind('loaded', function() {
        if(LFM.session === null && remind === true) {
            show('setup');
        }
    });

    return {
        show: show,
        destroy: function() {
            $('.qtip').qtip('destroy');
        }
    };
})();