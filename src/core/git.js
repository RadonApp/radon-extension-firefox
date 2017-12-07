import Filesystem from 'fs';
import IsNil from 'lodash-es/isNil';
import Path from 'path';
import SimpleGit from 'simple-git';


export class Git {
    version(path, packageVersion) {
        return this.status(path).then((status) => {
            // Build version
            let version;

            if(!IsNil(status.tag)) {
                version = status.tag.substring(1);

                if(status.ahead > 0) {
                    version += '-' + status.commit.substring(0, 7)
                }
            } else {
                version = packageVersion + '-' + status.commit.substring(0, 7);
            }

            if(status.dirty) {
                version += '-dirty';
            }

            return {
                ...status,

                version
            };
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
            // Retrieve latest version
            .then(() => this._getLatestTag(repository).then((tag) => ({
                tag: tag
            }), () => ({
                tag: null
            })))

            // Retrieve commits since latest version
            .then((result) => this._getCommits(repository, result.tag).then((commits) => ({
                ...result,

                ahead: commits.total
            }), () => ({
                ...result,

                ahead: 0
            })))

            // Retrieve latest commit hash
            .then((result) => this._resolveHash(repository).then((commit) => ({
                ...result,

                commit
            }), () => ({
                ...result,

                commit: null
            })))

            // Retrieve status
            .then((result) => this._getStatus(repository).then((status) => ({
                ...result,

                dirty: status.files.length > 0
            }), () => ({
                ...result,

                dirty: false
            })));
    }

    _getCommits(repository, from, to = 'HEAD') {
        return new Promise((resolve, reject) => {
            repository.log({ from, to }, (err, commits) => {
                if(err) {
                    reject(err);
                    return;
                }

                resolve(commits);
            });
        });
    }

    _getLatestTag(repository) {
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

    _resolveHash(repository, name = 'HEAD') {
        return new Promise((resolve, reject) => {
            repository.revparse([name], (err, hash) => {
                if(err) {
                    reject(err);
                    return;
                }

                resolve(hash.trim());
            });
        })
    }
}

export default new Git();
