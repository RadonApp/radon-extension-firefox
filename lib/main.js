const {Cc,Ci,Cm,Cr,Cu,components} = require("chrome");

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var pageMod = require("sdk/page-mod"),
    self = require("sdk/self"),
    tabs = require("sdk/tabs"),
    ss = require('sdk/simple-storage'),
    r = require("sdk/request");

const RE_DOMAIN = /^https?:\/\/play\.google\.com\/music\/listen/i;
const RE_LISTEN_JS = /^https?:\/\/ssl\.gstatic\.com\/play\/music\/\w+\/\w+\/listen_extended_\w+\.js/i;

var lex_location = null;

let registrar = components.manager.QueryInterface(Ci.nsIComponentRegistrar);
let catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);

// Create policy
let policy =
{
    classDescription: "Google Music Scrobbler Intercept Policy",
    classID: components.ID("{a4248b2d-dc0e-44a7-8cb8-f8c4971a3dd4}"),
    contractID: "@gmusicscrobbler/intercept-policy;1",
    xpcom_categories: ["content-policy"],

    init: function()
    {
        registrar.registerFactory(this.classID, this.classDescription, this.contractID, this);

        for each (let category in this.xpcom_categories)
            catMan.addCategoryEntry(category, this.contractID, this.contractID, false, true);
    },

    unload: function() {
        for each (let category in this.xpcom_categories)
            catMan.deleteCategoryEntry(category, this.contractID, false);

        registrar.unregisterFactory(this.classID, this);
    },

    shouldLoad: function(contentType, contentLocation, requestOrigin, wrappedNode, mimeTypeGuess, extra)
    {
        if(contentType == 2 && RE_DOMAIN.test(requestOrigin.spec) && RE_LISTEN_JS.test(contentLocation.spec)) {
            var node = wrappedNode.wrappedJSObject;

            try {
                // check for override attribute
                if(node.hasAttribute('override') && node.getAttribute('override') == 'true') {
                    return Ci.nsIContentPolicy.ACCEPT;
                }

                lex_location = contentLocation.spec;

                node.removeAttribute('src');
                node.setAttribute('blocked', 'true');

                console.log("Rejected listen_extended script request");
                return Ci.nsIContentPolicy.REJECT_REQUEST;
            } catch(e) {
                console.log("Error while processing listen_extended script request.");
                return Ci.nsIContentPolicy.ACCEPT;
            }
        }
        return Ci.nsIContentPolicy.ACCEPT;
    },
    shouldProcess: function(contentType, contentLocation, requestOrigin, node, mimeTypeGuess, extra)
    {
        return Ci.nsIContentPolicy.ACCEPT;
    },
    createInstance: function(outer, iid)
    {
        if (outer)
            throw Cr.NS_ERROR_NO_AGGREGATION;
        return this.QueryInterface(iid);
    },

    QueryInterface: XPCOMUtils.generateQI([Ci.nsIContentPolicy, Ci.nsIFactory])
};

exports.main = function() {
    policy.init();

    // Create a page mod
    pageMod.PageMod({
        include: /.*play\.google\.com\/music\/listen.*/,
        contentScriptFile: [self.data.url("jquery-1.10.2.min.js"),
                            self.data.url('attrmonitor.js'),
                            self.data.url("md5.js"),
                            self.data.url("gmusicscrobble.js"),
                            self.data.url("settings.js")],
        contentScriptWhen: 'ready',

        onAttach: function(worker) {
            worker.port.on('gms.ready', function(data) {
                worker.port.emit('gms.construct', {
                    pageUrl: self.data.url('page.js'),
                    storage: ss.storage,
                    lex_location: lex_location
                });
            });

            worker.port.on('gms.lex_request', function(data) {
                data['onComplete'] = function(response) {
                    worker.port.emit('gms.lex_response', response.text);
                };
                r.Request(data).get();
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
    policy.unload();
};