import ExtractTextPlugin from 'extract-text-webpack-plugin';
import Path from 'path';
import Webpack from 'webpack';

import Constants from '../core/constants';


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
