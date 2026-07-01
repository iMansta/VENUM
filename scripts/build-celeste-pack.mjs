import { execSync, existsSync, mkdirSync, copyFileSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientDir = join(root, 'celeste-client');
const outDir = join(root, 'public', 'downloads');
const outZip = join(outDir, 'celeste.zip');
const outExe = join(outDir, 'celeste.exe');
const builtExe = join(clientDir, 'celeste.exe');

mkdirSync(outDir, { recursive: true });

let hasExe = false;

if (existsSync(join(clientDir, 'go.mod'))) {
  try {
    const isWin = process.platform === 'win32';
    if (isWin) {
      execSync('powershell -NoProfile -ExecutionPolicy Bypass -File build.ps1', {
        cwd: clientDir,
        stdio: 'inherit',
      });
    } else {
      execSync(
        'go build -ldflags "-s -w" -o celeste.exe .',
        { cwd: clientDir, stdio: 'inherit' }
      );
    }
    if (existsSync(builtExe)) {
      copyFileSync(builtExe, outExe);
      hasExe = true;
    }
  } catch (err) {
    console.warn('[celeste:pack] Go build indisponível — empacotando só instalador se existir exe.');
  }
}

if (!hasExe && existsSync(outExe)) {
  hasExe = true;
}

if (!hasExe) {
  console.error('[celeste:pack] celeste.exe não encontrado. Instale Go 1.22+ e rode celeste-client/build.ps1');
  process.exit(1);
}

copyFileSync(join(clientDir, 'Instalar-Celeste.bat'), join(outDir, 'Instalar-Celeste.bat'));

if (existsSync(outZip)) rmSync(outZip);

const isWin = process.platform === 'win32';
if (isWin) {
  const files = ['celeste.exe', 'Instalar-Celeste.bat']
    .map((f) => join(outDir, f).replace(/\\/g, '/'))
    .join(',');
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${files}' -DestinationPath '${outZip.replace(/\\/g, '/')}' -Force"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(
    `cd "${outDir}" && zip -j "${outZip}" celeste.exe Instalar-Celeste.bat`,
    { stdio: 'inherit' }
  );
}

console.log(`[celeste:pack] ${outZip}`);
