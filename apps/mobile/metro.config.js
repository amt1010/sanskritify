const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Metro's default resolver only looks inside the app's own node_modules.
// This is a monorepo: workspace packages (@sanskritify/sanskrit etc.) live
// in ../../packages/*/node_modules is where pnpm's symlinks point, and the
// root node_modules holds pnpm's shared store. Both need to be watched and
// searched, or Metro cannot find them.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
