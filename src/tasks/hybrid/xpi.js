import Gulp from 'gulp';
import Path from 'path';
import Rename from 'gulp-rename';

import Constants from '../../core/constants';
import Extension from '../../core/extension';
import {buildDistributionName, getTaskName} from '../../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'hybrid:xpi'), [
        getTaskName(environment, 'hybrid:package')
    ], () => {
        let basePath = Path.join(Constants.BuildDirectory.Root, environment);
        let version = Extension.getVersion(environment);

        // Rename archive to xpi
        return Gulp.src(Path.join(basePath, buildDistributionName(version, { type: 'Hybrid' })))
            .pipe(Rename(buildDistributionName(version, {
                type: 'Hybrid',
                extension: 'xpi'
            })))
            .pipe(Gulp.dest(basePath));
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
