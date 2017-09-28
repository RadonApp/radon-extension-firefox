import Filesystem from 'fs';
import Merge from 'lodash-es/merge';
import Path from 'path';

import Constants from '../core/constants';


export class Extension {
    constructor() {
        this._details = {};

        this._fetched = false;
    }

    get manifest() {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        return this._details.manifest;
    }

    get modules() {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        return this._details.modules;
    }

    get package() {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        return this._details.package;
    }

    get version() {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        return this._details.version;
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
        return this._getDetails().then((details) => {
            this._details = details;
            this._fetched = true;

            return details;
        });
    }

    _getDetails() {
        return Promise.resolve()
            // Retrieve module manifest
            .then(() => this._getManifest({ required: false }))
            // Retrieve module package details, and merge with manifest
            .then((manifest) => this._getPackageDetails().then((data) => ({
                name: data.name,
                version: data.version,
                ...manifest,

                manifest: manifest,
                package: data
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

    _parseManifest(contents) {
        let data = {};

        // Parse file contents (if provided)
        if(contents) {
            data = JSON.parse(contents);
        }

        // Set defaults
        let modules = data.modules || {};

        return {
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

            ...data
        };
    }
}

export default new Extension();
