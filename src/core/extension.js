import Filesystem from 'fs';
import IsNil from 'lodash-es/isNil';
import Merge from 'lodash-es/merge';
import Path from 'path';
import Pick from 'lodash-es/pick';

import Constants from './constants';
import Git from './git';
import Travis from './travis';


export class Extension {
    constructor() {
        this._ahead = {};
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

    get branch() {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        return Travis.branch || this._metadata.repository.branch;
    }

    get commit() {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        return this._metadata.repository.commit;
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

    setAhead(environment, value = true) {
        this._ahead[environment] = value;
    }

    setDirty(environment, value = true) {
        this._dirty[environment] = value;
    }

    isAhead(environment) {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        return this._ahead[environment] || this._metadata.repository.ahead || false;
    }

    isDirty(environment) {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        return this._dirty[environment] || this._metadata.repository.dirty || false;
    }

    getCommitShort() {
        let commit = this.commit;

        if(IsNil(commit)) {
            return null;
        }

        return commit.substring(0, 7);
    }

    getVersion(environment, options) {
        if(!this._fetched) {
            throw new Error('Extension manifest hasn\'t been fetched yet');
        }

        options = Merge({
            plain: false
        }, options || {});

        // Retrieve current version
        let version = this._metadata.version;

        if(IsNil(version)) {
            return null;
        }

        // Return plain version (if requested)
        if(options.plain) {
            return version.substring(0, version.indexOf('-')) || version;
        }

        // Format version (for AMO)
        version = version.replace(/-(\w)\w+\.(\d+)$/g, '$1$2');

        // Retrieve repository status
        let dirty = this.isDirty(environment);

        // Ahead / Behind
        if(this.isAhead(environment)) {
            if(this.branch === 'master') {
                version += '-pre';
            } else {
                version += '-dev';

                // Append branch name (for unknown branches)
                if(this.branch !== 'develop') {
                    version += '-' + this.branch.replace(/[^A-Za-z0-9]+/g, '-');
                }
            }

            // Append commit sha (if defined)
            let commit = this.getCommitShort();

            if(!IsNil(commit)) {
                version += '-' + commit;
            } else {
                dirty = true;
            }
        }

        // Dirty
        if(dirty) {
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

    toPlainObject(environment) {
        return {
            ...Pick(this.metadata, [
                'name',

                'title',
                'description',

                // Required Permissions
                'origins',
                'permissions',

                // Optional Permissions
                'optional_origins',
                'optional_permissions'
            ]),

            // Generate version for environment
            version: this.getVersion(environment)
        };
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

                // Include repository details
                repository
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
        return Git.version(Constants.PackagePath, packageVersion).catch(() => ({
            ahead: 0,
            dirty: false,

            commit: null,
            tag: null,
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
