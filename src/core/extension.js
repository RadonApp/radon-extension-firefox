import Filesystem from 'fs';
import Merge from 'lodash-es/merge';
import Path from 'path';

import Constants from './constants';
import Git from './git';


export class Extension {
    constructor() {
        this._dirty = {};
        this._fetched = false;
        this._metadata = {};
    }

    get metadata() {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        return this._metadata;
    }

    get manifest() {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        return this._metadata.manifest;
    }

    get package() {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        return this._metadata.package;
    }

    get modules() {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        return this._metadata.modules;
    }

    get version() {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        let version = this._metadata.version;

        // Ensure "-dirty" suffix has been added
        if(this.dirty && !version.endsWith('-dirty')) {
            version += '-dirty';
        }

        return version;
    }

    isDirty(environment) {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        if(this._metadata.version.endsWith('-dirty')) {
            return true;
        }

        return this._dirty[environment] || false;
    }

    setDirty(environment, value = true) {
        this._dirty[environment] = value;
    }

    getVersion(environment) {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        let version = this._metadata.version;

        // Ensure "-dirty" suffix has been added
        if(this.isDirty(environment) && !version.endsWith('-dirty')) {
            version += '-dirty';
        }

        return version;
    }

    fetch(options) {
        options = Merge({
            force: false
        }, options || {});

        // Ensure extension details haven't already been fetched
        if(this._fetched && !options.force) {
            return Promise.resolve();
        }

        // Fetch extension details
        return this._getMetadata().then((details) => {
            this._metadata = details;
            this._fetched = true;

            return details;
        });
    }

    _getMetadata() {
        // Retrieve manifest
        return this._getManifest({ required: false })
            // Retrieve package details
            .then((manifest) => this._getPackageDetails().then((details) => ({
                ...manifest,

                name: details.name,
                title: manifest.title,
                version: details.version,

                manifest: manifest,
                package: details
            })))
            // Try retrieve extension version from git (or fallback to manifest version)
            .then((metadata) => this._getRepositoryDetails(metadata.version).then((repository) => ({
                ...metadata,

                version: repository.version || metadata.version
            })));
    }

    _getManifest(options) {
        options = Merge({
            required: true
        }, options || {});

        return new Promise((resolve, reject) => {
            let path = Path.resolve(Constants.PackagePath, 'extension.json');

            // Ensure file exists
            if(!Filesystem.existsSync(path)) {
                if(options.required) {
                    reject(new Error('Missing required file: module.json'));
                } else {
                    resolve(this._parseManifest());
                }
                return;
            }

            // Read file
            Filesystem.readFile(path, (err, contents) => {
                if(err) {
                    reject(err);
                    return;
                }

                // Parse file
                try {
                    resolve(this._parseManifest(contents));
                } catch(e) {
                    reject(new Error('Unable to parse module manifest: ' + e.message));
                }
            });
        });
    }

    _getPackageDetails(options) {
        options = Merge({
            required: true
        }, options || {});

        return new Promise((resolve, reject) => {
            let path = Path.resolve(Constants.PackagePath, 'package.json');

            // Ensure file exists
            if(!Filesystem.existsSync(path)) {
                if(options.required) {
                    reject(new Error('Missing required file: package.json'));
                } else {
                    resolve(this._parsePackageDetails());
                }
                return;
            }

            // Read file
            Filesystem.readFile(path, (err, contents) => {
                if(err) {
                    reject(err);
                    return;
                }

                // Parse file
                try {
                    resolve(this._parsePackageDetails(contents));
                } catch(e) {
                    reject(new Error('Unable to parse package details: ' + e.message));
                }
            });
        });
    }

    _getRepositoryDetails(packageVersion) {
        return Git.version(Constants.PackagePath, packageVersion).then((version) => ({
            version
        }), () => ({
            version: null
        }));
    }

    _parseManifest(contents) {
        let data = {};

        // Parse file contents (if provided)
        if(contents) {
            data = JSON.parse(contents);
        }

        // Set defaults
        let modules = data.modules || {};

        return {
            title: data.name || null,

            origins: [],
            permissions: [],

            optional_origins: [],
            optional_permissions: [],

            // Retrieve extension manifest properties
            ...data,

            // Modules
            modules: {
                // Defaults
                destinations: [],
                sources:      [],

                // Include provided modules
                ...modules,

                // Browsers
                browsers: [
                    'neon-extension-browser-base',

                    ...(modules.browsers || [])
                ],

                // Core
                core: [
                    'neon-extension-core',
                    'neon-extension-framework',

                    ...(modules.core || [])
                ]
            }
        };
    }

    _parsePackageDetails(contents) {
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
}

export default new Extension();
