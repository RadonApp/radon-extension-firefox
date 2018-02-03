import Gulp from 'gulp';

import AssetsTask from './src/tasks/assets';
import BintrayTask from './src/tasks/bintray';
import BuildTask from './src/tasks/build';
import CleanTask from './src/tasks/clean';
import ContributorsTask from './src/tasks/contributors';
import CreditsTask from './src/tasks/credits';
import LibrariesTask from './src/tasks/libraries';
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
BintrayTask.createTasks(Environments);
BuildTask.createTasks(Environments);
CleanTask.createTasks(Environments);

ContributorsTask.createTasks(Environments);
CreditsTask.createTasks(Environments);
LibrariesTask.createTasks(Environments);

DiscoverTask.createTasks(Environments);
ExtensionTask.createTasks(Environments);
ManifestTask.createTasks(Environments);
WebpackTask.createTasks(Environments);
