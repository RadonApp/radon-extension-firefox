import SemanticVersion from 'semver';
import Set from 'lodash-es/set';

import Extension from '../../core/extension';
import Registry from '../../core/registry';
import ValidatorPlugin from './plugins/validator';
import {isDefined} from '../../core/helpers';


const DependencyVersionRegex = /^\d+\.\d+\.\d+(\-\w+(\.\d+)?)?$/g;

export class Validator {
    constructor() {
        this.dependencies = {};
        this.peerDependencies = {};
    }

    createPlugin(environment) {
        return new ValidatorPlugin(this, environment);
    }

    processModule(environment, module) {
        if(!isDefined(environment) || !isDefined(module) || !isDefined(module.userRequest)) {
            return;
        }

        // Validate each module source
        module.reasons.forEach((source) => {
            this.processModuleDependency(environment, source.module.userRequest, module.userRequest)
        });
    }

    processModuleDependency(environment, source, request) {
        if(!isDefined(environment) || !isDefined(request)) {
            return false;
        }

        // Retrieve dependency name
        let name = this._getDependencyName(request);

        if(!isDefined(name) || name.startsWith('neon-extension-')) {
            return false;
        }

        // Search for dependency definition
        let extensionDependency = Extension.package.dependencies[name];

        // Find registered module matching source (if available)
        let module;
        let moduleDependency;

        if(isDefined(source)) {
            module = Registry.match(environment, source);
        }

        if(isDefined(module)) {
            moduleDependency = module.package.dependencies[name];
        }

        // Pick definition
        let dependency = moduleDependency || extensionDependency;

        // Ensure dependency definition was found
        if(!isDefined(dependency)) {
            if(isDefined(module)) {
                throw new Error('Unable to find "' + name + '" dependency for "' + module.name + '"');
            }

            throw new Error('Unable to find "' + name + '" dependency');
        }

        // Ensure dependency is pinned to a version
        if(!dependency.match(DependencyVersionRegex)) {
            if(isDefined(moduleDependency)) {
                throw new Error(
                    'Dependency "' + name + '" for "' + module.name + '" ' +
                    'should be pinned to a version (found: ' + dependency + ')'
                );
            }

            throw new Error(
                'Dependency "' + name + '" ' +
                'should be pinned to a version (found: ' + dependency + ')'
            );
        }

        // Ensure dependencies aren't duplicated
        if(isDefined(moduleDependency) && isDefined(extensionDependency)) {
            throw new Error(
                'Dependency "' + name + '" has been duplicated ' +
                '(extension: ' + extensionDependency + ', ' + module.name + ': ' + moduleDependency + ')'
            );
        }

        // Mark dependency
        if(isDefined(moduleDependency)) {
            Set(this.dependencies, [environment, module.name, name], true);
        } else {
            Set(this.dependencies, [environment, null, name], true);
        }

        // Validate module dependency
        if(isDefined(module)) {
            let modulePeerDependency = module.package.peerDependencies[name];

            // Mark peer dependency
            Set(this.peerDependencies, [environment, module.name, name], true);

            // Ensure peer dependency is defined
            if(isDefined(extensionDependency) && !isDefined(modulePeerDependency)) {
                throw new Error('"' + name + '" should be defined as a peer dependency in "' + module.name + '"');
            }

            // Ensure peer dependency is a caret range
            if(isDefined(extensionDependency) && modulePeerDependency.indexOf('^') !== 0) {
                throw new Error('"' + name + '" peer dependency in "' + module.name + '" should be a caret range');
            }

            // Ensure extension dependency matches peer dependency range
            if(isDefined(extensionDependency) && !SemanticVersion.satisfies(extensionDependency, modulePeerDependency)) {
                throw new Error(
                    '"' + name + '" peer dependency in "' + module.name + '" (' + modulePeerDependency + ')' +
                    ' is not satisfied by extension version: ' + extensionDependency
                );
            }
        }

        return true;
    }

    finish(environment) {
        // Ensure there are no unused extension dependencies
        this._checkDependencies('Dependency', Extension.package.dependencies, this.dependencies[environment][null]);

        // Ensure there are no unused module dependencies
        Registry.list(environment).forEach((module) => {
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
        if(!isDefined(prefix) || !isDefined(current)) {
            return;
        }

        matched = matched || {};

        // Ensure dependencies have been matched
        for(let name in current) {
            if(!current.hasOwnProperty(name) || name.startsWith('neon-extension-')) {
                continue;
            }

            if(!matched[name]) {
                if(isDefined(moduleName)) {
                    throw new Error(prefix + ' "' + name + '" for "' + moduleName + '" is not required');
                }

                throw new Error(prefix + ' "' + name + '" is not required');
            }
        }
    }

    _getDependencyName(request) {
        let position;

        // Convert separators
        request = request.replace(/\\/g, '/');

        // Strip path prefix
        position = request.indexOf('node_modules');

        if(position >= 0) {
            request = request.substring(position + 12 + 1);
        } else {
            return null;
        }

        // Find module end position
        position = request.indexOf('/');

        // Find next path component (for scoped packages)
        if(request.indexOf('@') === 0) {
            position = request.indexOf('/', position + 1);
        }

        // Remove module path suffix
        if(position >= 0) {
            request = request.substring(0, position);
        }

        return request;
    }
}

export default new Validator();
