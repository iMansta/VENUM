import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const celesteDir = join(root, 'celeste');
const outDir = join(root, 'public', 'downloads');
const outZip = join(outDir, 'celeste.zip');

if (!existsSync(celesteDir)) {
  console.error('[celeste:pack] Pasta celeste/ não encontrada.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
if (existsSync(outZip)) rmSync(outZip);

const isWin = process.platform === 'win32';

if (isWin) {
  const src = join(celesteDir, '*').replace(/\\/g, '/');
  const dest = outZip.replace(/\\/g, '/');
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${src}' -DestinationPath '${dest}' -Force"`,
    { stdio: 'inherit', cwd: root }
  );
} else {
  execSync(`cd "${celesteDir}" && zip -r "${outZip}" . -x "node_modules/*"`, {
    stdio: 'inherit',
  });
}

console.log(`[celeste:pack] Gerado: ${outZip}`);
