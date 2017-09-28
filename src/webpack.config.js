import ExtractTextPlugin from 'extract-text-webpack-plugin';
import GulpUtil from 'gulp-util';
import Path from 'path';
import Webpack from 'webpack';

import Constants from './core/constants';
import {isDefined} from './core/helpers';


let bundled = {};

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

    if(typeof bundled[name] === 'undefined') {
        bundled[name] = {};
    }

    // Log included module (if not already logged)
    if(typeof bundled[name][packagePath] === 'undefined') {
        bundled[name][packagePath] = true;

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

export default {
    profile: true,

    entry: {},
    externals: [],

    output: {
        filename: '[name].js',

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

            chunks: [
                'destination/lastfm/callback/callback',
                'destination/trakt/callback/callback'
            ],

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

            chunks: [
                'source/amazonvideo/amazonvideo',
                'source/googlemusic/googlemusic',
                'source/netflix/netflix'
            ],

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

        new Webpack.ProvidePlugin({
            '$': 'jquery',
            'jQuery': 'jquery'
        }),

        new ExtractTextPlugin({
            filename: '[name].css',
            allChunks: true
        })
    ],

    resolve: {
        modules: [],

        alias: {
            'lodash-amd': 'lodash-es'
        }
    }
};
