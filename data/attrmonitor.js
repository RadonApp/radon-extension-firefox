(function($) {
    function setup($e, options) {
        var instance = $e.data('attrmonitor');
        if(instance !== undefined) {
            return;
        }

        instance = {
            $element: $e,
            options: options,
            intervalId: null,
            history: {},

            start: function() {
                if(instance.intervalId !== null) {
                    instance.stop();
                }
                instance.intervalId = window.setInterval(instance._run, instance.options.interval);
                console.log('attrmonitor started');
            },
            stop: function() {
                if(instance.intervalId !== null) {
                    window.clearInterval(instance.intervalId);
                    instance.intervalId = null;
                    console.log('attrmonitor stopped');
                }
            },
            destroy: function() {
                instance.stop();
                instance.$element.removeData('attrmonitor');
            },

            _run: function() {
                for(var i = 0; i < instance.options.attributes.length; i++) {
                    var attrName = instance.options.attributes[i],
                        value = instance.$element.attr(attrName);

                    if(value === undefined) {
                        value = null;
                    }

                    if(instance.history[attrName] === undefined ||
                       instance.history[attrName] != value)
                    {
                        instance.history[attrName] = value;
                        instance.options.callback({
                            attribute: attrName,
                            value: value
                        });

                        console.log('attribute "' + attrName + '" changed to "' + value + '"');
                    }
                }
            }
        };

        if(options.start == true) {
            instance.start();
        }

        $e.data('attrmonitor', instance);
    }

    function call($e, method) {
        var instance = $e.data('attrmonitor');
        if(instance === undefined) {
            return;
        }

        instance[method]();
    }

    $.fn.attrmonitor = function(o) {
        return this.each(function() {
            var $e = $(this);

            if(typeof o == 'string') {
                call($e, o);
            } else {
                var options = {
                    attributes: [],
                    interval: 500,  // in ms
                    start: true,
                    callback: null
                };
                $.extend(options, o);

                setup($e, options);
            }
        });
    }
}(jQuery));