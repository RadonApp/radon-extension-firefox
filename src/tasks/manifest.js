import CloneDeep from 'lodash-es/cloneDeep';
import Filesystem from 'fs';
import ForEach from 'lodash-es/forEach';
import Gulp from 'gulp';
import Mkdirp from 'mkdirp';
import Path from 'path';
import Pick from 'lodash-es/pick';
import Reduce from 'lodash-es/reduce';
import Remove from 'lodash-es/remove';
import Uniq from 'lodash-es/uniq';

import Browser from '../core/browser';
import Extension from '../core/extension';
import Registry from '../core/registry';
import {getOutputDirectory, getTaskName, isDefined} from '../core/helpers';


export function build(environment) {
    environment = environment || 'production';

    // Build manifest from modules
    return buildModuleManifests(environment)
        .then((manifests) => buildManifest(environment, manifests))
        .then((manifest) => writeManifest(environment, manifest));
}

export function createTask(environment) {
    Gulp.task(getTaskName(environment, 'manifest'), [
        getTaskName(environment, 'clean'),
        getTaskName(environment, 'discover'),
        getTaskName(environment, 'webpack')
    ], (done) => {
        build(environment).then(
            () => done(),
            done
        );
    });
}

export function createTasks(environments) {
    environments.forEach((environment) =>
        createTask(environment)
    );
}

function buildModuleManifests(environment) {
    return Promise.all(Registry.list(environment).map((module) => {
        return buildModuleManifest(environment, module);
    }));
}

function getExtensionManifest(environment) {
    let permissions = [
        ...Extension.manifest.origins,
        ...Extension.manifest.permissions
    ];

    let optional_permissions = [
        ...Extension.manifest.optional_origins,
        ...Extension.manifest.optional_permissions
    ];

    return {
        manifest_version: 2,

        name: null,
        version: Extension.getVersion(environment),

        description: null,
        icons: {},

        applications: {},
        permissions: permissions,
        optional_permissions: optional_permissions,

        background: {},
        content_scripts: [],
        options_ui: {},
        web_accessible_resources: [],

        // Retrieve extension properties
        ...Pick(Extension.manifest, [
            'name',

            'description',
            'icons',

            'applications',

            'background',
            'options_ui',
            'web_accessible_resources'
        ])
    };
}

function buildManifest(environment, manifests) {
    let current = CloneDeep(getExtensionManifest(environment));
    let outputPath = getOutputDirectory(environment, 'unpacked');

    // Merge module manifests
    for(let i = 0; i < manifests.length; i++) {
        let manifest = manifests[i];

        current = {
            ...current,
            ...manifest,

            icons: {
                ...current.icons,
                ...manifest.icons
            },

            content_scripts: [
                ...current.content_scripts,
                ...manifest.content_scripts
            ],

            web_accessible_resources: [
                ...current.web_accessible_resources,
                ...manifest.web_accessible_resources
            ],

            permissions: [
                ...current.permissions,
                ...manifest.permissions
            ],

            optional_permissions: [
                ...current.optional_permissions,
                ...manifest.optional_permissions
            ],
        };
    }

    // Remove background scripts that don't exist
    if(isDefined(current.background.scripts)) {
        Remove(current.background.scripts, (path) => !Filesystem.existsSync(Path.join(outputPath, path)));
    }

    // Sort arrays
    current.permissions = Uniq(current.permissions).sort();
    current.optional_permissions = Uniq(current.optional_permissions).sort();

    current.web_accessible_resources = current.web_accessible_resources.sort();

    return current;
}

function buildModuleManifest(environment, module) {
    let manifest = {
        icons: {},

        content_scripts: [],
        web_accessible_resources: [],

        // Retrieve module manifest properties
        ...Pick(module.manifest, [
            'icons',
            'web_accessible_resources'
        ]),

        // Build module permissions
        ...buildModulePermissions(environment, module)
    };

    // Content Scripts (if the browser doesn't support declarative content)
    if(!Browser.supportsApi(environment, 'declarativeContent', 'permissions')) {
        manifest.content_scripts = module.manifest.content_scripts.map((contentScript) =>
            createContentScript(contentScript)
        );
    }

    return manifest;
}

function buildModulePermissions(environment, module) {
    let permissions = [
        ...module.manifest.origins,
        ...module.manifest.permissions
    ];

    let optional_permissions = [
        ...module.manifest.optional_origins,
        ...module.manifest.optional_permissions
    ];

    // Declarative Content
    if(Browser.supportsApi(environment, 'declarativeContent', 'permissions')) {
        optional_permissions = optional_permissions.concat(getContentScriptPatterns(module));
    }

    // Destination / Source
    if(['destination', 'source'].indexOf(module.type) >= 0) {
        if(Browser.supportsApi(environment, 'permissions')) {
            // Request permissions when the module is enabled
            return {
                permissions: [],
                optional_permissions: optional_permissions.concat(permissions)
            };
        } else {
            // Request permissions on extension installation
            return {
                permissions: permissions.concat(optional_permissions),
                optional_permissions: []
            };
        }
    }

    // Unknown Module
    return {
        permissions,
        optional_permissions
    };
}

function writeManifest(environment, manifest) {
    let outputPath = getOutputDirectory(environment, 'unpacked');
    let destinationPath = Path.join(outputPath, 'manifest.json');

    // Ensure output directory exists
    Mkdirp.sync(outputPath);

    // Encode manifest
    let data;

    try {
        data = JSON.stringify(manifest, null, 2);
    } catch(e) {
        return Promise.reject(e);
    }

    // Write manifest to output directory
    return new Promise((resolve, reject) => {
        Filesystem.writeFile(destinationPath, data, (err) => {
            if(err) {
                reject(err);
                return;
            }

            resolve(destinationPath);
        });
    });
}

export function createContentScript(contentScript) {
    if(!isDefined(contentScript) || !isDefined(contentScript.conditions)) {
        throw new Error('Invalid content script definition');
    }

    return {
        css: [],
        js: [],

        matches: contentScript.conditions.map((condition) => {
            if(!isDefined(condition) || !isDefined(condition.pattern)) {
                throw new Error('Invalid content script condition');
            }

            return condition.pattern;
        }),

        ...Pick(contentScript, [
            'css',
            'js'
        ])
    };
}

export function getContentScriptPatterns(module) {
    return Reduce(module.manifest.content_scripts, (result, contentScript) => {
        ForEach(contentScript.conditions, (condition) => {
            if(!isDefined(condition) || !isDefined(condition.pattern)) {
                throw new Error('Invalid content script condition');
            }

            // Include pattern in result
            result.push(condition.pattern);
        });

        return result;
    }, []);
}

export default {
    build,

    createTask,
    createTasks
};
