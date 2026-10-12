import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const processes = [
  {
    name: 'Backend',
    cwd: path.join(root, 'backend'),
    args: ['server.js'],
  },
  {
    name: 'Frontend',
    cwd: path.join(root, 'frontend'),
    args: ['node_modules/vite/bin/vite.js'],
  },
];

let stopping = false;
let exitCode = 0;
const children = [];

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }

  const forceStop = setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null) child.kill('SIGKILL');
    }
  }, 3000);
  forceStop.unref();
}

for (const service of processes) {
  const child = spawn(process.execPath, service.args, {
    cwd: service.cwd,
    env: process.env,
    stdio: 'inherit',
  });
  children.push(child);

  child.on('error', (error) => {
    console.error(`${service.name} could not start: ${error.message}`);
    stop(1);
  });

  child.on('close', (code, signal) => {
    if (!stopping) {
      console.error(`${service.name} stopped${signal ? ` (${signal})` : ` with exit code ${code}`}.`);
      stop(code || 1);
    }
    if (children.every((process) => process.exitCode !== null || process.signalCode !== null)) {
      process.exitCode = exitCode;
    }
  });
}

process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));

console.log('Starting backend and frontend. Press Ctrl+C to stop both.');
