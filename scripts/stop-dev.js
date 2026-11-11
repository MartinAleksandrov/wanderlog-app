// `pnpm stop`: shuts down the Android emulator and Metro together.
// Safe to run when either is already stopped; it prints what it found.
const { execSync } = require('child_process');

const METRO_PORT = 8081;

// Output of a command, or '' if it fails (e.g. adb isn't running yet)
function run(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

// Emulators are listed by `adb devices` as emulator-<port>. `emu kill` asks each one to shut
// down cleanly. The AVD is set to cold boot, so no Quick Boot state is saved for next time.
const emulators = run('adb devices')
  .split('\n')
  .map((line) => line.split('\t')[0].trim())
  .filter((serial) => serial.startsWith('emulator-'));

for (const serial of emulators) {
  run(`adb -s ${serial} emu kill`);
  console.log(`Stopped emulator ${serial}`);
}
if (emulators.length === 0) console.log('No emulator running');

// Metro runs inside the `expo start` / `expo run:android` process, so ending the process that
// listens on Metro's port stops it. The pnpm command that started it then exits on its own.
const listeners =
  process.platform === 'win32'
    ? run(
        `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${METRO_PORT} -State Listen -ErrorAction SilentlyContinue).OwningProcess"`,
      )
    : run(`lsof -ti tcp:${METRO_PORT} -sTCP:LISTEN`);
// The same process can listen on IPv4 and IPv6, so de-duplicate
const metroPids = [...new Set(listeners.split(/\s+/).filter(Boolean))].map(Number);

for (const pid of metroPids) {
  try {
    process.kill(pid);
    console.log(`Stopped Metro (PID ${pid})`);
  } catch {
    console.log(`Could not stop Metro (PID ${pid})`);
  }
}
if (metroPids.length === 0) console.log(`Metro not running (nothing on port ${METRO_PORT})`);
