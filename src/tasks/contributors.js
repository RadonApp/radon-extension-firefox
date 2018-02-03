import Gulp from 'gulp';
import GulpUtil from 'gulp-util';
import KeyBy from 'lodash-es/keyBy';
import Merge from 'lodash-es/merge';
import Path from 'path';
import SortBy from 'lodash-es/sortBy';

import Git from '../core/git';
import Registry from '../core/registry';
import {getTaskName} from '../core/helpers';
import {readJson, writeJson} from '../core/json';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'contributors'), [
        getTaskName(environment, 'discover')
    ], (done) => {
        build(environment).then(
            () => done(),
            done
        );
    });
}

export function createTasks(environments) {
    environments.forEach((environment) =>
        createTask(environment)
    );
}

export function build(environment) {
    return Promise.all(Registry.list(environment).map((module) => {
        let contributorsPath = Path.join(module.path, 'contributors.json');

        // Read contributors from file
        return readJson(contributorsPath, [])
            // Update contributors with current repository commits
            .then((existing) => updateContributors(module, existing))
            // Write contributors to file
            .then((contributors) => writeJson(contributorsPath, contributors))
            // Catch any errors
            .then(() => {
                GulpUtil.log(
                    'Built contributors for "' + module.name + '"'
                );
            },(err) => {
                GulpUtil.log(GulpUtil.colors.red(
                    'Unable to build contributors for "' + module.name + '": ' + err
                ))
            });
    }));
}

export function updateContributors(module, existing) {
    return Git.contributors(module.path).then((current) =>
        SortBy(Object.values(Merge(
            KeyBy(existing, 'name'),
            KeyBy(current, 'name')
        )), 'commits')
    );
}

export default {
    build,

    createTask,
    createTasks
};
