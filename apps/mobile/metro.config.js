const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the monorepo root so Metro sees packages/domain changes
config.watchFolders = [workspaceRoot];

// 2. Resolve @if-fleet/domain to the compiled dist (Metro doesn't handle
//    TypeScript enum re-exports from raw .ts source files either)
config.resolver.extraNodeModules = {
  '@if-fleet/domain': path.resolve(workspaceRoot, 'packages/domain/dist'),
};

// 3. Make sure node_modules from workspace root are found
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
