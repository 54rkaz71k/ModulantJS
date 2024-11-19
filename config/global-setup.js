const childProcess = require('child_process');
const axios = require('axios');
const path = require('path');

let primaryServerProcess;
let secondaryServerProcess;

async function waitForServer(url, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await axios.get(url);
      return true;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`Server at ${url} did not respond`);
}

async function globalSetup() {
  console.log('Starting servers...');
  const testServerPath = path.join(__dirname, '../tests/mocks/test-server.js');
  primaryServerProcess = childProcess.spawn('node', [testServerPath, '3000']);
  secondaryServerProcess = childProcess.spawn('node', [testServerPath, '4000']);

  primaryServerProcess.stdout.on('data', (data) => console.log(`Primary Server (3000): ${data}`));
  primaryServerProcess.stderr.on('data', (data) => console.error(`Primary Server (3000) Error: ${data}`));
  secondaryServerProcess.stdout.on('data', (data) => console.log(`Secondary Server (4000): ${data}`));
  secondaryServerProcess.stderr.on('data', (data) => console.error(`Secondary Server (4000) Error: ${data}`));

  try {
    // Wait for both servers to be ready
    await Promise.all([
      waitForServer('http://localhost:3000'),
      waitForServer('http://localhost:4000')
    ]);
    console.log('Both servers are ready');
  } catch (error) {
    console.error('Error starting servers:', error);
    if (primaryServerProcess) primaryServerProcess.kill();
    if (secondaryServerProcess) secondaryServerProcess.kill();
    throw error;
  }

  // Store process references globally
  global.__primaryServerProcess = primaryServerProcess;
  global.__secondaryServerProcess = secondaryServerProcess;
}

module.exports = globalSetup;
