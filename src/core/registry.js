import Filesystem from 'fs';
import Filter from 'lodash-es/filter';
import GulpUtil from 'gulp-util';
import Merge from 'lodash-es/merge';
import PadEnd from 'lodash-es/padEnd';
import Path from 'path';
import Set from 'lodash-es/set';

import Constants from '../core/constants';
import Extension from './extension';


export class Registry {
    constructor() {
        this._modules = {};
        this._modulesByPath = {};
        this._modulesByType = {};

        this._discovered = false;
    }

    discover(environment = 'production', options) {
        options = Merge({
            force: false
        }, options || {});

        // Ensure modules haven't already been discovered
        if(this._discovered && !options.force) {
            return Promise.resolve();
        }

        // Ensure extension manifest has been fetched
        return Extension.fetch().then(() => {
            // Discover modules
            if(environment === 'development') {
                return this._discoverDevelopment();
            }

            if(environment === 'production') {
                return this._discoverProduction();
            }

            // Unknown environment
            return Promise.reject(new Error('Invalid environment: ' + environment));
        });
    }

    register(path, options) {
        options = Merge({
            environment: 'production',
            type: null
        }, options || {});

        let name = Path.basename(path);
        let type = options.type || this._getModuleType(name);

        // Retrieve module details
        return this._getModuleDetails(path)
            .then((module) => {
                if(!module.name || module.name !== name) {
                    return Promise.reject(new Error('Invalid name, found: "' + module.name + '"'));
                }

                // Set module attributes
                module = {
                    ...module,

                    environment: options.environment,
                    path: path,
                    type: type
                };

                // Register module
                Set(this._modules,       [options.environment, name],        module);
                Set(this._modulesByPath, [options.environment, module.path], module);
                Set(this._modulesByType, [options.environment, type, name],  module);

                GulpUtil.log(
                    GulpUtil.colors.green('[%s] Registered: %s'),
                    PadEnd(name, 35), path
                );
            })
            .catch((err) => {
                GulpUtil.log(
                    GulpUtil.colors.red('[%s] %s'),
                    PadEnd(name, 35), err.message
                );
                return Promise.reject(err);
            });
    }

    get(environment, name) {
        return this._modules[environment][name];
    }

    list(environment, selector) {
        return Filter(this._modules[environment], selector);
    }

    match(environment, path) {
        return this._modulesByPath[environment][path];
    }

    // region Private Methods

    _discoverDevelopment() {
        let promises = [];

        // Iterate over module collections, and register modules
        for(let type in Extension.modules) {
            if(!Extension.modules.hasOwnProperty(type)) {
                continue;
            }

            let collectionType = this._getCollectionType(type);

            // Build collection path
            let collectionPath = Path.resolve(Constants.ProjectPath, this._getCollectionDirectory(collectionType));

            // Ensure collection path exists
            if(!Filesystem.existsSync(collectionPath)) {
                throw new Error('Unable to find collection: "' + collectionType + '"');
            }

            // Register modules
            for(let i = 0; i < Extension.modules[type].length; i++) {
                let modulePath = Filesystem.realpathSync(Path.resolve(collectionPath, Extension.modules[type][i]));

                // Ensure module exists
                if(!Filesystem.existsSync(modulePath)) {
                    throw new Error('Unable to find module: "' + modulePath + '"');
                }

                // Register module
                promises.push(this.register(modulePath, {
                    environment: 'development',
                    type: collectionType
                }));
            }
        }

        // Wait for modules to be registered
        return Promise.all(promises).then(() => {
            GulpUtil.log(
                GulpUtil.colors.green('Registered %d module(s)'),
                Object.keys(this._modules['development']).length
            );

            // Update state
            this._discovered = true;
        });
    }

    _discoverProduction() {
        let promises = [];

        // Iterate over module collections, and register modules
        for(let type in Extension.modules) {
            if(!Extension.modules.hasOwnProperty(type)) {
                continue;
            }

            // Load modules
            for(let i = 0; i < Extension.modules[type].length; i++) {
                let modulePath = Filesystem.realpathSync(Path.resolve(
                    Constants.PackagePath, 'node_modules',
                    Extension.modules[type][i]
                ));

                // Ensure module exists
                if(!Filesystem.existsSync(modulePath)) {
                    throw new Error('Unable to find module: "' + modulePath + '"');
                }

                // Load module
                promises.push(this.register(modulePath));
            }
        }

        // Wait for modules to be registered
        return Promise.all(promises).then(() => {
            GulpUtil.log(
                GulpUtil.colors.green('Registered %d module(s)'),
                Object.keys(this._modules['production']).length
            );

            // Update state
            this._discovered = true;
        });
    }

