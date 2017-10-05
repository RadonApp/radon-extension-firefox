import Filesystem from 'fs';
import Filter from 'lodash-es/filter';
import GulpUtil from 'gulp-util';
import MapValues from 'lodash-es/mapValues';
import Merge from 'lodash-es/merge';
import PadEnd from 'lodash-es/padEnd';
import Path from 'path';
import Pick from 'lodash-es/pick';
import Set from 'lodash-es/set';
import SortBy from 'lodash-es/sortBy';

import Constants from './constants';
import Extension from './extension';
import Git from './git';
import {isDefined} from '../core/helpers';


export class Registry {
    constructor() {
        this.ahead = false;
        this.dirty = false;

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

        // Ensure extension metadata has been fetched
        return Extension.fetch()
            // Discover modules
            .then(() => this._discover(environment).then(() => {
                this._discovered = true;
            }))
            // Update extension version
            .then(() => {
                // Update extension state
                if(this.ahead) Extension.setAhead(environment);
                if(this.dirty) Extension.setDirty(environment);

                // Display extension version
                let color = GulpUtil.colors.green;

                if(Extension.isAhead(environment)) {
                    color = GulpUtil.colors.yellow;
                }

                if(Extension.isDirty(environment)) {
                    color = GulpUtil.colors.red;
                }

                GulpUtil.log(
                    color('Extension Version: %s'),
                    Extension.getVersion(environment)
                );
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
        return this._getMetadata(path).then((module) => {
            if(!module.name || module.name !== name) {
                return Promise.reject(new Error('Invalid name, found: "' + module.name + '"'));
            }

            // Update state
            this.ahead = this.ahead || module.repository.ahead;
            this.dirty = this.dirty || module.repository.dirty;

            // Set module attributes
            module = {
                ...module,

                environment: options.environment,
                path: path,

                key: this._getModuleKey(module.name),
                type: type
            };

            // Register module
            Set(this._modules,       [options.environment, name],        module);
            Set(this._modulesByPath, [options.environment, module.path], module);
            Set(this._modulesByType, [options.environment, type, name],  module);

            // Resolve promise with module
            return module;
        }, (err) => {
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

    list(environment, options) {
        options = Merge({
            filter: {},
            sort: true,
            type: null
        }, options || {});

        // Enable "type" filter
        if(isDefined(options.type)) {
            options.filter.type = options.type;
        }

        // Filter modules
        let modules = Filter(this._modules[environment], options.filter);

        // Sort modules (if enabled)
        if(isDefined(options.sort) && options.sort !== false) {
            modules = SortBy(modules, options.sort || 'name');
        }

        return modules;
    }

    match(environment, path) {
        path = Path.normalize(path);

        for(let p in this._modulesByPath[environment]) {
            if(!this._modulesByPath[environment].hasOwnProperty(p)) {
                continue;
            }

            if(path.startsWith(p)) {
                return this._modulesByPath[environment][p];
            }
        }

        return null;
    }

    toPlainObject(environment) {
        let modules = MapValues(this._modules[environment], (module) => Pick(module, [
            'name',
            'type',
            'key',

            'title',
            'version',

            'content_scripts',
            'services',

            // Required Permissions
            'origins',
            'permissions',

            // Optional Permissions
            'optional_origins',
            'optional_permissions'
        ]));

        // Sort modules by key
        return Pick(modules, Object.keys(modules).sort());
    }

    // region Private Methods

    _discover(environment) {
        if(environment === 'development') {
            return this._discoverDevelopment();
        }

        if(environment === 'production') {
            return this._discoverProduction();
        }

        // Unknown environment
        return Promise.reject(new Error('Invalid environment: ' + environment));
    }

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
                }).then((module) => {
                    // Display module version
                    this._logModuleRegistration(module, Path.relative(
                        Constants.ProjectPath,
                        modulePath
                    ));
                }));
            }
        }

        // Wait for modules to be registered
        return Promise.all(promises);
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
                promises.push(this.register(modulePath).then((module) => {
                    // Display module version
                    this._logModuleRegistration(module, Path.relative(
                        Path.resolve(Constants.PackagePath, 'node_modules'),
                        modulePath
                    ));
                }));
            }
        }

        // Wait for modules to be registered
        return Promise.all(promises);
    }

    _logModuleRegistration(module, relativePath) {
        let color = GulpUtil.colors.green;

        if(isDefined(module.repository) && module.repository.dirty) {
            color = GulpUtil.colors.red;
        } else if(isDefined(module.repository) && module.repository.ahead) {
            color = GulpUtil.colors.yellow;
        }

        // Display module version
        GulpUtil.log(
            color('[%s] Registered: %s (%s)'),
            PadEnd(module.name, 35), relativePath, module.version
        );
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

    _getModuleKey(name) {
        name = name.replace('neon-extension-', '');

        // Find key position
        let splitAt = name.indexOf('-');

        if(splitAt < 0) {
            return null;
        }

        // Return module key
        return name.substring(splitAt + 1);
    }

    _getMetadata(path) {
        return this._getManifest(path, { required: false })
            // Retrieve package details
            .then((manifest) => this._getPackageDetails(path).then((data) => ({
                ...manifest,

                name: data.name,
                title: manifest.title,
                version: data.version,

                manifest: manifest,
                package: data
            })))
            // Try retrieve extension version from git (or fallback to manifest version)
            .then((metadata) => this._getRepositoryDetails(path, metadata.version).then((repository) => {
                return {
                    ...metadata,

                    // Include repository details
                    repository,

                    // Pick repository version, or fallback to metadata version
                    version: repository.version || metadata.version
                };
            }));
    }

    _getManifest(path, options) {
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

    _getPackageDetails(path, options) {
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

    _getRepositoryDetails(path, packageVersion) {
        return Git.version(path, packageVersion).catch(() => ({
            ahead: 0,
            dirty: false,

            commit: null,
            tag: null,
            version: null
        }));
    }

    _parseModuleManifest(contents) {
        let data = {};

        // Parse file contents (if provided)
        if(contents) {
            data = JSON.parse(contents);
        }

        // Set manifest defaults
        return {
            title: data.name || null,
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
                babel: [],
                chunks: [],
                modules: [],
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

            dependencies: {},
            peerDependencies: {},

            ...data
        };
    }

    // endregion
}

export default new Registry();
