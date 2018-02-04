import Filesystem from 'fs';
import GulpUtil from 'gulp-util';
import IsNil from 'lodash-es/isNil';
import Path from 'path';
import SemanticVersion from 'semver';
import Set from 'lodash-es/set';
import UniqBy from 'lodash-es/uniqBy';

import Extension from '../../core/extension';
import Registry from '../../core/registry';
import ValidatorPlugin from './plugins/validator';
import {readJsonSync} from '../../core/json';


const DependencyVersionRegex = /^\d+\.\d+\.\d+(\-\w+(\.\d+)?)?$/g;

const IgnoredPackages = [
    'webpack'
];

export class Validator {
    constructor() {
        this.dependencies = {};
        this.peerDependencies = {};

        this._error = false;
    }

    createPlugin(environment) {
        return new ValidatorPlugin(this, environment);
    }

    processModule(environment, module) {
        if(IsNil(environment) || IsNil(module) || IsNil(module.userRequest)) {
            return;
        }

        // Validate each module source
        module.reasons.forEach((source) => {
            let sources = this._getSources(environment, source) || source;

            for(let i = 0; i < sources.length; i++) {
                this.processModuleDependency(environment, sources[i].module.userRequest, module.userRequest)
            }
        });
    }

    processModuleDependency(environment, source, request) {
        if(IsNil(environment) || IsNil(request)) {
            return false;
        }

        // Retrieve dependency name
        let dep;

        try {
            dep = this._parseDependency(request);
        } catch(e) {
            console.log('Unable to parse dependency: "' + request + '": ' + e);
            return false;
        }

        // Validate package information
        if(IsNil(dep)) {
            console.log('Unable to parse dependency: "' + request + '"');
            return false;
        }

        // Ignore neon modules
        if(dep.name.startsWith('neon-extension-')) {
            return false;
        }

        // Apply `IgnoredPackages` filter
        if(IgnoredPackages.indexOf(dep.name) >= 0) {
            return false;
        }

        // Search for dependency definition
        let extensionDependency = Extension.package.devDependencies[dep.name];

        // Find registered module matching source (if available)
        let module;
        let moduleDependency;

        if(!IsNil(source)) {
            module = Registry.match(environment, source);

            if(IsNil(module)) {
                GulpUtil.log(GulpUtil.colors.yellow(
                    '[' + dep.name + '] Unknown source: "' + source + '"'
                ));
                return false;
            }
        }

        if(!IsNil(module) && module.type !== 'package') {
            moduleDependency = module.package.dependencies[dep.name];
        }

        // Pick definition
        let dependency = moduleDependency || extensionDependency;

        // Ensure dependency definition was found
        if(IsNil(dependency)) {
            if(!IsNil(module)) {
                GulpUtil.log(GulpUtil.colors.red(
                    'Unable to find "' + dep.name + '" dependency for "' + module.name + '"'
                ));
            } else {
                GulpUtil.log(GulpUtil.colors.red(
                    'Unable to find "' + dep.name + '" dependency'
                ));
            }

            this._error = true;
            return false;
        }

        // Ensure dependency is pinned to a version
        if(!dependency.match(DependencyVersionRegex)) {
            if(!IsNil(moduleDependency)) {
                GulpUtil.log(GulpUtil.colors.red(
                    'Dependency "' + dep.name + '" for "' + module.name + '" ' +
                    'should be pinned to a version (found: ' + dependency + ')'
                ));
            } else {
                GulpUtil.log(GulpUtil.colors.red(
                    'Dependency "' + dep.name + '" ' +
                    'should be pinned to a version (found: ' + dependency + ')'
                ));
            }

            this._error = true;
            return false;
        }

        // Ensure dependencies aren't duplicated
        if(!IsNil(moduleDependency) && !IsNil(extensionDependency)) {
            GulpUtil.log(GulpUtil.colors.red(
                'Dependency "' + dep.name + '" has been duplicated ' +
                '(extension: ' + extensionDependency + ', ' + module.name + ': ' + moduleDependency + ')'
            ));

            this._error = true;
            return false;
        }

        // Mark dependency
        if(!IsNil(moduleDependency)) {
            Set(this.dependencies, [environment, module.name, dep.name], true);
        } else {
            Set(this.dependencies, [environment, null, dep.name], true);
        }

        // Validate module dependency
        if(!IsNil(module) && module.type !== 'package') {
            let modulePeerDependency = module.package.peerDependencies[dep.name];

            // Mark peer dependency
            Set(this.peerDependencies, [environment, module.name, dep.name], true);

            // Ensure peer dependency is defined
            if(!IsNil(extensionDependency) && IsNil(modulePeerDependency)) {
                GulpUtil.log(GulpUtil.colors.red(
                    '"' + dep.name + '" should be defined as a peer dependency in "' + module.name + '"'
                ));

                this._error = true;
                return false;
            }

            // Ensure peer dependency is a caret range
            if(!IsNil(extensionDependency) && modulePeerDependency.indexOf('^') !== 0) {
                GulpUtil.log(GulpUtil.colors.red(
                    '"' + dep.name + '" peer dependency in "' + module.name + '" should be a caret range'
                ));

                this._error = true;
                return false;
            }

            // Ensure extension dependency matches peer dependency range
            if(!IsNil(extensionDependency) && !SemanticVersion.satisfies(extensionDependency, modulePeerDependency)) {
                GulpUtil.log(GulpUtil.colors.red(
                    '"' + dep.name + '" peer dependency in "' + module.name + '" (' + modulePeerDependency + ')' +
                    ' is not satisfied by extension version: ' + extensionDependency
                ));

                this._error = true;
                return false;
            }
        }

        return true;
    }

