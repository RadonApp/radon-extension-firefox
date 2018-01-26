import Filesystem from 'fs';
import Gulp from 'gulp';
import Path from 'path';

import Extension from '../core/extension';
import {getOutputDirectory, getTaskName} from '../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'bintray'), [
        getTaskName(environment, 'clean'),
        getTaskName(environment, 'discover')
    ], (done) => {
        build(environment).then(
            () => done(),
            done
        );
    });
}

export function createTasks(environments) {
    environments.forEach((environment) =>
        createTask(environment)
    );
}

export function build(environment) {
    environment = environment || 'production';

    // Build descriptor
    return buildDescriptor(environment)
        .then((descriptor) => writeDescriptor(environment, descriptor));
}

export function buildDescriptor(environment) {
    if(Extension.isDirty(environment)) {
        return Promise.reject();
    }

    return Promise.resolve({
        'package': {
            'name': Extension.package.name,
            'licenses': ['GPL-3.0'],

            'subject': 'neapp',
            'repo': 'neon-extension',

            'vcs_url': 'https://github.com/NeApp/' + Extension.package.name + '.git'
        },

        'version': {
            'name': Extension.getVersion(environment),
            'vcs_tag': Extension.getCommit()
        },

        'files': [
            {"includePattern": "build/production/(.*\\.zip)", "uploadPattern": "$1"}
        ],

        'publish': true
    });
}

export function writeDescriptor(environment, descriptor) {
    let destinationPath = Path.join(getOutputDirectory(environment), 'bintray.json');

    // Encode manifest
    let data;

    try {
        data = JSON.stringify(descriptor, null, 2);
    } catch(e) {
        return Promise.reject(e);
    }

    // Write manifest to output directory
    return new Promise((resolve, reject) => {
        Filesystem.writeFile(destinationPath, data, (err) => {
            if(err) {
                reject(err);
                return;
            }

            resolve(destinationPath);
        });
    });
}

export default {
    build,

    createTask,
    createTasks
};
