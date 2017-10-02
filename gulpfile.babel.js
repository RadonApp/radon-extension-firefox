import Gulp from 'gulp';

import HybridBuildTask from './src/tasks/hybrid/build';
import HybridManifestTask from './src/tasks/hybrid/manifest';
import HybridPackageTask from './src/tasks/hybrid/package';
import HybridWebExtensionTask from './src/tasks/hybrid/webextension';
import HybridWrapperTask from './src/tasks/hybrid/wrapper';
import HybridXpiTask from './src/tasks/hybrid/xpi';

import AssetsTask from './src/tasks/assets';
import BuildTask from './src/tasks/build';
import CleanTask from './src/tasks/clean';
import DiscoverTask from './src/tasks/discover';
import ExtensionTask from './src/tasks/extension';
import ManifestTask from './src/tasks/manifest';
import WebpackTask from './src/tasks/webpack';


const Environments = [
    'development',
    'production'
];

Gulp.task('build', ['build:production']);

// Create tasks
AssetsTask.createTasks(Environments);
BuildTask.createTasks(Environments);
CleanTask.createTasks(Environments);
DiscoverTask.createTasks(Environments);
ExtensionTask.createTasks(Environments);
ManifestTask.createTasks(Environments);
WebpackTask.createTasks(Environments);

HybridBuildTask.createTasks(Environments);
HybridManifestTask.createTasks(Environments);
HybridPackageTask.createTasks(Environments);
HybridWebExtensionTask.createTasks(Environments);
HybridWrapperTask.createTasks(Environments);
HybridXpiTask.createTasks(Environments);
