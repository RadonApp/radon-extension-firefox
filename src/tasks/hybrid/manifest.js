import Filesystem from 'fs';
import Gulp from 'gulp';
import Mkdirp from 'mkdirp';
import Path from 'path';

import Constants from '../../core/constants';
import Extension from '../../core/extension';
import {getTaskName} from '../../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'hybrid:manifest'), [
        getTaskName(environment, 'clean'),
        getTaskName(environment, 'discover')
    ], (done) => {
        // Read (and decode) base manifest
        let manifest = JSON.parse(Filesystem.readFileSync(Path.join(
            Constants.PackagePath,
            'src/hybrid/package.json'
        )));

        // Update manifest version
        manifest.version = Extension.getVersion(environment);

        // Build destination path
        let destinationPath = Path.join(
            Constants.BuildDirectory.Root,
            environment,
            'hybrid'
        );

        // Ensure destination directory exists
        Mkdirp(destinationPath);

        // Encode manifest
        try {
            manifest = JSON.stringify(manifest, null, 2);
        } catch(err) {
            done(err);
            return;
        }

        // Write manifest to build directory
        Filesystem.writeFile(Path.join(destinationPath, 'package.json'), manifest, function(err) {
            if(err) {
                done(err);
                return;
            }

            done();
        });
    });
}

export function createTasks(environments) {
    environments.forEach((environment) =>
        createTask(environment)
    );
}

export default {
    createTask,
    createTasks
};
