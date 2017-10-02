import Delete from 'del';
import Gulp from 'gulp';
import Path from 'path';

import Constants from '../core/constants';
import {getTaskName} from '../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'clean'), () => {
        return Delete([
            Path.join(Constants.BuildDirectory.Root, environment, '**/*')
        ]);
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
