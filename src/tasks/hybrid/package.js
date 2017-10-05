import Gulp from 'gulp';
import Path from 'path';

import Constants from '../../core/constants';
import Extension from '../../core/extension';
import {buildDistributionName, getTaskName} from '../../core/helpers';
import {createZip} from '../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'hybrid:package'), [
        getTaskName(environment, 'clean'),
        getTaskName(environment, 'hybrid:wrapper'),
        getTaskName(environment, 'hybrid:webextension')
    ], () => {
        // Create archive
        return createZip({
            archive: Path.join(
                Constants.BuildDirectory.Root, environment,
                buildDistributionName(Extension.getVersion(environment), {
                    type: 'Hybrid'
                })
            ),

            source: Path.join(Constants.BuildDirectory.Root, environment, 'hybrid'),
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
