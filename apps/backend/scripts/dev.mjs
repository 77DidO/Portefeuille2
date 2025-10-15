import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const repoRoot = resolve(projectRoot, '..', '..');
const tscPath = resolve(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const distEntry = resolve(projectRoot, 'dist', 'server.js');

const childProcesses = new Set();
let shuttingDown = false;
let serverStarted = false;

const registerChild = (child) => {
  childProcesses.add(child);
  child.on('exit', () => childProcesses.delete(child));
  return child;
};

const startServer = () => {
  if (!existsSync(distEntry)) {
    console.log('[dev] Compilation TypeScript en attente avant de démarrer le serveur.');
    return;
  }
  if (serverStarted) {
    return;
  }

  console.log('[dev] Démarrage du serveur Node en mode watch...');
  const server = registerChild(
    spawn(process.execPath, ['--watch', '--enable-source-maps', distEntry], {
      cwd: projectRoot,
      stdio: 'inherit',
    }),
  );

  serverStarted = true;

  server.on('exit', (code, signal) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[dev] Le serveur s\'est arrêté avec le code ${code ?? 'inconnu'} (signal: ${signal ?? 'none'}).`);
      process.exitCode = code ?? 1;
    }
  });
};

console.log('[dev] Lancement de la compilation TypeScript en mode watch...');
const tsc = registerChild(
  spawn(process.execPath, [tscPath, '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], {
    cwd: projectRoot,
    stdio: ['inherit', 'pipe', 'inherit'],
  }),
);

const tscOutput = createInterface({ input: tsc.stdout });

tscOutput.on('line', (line) => {
  console.log(`[tsc] ${line}`);
  if (line.includes('Found 0 errors.')) {
    startServer();
  }
});

tsc.on('exit', (code, signal) => {
  if (!shuttingDown) {
    console.error(`[dev] Le processus tsc s\'est arrêté avec le code ${code ?? 'inconnu'} (signal: ${signal ?? 'none'}).`);
    process.exitCode = code ?? 1;
  }
});

const shutdown = () => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
