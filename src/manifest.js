import CloneDeep from 'lodash-es/cloneDeep';
import Filesystem from 'fs';
import Merge from 'lodash-es/merge';
import Mkdirp from 'mkdirp';
import Path from 'path';
import Pick from 'lodash-es/pick';
import Uniq from 'lodash-es/uniq';

import Extension from './core/extension';
import Log from './core/log';
import Registry from './core/registry';
import {getOutputDirectory, isDefined} from './core/helpers';


export function build(environment) {
    environment = environment || 'production';

    // Build manifest from modules
    return buildModuleManifests(environment)
        .then((manifests) => buildManifest(manifests))
        .then((manifest) => writeManifest(environment, manifest));
}

function buildModuleManifests(environment) {
    return Promise.all(Registry.list(environment).map((module) => {
        return getModuleManifest(module);
    }));
}

function getExtensionManifest() {
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
        version: Extension.version,

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

function getModuleManifest(module) {
    return {
        icons: {},

        web_accessible_resources: [],

        // Retrieve module manifest properties
        ...Pick(module.manifest, [
            'icons',
            'web_accessible_resources'
        ]),

        // Create content scripts definitions
        content_scripts: module.manifest.content_scripts.map((contentScript) =>
            createContentScript(contentScript)
        ),

        // Merge origins + permissions
        permissions: [
            ...module.manifest.origins,
            ...module.manifest.permissions
        ],

        // Merge optional origins + permissions
        optional_permissions: [
            ...module.manifest.optional_origins,
            ...module.manifest.optional_permissions
        ]
    };
}

function buildManifest(manifests) {
    let result = CloneDeep(getExtensionManifest());

    for(let i = 0; i < manifests.length; i++) {
        let manifest = manifests[i];

        // Merge with module manifest
        result = {
            ...result,
            ...manifest,

            icons: {
                ...result.icons,
                ...manifest.icons
            },

            content_scripts: [
                ...result.content_scripts,
                ...manifest.content_scripts
            ],

            // Sort resources
            web_accessible_resources: [
                ...result.web_accessible_resources,
                ...manifest.web_accessible_resources
            ].sort(),

            // Remove duplicate permissions, and sort permissions
            permissions: Uniq([
                ...result.permissions,
                ...manifest.permissions
            ]).sort(),
        };
    }

    return result;
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

function mergeModuleManifest(manifest, module) {
    // Ensure module manifest exists
    let manifestPath = Path.join(module.path, 'manifest.json');

    if(!Filesystem.existsSync(manifestPath)) {
        Log.moduleWarning(module.name,
            'Module "%s" has no manifest', module.name
        );
        return manifest;
    }

    // Read module manifest
    let moduleManifest = Merge({
        content_scripts: [],
        web_accessible_resources: [],

        origins: [],
        permissions: []
    }, JSON.parse(Filesystem.readFileSync(manifestPath)));

    // Return manifest merged with module properties
    return {
        ...manifest,

        'content_scripts': [
            ...manifest['content_scripts'],

            ...moduleManifest['content_scripts']
                .map((contentScript) => createContentScript(contentScript))
                .filter((contentScript) => contentScript !== null)
        ],

        'permissions': [
            ...manifest['permissions'],
            ...moduleManifest['origins'],
            ...moduleManifest['permissions']
        ],

        'web_accessible_resources': [
            ...manifest['web_accessible_resources'],
            ...moduleManifest['web_accessible_resources']
        ],
    };
}

export function createContentScript(contentScript) {
    if(!isDefined(contentScript) || !isDefined(contentScript.conditions)) {
        throw new Error('Invalid content script definition');
    }

    return {
        matches: contentScript.conditions.map((condition) => {
            if(!isDefined(condition) || !isDefined(condition.pattern)) {
                throw new Error('Invalid content script condition');
            }

            return condition.pattern;
        }),

        css: contentScript.css || [],
        js: contentScript.js || []
    };
}

export default {
    build: build
};
