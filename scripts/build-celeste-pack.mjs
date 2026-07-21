import { existsSync, mkdirSync, copyFileSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientDir = join(root, 'celeste-client');
const outDir = join(root, 'public', 'downloads');
const outZip = join(outDir, 'anaconda.zip');
const outExe = join(outDir, 'anaconda.exe');
const outAdminZip = join(outDir, 'anaconda-admin.zip');
const outAdminExe = join(outDir, 'anaconda-admin.exe');
const outSetupExe = join(outDir, 'Anaconda-Setup.exe');
const outAdminSetupExe = join(outDir, 'Anaconda-Admin-Setup.exe');
const sourceIcon = join(root, 'public', 'assets', 'anaconda-icon.png');
const outIcon = join(outDir, 'anaconda-icon.png');
const sourceIco = join(root, 'celeste-client', 'installer', 'assets', 'anaconda.ico');
const outIco = join(outDir, 'anaconda-icon.ico');
const builtExe = existsSync(join(clientDir, 'anaconda.exe'))
  ? join(clientDir, 'anaconda.exe')
  : join(clientDir, 'celeste.exe');
const builtAdminExe = join(clientDir, 'anaconda-admin.exe');
const installBat = existsSync(join(clientDir, 'Instalar-Anaconda.bat'))
  ? join(clientDir, 'Instalar-Anaconda.bat')
  : join(clientDir, 'Instalar-Celeste.bat');
const debugBat = join(clientDir, 'Anaconda-Debug.bat');

const isCI = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.CI === 'true' ||
  process.env.GITHUB_ACTIONS === 'true'
);

/** ZIP mínimo (store) — funciona em Linux/Vercel sem zip/powershell. */
function createZip(files, targetPath = outZip) {
  const parts = [];
  let offset = 0;
  const central = [];

  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    parts.push(local, data);

    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    nameBuf.copy(cd, 46);
    central.push(cd);

    offset += local.length + data.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  writeFileSync(targetPath, Buffer.concat([...parts, centralBuf, end]));
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (~c) >>> 0;
}

mkdirSync(outDir, { recursive: true });

let hasExe = existsSync(outExe);
let hasAdminExe = existsSync(outAdminExe);

if ((!hasExe || !hasAdminExe) && existsSync(join(clientDir, 'go.mod')) && !isCI) {
  try {
    execSync('go version', { stdio: 'pipe' });
    if (process.platform === 'win32') {
      execSync('powershell -NoProfile -ExecutionPolicy Bypass -File build.ps1', {
        cwd: clientDir,
        stdio: 'inherit',
      });
    } else {
      execSync('go build -ldflags "-s -w" -o anaconda.exe .', {
        cwd: clientDir,
        stdio: 'inherit',
      });
      execSync('go build -ldflags "-s -w" -o anaconda-admin.exe ./cmd/anaconda-admin', {
        cwd: clientDir,
        stdio: 'inherit',
      });
    }
    if (existsSync(builtExe)) {
      copyFileSync(builtExe, outExe);
      hasExe = true;
    }
    if (existsSync(builtAdminExe)) {
      copyFileSync(builtAdminExe, outAdminExe);
      hasAdminExe = true;
    }
  } catch {
    console.warn('[celeste:pack] Go build indisponível — usando artefatos existentes.');
  }
}

if (existsSync(builtExe)) {
  if (builtExe !== outExe) {
    try {
      copyFileSync(builtExe, outExe);
    } catch (err) {
      console.warn(`[celeste:pack] não foi possível copiar ${builtExe}: ${err.message}`);
    }
  }
  hasExe = existsSync(outExe);
}
if (existsSync(builtAdminExe)) {
  if (builtAdminExe !== outAdminExe) {
    try {
      copyFileSync(builtAdminExe, outAdminExe);
    } catch (err) {
      console.warn(`[celeste:pack] não foi possível copiar ${builtAdminExe}: ${err.message}`);
    }
  }
  hasAdminExe = existsSync(outAdminExe);
}

