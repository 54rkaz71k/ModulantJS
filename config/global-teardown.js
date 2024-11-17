async function globalTeardown() {
    console.log('Stopping servers...');
    
    // Kill server processes if they exist
    if (global.__primaryServerProcess) {
        global.__primaryServerProcess.kill();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for port to be released
    }
    if (global.__secondaryServerProcess) {
        global.__secondaryServerProcess.kill();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for port to be released
    }
    
    console.log('Servers stopped');
}

module.exports = globalTeardown;
