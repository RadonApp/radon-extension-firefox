import Filesystem from 'fs';
import Glob from 'glob';
import GulpUtil from 'gulp-util';
import Mkdirp from 'mkdirp';
import PadEnd from 'lodash-es/padEnd';
import Path from 'path';

import Registry from './core/registry';
import {getOutputDirectory} from './core/helpers';


const Pattern = '**/*.{html,png,svg}';

export function build(environment) {
    environment = environment || 'production';

    // Build output directory path
    let outputPath = getOutputDirectory(environment, 'unpacked');

    // Ensure output directory exists
    Mkdirp.sync(outputPath);

    // Copy module assets to output directory
    return Promise.all(Registry.list(environment).map((module) => {
        return copyModuleAssets(module, outputPath);
    }));
}

function copyModuleAssets(module, outputPath) {
    let sourcePath = Path.join(module.path, 'assets');

    // Ensure source path exists
    if(!Filesystem.existsSync(sourcePath)) {
        return false;
    }

    // Update module output directory
    if(['destination', 'source'].indexOf(module.type) >= 0) {
        outputPath = Path.join(
            outputPath,
            module.name.replace('neon-extension-', '').replace('-', Path.sep)
        );
    }

    // Copy module assets to build directory
    return copy(sourcePath, outputPath).then((files) => {
        GulpUtil.log(
            GulpUtil.colors.green('[%s] Copied %d asset(s)'),
            PadEnd(module.name, 35), files.length
        );
    }, (err) => {
        GulpUtil.log(
            GulpUtil.colors.red('[%s] Unable to copy assets: %s'),
            PadEnd(module.name, 35), err.message
        );
        return Promise.reject(err);
    });
}

function copy(basePath, outputPath) {
    return new Promise((resolve) => {
        Glob(basePath + '/' + Pattern, (err, files) => {
            // Copy matched files to output directory
            let promises = files.map((filePath) =>
                copyFile(filePath,  Path.join(outputPath, Path.relative(basePath, filePath)))
            );

            // Wait until all files have been copied
            resolve(Promise.all(promises));
        });
    });
}

function copyFile(sourcePath, outputPath) {
    return new Promise((resolve, reject) => {
        // Ensure output directory exists
        Mkdirp.sync(Path.dirname(outputPath));

        // Copy file to output path
        Filesystem.createReadStream(sourcePath).pipe(
            Filesystem.createWriteStream(outputPath)
                .on('error', (err) => reject(err))
                .on('finish', () => resolve(outputPath))
        );
    });
}

export default {
    build: build
};
