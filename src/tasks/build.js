import Gulp from 'gulp';
import GulpHashsum from 'gulp-hashsum';
import Path from 'path';

import Constants from '../core/constants';
import {getTaskName} from '../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'build:package'), [
        getTaskName(environment, 'clean'),
        getTaskName(environment, 'extension')
    ]);

    Gulp.task(getTaskName(environment, 'build:hashsum'), [
        getTaskName(environment, 'build:package')
    ], () => {
        // Create checksum file
        return Gulp.src(Path.join(Constants.BuildDirectory.Root, environment, '*.{xpi,zip}'))
            .pipe(GulpHashsum({
                dest: Path.join(Constants.BuildDirectory.Root, environment),
                hash: 'md5'
            }));
    });

    Gulp.task(getTaskName(environment, 'build'), [
        getTaskName(environment, 'build:package'),
        getTaskName(environment, 'build:hashsum')
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
