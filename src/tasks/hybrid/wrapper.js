import Gulp from 'gulp';
import Path from 'path';

import Constants from '../../core/constants';
import {getTaskName} from '../../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'hybrid:wrapper'), [
        getTaskName(environment, 'clean'),
        getTaskName(environment, 'hybrid:manifest')
    ], () => {
        // Copy wrapper files
        return Gulp.src(Path.join(Constants.PackagePath, 'src/hybrid/**/*.js'))
            .pipe(Gulp.dest(Path.join(Constants.BuildDirectory.Root, environment, 'hybrid')));
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
