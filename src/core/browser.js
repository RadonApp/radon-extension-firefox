import IsNil from 'lodash-es/isNil';
import Pick from 'lodash-es/pick';

import Extension from './extension';
import Registry from './registry';


export class Browser {
    getModule(environment) {
        return {
            manifest: {
                browser: {
                    api: {}
                }
            },

            package: {},

            // Retrieve module from registry
            ...(Registry.get(environment, this._getModuleName()) || {})
        };
    }

    supportsApi(environment, ...keys) {
        let module = this.getModule(environment);

        for(let i = 0; i < keys.length; i++) {
            if(module.manifest.browser.api[keys[i]] !== true) {
                return false;
            }
        }

        return true;
    }

    toPlainObject(environment) {
        return {
            ...Pick(this.getModule(environment).browser, [
                'api'
            ])
        };
    }

    _getModuleName() {
        if(IsNil(Extension.package.name)) {
            throw new Error('No "name" found in package.json');
        }

        // Retrieve key from package name
        let key = Extension.package.name.replace('neon-extension-', '');

        // Build module name
        return 'neon-extension-browser-' + key;
    }
}

export default new Browser();