    _getCollectionType(type) {
        type = type.toLowerCase();

        // Match collection type
        if(type.indexOf('browser') === 0) {
            return 'browser';
        }

        if(type.indexOf('destination') === 0) {
            return 'destination';
        }

        if(type.indexOf('source') === 0) {
            return 'source';
        }

        if(type.indexOf('core') === 0) {
            return 'core';
        }

        // Unknown collection type
        throw new Error('Unknown collection type: ' + type);
    }

    _getCollectionDirectory(type) {
        if(type === 'browser') {
            return './Browsers';
        }

        if(type === 'core') {
            return './';
        }

        if(type === 'destination') {
            return './Destinations';
        }

        if(type === 'source') {
            return './Sources';
        }

        throw new Error('Unknown collection type: ' + type);
    }

    _getModuleDetails(path) {
        return Promise.resolve()
            // Retrieve module manifest
            .then(() => this._getModuleManifest(path, { required: false }))
            // Retrieve module package details, and merge with manifest
            .then((manifest) => this._getModulePackageDetails(path).then((data) => ({
                name: data.name,
                version: data.version,
                ...manifest,

                manifest: manifest,
                package: data
            })));
    }

    _getModuleManifest(path, options) {
        options = Merge({
            required: true
        }, options || {});

        return new Promise((resolve, reject) => {
            if(Path.basename(path) !== 'module.json') {
                path = Path.resolve(path, 'module.json');
            }

            // Ensure file exists
            if(!Filesystem.existsSync(path)) {
                if(options.required) {
                    reject(new Error('Missing required file: module.json'));
                } else {
                    resolve(this._parseModuleManifest());
                }
                return;
            }

            // Read file
            Filesystem.readFile(path, (err, data) => {
                if(err) {
                    reject(err);
                    return;
                }

                // Parse file
                try {
                    resolve(this._parseModuleManifest(data));
                } catch(e) {
                    reject(new Error('Unable to parse module manifest: ' + e.message));
                }
            });
        });
    }

    _getModulePackageDetails(path, options) {
        options = Merge({
            required: true
        }, options || {});

        return new Promise((resolve, reject) => {
            if(Path.basename(path) !== 'package.json') {
                path = Path.resolve(path, 'package.json');
            }

            // Ensure file exists
            if(!Filesystem.existsSync(path)) {
                if(options.required) {
                    reject(new Error('Missing required file: package.json'));
                } else {
                    resolve(this._parseModulePackageDetails());
                }
                return;
            }

            // Read file
            Filesystem.readFile(path, (err, data) => {
                if(err) {
                    reject(err);
                    return;
                }

                // Parse file
                try {
                    resolve(this._parseModulePackageDetails(data));
                } catch(e) {
                    reject(new Error('Unable to parse package details: ' + e.message));
                }
            });
        });
    }

    _getModuleType(name) {
        name = name.toLowerCase();

        // Match module type
        if(name.indexOf('neon-extension-browser-') === 0) {
            return 'browser';
        }

        if(name.indexOf('neon-extension-destination-') === 0) {
            return 'destination';
        }

        if(name.indexOf('neon-extension-source-') === 0) {
            return 'source';
        }

        if(name.indexOf('neon-extension-') === 0) {
            return 'core';
        }

        // Unknown module name
        throw new Error('Unknown module name: ' + name);
    }

    _parseModuleManifest(contents) {
        let data = {};

        // Parse file contents (if provided)
        if(contents) {
            data = JSON.parse(contents);
        }

        // Set manifest defaults
        return {
            title: null,
            icons: {},

            content_scripts: [],
            web_accessible_resources: [],

            origins: [],
            permissions: [],

            optional_origins: [],
            optional_permissions: [],

            // Retrieve manifest properties
            ...data,

            // Set Webpack defaults
            webpack: Merge({
                alias: [],
                babel: []
            }, data.webpack || {})
        }
    }

    _parseModulePackageDetails(contents) {
        let data = {};

        // Parse file contents (if provided)
        if(contents) {
            data = JSON.parse(contents);
        }

        // Set defaults
        return {
            name: null,
            version: null,

            ...data
        };
    }

    // endregion
}

export default new Registry();
