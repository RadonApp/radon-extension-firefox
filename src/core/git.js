import Filesystem from 'fs';
import Path from 'path';
import SimpleGit from 'simple-git';

import {isDefined} from './helpers';


export class Git {
    version(path, packageVersion) {
        let repository = SimpleGit(path).silent(true);

        return this.status(path).then((status) => {
            if(!isDefined(status.version) && !isDefined(packageVersion)) {
                return Promise.reject(new Error('Unable to find version'));
            }

            // Build version
            let version;

            if(isDefined(status.version)) {
                version = status.version;

                if(status.ahead > 0) {
                    version += '-' + status.commit.substring(0, 7)
                }
            } else {
                version = packageVersion + '-' + status.commit.substring(0, 7);
            }

            if(status.dirty) {
                version += '-dirty';
            }

            return version;
        });

        return this._getDescription(repository).then((version) => {
            console.log('version:', version);

            if(!isDefined(version)) {
                return null;
            }

            // Build version
            if(version.indexOf('v') === 0) {
                version = version.substring(1);
            } else if(version.length > 0) {
                version = packageVersion + '-' + version;
            } else {
                version = packageVersion;
            }

            // Remove whitespace
            return version.trim();
        });
    }

    status(path) {
        // Ensure repository exists
        if(!Filesystem.existsSync(Path.join(path, '.git'))) {
            return Promise.resolve({});
        }

        // Create repository instance
        let repository = SimpleGit(path).silent(true);

        // Retrieve repository status
        return Promise.resolve()
            // Retrieve latest version tag
            .then(() => this._getDescription(repository).then((version) => ({
                version: version.substring(1)
            }), () => ({
                version: null
            })))

            // Retrieve latest commit hash
            .then((result) => this._getHash(repository, ['HEAD']).then((commit) => ({
                ...result,
                commit
            }), () => ({
                ...result,
                commit: null
            })))

            // Retrieve status
            .then((result) => this._getStatus(repository).then((status) => ({
                ...result,

                ahead: status.ahead,
                behind: status.behind,
                dirty: status.files.length > 0
            }), () => ({
                ...result,

                ahead: 0,
                behind: 0,
                dirty: false
            })));
    }

    _getDescription(repository) {
        return new Promise((resolve, reject) => {
            repository.raw([
                'describe',
                '--abbrev=0',
                '--match=v*',
                '--tags'
            ], (err, description) => {
                if(err) {
                    reject(err);
                    return;
                }

                resolve(description.trim());
            });
        });
    }

    _getHash(repository, name) {
        return new Promise((resolve, reject) => {
            repository.revparse(name, (err, hash) => {
                if(err) {
                    reject(err);
                    return;
                }

                resolve(hash.trim());
            });
        })
    }

    _getStatus(repository) {
        return new Promise((resolve, reject) => {
            repository.status((err, status) => {
                if(err) {
                    reject(err);
                    return;
                }

                resolve(status);
            });
        });
    }
}

export default new Git();
