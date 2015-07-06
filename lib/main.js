/*jshint moz:true */

const {Cc,Ci,Cm,Cr,Cu,components} = require("chrome");

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var pageMod = require("sdk/page-mod"),
    self = require("sdk/self"),
    tabs = require("sdk/tabs"),
    ss = require('sdk/simple-storage');

const RE_LISTEN_JS = /^https?:\/\/ssl\.gstatic\.com\/play\/music\/\w+\/\w+\/listen(_extended)?(_\w+)?(__.+)?\.js/i;

// Intercept page requests
var observer = {
    modifyResponse: {
        observe: function(aSubject, aTopic, aData) {
            aSubject.QueryInterface(Ci.nsITraceableChannel);

            var listener = new RequestHandler();
            listener.original = aSubject.setNewListener(listener);
        },
        register: function() {
            Services.obs.addObserver(observer.modifyResponse, 'http-on-examine-response', false);
            Services.obs.addObserver(observer.modifyResponse, 'http-on-examine-cached-response', false);
        },
        unregister: function() {
            Services.obs.removeObserver(observer.modifyResponse, 'http-on-examine-response');
            Services.obs.removeObserver(observer.modifyResponse, 'http-on-examine-cached-response');
        },
        QueryInterface : function (aIID)    {
            if (aIID.equals(Ci.nsIObserver) || aIID.equals(Ci.nsISupports)) {
                return this;
            }

            throw Cr.NS_NOINTERFACE;
        }
    }
};

// Helper function for XPCOM instance construction
function CCIN(cName, ifaceName) {
    return Cc[cName].createInstance(Ci[ifaceName]);
}

// Hook insertion helper
const RE_EV1_ANCHOR = /var\s(\w)=\{eventName:.*?,eventSrc:.*?,payload:.*?\},\w=.*?;/i;
const RE_EV2_ANCHOR = /\w\.dispatchEvent=function\((\w+)\)\{/i;
const RE_PS_ANCHOR = /\w\.playSong=function\((\w+),(\w+),(\w+),(\w+)\)\{/i;

function inject_hook(data, pattern, fn) {
    var match = pattern.exec(data);

    if(match === null) {
        return null;
    }

    var slice_start = match.index + match[0].length;

    var head = data.slice(0, slice_start);
    var tail = data.slice(slice_start, data.length);

    return head + fn(match) + tail;
}

function inject_ev1_hook(data) {
    return inject_hook(data, RE_EV1_ANCHOR, function(match) {
        return "if(window.gms_ev1 !== undefined){window.gms_ev1(" + match[1] + ");}";
    });
}

function inject_ev2_hook(data) {
    return inject_hook(data, RE_EV2_ANCHOR, function(match) {
        return "if(window.gms_ev2 !== undefined){window.gms_ev2(" + match[1] + ");}";
    });
}

function inject_ps_hook(data) {
    return inject_hook(data, RE_PS_ANCHOR, function(match) {
        var parameters = [
            match[1],
            match[2],
            match[3],
            match[4]
        ];

        return "if(window.gms_ps !== undefined){window.gms_ps(this, [" + parameters.join(',') + "]);}"
    });
}

var hooks = {
    available: {
        ev1: inject_ev1_hook,
        ev2: inject_ev2_hook,

        ps: inject_ps_hook
    },
    injected: {}
};

function inject_hooks(data) {
    for(var key in hooks.available) {
        if(!hooks.available.hasOwnProperty(key)) {
            continue;
        }

        var hook = hooks.available[key],
            result = hook(data);

        if(result !== null) {
            data = result;

            hooks.injected[key] = true;
        }
    }

    return data;
}

const ACCEPTED_ENCODINGS = ["gzip", "deflate", "x-gzip", "x-deflate"];
const Converter = Cc["@mozilla.org/streamConverters;1"].getService(Ci.nsIStreamConverterService);

function constructDecoder(encodings, listener) {
    let current = listener;

    // Construct a chain of `asyncConvertData` calls to decode data
    // with the specified `encodings`
    for (let i = encodings.length - 1; i >= 0; --i) {
        let from = encodings[i].toLowerCase();

        if (ACCEPTED_ENCODINGS.indexOf(from) == -1) {
            log.warn('Unknown content encoding "' + from + '", ignoring');
            continue;
        }

        console.log('constructDecoder: ' + from + ' ->');

        current = Converter.asyncConvertData(from, "uncompressed", current, null);
    }

    return current;
}

function constructEncoder(encodings, listener) {
    let current = listener;

    // Construct a chain of `asyncConvertData` calls to encode data
    // in the specified `encodings`
    for (let i = 0; i < encodings.length; ++i) {
        let to = encodings[i].toLowerCase();

        if (ACCEPTED_ENCODINGS.indexOf(to) == -1) {
            log.warn('Unknown content encoding "' + to + '", ignoring');
            continue;
        }

        console.log('constructEncoder: -> ' + to);

        current = Converter.asyncConvertData("uncompressed", to, current, null);
    }

    return current;
}

// Response listener implementation.
function RequestHandler() {
    this.original = null;

    this.encoder = null;
    this.decoder = null;

    this.injector = null;
}

RequestHandler.prototype =
{
    onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
        if(!RE_LISTEN_JS.test(aRequest.name)) {
            this.original.onDataAvailable(aRequest, aContext, aInputStream, aOffset, aCount);
            return;
        }

        if (this.decoder) {
            this.decoder.onDataAvailable(aRequest, aContext, aInputStream, aOffset, aCount);
        } else {
            this.injector.onDataAvailable(aRequest, aContext, aInputStream, aOffset, aCount);
        }
    },

    onStartRequest: function(aRequest, aContext) {
        // Call `onStartReuest` on the original listener first, this ensures
        // `channel.applyConversion` will be correctly set.
        this.original.onStartRequest(aRequest, aContext);

        if(!RE_LISTEN_JS.test(aRequest.name)) {
            return;
        }

        // In multi-process mode response streams are still encoded, so we need to
        // 1. decode the content
        // 2. inject the hooks
        // 3. re-encode the content (so the browser can then correctly decode it again)
        let channel = aRequest.QueryInterface(Ci.nsIHttpChannel);

        if (channel instanceof Ci.nsIEncodedChannel && !channel.applyConversion) {
            let encodingHeader = channel.getResponseHeader("Content-Encoding");
            var encodings = encodingHeader.split(/\s*\t*,\s*\t*/);

            console.log('Channel encodings:', encodings);

            // Construct listeners to: decode -> inject -> encode
            this.encoder = constructEncoder(encodings, this.original);
            this.injector = new HookInjector(this.encoder);

            this.decoder = constructDecoder(encodings, this.injector);

            console.log('Initialized handler for encoded stream');

            this.decoder.onStartRequest(aRequest, null);
        } else {
            this.injector = new HookInjector(this.original);

            console.log('Initialized handler for raw stream');

            this.injector.onStartRequest(aRequest, aContext);
        }
    },

    onStopRequest: function(aRequest, aContext, aStatusCode) {
        if(!RE_LISTEN_JS.test(aRequest.name)) {
            this.original.onStopRequest(aRequest, aContext, aStatusCode);
            return;
        }

        if (this.decoder) {
            this.decoder.onStopRequest(aRequest, aContext, aStatusCode);

            // Reset listeners for encoded streams
            this.encoder = null;
            this.injector = null;

            this.decoder = null;
        } else {
            this.injector.onStopRequest(aRequest, aContext, aStatusCode);
        }
    },

    QueryInterface: function (aIID) {
        if (aIID.equals(Ci.nsIStreamListener) ||
            aIID.equals(Ci.nsISupports)) {
            return this;
        }

        throw Cr.NS_NOINTERFACE;
    }
};

function HookInjector(original) {
    this.original = original;
}

HookInjector.prototype = {
    onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
        console.log('HookInjector.onDataAvailable');

        var storageStream = CCIN("@mozilla.org/storagestream;1", "nsIStorageStream");
        storageStream.init(8192, aCount, null);

        var binaryInputStream = CCIN("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream");
        binaryInputStream.setInputStream(aInputStream);

        var binaryOutputStream = CCIN("@mozilla.org/binaryoutputstream;1", "nsIBinaryOutputStream");
        binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));

        // Retrieve chunk from stream
        var data = binaryInputStream.readBytes(aCount);

        // Try inject hooks
        data = inject_hooks(data);

        // Write chunk to output stream
        binaryOutputStream.writeBytes(data, data.length);

        this.original.onDataAvailable(aRequest, aContext, storageStream.newInputStream(0), aOffset, data.length);
    },

    onStartRequest: function(aRequest, aContext) {
        console.log('HookInjector.onStartRequest');

        hooks.injected = {
            ev1: false,
            ev2: false,

            ps: false
        };
    },

    onStopRequest: function(aRequest, aContext, statusCode) {
        console.log('HookInjector.onStopRequest');

        console.log('GMS - hooks injected:', hooks.injected);

        this.original.onStopRequest(aRequest, aContext, statusCode);
    },

    QueryInterface: function (aIID) {
        if (aIID.equals(Ci.nsIStreamListener) ||
            aIID.equals(Ci.nsISupports)) {
            return this;
        }

        throw Cr.NS_NOINTERFACE;
    }
};

