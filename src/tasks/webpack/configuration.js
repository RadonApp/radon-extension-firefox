import ExtractTextPlugin from 'extract-text-webpack-plugin';
import Filesystem from 'fs';
import IsNil from 'lodash-es/isNil';
import Merge from 'lodash-es/merge';
import Path from 'path';
import Set from 'lodash-es/set';
import Webpack from 'webpack';

import Browser from '../../core/browser';
import Constants from '../../core/constants';
import Extension from '../../core/extension';
import Registry from '../../core/registry';
import Validator from './validator';
import {createChunks} from './chunks';


export let ExtractedModules = {};

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

                                plugins: [
                                    '@babel/proposal-class-properties',
                                    '@babel/proposal-object-rest-spread'
                                ],

                                presets: [
                                    '@babel/env',
                                    '@babel/react'
                                ]
                            }
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
            //
            // Commons Chunks
            //

            new Webpack.optimize.CommonsChunkPlugin({
                name: 'background/common',

                chunks: [
                    'background/main/main',
                    'background/migrate/migrate',

                    'background/messaging/messaging',
                    'background/messaging/services/library',
                    'background/messaging/services/scrobble',
                    'background/messaging/services/storage'
                ],

                minChunks: (module, count) => shouldExtractModule(module, count, {
                    chunk: 'background/common',
                    environment,

                    shared: true,
                    types: ['browser', 'framework']
                })
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

                minChunks: (module, count) => shouldExtractModule(module, count, {
                    chunk: 'destination/common',
                    environment,

                    shared: true,
                    types: ['browser', 'core', 'framework']
                })
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

                minChunks: (module, count) => shouldExtractModule(module, count, {
                    chunk: 'source/common',
                    environment,

                    shared: true,
                    types: ['browser', 'core', 'framework']
                })
            }),

            new Webpack.optimize.CommonsChunkPlugin({
                name: 'common',

                chunks: [
                    'background/common',
                    'destination/common',
                    'source/common',

                    'configuration/configuration'
                ],

                minChunks: (module, count) => shouldExtractModule(module, count, {
                    chunk: 'common',
                    environment
                })
            }),

            //
            // Compiler Definitions
            //

            new Webpack.DefinePlugin({
                'neon.browser': JSON.stringify(
                    Browser.toPlainObject(environment)
                ),
                'neon.manifests': JSON.stringify({
                    'neon-extension': Extension.toPlainObject(environment),

                    ...Registry.toPlainObject(environment)
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
            // Development
            //

            ...(environment === 'development' ? [
                Validator.createPlugin(environment)
            ] : []),

            //
            // Production
            //

            ...(environment === 'production' ? [
                new Webpack.HashedModuleIdsPlugin(),
                new Webpack.NamedChunksPlugin(),

                new Webpack.optimize.UglifyJsPlugin()
            ] : []),
        ],

        externals: {
            'jquery':    'jQuery',
            'react':     'React',
            'react-dom': 'ReactDOM'
        },

        resolve: {
            modules: [
                // Shared modules
                Path.resolve(Constants.PackagePath, 'node_modules'),

                // Local modules
                'node_modules'
            ],

            alias: {
                ...getModuleAliases(environment),

                'lodash-amd': 'lodash-es',
            }
        }
    };
}

function getBabelPaths(environment) {
    let modules = Registry.list(environment, {
        filter: (module) => module.type !== 'package'
    });

    // Build list of babel includes
    let items = [];

    for(let i = 0; i < modules.length; i++) {
        let module = modules[i];

        // Include source directory
        items.push(Path.resolve(module.path, 'src'));

        // Include additional directories from manifest
        items.push(...module.webpack.babel
            .map((path) => getValidPath(
                Path.resolve(module.path, path),

                // Fallback to package modules
                Path.resolve(Constants.PackagePath, path)
            ))
            .filter((value) =>
                value !== null
            )
        );
    }

    return items;
}

function getModuleAliases(environment) {
    return Object.assign({}, ...Registry.list(environment, {
        filter: (module) => module.type !== 'package'
    }).map((module) => {
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
        ...Registry.list(environment, {
            filter: (module) => module.type !== 'package'
        }).map((module) =>
            Path.join(module.path, 'node_modules')
        )
    ];
}

function shouldExtractModule(module, count, options) {
    options = Merge({
        chunk: null,
        environment: null,

        count: 2,
        shared: false,
        types: [],
    }, options || {});

    // Validate options
    if(IsNil(options.chunk)) {
        throw new Error('Missing required option: chunk');
    }

    if(IsNil(options.environment)) {
        throw new Error('Missing required option: environment');
    }

    // Retrieve module details
    let details = {
        name: null,
        type: null,

        ...(getModuleDetails(options.environment, module.userRequest) || {})
    };

    // Determine if module should be included
    let include = false;

    if(count >= options.count) {
        include = true;
    } else if(options.types.indexOf(details.type) >= 0) {
        include = true;
    } else if(options.shared && details.type === 'dependency' && isSharedDependency(details.name)) {
        include = true;
    }

    // Ignore excluded/invalid modules
    if(IsNil(module.userRequest) || !include) {
        return include;
    }

    // Shorten request
    let request = module.userRequest;

    if(!IsNil(details.name)) {
        let start = request.indexOf(details.name);

        if(start >= 0) {
            request = request.substring(start);
        }
    }

    // Store extracted module location
    Set(ExtractedModules, [options.environment, request], options.chunk);

    return include;
}

function getModuleDetails(environment, path) {
    if(IsNil(path)) {
        return null;
    }

    // Find matching module
    let module = Registry.match(environment, path);

    // Module
    if(!IsNil(module)) {
        if(path.startsWith(Path.resolve(module.path, 'node_modules'))) {
            return {
                type: 'dependency',
                name: getModuleName(Path.resolve(module.path, 'node_modules'), path)
            };
        }

        if(module.name === 'neon-extension-core') {
            return {
                type: 'core',
                name: module.name
            };
        }

        if(module.name === 'neon-extension-framework') {
            return {
                type: 'framework',
                name: module.name
            };
        }

        if(module.name.startsWith('neon-extension-browser-')) {
            return {
                type: 'browser',
                name: module.name
            };
        }

        if(module.name.startsWith('neon-extension-destination-')) {
            return {
                type: 'destination',
                name: module.name
            };
        }

        if(module.name.startsWith('neon-extension-source-')) {
            return {
                type: 'source',
                name: module.name
            };
        }
    }

    // Package
    if(path.startsWith(Path.resolve(Constants.PackagePath, 'node_modules'))) {
        return {
            type: 'dependency',
            name: getModuleName(Path.resolve(Constants.PackagePath, 'node_modules'), path)
        };
    }

    return null;
}

function getModuleName(basePath, path) {
    path = Path.normalize(Path.relative(basePath, path));

    let end = path.indexOf(Path.sep);

    if(path[0] === '@') {
        end = path.indexOf(Path.sep, end + 1);
    }

    return path.substring(0, end);
}

function isSharedDependency(name) {
    if(name.startsWith('neon-extension-')) {
        return false;
    }

    return !IsNil(Extension.package.dependencies[name]);
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

function getValidPath(...paths) {
    for(let i = 0; i < paths.length; i++) {
        if(Filesystem.existsSync(paths[i])) {
            return paths[i];
        }
    }

    return null;
}
