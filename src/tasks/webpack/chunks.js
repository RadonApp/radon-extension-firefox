import Filesystem from 'fs';
import GulpUtil from 'gulp-util';
import Merge from 'lodash-es/merge';
import Path from 'path';

import Constants from '../../core/constants';
import Registry from '../../core/registry';


export function createChunks(environment) {
    let modules = Registry.list(environment);

    // Retrieve destinations
    let destinations = Registry.list(environment, {
        type: 'destination'
    });

    // Retrieve sources
    let sources = Registry.list(environment, {
        type: 'source'
    });

    // Create modules
    return {
        'background/callback/callback': [
            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration'),
            'neon-extension-core/modules/background/callback'
        ],
        'background/main/main': [
            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration'),
            'neon-extension-core/modules/background/main'
        ],
        'background/migrate/migrate': [
            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration'),
            ...getServices(modules, 'migrate'),
            'neon-extension-core/modules/background/migrate'
        ],

        //
        // Messaging
        //

        'background/messaging/messaging': [
            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration'),
            'neon-extension-core/modules/background/messaging'
        ],
        'background/messaging/services/scrobble': [
            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration'),
            ...getServices(destinations, 'destination/scrobble'),
            'neon-extension-core/modules/background/messaging/services/scrobble'
        ],
        'background/messaging/services/storage': [
            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration'),
            'neon-extension-core/modules/background/messaging/services/storage'
        ],

        //
        // Configuration
        //

        'configuration/configuration': [
            // Ensure CSS Dependencies are bundled first
            'neon-extension-core/modules/configuration/dependencies.scss',

            ...Constants.CommonRequirements,
            ...getServices(modules, 'configuration', { includeComponents: true }),
            'neon-extension-core/modules/configuration'
        ],

        //
        // Destinations
        //

        ...Object.assign({}, ...destinations.map((module) => {
            return createModuleChunks(module) || {};
        })),

        //
        // Sources
        //

        ...Object.assign({}, ...sources.map((module) => {
            return {
                ...createModule(environment, module),
                ...createModuleChunks(module)
            };
        }))
    };
}

function createModule(environment, module) {
    // Parse module name
    let moduleName = module.name.replace('neon-extension-', '');
    let splitAt = moduleName.indexOf('-');

    if(splitAt < 0) {
        GulpUtil.log(GulpUtil.colors.red(
            'Invalid value provided for the "module.name" parameter: %O'
        ), module.name);
        return null;
    }

    let type = moduleName.substring(0, splitAt);
    let plugin = moduleName.substring(splitAt + 1);

    // Build module entry
    let result = {};

    result[type + '/' + plugin + '/' + plugin] = [
        ...Constants.CommonRequirements,
        ...getServices([Registry.get(environment, 'neon-extension-core')], 'configuration'),
        ...getModuleServices(environment, module)
    ];

    return result;
}

function createModuleChunks(module) {
    // Validate `module` object
    if(typeof module === 'undefined' || module === null) {
        GulpUtil.log(GulpUtil.colors.red(
            'Invalid value provided for the "module" parameter: %O'
        ), module);
        return null;
    }

    if(typeof module.name === 'undefined' || module.name === null) {
        GulpUtil.log(GulpUtil.colors.red(
            'Invalid value provided for the "module" parameter: %O'
        ), module);
        return null;
    }

    // Parse module name
    let moduleName = module.name.replace('neon-extension-', '');
    let splitAt = moduleName.indexOf('-');

    if(splitAt < 0) {
        GulpUtil.log(GulpUtil.colors.red(
            'Invalid value provided for the "module.name" parameter: %O'
        ), module.name);
        return null;
    }

    let type = moduleName.substring(0, splitAt);
    let plugin = moduleName.substring(splitAt + 1);

    // Create module chunks
    let result = {};

    (module.webpack.chunks || []).forEach((name) => {
        result[type + '/' + plugin + '/' + name + '/' + name] = [
            ...Constants.CommonRequirements,
            module.name + '/' + name
        ];
    });

    (module.webpack.modules || []).forEach((name) => {
        result[type + '/' + plugin + '/' + name + '/' + name] = [
            ...Constants.CommonRequirements,
            module.name + '/' + name
        ];
    });

    return result;
}

function getModuleServices(environment, module) {
    if(typeof module === 'undefined' || module === null) {
        return [];
    }

    if(typeof module.services === 'undefined' || module.services === null) {
        return [];
    }

    // Retrieve core module
    let coreModule = Registry.get(environment, 'neon-extension-core');

    // Find module services
    let items = [];

    for(let i = 0; i < module.services.length; i++) {
        let type = module.services[i];

        // Ignore migrate service
        if(type === 'migrate') {
            continue;
        }

        // Build service name
        let name = type.substring(type.indexOf('/') + 1);

        // Build service module path
        let servicePath = Path.resolve(module.path, 'src/services/' + name + '/index.js');

        // Ensure service module exists
        if(!Filesystem.existsSync(servicePath)) {
            GulpUtil.log(GulpUtil.colors.red(
                'Ignoring service "%s" for module "%s", no file exists at: "%s"'
            ), name, module.name, servicePath);
            continue;
        }

        // Only include the plugin configuration service
        if(type === 'configuration') {
            items.push(servicePath);
            continue;
        }

        // Build main module path
        let mainPath = Path.resolve(coreModule.path, 'src/modules/' + type + '/index.js');

        // Ensure main module exists
        if(!Filesystem.existsSync(mainPath)) {
            GulpUtil.log(GulpUtil.colors.red(
                'Ignoring service "%s" for module "%s", unable to find main module at: "%s"'
            ), name, module.name, mainPath);
            continue;
        }

        // Found service
        items.push(servicePath);
        items.push(mainPath);
    }

    return items.sort();
}

function getServices(modules, type, options) {
    options = Merge({
        includeComponents: false
    }, options);

    // Build service name
    let name = type.substring(type.indexOf('/') + 1);

    // Find matching services
    let items = [];

    for(let i = 0; i < modules.length; i++) {
        let module = modules[i];

        // Ensure module has services
        if(typeof module.services === 'undefined') {
            continue;
        }

        // Ensure module has the specified service
        if(module.services.indexOf(type) === -1) {
            continue;
        }

        let servicePath = Path.resolve(module.path, 'src/services/' + name);
        let serviceIndexPath = Path.resolve(servicePath, 'index.js');

        // Ensure service exists
        if(!Filesystem.existsSync(serviceIndexPath)) {
            GulpUtil.log(
                GulpUtil.colors.red('Ignoring service "%s" for module "%s", no file exists at: "%s"'),
                name, module.name, serviceIndexPath
            );
            continue;
        }

        // Include service
        items.push(serviceIndexPath);

        // Include react components (if enabled)
        if(options.includeComponents) {
            let componentsPath = Path.resolve(servicePath, 'components/index.js');

            // Ensure service components exist
            if(Filesystem.existsSync(componentsPath)) {
                items.push(componentsPath);
            }
        }
    }

    return items.sort();
}

export default {
    createChunks
};
