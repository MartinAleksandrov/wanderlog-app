// `pnpm doctor:expo`: Expo Doctor, with dependency versions checked against the installed Expo
// SDK instead of the newest patch releases online. Expo publishes patches often, and the online
// check failed CI for each one even when nothing in the project had changed.
const { spawnSync } = require('child_process');

// Runs a command with extra environment variables, and stops here if it fails
function run(command, env) {
  const { status } = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
  if (status !== 0) process.exit(status ?? 1);
}

// 1. Every Expo Doctor check except its online version check: app config, duplicate native
//    modules, overridden dependencies (like the old @expo/metro-runtime mismatch), and more.
run('pnpm dlx expo-doctor@latest', { EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK: '1' });

// 2. Versions must match the list inside the installed `expo` package
//    (node_modules/expo/bundledNativeModules.json). A package from another SDK or a wrong
//    major/minor version still fails; a patch Expo published later does not.
run('pnpm exec expo install --check', { EXPO_OFFLINE: '1' });