    finish(environment) {
        if(this._error) {
            throw new Error('Build didn\'t pass validation');
        }

        // Ensure there are no unused extension dependencies
        this._checkDependencies('Dependency', Extension.package.dependencies, this.dependencies[environment][null]);

        // Ensure there are no unused module dependencies
        Registry.list(environment, {
            filter: (module) => module.type !== 'package'
        }).forEach((module) => {
            this._checkDependencies(
                'Dependency', module.package.dependencies, this.dependencies[environment][module.name],
                module.name
            );

            this._checkDependencies(
                'Peer dependency', module.package.peerDependencies, this.peerDependencies[environment][module.name],
                module.name
            );
        });
    }

    _checkDependencies(prefix, current, matched, moduleName) {
        if(IsNil(prefix) || IsNil(current)) {
            return;
        }

        matched = matched || {};

        // Ensure dependencies have been matched
        for(let name in current) {
            if(!current.hasOwnProperty(name) || name.startsWith('neon-extension-')) {
                continue;
            }

            // Check if module was used
            if(matched[name]) {
                continue;
            }

            // Display warning
            if(!IsNil(moduleName)) {
                GulpUtil.log(GulpUtil.colors.yellow(
                    prefix + ' "' + name + '" for "' + moduleName + '" is not required'
                ));
            } else {
                GulpUtil.log(GulpUtil.colors.yellow(
                    prefix + ' "' + name + '" is not required'
                ));
            }
        }
    }

    _getSources(environment, source) {
        if(IsNil(source.module.userRequest)) {
            return [source];
        }

        if(Registry.match(environment, source.module.userRequest, { type: { exclude: 'package' } })) {
            return [source];
        }

        let result = [];

        for(let i = 0; i < source.module.reasons.length; i++) {
            result.push.apply(result, this._getSources(environment, source.module.reasons[0]));
        }

        return UniqBy(result, (source) =>
            source.module.userRequest || source.module.name
        );
    }

    _parseDependency(request) {
        let path = Path.dirname(request);
        let packagePath;

        while(true) {
            let current = Path.join(path, 'package.json');

            if(Filesystem.existsSync(current)) {
                packagePath = current;
                break;
            }

            // Go up one directory
            let next = Path.resolve(path, '..');

            if(next === path) {
                return null;
            }

            // Set next search directory
            path = next;
        }

        // Retrieve package name
        let name = readJsonSync(packagePath)['name'];

        // Return package information
        return {
            name,
            path
        };
    }
}

export default new Validator();
