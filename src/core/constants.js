import Path from 'path';


export const PackagePath = Path.resolve(__dirname, '../../');
export const ProjectPath = Path.join(PackagePath, '../../');

export const BuildDirectory = {
    Root: Path.join(PackagePath, 'build'),

    Development: {
        Root:       Path.join(PackagePath, 'build', 'development'),
        Unpacked:   Path.join(PackagePath, 'build', 'development', 'unpacked'),
        Hybrid:     Path.join(PackagePath, 'build', 'development', 'hybrid')
    },

    Production: {
        Root:       Path.join(PackagePath, 'build', 'production'),
        Unpacked:   Path.join(PackagePath, 'build', 'production', 'unpacked'),
        Hybrid:     Path.join(PackagePath, 'build', 'production', 'hybrid')
    }
};

export const CommonRequirements = [
    'whatwg-fetch'
];

export default {
    PackagePath,
    ProjectPath,
    BuildDirectory,

    CommonRequirements
};
