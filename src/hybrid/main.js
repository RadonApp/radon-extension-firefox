const ss = require('sdk/simple-storage');
const webext = require("sdk/webextension");


function migrateHandler(data, sender, respond) {
    if(data.type !== 'migrate/preferences') {
        return;
    }

    // Respond with current preferences
    respond({
        lastfm: ss.storage['lastfm']
    });
}

// Start extension
webext.startup().then(({browser}) => {
  browser.runtime.onMessage.addListener(migrateHandler);
});
