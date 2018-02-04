import Credits from '@fuzeman/credits';
import Gulp from 'gulp';
import IsNil from 'lodash-es/isNil';
import Map from 'lodash-es/map';
import OrderBy from 'lodash-es/orderBy';
import Path from 'path';
import Reduce from 'lodash-es/reduce';

import Registry from '../core/registry';
import {getOutputDirectory, getTaskName} from '../core/helpers';
import {writeJson} from '../core/json';
import {sortKey} from './core/helpers';


export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'libraries'), [
        getTaskName(environment, 'clean'),
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
    environment = environment || 'production';

    let librariesPath = Path.join(getOutputDirectory(environment, 'unpacked'), 'libraries.json');

    // Retrieve libraries, and write to the build directory
    return buildLibraries(environment).then((libraries) =>
        writeJson(librariesPath, libraries)
    );
}

export function buildLibraries(environment) {
    return Promise.all(Registry.list(environment).map((module) =>
        getPackageCredits(module.path)
    )).then((modules) => {
        let libraries = {};

        for(let i = 0; i < modules.length; i++) {
            for(let type in modules[i]) {
                if(!modules[i].hasOwnProperty(type)) {
                    continue;
                }

                for(let j = 0; j < modules[i][type].length; j++) {
                    let credit = modules[i][type][j];
                    let creditKey = sortKey(credit.name);

                    if(IsNil(credit.name) || credit.name.length < 1) {
                        continue;
                    }

                    if(IsNil(credit.packages)) {
                        continue;
                    }

                    for(let h = 0; h < credit.packages.length; h++) {
                        let library = credit.packages[h];
                        let libraryKey = sortKey(library);

                        if(IsNil(library)) {
                            continue;
                        }

                        // Ignore "neon-extension-" libraries
                        if(library.indexOf('neon-extension-') === 0) {
                            continue;
                        }

                        // Ensure library exists
                        if(IsNil(libraries[libraryKey])) {
                            libraries[libraryKey] = {
                                name: library,
                                credits: {}
                            };
                        }

                        // Add `credit` to library
                        libraries[libraryKey].credits[creditKey] = {
                            name: credit.name,
                            email: credit.email
                        };
                    }
                }
            }
        }

        // Order libraries by name
        return OrderBy(Map(Object.values(libraries), (library) => ({
            ...library,

            credits: Object.values(library.credits)
        })), [(library) =>
            sortKey(library.name)
        ], ['asc']);
    });
}

export function getPackageCredits(path) {
    function process(credits, initial) {
        return Reduce(credits, (result, value) => {
            if(Array.isArray(value)) {
                process(value, initial);
            } else {
                result.push(value);
            }

            return result;
        }, initial);
    }

    return Credits(path).then((credits) => ({
        bower: process(credits.bower, []),
        jspm: process(credits.jspm, []),
        npm: process(credits.npm, [])
    }));
}

export default {
    build,

    createTask,
    createTasks
};
