import Filesystem from 'fs';
import Gulp from 'gulp';
import GulpUtil from 'gulp-util';
import Merge from 'lodash-es/merge';
import Mkdirp from 'mkdirp';
import Path from 'path';
import Util from 'util';
import Webpack from 'webpack';

import Base from './webpack.config';
import Constants from '../core/constants';
import Extension from '../core/extension';
import Registry from '../core/registry';
import {getOutputDirectory, getTaskName, isDefined} from '../core/helpers';


let loggedModules = {};

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

            let statisticsPath = getOutputDirectory(environment, 'webpack.stats.json');

            // Write statistics to file
            let statistics = JSON.stringify(stats.toJson('verbose'));

            return Filesystem.writeFile(statisticsPath, statistics, function(err) {
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
        configuration = buildConfiguration(environment, outputPath);
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

function getPackagePath(modulePath) {
    let result = Path.relative(Constants.ProjectPath, modulePath);

    // Replace "node_modules" with "~"
    result = result.replace('node_modules', '~');

    // Strip module path
    let lastModulesStart = result.indexOf('~');

    if(lastModulesStart < 0) {
        return result;
    }

    let nameEnd = result.indexOf(Path.sep, lastModulesStart + 2);

    if(nameEnd < 0) {
        return result;
    }

    return result.substring(0, nameEnd);
}

function logModule(color, name, modulePath, count, suffix) {
    if(!isDefined(modulePath)) {
        return;
    }

    let packagePath = getPackagePath(modulePath);

    if(typeof loggedModules[name] === 'undefined') {
        loggedModules[name] = {};
    }

    // Log included module (if not already logged)
    if(typeof loggedModules[name][packagePath] === 'undefined') {
        loggedModules[name][packagePath] = true;

        // Log module details
        GulpUtil.log(
            color('[%s] %s (chunks: %s)%s'),
            name, packagePath, count,
            suffix ? (' ' + suffix) : ''
        );
    }
}

function getModuleType(path) {
    if(!isDefined(path)) {
        return null;
    }

    // Find matching module type
    if(path.indexOf(Path.join(Constants.ProjectPath, 'Browsers')) === 0) {
        return 'browser';
    }

    if(path.indexOf(Path.join(Constants.ProjectPath, 'Destinations')) === 0) {
        return 'destination';
    }

    if(path.indexOf(Path.join(Constants.ProjectPath, 'Sources')) === 0) {
        return 'source';
    }

    if(path.indexOf(Path.join(Constants.ProjectPath, 'neon-extension-core')) === 0) {
        return 'core';
    }

    if(path.indexOf(Path.join(Constants.ProjectPath, 'neon-extension-framework')) === 0) {
        return 'framework';
    }

    // Unknown module type
    return null;
}

// region Configuration

function buildConfiguration(environment, outputPath) {
    let babelIncludePaths = getBabelIncludePaths(environment);

    return {
        ...Base,

        devtool: environment === 'production' ?
            'hidden-source-map' :
            'cheap-module-source-map',

        entry: {
            ...Base.entry,
            ...createChunks(environment)
        },

        output: {
            ...Base.output,

            path: outputPath
        },

        externals: [
            ...Base.externals
        ],

        module: {
            ...Base.module,

            rules: [
                ...Base.module.rules,

                {
                    test: /\.js$/,
                    include: babelIncludePaths,
                    exclude: /(node_modules)/,

                    enforce: 'pre',
                    use: [
                        {
                            loader: 'eslint-loader',
                            options: {
                                baseConfig: buildEslintConfiguration(environment)
                            }
                        }
                    ]
                },

                {
                    test: /\.js$/,
                    include: [
                        Path.resolve(Constants.PackagePath, 'node_modules/foundation-sites')
                    ],

                    use: [
                        'imports-loader?this=>window'
                    ]
                },
                {
                    test: /\.js$/,
                    include: [
                        Path.resolve(Constants.PackagePath, 'node_modules/foundation-sites'),
                        Path.resolve(Constants.PackagePath, 'node_modules/lodash-es'),

                        ...babelIncludePaths
                    ],

                    use: [
                        {
                            loader: 'babel-loader',
                            options: {
                                cacheDirectory: Path.join(Constants.PackagePath, '.babel/cache'),
                                presets: ['es2015', 'react']
                            },
                        }
                    ]
                }
            ]
        },

        plugins: [
            ...Base.plugins,

            new Webpack.optimize.CommonsChunkPlugin({
                name: 'background/common',

                chunks: [
                    'background/callback/callback',
                    'background/main/main',
                    'background/migrate/migrate',

                    'background/messaging/messaging',
                    'background/messaging/services/scrobble',
                    'background/messaging/services/storage'
                ],

                minChunks: (module, count) => {
                    let type = getModuleType(module.userRequest);

                    if(count < 2 && ['browser', 'framework'].indexOf(type) < 0) {
                        logModule(GulpUtil.colors.cyan, 'background/common', module.userRequest, count, '[type: ' + type + ']');
                        return false;
                    }

                    logModule(GulpUtil.colors.green, 'background/common', module.userRequest, count, '[type: ' + type + ']');
                    return true;
                }
            }),

            new Webpack.optimize.CommonsChunkPlugin({
                name: 'destination/common',

                chunks: [].concat(...Registry.list(environment, {
                    type: 'destination'
                }).map((module) =>
                    (module.webpack.chunks || []).map((chunk) =>
                        'destination/' + module.key + '/' + chunk + '/' + chunk
                    )
                )),

                minChunks: (module, count) => {
                    let type = getModuleType(module.userRequest);

                    if(count < 2 && ['browser', 'core', 'framework'].indexOf(type) < 0) {
                        logModule(GulpUtil.colors.cyan, 'destination/common', module.userRequest, count, '[type: ' + type + ']');
                        return false;
                    }

                    logModule(GulpUtil.colors.green, 'destination/common', module.userRequest, count, '[type: ' + type + ']');
                    return true;
                }
            }),

            new Webpack.optimize.CommonsChunkPlugin({
                name: 'source/common',

                chunks: [].concat(...Registry.list(environment, {
                    type: 'source'
                }).map((module) => [
                    'source/' + module.key + '/' + module.key,

                    // Include additional chunks
                    ...(module.webpack.chunks || []).map((chunk) =>
                        'source/' + module.key + '/' + chunk + '/' + chunk
                    )
                ])),

                minChunks: (module, count) => {
                    let type = getModuleType(module.userRequest);

                    if(count < 2 && ['browser', 'core', 'framework'].indexOf(type) < 0) {
                        logModule(GulpUtil.colors.cyan, 'source/common', module.userRequest, count, '[type: ' + type + ']');
                        return false;
                    }

                    logModule(GulpUtil.colors.green, 'source/common', module.userRequest, count, '[type: ' + type + ']');
                    return true;
                }
            }),

            new Webpack.optimize.CommonsChunkPlugin({
                name: 'common',

                chunks: [
                    'background/common',
                    'destination/common',
                    'source/common',

                    'configuration/configuration'
                ],

                minChunks: (module, count) => {
                    if(count < 2) {
                        logModule(GulpUtil.colors.cyan, 'common', module.userRequest, count);
                        return false;
                    }

                    logModule(GulpUtil.colors.green, 'common', module.userRequest, count);
                    return true;
                }
            }),

            new Webpack.DefinePlugin({
                'neon.manifests': JSON.stringify({
                    'neon-extension': Extension.metadata,
                    ...Registry.getIndex(environment)
                }),

                'process.env': {
                    'NODE_ENV': JSON.stringify(environment)
                }
            }),

            new Webpack.LoaderOptionsPlugin({
                debug: environment !== 'production',
                minimize: environment === 'production'
            }),

            // Enable uglify on production builds
            ...(environment === 'production' ? [
                new Webpack.optimize.UglifyJsPlugin()
            ] : [])
        ],

        resolve: {
            ...Base.resolve,

            modules: [
                ...getModulePaths(environment),
                ...Base.resolve.modules
            ],

            alias: {
                ...Base.resolve.alias,
                ...getModuleAliases(environment)
            }
        }
    };
}

function buildEslintConfiguration(environment) {
    return {
        "settings": {
            "import/resolver": {
                "eslint-import-resolver-node-extended": {
                    "alias": getModuleAliases(environment),
                    "paths": getModulePaths(environment)
                }
            }
        }
    };
}

function getModuleAliases(environment) {
    return Object.assign({}, ...Registry.list(environment).map((module) => {
        let result = {};

        // Module
        result[module.name] = Path.resolve(module.path, 'src');

        // Aliases
        for(let name in module.webpack.alias) {
            if(!module.webpack.alias.hasOwnProperty(name)) {
                continue;
            }

            let target = module.webpack.alias[name];

            // Parse alias
            if(target === './') {
                result[name] = Path.resolve(module.path, 'src');
            } else {
                result[name] = target;
            }
        }


        return result;
    }));
}

function getModulePaths(environment) {
    return [
        // Shared modules
        Path.resolve(Constants.PackagePath, 'node_modules'),

        // Plugin modules
        ...Registry.list(environment).map((module) =>
            Path.join(module.path, 'node_modules')
        )
    ];
}

function getBabelIncludePaths(environment) {
    let modules = Registry.list(environment);

    // Build list of babel includes
    let include = [];

    for(let i = 0; i < modules.length; i++) {
        let module = modules[i];

        // Include source directory
        include.push(Path.resolve(module.path, 'src'));

        // Include additional directories from manifest
        include.push(...module.webpack.babel.map((path) =>
            Path.resolve(module.path, path)
        ));
    }

    return include;
}

function createChunks(environment) {
    let modules = Registry.list(environment);

    // Retrieve destinations
    let destinations = Registry.list(environment, {
        type: 'destination'
    });

    // Retrieve sources
    let sources = Registry.list(environment, {
        type: 'source'
    });

    // Create modules
    return {
        'background/callback/callback': [
            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration'),
            'neon-extension-core/modules/background/callback'
        ],
        'background/main/main': [
            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration'),
            'neon-extension-core/modules/background/main'
        ],
        'background/migrate/migrate': [
            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration'),
            ...getServices(modules, 'migrate'),
            'neon-extension-core/modules/background/migrate'
        ],

        //
        // Messaging
        //

        'background/messaging/messaging': [
            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration'),
            'neon-extension-core/modules/background/messaging'
        ],
        'background/messaging/services/scrobble': [
            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration'),
            ...getServices(destinations, 'destination/scrobble'),
            'neon-extension-core/modules/background/messaging/services/scrobble'
        ],
        'background/messaging/services/storage': [
            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration'),
            'neon-extension-core/modules/background/messaging/services/storage'
        ],

        //
        // Configuration
        //

        'configuration/configuration': [
            // Ensure CSS Dependencies are bundled first
            'neon-extension-core/modules/configuration/dependencies.scss',

            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration', { includeComponents: true }),
            'neon-extension-core/modules/configuration'
        ],

        //
        // Destinations
        //

        ...Object.assign({}, ...destinations.map((module) => {
            return createModuleChunks(module) || {};
        })),

        //
        // Sources
        //

        ...Object.assign({}, ...sources.map((module) => {
            return {
                ...createModule(environment, module),
                ...createModuleChunks(module)
            };
        }))
    };
}

function createModule(environment, module) {
    // Parse module name
    let moduleName = module.name.replace('neon-extension-', '');
    let splitAt = moduleName.indexOf('-');

    if(splitAt < 0) {
        GulpUtil.log(GulpUtil.colors.red(
            'Invalid value provided for the "module.name" parameter: %O'
        ), module.name);
        return null;
    }

    let type = moduleName.substring(0, splitAt);
    let plugin = moduleName.substring(splitAt + 1);

    // Build module entry
    let result = {};

    result[type + '/' + plugin + '/' + plugin] = [
        ...Constants.CommonRequirements,
        ...getServices([Registry.get(environment, 'neon-extension-core')], 'configuration'),
        ...getModuleServices(environment, module)
    ];

    return result;
}

function createModuleChunks(module) {
    // Validate `module` object
    if(typeof module === 'undefined' || module === null) {
        GulpUtil.log(GulpUtil.colors.red(
            'Invalid value provided for the "module" parameter: %O'
        ), module);
        return null;
    }

    if(typeof module.name === 'undefined' || module.name === null) {
        GulpUtil.log(GulpUtil.colors.red(
            'Invalid value provided for the "module" parameter: %O'
        ), module);
        return null;
    }

    // Parse module name
    let moduleName = module.name.replace('neon-extension-', '');
    let splitAt = moduleName.indexOf('-');

    if(splitAt < 0) {
        GulpUtil.log(GulpUtil.colors.red(
            'Invalid value provided for the "module.name" parameter: %O'
        ), module.name);
        return null;
    }

    let type = moduleName.substring(0, splitAt);
    let plugin = moduleName.substring(splitAt + 1);

    // Create module chunks
    let result = {};

    (module.webpack.chunks || []).forEach((name) => {
        result[type + '/' + plugin + '/' + name + '/' + name] = [
            ...Constants.CommonRequirements,
            module.name + '/' + name
        ];
    });

    (module.webpack.modules || []).forEach((name) => {
        result[type + '/' + plugin + '/' + name + '/' + name] = [
            ...Constants.CommonRequirements,
            module.name + '/' + name
        ];
    });

    return result;
}

function getModuleServices(environment, module) {
    if(typeof module === 'undefined' || module === null) {
        return [];
    }

    if(typeof module.services === 'undefined' || module.services === null) {
        return [];
    }

    // Retrieve core module
    let coreModule = Registry.get(environment, 'neon-extension-core');

    // Find module services
    let result = [];

    for(let i = 0; i < module.services.length; i++) {
        let type = module.services[i];

        // Ignore migrate service
        if(type === 'migrate') {
            continue;
        }

        // Build service name
        let name = type.substring(type.indexOf('/') + 1);

        // Build service module path
        let servicePath = Path.resolve(module.path, 'src/services/' + name + '/index.js');

        // Ensure service module exists
        if(!Filesystem.existsSync(servicePath)) {
            GulpUtil.log(GulpUtil.colors.red(
                'Ignoring service "%s" for module "%s", no file exists at: "%s"'
            ), name, module.name, servicePath);
            continue;
        }

        // Only include the plugin configuration service
        if(type === 'configuration') {
            result.push(servicePath);
            continue;
        }

        // Build main module path
        let mainPath = Path.resolve(coreModule.path, 'src/modules/' + type + '/index.js');

        // Ensure main module exists
        if(!Filesystem.existsSync(mainPath)) {
            GulpUtil.log(GulpUtil.colors.red(
                'Ignoring service "%s" for module "%s", unable to find main module at: "%s"'
            ), name, module.name, mainPath);
            continue;
        }

        // Found service
        result.push(servicePath);
        result.push(mainPath);
    }

    return result;
}

function getServices(modules, type, options) {
    options = Merge({
        includeComponents: false
    }, options);

    // Build service name
    let name = type.substring(type.indexOf('/') + 1);

    // Find matching services
    let items = [];

    for(let i = 0; i < modules.length; i++) {
        let module = modules[i];

        // Ensure module has services
        if(typeof module.services === 'undefined') {
            continue;
        }

        // Ensure module has the specified service
        if(module.services.indexOf(type) === -1) {
            continue;
        }

        let servicePath = Path.resolve(module.path, 'src/services/' + name);
        let serviceIndexPath = Path.resolve(servicePath, 'index.js');

        // Ensure service exists
        if(!Filesystem.existsSync(serviceIndexPath)) {
            GulpUtil.log(
                GulpUtil.colors.red('Ignoring service "%s" for module "%s", no file exists at: "%s"'),
                name, module.name, serviceIndexPath
            );
            continue;
        }

        // Include service
        items.push(serviceIndexPath);

        // Include react components (if enabled)
        if(options.includeComponents) {
            let componentsPath = Path.resolve(servicePath, 'components/index.js');

            // Ensure service components exist
            if(Filesystem.existsSync(componentsPath)) {
                items.push(componentsPath);
            }
        }
    }

    return items;
}

// endregion

export default {
    build,

    createTask,
    createTasks
};
