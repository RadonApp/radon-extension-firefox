import GulpUtil from 'gulp-util';
import IsNil from 'lodash-es/isNil';
import Path from 'path';

import Constants from '../../core/constants';


let LoggedModules = {};

export function getPackagePath(modulePath) {
    let result = Path.relative(Constants.ProjectPath, modulePath);

    // Replace "node_modules" with "~"
    result = result.replace('node_modules', '~');

    // Strip module path
    let lastModulesStart = result.indexOf('~');

    if(lastModulesStart < 0) {
        return result;
    }

    let nameEnd = result.indexOf(Path.sep, lastModulesStart + 2);

    if(nameEnd < 0) {
        return result;
    }

    return result.substring(0, nameEnd);
}

export function logModule(color, name, modulePath, count, suffix) {
    if(IsNil(modulePath)) {
        return;
    }

    let packagePath = getPackagePath(modulePath);

    if(typeof LoggedModules[name] === 'undefined') {
        LoggedModules[name] = {};
    }

    // Log included module (if not already logged)
    if(typeof LoggedModules[name][packagePath] === 'undefined') {
        LoggedModules[name][packagePath] = true;

        // Log module details
        GulpUtil.log(
            color('[%s] %s (chunks: %s)%s'),
            name, packagePath, count,
            suffix ? (' ' + suffix) : ''
        );
    }
}