exports.main = function() {
    observer.modifyResponse.register();

    // Create a page mod
    pageMod.PageMod({
        include: /.*play\.google\.com\/music\/listen.*/,

        contentScriptFile: [self.data.url("vendor/jquery/jquery-1.10.2.min.js"),
                            self.data.url("vendor/jquery/jquery-migrate-1.2.1.min.js"),
                            self.data.url("vendor/jquery.qtip/jquery.qtip.min.js"),
                            self.data.url('vendor/attrmonitor.js'),
                            self.data.url("vendor/md5.js"),
                            self.data.url("lastfm.js"),
                            self.data.url("core.js"),
                            self.data.url("settings.js"),
                            self.data.url("status-icon.js"),
                            self.data.url("bootstrap.js")],

        contentStyleFile: [self.data.url("vendor/jquery.qtip/jquery.qtip.min.css"),
                           self.data.url("media/status-icon.css"),
                           self.data.url("media/settings.css")],

        contentScriptWhen: 'ready',

        onAttach: function(worker) {
            worker.port.on('gms.ready', function(data) {
                worker.port.emit('gms.construct', {
                    urls: {
                        icon24: self.data.url('media/icon24.png'),
                        page: self.data.url('page.js')
                    },
                    pageUrl: self.data.url('page.js'),
                    storage: ss.storage
                });
            });

            worker.port.on('gms.open', function(url) {
                tabs.open(url);
            });

            worker.port.on('gms.store', function(data) {
                Object.keys(data).forEach(function(key) {
                    ss.storage[key] = data[key];
                });
            });
        }
    });
};

exports.onUnload = function() {
    observer.modifyResponse.unregister();
};