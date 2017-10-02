import Gulp from 'gulp';
import Path from 'path';
import Rename from 'gulp-rename';
import {exec} from 'child_process';

import Constants from '../../core/constants';
import Extension from '../../core/extension';
import {buildDistributionName, getTaskName} from '../../core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'hybrid:xpi:build'), [
        getTaskName(environment, 'hybrid:package')
    ], (done) => {
        // Create xpi of build
        exec('jpm xpi', {
            cwd: Path.join(Constants.BuildDirectory.Root, environment, 'hybrid')
        }, function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            done(err);
        });
    });

    Gulp.task(getTaskName(environment, 'hybrid:xpi'), [
        getTaskName(environment, 'hybrid:xpi:build')
    ], () => {
        // Copy xpi to build directory
        return Gulp.src(Path.join(Constants.BuildDirectory.Root, environment, 'hybrid/*.xpi'))
            .pipe(Rename(buildDistributionName(Extension.getVersion(environment), {
                type: 'Hybrid',
                extension: 'xpi'
            })))
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
