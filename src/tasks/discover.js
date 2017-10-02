import Gulp from 'gulp';

import Registry from '../core/registry';
import {getTaskName} from '../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'discover'), [
        getTaskName(environment, 'clean')
    ], (done) => {
        // Discover modules
        Registry.discover(environment).then(() => {
            done();
        }, (err) => {
            done(err);
        });
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
