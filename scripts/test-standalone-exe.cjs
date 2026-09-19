const { spawn } = require('child_process');
const path = require('path');

const exePath = path.resolve(__dirname, '..', 'release', 'win-unpacked', 'GameHub.exe');
console.log('Testing standalone executable at:', exePath);

const proc = spawn(exePath, [], {
  detached: true,
  stdio: 'ignore'
});

console.log('Spawned PID:', proc.pid);

setTimeout(() => {
  try {
    // Check if process is still running
    process.kill(proc.pid, 0);
    console.log('SUCCESS: GameHub.exe is running steadily without crashing!');
    
    // Clean up
    process.kill(proc.pid);
    console.log('Terminated process successfully.');
    process.exit(0);
  } catch (err) {
    console.error('FAIL: GameHub.exe exited prematurely:', err.message);
    process.exit(1);
  }
}, 3000);
