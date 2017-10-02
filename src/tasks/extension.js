import Gulp from 'gulp';
import GulpZip from 'gulp-zip';
import Path from 'path';

import Constants from '../core/constants';
import Extension from '../core/extension';
import {buildDistributionName, getTaskName} from '../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'extension'), [
        getTaskName(environment, 'clean'),
        getTaskName(environment, 'discover'),
        getTaskName(environment, 'assets'),
        getTaskName(environment, 'manifest'),
        getTaskName(environment, 'webpack')
    ], () => {
        // Create archive of build
        return Gulp.src(Path.join(Constants.BuildDirectory.Root, environment, 'unpacked/**/*'))
            .pipe(GulpZip(buildDistributionName(Extension.getVersion(environment))))
            .pipe(Gulp.dest(Path.join(Constants.BuildDirectory.Root, environment)));
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
