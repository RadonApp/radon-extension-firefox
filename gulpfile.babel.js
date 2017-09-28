import Delete from 'del';
import Filesystem from 'fs';
import Gulp from 'gulp';
import GulpUtil from 'gulp-util';
import GZip from 'gulp-zip';
import Mkdirp from 'mkdirp';
import Path from 'path';
import Rename from 'gulp-rename';
import {exec} from 'child_process';

import Assets from './src/assets';
import Constants from './src/core/constants';
import Extension from './src/core/extension';
import Manifest from './src/manifest';
import Registry from './src/core/registry';
import Webpack from './src/webpack';
import {buildDistributionName} from './src/core/helpers';


Gulp.task('build', ['build:production']);

// region build:production

Gulp.task('build:production', [
    'clean:production',

    'webextension:production',
    'hybrid:production'
]);

Gulp.task('clean:production', () => {
    return Delete([
        __dirname + '/build/production/**/*'
    ]);
});

Gulp.task('discover:production', ['clean:production'], (done) => {
    // Discover modules
    Registry.discover().then(() => {
        done();
    }, (err) => {
        done(err);
    });
});

Gulp.task('webextension:production', [
    'clean:production',
    'discover:production',
    'webextension:production:assets',
    'webextension:production:manifest',
    'webextension:production:package'
], () => {
    // Create archive of build
    return Gulp.src(Path.join(Constants.BuildDirectory.Production.Unpacked, '**/*'))
        .pipe(GZip(buildDistributionName(Extension.version)))
        .pipe(Gulp.dest(Constants.BuildDirectory.Production.Root));
});

Gulp.task('webextension:production:assets', [
    'clean:production',
    'discover:production'
], (done) => {
    Assets.build().then(
        () => done(),
        done
    );
});

Gulp.task('webextension:production:manifest', [
    'clean:production',
    'discover:production'
], (done) => {
    Manifest.build().then(
        () => done(),
        done
    );
});

Gulp.task('webextension:production:package', [
    'clean:production',
    'discover:production'
], (callback) => {
    Webpack.build().then(
        (stats) => {
            GulpUtil.log(stats.toString('normal'));
            callback();
        },
        callback
    );
});

Gulp.task('hybrid:production', [
    'clean:production',
    'hybrid:production:package',
    'hybrid:production:xpi'
]);

Gulp.task('hybrid:production:package', [
    'clean:production',
    'hybrid:production:wrapper',
    'hybrid:production:webextension'
], () => {
    // Create archive of build
    return Gulp.src(Path.join(Constants.BuildDirectory.Production.Hybrid, '**/*'))
        .pipe(GZip(buildDistributionName(Extension.version, {
            type: 'hybrid'
        })))
        .pipe(Gulp.dest(Constants.BuildDirectory.Production.Root));
});

Gulp.task('hybrid:production:manifest', [
    'clean:production',
    'discover:production'
], (done) => {
    let manifest = JSON.parse(Filesystem.readFileSync('src/hybrid/package.json'));

    // Set manifest version
    manifest.version = Extension.version;

    // Ensure destination directory exists
    Mkdirp(Constants.BuildDirectory.Production.Hybrid);

    // Build destination path
    let destinationPath = Path.join(Constants.BuildDirectory.Production.Hybrid, 'package.json');

    // Write manifest to build directory
    Filesystem.writeFile(destinationPath, JSON.stringify(manifest, null ,2), function(err) {
        if(err) {
            done(err);
            return;
        }

        done();
    });
});

Gulp.task('hybrid:production:wrapper', [
    'clean:production',
    'hybrid:production:manifest'
], () => {
    // Copy wrapper files
    return Gulp.src('src/hybrid/**/*.js')
        .pipe(Gulp.dest(Constants.BuildDirectory.Production.Hybrid));
});

Gulp.task('hybrid:production:webextension', ['webextension:production'], () => {
    // Copy production build
    return Gulp.src(Path.join(Constants.BuildDirectory.Production.Unpacked, '**/!(*.map)'))
        .pipe(Gulp.dest(Path.join(Constants.BuildDirectory.Production.Hybrid, 'webextension')));
});

Gulp.task('hybrid:production:xpi:build', ['hybrid:production:package'], (done) => {
    // Create xpi of build
    exec('jpm xpi', { cwd: Constants.BuildDirectory.Production.Hybrid }, function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        done(err);
    });
});

