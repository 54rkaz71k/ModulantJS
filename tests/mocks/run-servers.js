const { createLocalServer } = require('./local-server');
const secondaryServer = require('./secondary-server');
const express = require('express');

async function startServers() {
  try {
    // Create express app for local server
    const app = express();
    
    // Start local server with the app
    const local = await createLocalServer(app);
    console.log(`Local server started on port ${local.port}`);
    
    // Start secondary server
    await secondaryServer.start();
    console.log(`Secondary server started on port ${secondaryServer.port}`);

    // Keep process running
    process.on('SIGINT', async () => {
      await Promise.all([
        new Promise(resolve => local.server.close(resolve)),
        secondaryServer.stop()
      ]);
      process.exit(0);
    });

    return { local, secondary: secondaryServer };
  } catch (error) {
    console.error('Failed to start servers:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServers();
} else {
  module.exports = startServers;
}
