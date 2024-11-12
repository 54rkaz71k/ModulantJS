const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Set up a comprehensive simulated DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    runScripts: 'dangerously'
});

// Comprehensive global object setup
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.URL = dom.window.URL;
global.history = dom.window.history;

// Comprehensive Response and Headers implementation
global.window.Headers = class Headers {
    constructor(init = {}) {
        this._headers = init || {};
    }
    get(name) {
        return this._headers[name];
    }
    set(name, value) {
        this._headers[name] = value;
    }
};

global.window.Response = class Response {
    constructor(body, init = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.ok = true;
        this.headers = new global.window.Headers(init.headers);
        
        this.text = async () => body;
        this.json = async () => {
            try {
                return JSON.parse(body);
            } catch {
                return body;
            }
        };
        this.clone = () => this;
    }
};

// Ensure fetch is defined with comprehensive mock
global.window.fetch = async (url, options = {}) => {
    return new global.window.Response('Mocked response', { 
        status: 200,
        headers: new global.window.Headers()
    });
};

// Load Modulant source code
const modulantSource = fs.readFileSync(path.resolve(__dirname, 'modulant.js'), 'utf8');

// Create a module context with comprehensive setup
const createModuleContext = () => {
    const module = { exports: {} };
    
    // Create a function to execute the module with full context
    const moduleFunction = new Function(
        'window', 
        'document', 
        'module', 
        'exports', 
        modulantSource
    );
    
    // Execute the module with full global context
    moduleFunction(
        global.window, 
        global.document, 
        module, 
        module.exports
    );
    
    return module;
};

// Create module context
const moduleContext = createModuleContext();

// Get Modulant class with fallback
const Modulant = global.window.Modulant || moduleContext.exports;

describe('Modulant.js Proxy Tool', function() {
    // Increase timeout for async tests
    this.timeout(10000);

    let modulant;
    let fetchStub;
    let windowOpenStub;
    let pushStateStub;
    let originalFetch;
    let originalWindowOpen;
    let originalPushState;

    const testRoutes = [
        {
            match: {
                hostname: 'example.com',
                path: '/api/*'
            },
            proxy: {
                target: 'https://secondary.com',
                pathRewrite: '/proxy$1'
            }
        }
    ];

    beforeEach(function() {
        // Store original methods
        originalFetch = global.window.fetch;
        originalWindowOpen = global.window.open;
        originalPushState = global.history.pushState;

        // Create stubs
        fetchStub = sinon.stub(global.window, 'fetch').callsFake(async (url, options) => {
            return new global.window.Response('Mocked response', { 
                status: 200,
                headers: new global.window.Headers()
            });
        });

        windowOpenStub = sinon.stub(global.window, 'open').callsFake((url, target, features) => {
            return url;
        });

        pushStateStub = sinon.stub(global.history, 'pushState').callsFake((state, title, url) => {
            return url;
        });
        
        // Initialize Modulant with test routes
        modulant = Modulant.initialize({ routes: testRoutes });
    });

    afterEach(function() {
        // Restore all stubs and original methods
        sinon.restore();
        global.window.fetch = originalFetch;
        global.window.open = originalWindowOpen;
        global.history.pushState = originalPushState;
    });

    describe('Fetch Interception', function() {
        it('should intercept and route fetch requests', async function() {
            const testURL = 'https://example.com/api/test-endpoint';
            
            // Perform fetch
            await global.window.fetch(testURL);

            // Verify fetch was intercepted and routed
            const lastCall = fetchStub.lastCall;
            expect(lastCall.args[0]).to.include('https://secondary.com/proxy/test-endpoint');
        });
    });

    describe('Window Open Interception', function() {
        it('should intercept and route window.open calls', function() {
            const testURL = 'https://example.com/api/new-page';
            
            // Perform window.open
            global.window.open(testURL);

            // Verify window.open was intercepted and routed
            const lastCall = windowOpenStub.lastCall;
            expect(lastCall.args[0]).to.include('https://secondary.com/proxy/new-page');
        });
    });

    describe('History Navigation Interception', function() {
        it('should intercept and route history.pushState', function() {
            const testURL = 'https://example.com/api/new-state';
            
            // Perform pushState
            global.history.pushState(null, '', testURL);

            // Verify pushState was intercepted and routed
            const lastCall = pushStateStub.lastCall;
            expect(lastCall.args[2]).to.include('https://secondary.com/proxy/new-state');
        });
    });

    describe('Error Handling', function() {
        it('should handle routing errors gracefully', async function() {
            const testURL = 'https://unmatched.com/api/test';
            
            // Perform fetch to unmatched route
            await global.window.fetch(testURL);

            // Verify original URL was used
            const lastCall = fetchStub.lastCall;
            expect(lastCall.args[0]).to.equal(testURL);
        });
    });
});
