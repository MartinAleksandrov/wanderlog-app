// The emulator screen as text, for checking what it says without a screenshot (~10x fewer tokens).
//   node ui.mjs                 every text and label on screen, with its centre "x,y"
//   node ui.mjs grep <regex>    only the lines matching (case-insensitive)
//   node ui.mjs tap <text>      tap the first element whose text or label is <text> (exact,
//                               else contains), then print the screen after 1.5 s
import { execFileSync } from 'node:child_process';

const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 32 << 20 });
const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, '&');

function screen() {
  // The dump fails now and then while something animates: one retry
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
      const xml = adb('exec-out', 'cat', '/sdcard/ui.xml');
      const nodes = [];
      for (const m of xml.matchAll(/<node [^>]*>/g)) {
        const attr = (name) => m[0].match(new RegExp(` ${name}="([^"]*)"`))?.[1] ?? '';
        const label = decode(attr('text') || attr('content-desc'));
        const b = attr('bounds').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
        if (label && b) nodes.push({ label, x: (+b[1] + +b[3]) >> 1, y: (+b[2] + +b[4]) >> 1 });
      }
      return nodes;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  return [];
}

const print = (nodes) => {
  // Neighbouring duplicates (a button and its own label) once
  const lines = nodes.map((n) => `${n.label.replace(/\s+/g, ' ').slice(0, 90)}  @${n.x},${n.y}`);
  console.log(
    lines.filter((line, i) => line.split('  @')[0] !== lines[i - 1]?.split('  @')[0]).join('\n'),
  );
};

const [command, ...rest] = process.argv.slice(2);
const arg = rest.join(' ');
if (command === 'tap') {
  const nodes = screen();
  const target =
    nodes.find((n) => n.label === arg) ??
    nodes.find((n) => n.label.toLowerCase().includes(arg.toLowerCase()));
  if (!target) {
    console.error(`No "${arg}" on screen. On screen:`);
    print(nodes);
    process.exit(1);
  }
  adb('shell', 'input', 'tap', String(target.x), String(target.y));
  console.log(`tapped "${target.label}" @${target.x},${target.y}`);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  print(screen());
} else if (command === 'grep') {
  const re = new RegExp(arg, 'i');
  print(screen().filter((n) => re.test(n.label)));
} else {
  print(screen());
}
