import Gulp from 'gulp';
import Path from 'path';

import Constants from '../../core/constants';
import {getTaskName} from '../../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'hybrid:webextension'), [
        getTaskName(environment, 'extension')
    ], () => {
        // Copy extension to build directory
        return Gulp.src(Path.join(Constants.BuildDirectory.Root, environment, 'unpacked/**/*'))
            .pipe(Gulp.dest(Path.join(Constants.BuildDirectory.Root, environment, 'hybrid/webextension')));
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
