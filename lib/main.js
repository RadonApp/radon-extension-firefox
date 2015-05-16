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
    httpModify: {
        observe: function(aSubject, aTopic, aData) {
            aSubject.QueryInterface(Ci.nsITraceableChannel);

            var newListener = new TracingListener();
            newListener.originalListener = aSubject.setNewListener(newListener);
        },
        register: function() {
            Services.obs.addObserver(observer.httpModify, 'http-on-examine-response', false);
            Services.obs.addObserver(observer.httpModify, 'http-on-examine-cached-response', false);
        },
        unregister: function() {
            Services.obs.removeObserver(observer.httpModify, 'http-on-examine-response');
            Services.obs.removeObserver(observer.httpModify, 'http-on-examine-cached-response');
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
const RE_LEX_ANCHOR = /var\s(\w)=\{eventName:.*?,eventSrc:.*?,payload:.*?\},\w=.*?;/i;

function insert_hook(data) {
    var match = RE_LEX_ANCHOR.exec(data);

    if(match === null) {
        console.log('Unable to find event anchor');
        return data;
    }

    console.log(match);

    var slice_start = match.index + match[0].length;

    var head = data.slice(0, slice_start);
    var tail = data.slice(slice_start, data.length);

    console.log('Hook inserted at event anchor');
    return head + "if(window.gms_event !== undefined){window.gms_event(" + match[1] + ");}" + tail;
}

// Response listener implementation.
function TracingListener() {
    this.originalListener = null;
}

TracingListener.prototype =
{
    onDataAvailable: function(request, context, inputStream, offset, count) {
        if(!RE_LISTEN_JS.test(request.name)) {
            this.originalListener.onDataAvailable(request, context, inputStream, offset, count);
            return;
        }

        var storageStream = CCIN("@mozilla.org/storagestream;1", "nsIStorageStream");
        storageStream.init(8192, count, null);

        var binaryInputStream = CCIN("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream");
        binaryInputStream.setInputStream(inputStream);

        var binaryOutputStream = CCIN("@mozilla.org/binaryoutputstream;1", "nsIBinaryOutputStream");
        binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));

        // Retrieve chunk from stream
        var data = binaryInputStream.readBytes(count);

        // Try insert hook at event anchor
        data = insert_hook(data);

        // Write chunk to output stream
        binaryOutputStream.writeBytes(data, data.length);

        this.originalListener.onDataAvailable(request, context, storageStream.newInputStream(0), offset, data.length);
    },

    onStartRequest: function(request, context) {
        if(!RE_LISTEN_JS.test(request.name)) {
            this.originalListener.onStartRequest(request, context);
            return;
        }

        console.log('onStartRequest', request.name);

        this.originalListener.onStartRequest(request, context);
    },

    onStopRequest: function(request, context, statusCode) {
        if(!RE_LISTEN_JS.test(request.name)) {
            this.originalListener.onStopRequest(request, context, statusCode);
            return;
        }

        console.log('onStopRequest', request.name);

        this.originalListener.onStopRequest(request, context, statusCode);
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
    observer.httpModify.register();

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
    observer.httpModify.unregister();
};