import Filesystem from 'fs';
import ForEach from 'lodash-es/forEach';
import Gulp from 'gulp';
import GulpUtil from 'gulp-util';
import IsNil from 'lodash-es/isNil';
import Mkdirp from 'mkdirp';
import PadEnd from 'lodash-es/padEnd';
import Reduce from 'lodash-es/reduce';
import Util from 'util';
import Webpack from 'webpack';

import {getOutputDirectory, getTaskName} from '../../core/helpers';
import {ExtractedModules, createConfiguration} from './configuration';


export function build(environment) {
    environment = environment || 'production';

    return new Promise((resolve, reject) => {
        // Retrieve compiler for `config`
        let compiler;

        try {
            compiler = constructCompiler(environment);
        } catch(e) {
            return reject(e);
        }

        if(typeof compiler === 'undefined' || compiler === null) {
            return reject(new Error('Unable to generate compiler'));
        }

        // Run compiler
        compiler.run((err, stats) => {
            if(err) {
                reject(err);
                return;
            }

            // Display extracted modules
            if(IsNil(ExtractedModules[environment])) {
                reject(new Error('No modules were extracted'));
                return;
            }

            let nameLength = Reduce(Object.keys(ExtractedModules[environment]), (result, name) => {
                if(name.length > result) {
                    return name.length;
                }

                return result;
            }, 0);

            ForEach(Object.keys(ExtractedModules[environment]).sort(), (name) => {
                GulpUtil.log(
                    GulpUtil.colors.green('%s => %s'),
                    PadEnd(name, nameLength), ExtractedModules[environment][name]
                );
            });

            // Write statistics to file
            let statistics = JSON.stringify(stats.toJson('verbose'));

            return Filesystem.writeFile(getOutputDirectory(environment, 'webpack.stats.json'), statistics, function(err) {
                if(err) {
                    GulpUtil.log(GulpUtil.colors.red(
                        'Unable to write statistics: %s'
                    ), err.stack);
                    return;
                }

                resolve(stats);
            });
        });
    });
}

export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'webpack'), [
        getTaskName(environment, 'clean'),
        getTaskName(environment, 'discover')
    ], (done) => {
        build(environment).then(
            (stats) => {
                GulpUtil.log(stats.toString('normal'));
                done();
            },
            done
        );
    });
}

export function createTasks(environments) {
    environments.forEach((environment) =>
        createTask(environment)
    );
}

function constructCompiler(environment) {
    let outputPath = getOutputDirectory(environment, 'unpacked');

    // Generation configuration
    let configuration;

    try {
        configuration = createConfiguration(environment, outputPath);
    } catch(e) {
        throw new Error('Unable to generate configuration: ' + e.stack);
    }

    // Ensure output directory exists
    Mkdirp.sync(outputPath);

    // Save configuration
    Filesystem.writeFileSync(
        getOutputDirectory(environment, 'webpack.config.js'),
        Util.inspect(configuration, {
            depth: null
        }),
        'utf-8'
    );

    // Construct compiler
    return Webpack(configuration);
}

export default {
    build,

    createTask,
    createTasks
};
