import Filesystem from 'fs';
import IsNil from 'lodash-es/isNil';
import Mkdirp from 'mkdirp';
import Path from 'path';


export function readJson(path, defaultValue) {
    return new Promise((resolve, reject) => {
        // Read `body` from file `path`
        Filesystem.readFile(path, (err, body) => {
            if(err) {
                // Return the `defaultValue` if the file doesn't exist
                if(err.code === 'ENOENT' && !IsNil(defaultValue)) {
                    resolve(defaultValue);
                    return;
                }

                // Reject promise with error
                reject(err);
                return;
            }

            let data;

            // Decode JSON `body`
            try {
                data = JSON.parse(body);
            } catch(e) {
                // Reject promise with decode error
                reject(e);
                return;
            }

            // Resolve promise with decoded data
            resolve(data);
        });
    });
}

export function writeJson(path, data) {
    let body;

    // Encode `data` to JSON
    try {
        body = JSON.stringify(data, null, 2);
    } catch(e) {
        // Reject promise with encode error
        return Promise.reject(e);
    }

    return new Promise((resolve, reject) => {
        // Ensure directory exists
        Mkdirp.sync(Path.dirname(path));

        // Write `body` to file `path`
        Filesystem.writeFile(path, body, (err) => {
            if(err) {
                // Reject promise with error
                reject(err);
                return;
            }

            // Resolve promise
            resolve();
        });
    });
}
