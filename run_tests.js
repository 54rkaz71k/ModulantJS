const { execSync } = require('child_process');
const path = require('path');
const globalSetup = require('./config/global-setup');
const globalTeardown = require('./config/global-teardown');

async function runTests(testSuite = 'test:all') {
    try {
        await globalSetup();
        console.log('Global setup complete. Running tests...');
        execSync(`npm run ${testSuite}`, { stdio: 'inherit' });
        console.log('Tests complete.');
        await globalTeardown();
        console.log('Global teardown complete.');
    } catch (error) {
        console.error('Error running tests:', error);
        process.exit(1);
    }
}

// Allow running specific test suites via command-line arguments
const testSuiteToRun = process.argv[2] || 'test:all';
runTests(testSuiteToRun);
