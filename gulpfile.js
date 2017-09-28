var path = require('path');


require('babel-register')({
    ignore: [
        function(filename) {
            filename = path.resolve(__dirname, filename);

            // Compile package modules
            if(filename.indexOf('node_modules') === -1) {
                return false;
            }

            // Compile "lodash-es"
            if(filename.indexOf(path.join('node_modules', 'lodash-es')) >= 0) {
                return false;
            }

            return true;
        }
    ],
    only: false
});

require('./gulpfile.babel.js');
