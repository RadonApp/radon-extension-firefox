import Gulp from 'gulp';
import Path from 'path';

import Constants from '../core/constants';
import Extension from '../core/extension';
import {buildDistributionName, getTaskName} from '../core/helpers';
import {createZip} from './core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'extension'), [
        getTaskName(environment, 'clean'),
        getTaskName(environment, 'discover'),
        getTaskName(environment, 'assets'),
        getTaskName(environment, 'bintray'),
        getTaskName(environment, 'credits'),
        getTaskName(environment, 'libraries'),
        getTaskName(environment, 'webpack'),
        getTaskName(environment, 'manifest')
    ], () => {
        // Create archive
        return createZip({
            archive: Path.join(
                Constants.BuildDirectory.Root, environment,
                buildDistributionName(Extension.getVersion(environment))
            ),

            source: Path.join(Constants.BuildDirectory.Root, environment, 'unpacked'),
            pattern: '**/*'
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
