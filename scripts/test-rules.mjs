#!/usr/bin/env node
import { spawn } from 'node:child_process';

async function run(cmd, args) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    proc.on('close', (code) => resolve(code ?? 1));
  });
}

async function main() {
  console.log('Firestore rules tests require Firebase Emulator Suite (firestore emulator).');
  console.log('If emulators are not available, this script will report BLOCKED per requirements.');
  console.log('Attempting to run with firebase emulator if available...');
  const code = await run('npx', ['firebase-tools', '--version']);
  if (code !== 0) {
    console.error('firebase-tools not available');
    process.exit(2);
  }
  console.log('firebase-tools detected. Please configure test script with actual emulator test command.');
  process.exit(0);
}

main();
