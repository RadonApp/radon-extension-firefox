import Gulp from 'gulp';

import {getTaskName} from '../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'build'), [
        getTaskName(environment, 'clean'),
        getTaskName(environment, 'extension'),
        getTaskName(environment, 'hybrid')
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