Gulp.task('hybrid:production:xpi', ['hybrid:production:xpi:build'], () => {
    // Copy xpi to build directory
    return Gulp.src(Path.join(Constants.BuildDirectory.Production.Hybrid, '*.xpi'))
        .pipe(Rename(buildDistributionName(Extension.version, {
            extension: 'xpi',
            type: 'hybrid'
        })))
        .pipe(Gulp.dest(Constants.BuildDirectory.Production.Root));
});

// endregion

// region build:development

Gulp.task('build:development', [
    'clean:development',

    'webextension:development',
    'hybrid:development'
]);

Gulp.task('clean:development', () => {
    return Delete([
        __dirname + '/build/development/**/*'
    ]);
});

Gulp.task('discover:development', ['clean:development'], (done) => {
    // Discover modules
    Registry.discover('development').then(() => {
        done();
    }, (err) => {
        done(err);
    });
});

Gulp.task('webextension:development', [
    'clean:development',
    'discover:development',
    'webextension:development:assets',
    'webextension:development:manifest',
    'webextension:development:package'
], () => {
    // Create archive of build
    return Gulp.src(Path.join(Constants.BuildDirectory.Development.Unpacked, '**/*'))
        .pipe(GZip(buildDistributionName(Extension.version, {
            environment: 'dev'
        })))
        .pipe(Gulp.dest(Constants.BuildDirectory.Development.Root));
});

Gulp.task('webextension:development:assets', [
    'clean:development',
    'discover:development'
], (done) => {
    Assets.build('development').then(
        () => done(),
        done
    );
});

Gulp.task('webextension:development:manifest', [
    'clean:development',
    'discover:development'
], (done) => {
    Manifest.build('development').then(
        () => done(),
        done
    );
});

Gulp.task('webextension:development:package', [
    'clean:development',
    'discover:development'
], (callback) => {
    Webpack.build('development').then(
        (stats) => {
            GulpUtil.log(stats.toString('normal'));
            callback();
        },
        callback
    );
});

Gulp.task('hybrid:development', [
    'clean:development',
    'hybrid:development:package',
    'hybrid:development:xpi'
]);

Gulp.task('hybrid:development:package', [
    'clean:development',
    'hybrid:development:wrapper',
    'hybrid:development:webextension'
], () => {
    // Create archive of build
    return Gulp.src(Path.join(Constants.BuildDirectory.Development.Hybrid, '**/*'))
        .pipe(GZip(buildDistributionName(Extension.version, {
            environment: 'dev',
            type: 'hybrid'
        })))
        .pipe(Gulp.dest(Constants.BuildDirectory.Development.Root));
});

Gulp.task('hybrid:development:manifest', [
    'clean:development',
    'discover:development'
], (done) => {
    let manifest = JSON.parse(Filesystem.readFileSync('src/hybrid/package.json'));

    // Set manifest version
    manifest.version = Extension.version;

    // Ensure destination directory exists
    Mkdirp(Constants.BuildDirectory.Development.Hybrid);

    // Build destination path
    let destinationPath = Path.join(Constants.BuildDirectory.Development.Hybrid, 'package.json');

    // Write manifest to build directory
    Filesystem.writeFile(destinationPath, JSON.stringify(manifest, null ,2), function(err) {
        if(err) {
            done(err);
            return;
        }

        done();
    });
});

Gulp.task('hybrid:development:wrapper', [
    'clean:development',
    'hybrid:development:manifest'
], () => {
    // Copy wrapper files
    return Gulp.src('src/hybrid/**/*.js')
        .pipe(Gulp.dest(Constants.BuildDirectory.Development.Hybrid));
});

Gulp.task('hybrid:development:webextension', ['webextension:development'], () => {
    // Copy development build
    return Gulp.src(Path.join(Constants.BuildDirectory.Development.Unpacked, '**/*'))
        .pipe(Gulp.dest(Path.join(Constants.BuildDirectory.Development.Hybrid, 'webextension')));
});

Gulp.task('hybrid:development:xpi:build', ['hybrid:development:package'], (done) => {
    // Create xpi of build
    exec('jpm xpi', { cwd: Constants.BuildDirectory.Development.Hybrid }, function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        done(err);
    });
});

Gulp.task('hybrid:development:xpi', ['hybrid:development:xpi:build'], () => {
    // Copy xpi to build directory
    return Gulp.src(Path.join(Constants.BuildDirectory.Development.Hybrid, '*.xpi'))
        .pipe(Rename(buildDistributionName(Extension.version, {
            environment: 'dev',
            extension: 'xpi',
            type: 'hybrid'
        })))
        .pipe(Gulp.dest(Constants.BuildDirectory.Development.Root));
});

// endregion