if (!hasExe && existsSync(outExe)) {
  hasExe = true;
}

if (!hasExe && existsSync(builtExe)) {
  copyFileSync(builtExe, outExe);
  hasExe = true;
}

if (!hasExe && existsSync(join(outDir, 'celeste.exe'))) {
  copyFileSync(join(outDir, 'celeste.exe'), outExe);
  hasExe = true;
}

if (!hasAdminExe && existsSync(builtAdminExe)) {
  copyFileSync(builtAdminExe, outAdminExe);
  hasAdminExe = true;
}

if (!hasExe) {
  console.warn(
    '[celeste:pack] celeste.exe ausente — build do app continua. ' +
      'Gere localmente: celeste-client/build.ps1 && npm run celeste:pack'
  );
  process.exit(0);
}

if (existsSync(installBat)) {
  copyFileSync(installBat, join(outDir, 'Instalar-Anaconda.bat'));
  copyFileSync(installBat, join(outDir, 'Instalar-Celeste.bat'));
}
if (existsSync(debugBat)) {
  copyFileSync(debugBat, join(outDir, 'Anaconda-Debug.bat'));
}

if (existsSync(sourceIcon)) {
  copyFileSync(sourceIcon, outIcon);
}
if (existsSync(sourceIco)) {
  copyFileSync(sourceIco, outIco);
}

const zipEntries = [{ name: 'anaconda.exe', data: readFileSync(outExe) }];
if (existsSync(outIcon)) {
  zipEntries.push({
    name: 'anaconda-icon.png',
    data: readFileSync(outIcon),
  });
}
if (existsSync(outIco)) {
  zipEntries.push({
    name: 'anaconda-icon.ico',
    data: readFileSync(outIco),
  });
}
if (existsSync(outSetupExe)) {
  zipEntries.push({
    name: 'Anaconda-Setup.exe',
    data: readFileSync(outSetupExe),
  });
}
if (existsSync(join(outDir, 'Instalar-Anaconda.bat'))) {
  zipEntries.push({
    name: 'Instalar-Anaconda.bat',
    data: readFileSync(join(outDir, 'Instalar-Anaconda.bat')),
  });
}
if (existsSync(join(outDir, 'Anaconda-Debug.bat'))) {
  zipEntries.push({
    name: 'Anaconda-Debug.bat',
    data: readFileSync(join(outDir, 'Anaconda-Debug.bat')),
  });
}

if (existsSync(outZip)) rmSync(outZip);
createZip(zipEntries);

if (hasAdminExe) {
  const adminZipEntries = [{ name: 'anaconda-admin.exe', data: readFileSync(outAdminExe) }];
  if (existsSync(outIcon)) {
    adminZipEntries.push({ name: 'anaconda-icon.png', data: readFileSync(outIcon) });
  }
  if (existsSync(outIco)) {
    adminZipEntries.push({ name: 'anaconda-icon.ico', data: readFileSync(outIco) });
  }
  if (existsSync(outAdminSetupExe)) {
    adminZipEntries.push({
      name: 'Anaconda-Admin-Setup.exe',
      data: readFileSync(outAdminSetupExe),
    });
  }
  if (existsSync(outAdminZip)) rmSync(outAdminZip);
  createZip(adminZipEntries, outAdminZip);
  console.log(`[celeste:pack] ${outAdminZip} (${adminZipEntries.length} arquivos)`);
} else {
  console.warn('[celeste:pack] anaconda-admin.exe ausente — download admin ficará indisponível até build local.');
}

// Compatibilidade de links antigos
copyFileSync(outExe, join(outDir, 'celeste.exe'));
copyFileSync(outZip, join(outDir, 'celeste.zip'));

console.log(`[celeste:pack] ${outZip} (${zipEntries.length} arquivos)`);
