import Gulp from 'gulp';

import {getTaskName} from '../../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'hybrid'), [
        getTaskName(environment, 'clean'),
        getTaskName(environment, 'hybrid:package'),
        getTaskName(environment, 'hybrid:xpi')
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
