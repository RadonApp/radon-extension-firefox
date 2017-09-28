import del from 'del';
import fs from 'fs';
import gulp from 'gulp';
import gutil from 'gulp-util';
import gzip from 'gulp-zip';
import path from 'path';
import rename from 'gulp-rename';
import {exec} from 'child_process';

import Assets from './src/assets';
import Constants from './src/core/constants';
import Extension from './src/core/extension';
import Manifest from './src/manifest';
import Registry from './src/core/registry';
import Webpack from './src/webpack';
import {buildDistributionName} from './src/core/helpers';


gulp.task('build', ['build:production']);

// region build:production

gulp.task('build:production', [
    'clean:production',

    'webextension:production',
    'hybrid:production'
]);

gulp.task('clean:production', () => {
    return del([
        __dirname + '/build/production/**/*'
    ]);
});

gulp.task('webextension:production:discover', ['clean:production'], (done) => {
    // Discover modules
    Registry.discover().then(() => {
        done();
    }, (err) => {
        done(err);
    });
});

gulp.task('webextension:production', [
    'clean:production',
    'webextension:production:discover',
    'webextension:production:assets',
    'webextension:production:manifest',
    'webextension:production:package'
], () => {
    // Create archive of build
    return gulp.src(path.join(Constants.BuildDirectory.Production.Unpacked, '**/*'))
        .pipe(gzip(buildDistributionName(Extension.version)))
        .pipe(gulp.dest(Constants.BuildDirectory.Production.Root));
});

gulp.task('webextension:production:assets', [
    'clean:production',
    'webextension:production:discover'
], (done) => {
    Assets.build().then(
        () => done(),
        done
    );
});

gulp.task('webextension:production:manifest', [
    'clean:production',
    'webextension:production:discover'
], (done) => {
    Manifest.build().then(
        () => done(),
        done
    );
});

gulp.task('webextension:production:package', [
    'clean:production',
    'webextension:production:discover'
], (callback) => {
    Webpack.build().then(
        (stats) => {
            gutil.log(stats.toString('normal'));
            callback();
        },
        callback
    );
});

gulp.task('hybrid:production', [
    'clean:production',
    'hybrid:production:package',
    'hybrid:production:xpi'
]);

gulp.task('hybrid:production:package', [
    'clean:production',
    'hybrid:production:wrapper',
    'hybrid:production:webextension'
], () => {
    // Create archive of build
    return gulp.src(path.join(Constants.BuildDirectory.Production.Hybrid, '**/*'))
        .pipe(gzip(buildDistributionName(Extension.version, {
            type: 'hybrid'
        })))
        .pipe(gulp.dest(Constants.BuildDirectory.Production.Root));
});

gulp.task('hybrid:production:wrapper', ['clean:production'], () => {
    // Copy wrapper files
    return gulp.src('src/hybrid/**/*')
        .pipe(gulp.dest(Constants.BuildDirectory.Production.Hybrid));
});

gulp.task('hybrid:production:webextension', ['webextension:production'], () => {
    // Copy production build
    return gulp.src(path.join(Constants.BuildDirectory.Production.Unpacked, '**/!(*.map)'))
        .pipe(gulp.dest(path.join(Constants.BuildDirectory.Production.Hybrid, 'webextension')));
});

gulp.task('hybrid:production:xpi:build', ['hybrid:production:package'], (done) => {
    // Create xpi of build
    exec('jpm xpi', { cwd: Constants.BuildDirectory.Production.Hybrid }, function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        done(err);
    });
});

gulp.task('hybrid:production:xpi', ['hybrid:production:xpi:build'], () => {
    // Read extension manifest
    let manifest = JSON.parse(fs.readFileSync(path.join(
        Constants.BuildDirectory.Production.Hybrid,
        'webextension/manifest.json'
    )));

    // Copy xpi to build directory
    return gulp.src(path.join(Constants.BuildDirectory.Production.Hybrid, '*.xpi'))
        .pipe(rename(buildDistributionName(manifest.version, {
            extension: 'xpi',
            type: 'hybrid'
        })))
        .pipe(gulp.dest(Constants.BuildDirectory.Production.Root));
});

// endregion

// region build:development

gulp.task('build:development', [
    'clean:development',

    'webextension:development',
    'hybrid:development'
]);

gulp.task('clean:development', () => {
    return del([
        __dirname + '/build/development/**/*'
    ]);
});

gulp.task('webextension:development:discover', ['clean:development'], (done) => {
    // Discover modules
    Registry.discover('development').then(() => {
        done();
    }, (err) => {
        done(err);
    });
});

gulp.task('webextension:development', [
    'clean:development',
    'webextension:development:discover',
    'webextension:development:assets',
    'webextension:development:manifest',
    'webextension:development:package'
], () => {
    // Create archive of build
    return gulp.src(path.join(Constants.BuildDirectory.Development.Unpacked, '**/*'))
        .pipe(gzip(buildDistributionName(Extension.version, {
            environment: 'dev'
        })))
        .pipe(gulp.dest(Constants.BuildDirectory.Development.Root));
});

gulp.task('webextension:development:assets', [
    'clean:development',
    'webextension:development:discover'
], (done) => {
    Assets.build('development').then(
        () => done(),
        done
    );
});

gulp.task('webextension:development:manifest', [
    'clean:development',
    'webextension:development:discover'
], (done) => {
    Manifest.build('development').then(
        () => done(),
        done
    );
});

gulp.task('webextension:development:package', [
    'clean:development',
    'webextension:development:discover'
], (callback) => {
    Webpack.build('development').then(
        (stats) => {
            gutil.log(stats.toString('normal'));
            callback();
        },
        callback
    );
});

gulp.task('hybrid:development', [
    'clean:development',
    'hybrid:development:package',
    'hybrid:development:xpi'
]);

gulp.task('hybrid:development:package', [
    'clean:development',
    'hybrid:development:wrapper',
    'hybrid:development:webextension'
], () => {
    // Create archive of build
    return gulp.src(path.join(Constants.BuildDirectory.Development.Hybrid, '**/*'))
        .pipe(gzip(buildDistributionName(Extension.version, {
            environment: 'dev',
            type: 'hybrid'
        })))
        .pipe(gulp.dest(Constants.BuildDirectory.Development.Root));
});

gulp.task('hybrid:development:wrapper', ['clean:development'], () => {
    // Copy wrapper files
    return gulp.src('src/hybrid/**/*')
        .pipe(gulp.dest(Constants.BuildDirectory.Development.Hybrid));
});

gulp.task('hybrid:development:webextension', ['webextension:development'], () => {
    // Copy development build
    return gulp.src(path.join(Constants.BuildDirectory.Development.Unpacked, '**/*'))
        .pipe(gulp.dest(path.join(Constants.BuildDirectory.Development.Hybrid, 'webextension')));
});

gulp.task('hybrid:development:xpi:build', ['hybrid:development:package'], (done) => {
    // Create xpi of build
    exec('jpm xpi', { cwd: Constants.BuildDirectory.Development.Hybrid }, function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        done(err);
    });
});

gulp.task('hybrid:development:xpi', ['hybrid:development:xpi:build'], () => {
    // Copy xpi to build directory
    return gulp.src(path.join(Constants.BuildDirectory.Development.Hybrid, '*.xpi'))
        .pipe(rename(buildDistributionName(Extension.version, {
            environment: 'dev',
            extension: 'xpi',
            type: 'hybrid'
        })))
        .pipe(gulp.dest(Constants.BuildDirectory.Development.Root));
});

// endregion
