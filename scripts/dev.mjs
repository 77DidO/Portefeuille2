import { spawn } from 'node:child_process';

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

run('npm', ['run', 'dev', '--workspace', 'backend'], process.cwd());
run('npm', ['run', 'dev', '--workspace', 'frontend'], process.cwd());

process.on('SIGINT', () => {
  processes.forEach((proc) => proc.kill('SIGINT'));
  process.exit(0);
});
