// A small emulator screenshot, to judge how something looks: 450 px wide costs ~600 tokens to
// view instead of ~2,400 for the full 1080 px. Prints the file's path; open it with Read.
//   node shot.mjs [width]
// Run from the repo root: it borrows jimp-compact from node_modules (it comes with Expo).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const Jimp = createRequire(join(process.cwd(), 'package.json'))('jimp-compact');
const width = Number(process.argv[2] ?? 450);

const png = execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 });
const image = await Jimp.read(png);
image.resize(width, Jimp.AUTO);
const file = join(tmpdir(), 'wandr-shot.png');
await image.writeAsync(file);
console.log(file);
