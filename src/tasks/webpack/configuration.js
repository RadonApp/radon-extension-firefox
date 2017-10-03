import ExtractTextPlugin from 'extract-text-webpack-plugin';
import GulpUtil from 'gulp-util';
import Path from 'path';
import Webpack from 'webpack';

import Constants from '../../core/constants';
import Extension from '../../core/extension';
import Registry from '../../core/registry';
import Validator from './validator';
import {isDefined} from '../../core/helpers';
import {createChunks} from './chunks';
import {logModule} from './helpers';


export function createConfiguration(environment, outputPath) {
    return {
        profile: true,

        devtool: environment === 'production' ?
            'hidden-source-map' :
            'cheap-module-source-map',

        entry: createChunks(environment),

        output: {
            filename: '[name].js',
            path: outputPath,

            devtoolModuleFilenameTemplate: (module) => {
                return generateModuleIdentifier(module);
            },

            devtoolFallbackModuleFilenameTemplate: (module) => {
                return generateModuleIdentifier(module, true);
            }
        },

        module: {
            rules: [
                {
                    test: /\.js$/,
                    include: getBabelPaths(environment),
                    exclude: /(node_modules)/,

                    enforce: 'pre',
                    use: [
                        {
                            loader: 'eslint-loader',
                            options: {
                                baseConfig: {
                                    "settings": {
                                        "import/resolver": {
                                            "eslint-import-resolver-node-extended": {
                                                "alias": getModuleAliases(environment),
                                                "paths": getModulePaths(environment)
                                            }
                                        }
                                    }
                                }
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

                        ...getBabelPaths(environment)
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
                },
                {
                    test: /\.css$/,
                    use: ['file-loader']
                },
                {
                    test: /\.scss$/,
                    use: ExtractTextPlugin.extract({
                        fallback: 'style-loader',
                        use: [
                            {
                                loader: 'css-loader'
                            },
                            {
                                loader: "sass-loader",
                                options: {
                                    includePaths: [
                                        Path.resolve(Constants.PackagePath, 'node_modules/foundation-sites/scss')
                                    ]
                                }
                            }
                        ]
                    })
                }
            ]
        },

        plugins: [
            // Create module validator plugin for environment
            Validator.createPlugin(environment),

            //
            // Commons Chunks
            //

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

            //
            // Compiler Definitions
            //

            new Webpack.DefinePlugin({
                'neon.manifests': JSON.stringify({
                    'neon-extension': Extension.metadata,
                    ...Registry.getIndex(environment)
                }),

                'process.env': {
                    'NODE_ENV': JSON.stringify(environment)
                }
            }),

            //
            // Compiler Provides
            //

            new Webpack.ProvidePlugin({
                '$': 'jquery',
                'jQuery': 'jquery'
            }),

            //
            // Extract CSS into separate files
            //

            new ExtractTextPlugin({
                filename: '[name].css',
                allChunks: true
            }),

            //
            // Loader Options
            //

            new Webpack.LoaderOptionsPlugin({
                debug: environment !== 'production',
                minimize: environment === 'production'
            }),

            //
            // Uglify
            //

            ...(environment === 'production' ? [
                new Webpack.optimize.UglifyJsPlugin()
            ] : [])
        ],

        resolve: {
            modules: getModulePaths(environment),

            alias: {
                ...getModuleAliases(environment),

                'lodash-amd': 'lodash-es',
            }
        }
    };
}

function getBabelPaths(environment) {
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

function generateModuleIdentifier(module, fallback) {
    let suffix = '';

    // Append module identifier on conflicts
    if(fallback) {
        suffix = '#' + module.moduleId;
    }

    // Ignored
    if(module.absoluteResourcePath.indexOf('ignored ') === 0) {
        return 'webpack://' + cleanModuleIdentifier(module.shortIdentifier) + suffix;
    }

    // Bootstrap
    if(module.absoluteResourcePath.indexOf('webpack/bootstrap ') === 0) {
        return 'webpack://' + cleanModuleIdentifier(module.shortIdentifier) + suffix;
    }

    // Convert to relative path
    let path = Path.resolve(Constants.PackagePath, module.absoluteResourcePath);

    // Build module identifier
    return 'webpack://' + cleanModuleIdentifier(Path.relative(Constants.ProjectPath, path)) + suffix;
}

function cleanModuleIdentifier(value) {
    return value.replace(/\s/g, '/').replace(/\\/g, '/');
}
