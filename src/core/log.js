import GulpUtil from 'gulp-util';


let moduleErrors = {};
let moduleWarnings = {};

export function logModuleError(moduleName, color, message) {
    let args;

    if(typeof color === 'string') {
        message = color;
        color = GulpUtil.colors.red;

        args = Array.from(arguments).slice(2);
    } else {
        args = Array.from(arguments).slice(3);
    }

    return logModuleMessage(moduleErrors, moduleName, color, message, args);
}

export function logModuleWarning(moduleName, color, message) {
    let args;

    if(typeof color === 'string') {
        message = color;
        color = GulpUtil.colors.yellow;

        args = Array.from(arguments).slice(2);
    } else {
        args = Array.from(arguments).slice(3);
    }

    return logModuleMessage(moduleWarnings, moduleName, color, message, args);
}

export function logModuleMessage(collection, moduleName, color, message, args) {
    if(typeof collection[moduleName] !== 'undefined' &&
        typeof collection[moduleName][message] !== 'undefined') {
        // Already logged module warning
        return;
    }

    // Log warning
    GulpUtil.log.apply(
        GulpUtil.log,
        [color(message)].concat(args)
    );

    // Mark warning as logged for module
    if(typeof collection[moduleName] === 'undefined') {
        collection[moduleName] = {};
    }

    collection[moduleName][message] = true;
}

export default {
    moduleError: logModuleError,
    moduleWarning: logModuleWarning,
    moduleMessage: logModuleMessage
};
