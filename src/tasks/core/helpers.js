import Filesystem from 'fs';
import Glob from 'glob';
import IsNil from 'lodash-es/isNil';
import Merge from 'lodash-es/merge';
import Path from 'path';
import Yazl from 'yazl';


export function createZip(options) {
    options = Merge({
        mode: 100664,
        mtime: new Date(2017, 0)
    }, options || {});

    return new Promise((resolve, reject) => {
        Glob(options.source + '/' + options.pattern, (err, files) => {
            if(err) {
                reject(err);
                return;
            }

            files.sort();

            // Create archive
            let zip = new Yazl.ZipFile();

            for(let i = 0; i < files.length; i++) {
                let file = Filesystem.lstatSync(files[i]);

                if(file.isDirectory()) {
                    continue;
                }

                zip.addFile(files[i], Path.relative(options.source, files[i]), {
                    mode: parseInt(options.mode, 8),
                    mtime: options.mtime
                });
            }

            // Save archive
            zip.end(() => {
                let writeStream = Filesystem.createWriteStream(options.archive)
                    .on('error', (err) => reject(err));

                // Write zip to file stream
                zip.outputStream.on('finish', () => resolve());
                zip.outputStream.pipe(writeStream);
            })
        });
    });
}

export function sortKey(value) {
    if(IsNil(value)) {
        return null;
    }

    return value.replace(/[^a-zA-Z]/g, '').toLowerCase();
}
