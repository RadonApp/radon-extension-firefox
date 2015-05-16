GMS.StatusIcon = (function() {
    var data = null,
        $icon = null,
        $iconContainer = null,
        $iconContainerDivider = null,
        $setupPopup = null,
        remind = true;

    GMS.option_defaults.display_icon = true;

    function show(type) {
        if($icon === null) {
            return;
        }

        var content = null;
        if(type == 'setup') {
            content = $setupPopup;
        }

        if(content === null) {
            return;
        }

        $setupPopup.css('display', 'block');

        $icon.qtip({
            suppress: false,

            content: {
                text: content
            },
            position: {
                my: 'bottom left',
                at: 'bottom left',
                target: $(window),

                adjust: {
                    x: 2,
                    y: -2
                }
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

    function buttonClick(event) {
        if($(this).hasClass('setup')) {
            location.hash = '#/accountsettings';
        } else if($(this).hasClass('stop')) {
            GMS.store({
                setup_remind: false
            });
        }

        GMS.StatusIcon.destroy();
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
            '<div id="gms-popup-setup" style="display: none;">' +
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

        document.addEventListener('gm.pageLoaded', function(event) {
            construct();

            if(LFM.session === null && remind === true) {
                show('setup');
            }
        });
    });

    GMS.bind('option_changed', function(event, key, value) {

        if(key == 'display_icon') {
            set_visibility(value);
        }
    });

    return {
        show: show,
        destroy: function() {
            $('.qtip').css('display', 'none')
                      .qtip('destroy');

            $setupPopup.css('display', 'none');
        }
    };
})();