import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const processes = [];

const run = (cmd, args, cwd) => {
  const child = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  processes.push(child);
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Process ${cmd} ${args.join(' ')} exited with code ${code}`);
      process.exitCode = code ?? 1;
      processes.forEach((proc) => {
        if (!proc.killed) {
          proc.kill('SIGTERM');
        }
      });
    }
  });
};

const rootDir = process.cwd();

run('npm', ['run', 'dev'], resolve(rootDir, 'apps/backend'));
run('npm', ['run', 'dev'], resolve(rootDir, 'apps/frontend'));

process.on('SIGINT', () => {
  processes.forEach((proc) => proc.kill('SIGINT'));
  process.exit(0);
});
