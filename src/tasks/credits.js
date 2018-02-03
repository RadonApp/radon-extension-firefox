import CloneDeep from 'lodash-es/cloneDeep';
import Credits from 'credits';
import Filter from 'lodash-es/filter';
import Get from 'lodash-es/get';
import Gulp from 'gulp';
import IsNil from 'lodash-es/isNil';
import IsNumber from 'lodash-es/isNumber';
import IsPlainObject from 'lodash-es/isPlainObject';
import KeyBy from 'lodash-es/keyBy';
import Map from 'lodash-es/map';
import Merge from 'lodash-es/merge';
import OmitBy from 'lodash-es/omitBy';
import OrderBy from 'lodash-es/orderBy';
import Path from 'path';
import Pick from 'lodash-es/pick';
import Reduce from 'lodash-es/reduce';
import Uniq from 'lodash-es/uniq';

import Registry from '../core/registry';
import {getOutputDirectory, getTaskName} from '../core/helpers';
import {writeJson} from '../core/json';
import {sortKey} from './core/helpers';


export const DefaultContributor = {
    name: null,
    email: null,
    type: null,

    commits: 0,

    modules: [],
    packages: []
};

export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'credits'), [
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

    let creditsPath = Path.join(getOutputDirectory(environment, 'unpacked'), 'credits.json');

    // Retrieve credits, and write to the build directory
    return buildCredits(environment).then((credits) =>
        writeJson(creditsPath, credits)
    );
}

export function buildCredits(environment) {
    return Promise.all(Registry.list(environment).map((module) =>
        getModuleCredits(module)
    )).then((modules) => {
        let credits = {};

        for(let i = 0; i < modules.length; i++) {
            for(let key in modules[i]) {
                if(!modules[i].hasOwnProperty(key)) {
                    continue;
                }

                // Merge module contributor with existing data
                credits[key] = mergeContributor(
                    {
                        ...CloneDeep(DefaultContributor),
                        ...credits[key]
                    },
                    {
                        ...CloneDeep(DefaultContributor),
                        ...Pick(modules[i][key], Object.keys(DefaultContributor))
                    }
                );
            }
        }

        // Sort credits
        let result = OrderBy(Object.values(credits), [
            // Contributors
            'modules.length',
            'commits',

            // Package Authors and Maintainers
            'packages.length',
            (credit) => sortKey(credit.name)
        ], [
            'desc',
            'desc',
            'desc',
            'asc'
        ]);

        // Remove credits without any commits, modules or packages
        result = OmitBy(result, (credit) =>
            credit.commits < 1 &&
            credit.modules.length < 1 &&
            credit.packages.length < 1
        );

        // Remove credit properties with values: [], 0, null, undefined
        return Map(result, (credit) =>
            OmitBy(credit, (value) =>
                IsNil(value) ||
                (Array.isArray(value) && value.length < 1) ||
                (IsNumber(value) && value === 0)
            )
        );
    });
}

export function getModuleCredits(module) {
    let result = KeyBy(Map(module.contributors, (contributor) => ({
        ...contributor,

        modules: [module.name],
        packages: []
    })), 'name');

    // Fetch package credits
    return getPackageCredits(module.path).then((credits) => {
        for(let type in credits) {
            if(!credits.hasOwnProperty(type)) {
                continue;
            }

            for(let i = 0; i < credits[type].length; i++) {
                let person = credits[type][i];

                if(!IsPlainObject(person)) {
                    continue;
                }

                if(IsNil(person.name) || person.name.length < 1) {
                    continue;
                }

                // Move "neon-extension-" packages to modules
                person.modules = Filter(person.packages, (name) =>
                    name.indexOf('neon-extension-') === 0
                );

                person.packages = Filter(person.packages, (name) =>
                    name.indexOf('neon-extension-') < 0
                );

                let key = person.name;

                // Include `person` in `result`
                if(IsNil(result[key])) {
                    result[key] = person;
                } else {
                    result[key] = {
                        ...Get(result, [key], {}),
                        ...person,

                        modules: [
                            ...Get(result, [key, 'modules'], []),
                            ...Get(person, 'modules', [])
                        ],

                        packages: [
                            ...Get(result, [key, 'packages'], []),
                            ...Get(person, 'packages', [])
                        ]
                    };
                }
            }
        }

        return result;
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

export function mergeContributor(a, b) {
    return Merge(a, {
        ...b,

        commits: a.commits + b.commits,

        modules: Uniq([
            ...a.modules,
            ...b.modules
        ]),

        packages: Uniq([
            ...a.packages,
            ...b.packages
        ])
    });
}


export default {
    build,

    createTask,
    createTasks
};
