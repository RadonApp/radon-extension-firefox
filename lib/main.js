var pageMod = require("sdk/page-mod"),
	self = require("sdk/self"),
	tabs = require("sdk/tabs"),
	ss = require('sdk/simple-storage');
 
// Create a page mod
pageMod.PageMod({
	include: /.*play\.google\.com\/music\/listen.*/,
	contentScriptFile: [self.data.url("jquery-1.10.2.min.js"),
                        self.data.url('attrmonitor.js'),
                        self.data.url("md5.js"),
                        self.data.url("gmusicscrobble.js"),
                        self.data.url("settings.js")],
	onAttach: function(worker) {
		worker.port.on('gms.ready', function(data) {
			worker.port.emit('gms.construct', {
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