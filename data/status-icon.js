GMS.StatusIcon = (function() {
    var data = null,
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

        $iconContainer.qtip({
            content: {
                text: content
            },
            position: {
                my: 'top right',
                at: 'bottom middle',
                target: $iconContainer
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
        $('#gbw').prepend(
            '<div id="gms-icon-container">' +
                '<img src="' + data.urls.icon24 + '"/>' +
                '</div>'
        );

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

        $iconContainer = $('#gms-icon-container');
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