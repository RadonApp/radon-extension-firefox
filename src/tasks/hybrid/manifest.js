import Filesystem from 'fs';
import Gulp from 'gulp';
import GulpXmlTransformer from 'gulp-xml-transformer';
import Mkdirp from 'mkdirp';
import Path from 'path';
import Pick from 'lodash-es/pick';

import Constants from '../../core/constants';
import Extension from '../../core/extension';
import {getTaskName} from '../../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'hybrid:manifest:package'), [
        getTaskName(environment, 'clean'),
        getTaskName(environment, 'discover')
    ], (done) => {
        let destinationPath = Path.join(
            Constants.BuildDirectory.Root, environment,
            'hybrid'
        );

        // Read base package manifest
        let manifest = JSON.parse(Filesystem.readFileSync(Path.join(
            Constants.PackagePath,
            'src/hybrid/package.json'
        )));

        // Update package manifest
        manifest = {
            ...manifest,

            // Retrieve extension version (for current environment)
            version: Extension.getVersion(environment),

            // Retrieve extension properties
            ...Pick(Extension.manifest, [
                'title',
                'description'
            ])
        };

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

    Gulp.task(getTaskName(environment, 'hybrid:manifest:install'), [
        getTaskName(environment, 'hybrid:manifest:package')
    ], () => {
        let sourcePath = Path.join(
            Constants.PackagePath, 'src/hybrid/install.rdf'
        );

        let destinationPath = Path.join(
            Constants.BuildDirectory.Root, environment,
            'hybrid'
        );

        // Read package manifest
        let manifest = {
            hasEmbeddedWebExtension: true,

            permissions: {
                multiprocess: false
            },

            ...JSON.parse(Filesystem.readFileSync(Path.join(
                destinationPath, 'package.json'
            )))
        };

        // Create install manifest
        return Gulp.src(sourcePath)
            .pipe(GulpXmlTransformer([
                {path: '//em:id', text: manifest.id},
                {path: '//em:version', text: Extension.getVersion(environment)},

                {path: '//em:name', text: Extension.manifest.title},
                {path: '//em:description', text: Extension.manifest.description},
                {path: '//em:creator', text: manifest.author},

                {path: '//em:multiprocessCompatible', text: manifest.permissions.multiprocess},
                {path: '//em:hasEmbeddedWebExtension', text: manifest.hasEmbeddedWebExtension},

                // Firefox
                {
                    path: (
                        '//em:targetApplication' +
                        '/rdf:Description[em:id = \'{ec8030f7-c20a-464f-9b0e-13a3a9e97384}\']' +
                        '/em:minVersion'
                    ),
                    text: Extension.manifest.applications.gecko.strict_min_version
                },

                // Firefox for Android
                {
                    path: (
                        '//em:targetApplication' +
                        '/rdf:Description[em:id = \'{aa3c5121-dab2-40e2-81ca-7ea25febc110}\']' +
                        '/em:minVersion'
                    ),
                    text: Extension.manifest.applications.gecko.strict_min_version
                }
            ], {
                rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
                em: 'http://www.mozilla.org/2004/em-rdf#'
            }))
            .pipe(Gulp.dest(destinationPath));
    });

    Gulp.task(getTaskName(environment, 'hybrid:manifest'), [
        getTaskName(environment, 'hybrid:manifest:package'),
        getTaskName(environment, 'hybrid:manifest:install')
    ]);
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
