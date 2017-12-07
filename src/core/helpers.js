import IsNil from 'lodash-es/isNil';
import Path from 'path';

import Constants from './constants';


export function buildDistributionName(version, options) {
    options = options || {};

    if(IsNil(version)) {
        throw new Error('Missing required parameter: version');
    }

    // Build distribution name
    let tags = ['Neon'];

    if(!IsNil(options.type)) {
        tags.push(options.type);
    }

    tags.push(version);

    return tags.join('-') + '.' + (options.extension || 'zip');
}

export function getOutputDirectory(environment, ...args) {
    let basePath;

    // Retrieve build directory
    if(environment === 'production') {
        basePath = Constants.BuildDirectory.Production.Root;
    } else if(environment === 'development') {
        basePath = Constants.BuildDirectory.Development.Root;
    } else {
        throw new Error('Unknown environment: ' + environment);
    }

    // Join path with arguments
    return Path.join.apply(null, [basePath].concat(args));
}

export function getTaskName(environment, ...args) {
    return args.join(':') + ':' + environment;
}
