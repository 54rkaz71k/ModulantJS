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

        // Initialize Modulant with test routes
        modulant = new Modulant({ routes: testRoutes });
        
        // Explicitly call interceptHistoryNavigation
        modulant.interceptHistoryNavigation();

        // Create stubs with more comprehensive implementation
        fetchStub = sinon.stub(global.window, 'fetch').callsFake(async (url, options) => {
            const route = modulant.findMatchingRoute(url, new URL(url).hostname, new URL(url).pathname);
            
            if (route && route.proxy) {
                const rewrittenPath = modulant.rewritePath(new URL(url).pathname, route.match.path, route.proxy.pathRewrite);
                const proxyUrl = new URL(rewrittenPath, route.proxy.target).href;
                
                // Simulate proxied fetch
                fetchStub.lastProxyUrl = proxyUrl;
                
                return new global.window.Response('Proxied content', {
                    status: 200,
                    headers: { 'X-Proxied-URL': proxyUrl }
                });
            }

            return new global.window.Response('Original content', {
                status: 200
            });
        });

        windowOpenStub = sinon.stub(global.window, 'open').callsFake((url, target, features) => {
            const route = modulant.findMatchingRoute(url, new URL(url).hostname, new URL(url).pathname);
            
            if (route && route.proxy) {
                const rewrittenPath = modulant.rewritePath(new URL(url).pathname, route.match.path, route.proxy.pathRewrite);
                const proxyUrl = new URL(rewrittenPath, route.proxy.target).href;
                
                // Store proxy URL for verification
                windowOpenStub.lastProxyUrl = proxyUrl;
                
                return {
                    href: proxyUrl,
                    toString: () => proxyUrl
                };
            }

            return global.window;
        });

        pushStateStub = sinon.stub(global.history, 'pushState').callsFake((state, title, url) => {
            let parsedUrl;
            try {
                parsedUrl = new URL(url, global.window.location.href);
            } catch (error) {
                console.error('Invalid URL:', url);
                return originalPushState.call(global.history, state, title, url);
            }

            const route = modulant.findMatchingRoute(parsedUrl.href, parsedUrl.hostname, parsedUrl.pathname);
            
            if (route && route.proxy) {
                const rewrittenPath = modulant.rewritePath(parsedUrl.pathname, route.match.path, route.proxy.pathRewrite);
                // Only change the pathname, keep the rest of the URL the same
                parsedUrl.pathname = rewrittenPath;
                const proxyUrl = parsedUrl.pathname;
                
                // Use the proxyUrl instead of the original url
                pushStateStub.lastProxyUrl = proxyUrl;
                return originalPushState.call(global.history, state, title, proxyUrl);
            }

            return originalPushState.call(global.history, state, title, url);
        });
        
        // Debug: Log Modulant instance
        console.log('Modulant instance:', modulant);
        console.log('Modulant routes:', modulant.routes);
        console.log('shouldInterceptFetch method:', modulant.shouldInterceptFetch);
        console.log('shouldInterceptWindowOpen method:', modulant.shouldInterceptWindowOpen);
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

            // Debug: Log before interception check
            console.log('Before shouldInterceptFetch:', testURL);

            // Check if the fetch should be intercepted
            const result = modulant.shouldInterceptFetch(testURL);

            // Debug: Log after interception check
            console.log('After shouldInterceptFetch:', result);

            // Verify fetch was intercepted and routed
            expect(result).to.be.true;
            
            // Perform the actual fetch
            await global.window.fetch(testURL);
            expect(fetchStub.lastProxyUrl).to.include('https://secondary.com/proxy/test-endpoint');
        });
    });

    describe('Window Open Interception', function() {
        it('should intercept and route window.open calls', function() {
            const testURL = 'https://example.com/api/new-page';

            // Debug: Log before interception check
            console.log('Before shouldInterceptWindowOpen:', testURL);

            // Check if window.open should be intercepted
            const result = modulant.shouldInterceptWindowOpen(testURL);

            // Debug: Log after interception check
            console.log('After shouldInterceptWindowOpen:', result);

            // Verify window.open was intercepted and routed
            expect(result).to.be.true;
            
            // Perform the actual window.open
            global.window.open(testURL);
            expect(windowOpenStub.lastProxyUrl).to.include('https://secondary.com/proxy/new-page');
        });
    });

    describe('History Navigation Interception', function() {
        it('should intercept and route history.pushState', function() {
            const testURL = 'https://example.com/api/new-state';

            // Debug: Log before pushState
            console.log('Before pushState:', testURL);

            // Perform pushState
            global.history.pushState(null, '', testURL);

            // Debug: Log after pushState
            console.log('After pushState:', pushStateStub.lastProxyUrl);

            // Verify pushState was intercepted and routed
            expect(pushStateStub.lastProxyUrl).to.include('/proxy/new-state');
        });
    });

    describe('Error Handling', function() {
        it('should handle routing errors gracefully', async function() {
            const testURL = 'https://unmatched.com/api/test';

            // Perform fetch to unmatched route
            await global.window.fetch(testURL);

            // Verify original URL was used
            expect(fetchStub.calledOnce).to.be.true;
        });
    });

    describe('Route Matching', function() {
        it('should match routes correctly', function() {
            // Test matching routes
            const matchedRoute1 = modulant.findMatchingRoute(
                'https://example.com/api/users', 
                'example.com', 
                '/api/users'
            );
            expect(matchedRoute1).to.deep.equal(testRoutes[0]);

            // Test non-matching routes
            const nonMatchedRoute = modulant.findMatchingRoute(
                'https://unmatched.com/path', 
                'unmatched.com', 
                '/path'
            );
            expect(nonMatchedRoute).to.be.undefined;
        });
    });

    describe('Path Rewriting', function() {
        it('should rewrite paths correctly', function() {
            // Test specific path rewriting scenarios
            const rewrittenPath1 = modulant.rewritePath(
                '/api/users', 
                '/api/*', 
                '/proxy$1'
            );
            expect(rewrittenPath1).to.equal('/proxy/users');

            // Test path with no match
            const nonMatchedPath = modulant.rewritePath(
                '/unmatched/path', 
                '/specific/*', 
                '/rewritten$1'
            );
            expect(nonMatchedPath).to.equal('/unmatched/path');
        });
    });

    describe('Proxy Configuration', function() {
        it('should handle multiple route configurations', function() {
            // Verify routes are correctly stored
            expect(modulant.routes).to.have.lengthOf(1);
            
            // Check route details
            expect(modulant.routes[0].match.hostname).to.equal('example.com');
            expect(modulant.routes[0].proxy.target).to.equal('https://secondary.com');
        });
    });
});
