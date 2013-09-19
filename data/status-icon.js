var GMS_StatusIcon = {
    $iconContainer: null,

    initialize: function() {
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

        this.$iconContainer = $('#gms-icon-container');
        this.$setupPopup = $('#gms-popup-setup');

        $('.button.setup', this.$setupPopup).bind('click', GMS_StatusIcon._setup);
        $('.button.remind', this.$setupPopup).bind('click', GMS_StatusIcon._remind);
        $('.button.stop', this.$setupPopup).bind('click', GMS_StatusIcon._stop);
    },

    showTooltip: function(type) {
        var content = null;
        if(type == 'setup') {
            content = GMS_StatusIcon.$setupPopup;
        }

        if(content === null) {
            return;
        }

        GMS_StatusIcon.$iconContainer.qtip({
            content: {
                text: content
            },
            position: {
                my: 'top right',
                at: 'bottom middle',
                target: this.$iconContainer
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
    },

    destroy: function() {
        $('.qtip').qtip('destroy');
    },

    _setup: function() {
        location.hash = '#/settings';
        GMS_StatusIcon.destroy();
    },
    _remind: function() {
        GMS_StatusIcon.destroy();
    },
    _stop: function() {
        self.port.emit('gms.store', {
            setup_remind: false
        });
        GMS_StatusIcon.destroy();
    }
};

self.port.on('gms.construct', function(data) {
    var storage = data.storage,
        setup_remind = storage.setup_remind == true || storage.setup_remind === undefined;

    GMS_StatusIcon.initialize();

    if(lastfm.session === null && setup_remind) {
        GMS_StatusIcon.showTooltip('setup');
    }
});