import Gulp from 'gulp';
import Path from 'path';

import Extension from '../core/extension';
import Travis from '../core/travis';
import {getOutputDirectory, getTaskName} from '../core/helpers';
import {writeJson} from '../core/json';


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

    let descriptorPath = Path.join(getOutputDirectory(environment), 'bintray.json');

    // Build descriptor
    return buildDescriptor(environment)
        .then((descriptor) => writeJson(descriptorPath, descriptor));
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
            'vcs_tag': Travis.tag,

            "attributes": [
                {"name": "branch", "type": "string", "values": [Extension.branch]},
                {"name": "commit", "type": "string", "values": [Extension.commit]},

                {"name": "build_number", "type": "number", "values": [parseInt(Travis.build_number, 10)]}
            ],
        },

        'files': [
            {
                "includePattern": "build/production/(.*\\.zip)",
                "uploadPattern": "$1"
            },
            {
                "includePattern": "build/production/(MD5SUMS|webpack*)",
                "uploadPattern": Extension.getVersion(environment) + "/$1"
            }
        ],

        'publish': true
    });
}

export default {
    build,

    createTask,
    createTasks
};
