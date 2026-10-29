import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public', 'icon.svg');
const foregroundSource = path.join(root, 'assets', 'icon-foreground.svg');

async function render(input, output, size) {
  await sharp(input).resize(size, size).png().toFile(output);
}

await render(source, path.join(root, 'public', 'icon-512.png'), 512);
await render(source, path.join(root, 'public', 'icon-192.png'), 192);

const densities = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
];

for (const [density, launcherSize, foregroundSize] of densities) {
  const directory = path.join(root, 'android', 'app', 'src', 'main', 'res', `mipmap-${density}`);
  try {
    await access(directory);
  } catch {
    continue;
  }
  await mkdir(directory, { recursive: true });
  await render(source, path.join(directory, 'ic_launcher.png'), launcherSize);
  await render(source, path.join(directory, 'ic_launcher_round.png'), launcherSize);
  await render(foregroundSource, path.join(directory, 'ic_launcher_foreground.png'), foregroundSize);
}

console.log('Generated PWA and Android launcher icons.');
