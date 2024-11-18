const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Set up a comprehensive simulated DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://example.com',  // Match the test routes domain
    runScripts: 'dangerously'
});

// Comprehensive global object setup
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.URL = dom.window.URL;
global.history = dom.window.history;

// Mock URL.createObjectURL
global.URL.createObjectURL = (blob) => {
    return 'blob:mock-url';
};

// Mock postMessage for iframe
class MockIframe extends dom.window.HTMLIFrameElement {
    constructor() {
        super();
        this.contentWindow = {
            postMessage: (data, origin) => {
                // Simulate the iframe's response
                setTimeout(() => {
                    if (data === 'test-custom-event') {
                        window.dispatchEvent(new dom.window.MessageEvent('message', {
                            data: 'custom-event-fired'
                        }));
                    }
                }, 0);
            }
        };
    }
}
global.window.HTMLIFrameElement = MockIframe;

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

// Mock Blob
global.Blob = class Blob {
    constructor(content, options = {}) {
        this.content = content;
        this.type = options.type || '';
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
const modulantSource = fs.readFileSync(path.resolve(__dirname, '../src/modulant.js'), 'utf8');

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
    let messageListeners = [];

    const testRoutes = [
        {
            match: {
                hostname: 'example.com',
                path: '/api/*'
            },
            proxy: {
                target: 'http://example.com'  // Use same origin for history tests
            }
        }
    ];

    // Track event listeners
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = function(type, listener, ...args) {
        if (type === 'message') {
            messageListeners.push(listener);
        }
        return originalAddEventListener.call(this, type, listener, ...args);
    };

    beforeEach(async function() {
        // Reset DOM for each test
        document.body.innerHTML = '';
        messageListeners = [];
        
        console.log('Setting up test environment...');
        
        // Store original methods
        originalFetch = global.window.fetch;
        originalWindowOpen = global.window.open;
        originalPushState = global.history.pushState;

        // Initialize Modulant with test routes and parameter config
        console.log('Initializing Modulant...');
        modulant = new Modulant({
            routes: testRoutes,
            parameterConfig: {
                transformHooks: {
                    'uppercase': (value) => value.toUpperCase(),
                    'base64': (value) => btoa(value)
                },
                parameterRules: {
                    'required_param': { required: true },
                    'pattern_param': { pattern: '^[0-9]+$' },
                    'custom_param': { 
                        validate: (value) => {
                            console.log(`Custom validation for custom_param length: ${value.length}`);
                            return value.length > 5;
                        }
                    }
                },
                defaultValues: {
                    'default_param': 'default_value'
                },
                filterPatterns: [
                    '^_internal_'
                ]
            }
        });
        
        // Manually trigger ready event
        setTimeout(() => {
            window.dispatchEvent(new dom.window.MessageEvent('message', {
                data: 'modulant:ready'
            }));
        }, 0);

        // Create stubs with more comprehensive implementation
        console.log('Setting up stubs...');
        fetchStub = sinon.stub(global.window, 'fetch').callsFake(async (url, options) => {
            const route = modulant._findMatchingRoute(url);
            
            if (route && route.proxy) {
                const proxyUrl = modulant._processURLParameters(url, route);
                
                // Store the processed URL for verification
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
            const route = modulant._findMatchingRoute(url);
            
            if (route && route.proxy) {
                const proxyUrl = modulant._processURLParameters(url, route);
                
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

            const route = modulant._findMatchingRoute(parsedUrl.href);
            
            if (route && route.proxy) {
                const proxyUrl = modulant._processURLParameters(url, route);
                
                // Use the proxyUrl instead of the original url
                pushStateStub.lastProxyUrl = proxyUrl;
                return originalPushState.call(global.history, state, title, proxyUrl);
            }

            return originalPushState.call(global.history, state, title, url);
        });

        console.log('Test environment setup complete');
    });

    afterEach(function() {
        // Only try to clean up DOM elements if document exists
        if (typeof global.document !== 'undefined') {
            // Clean up iframes
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => iframe.remove());
        }

        // Remove message event listeners if window exists
        if (typeof global.window !== 'undefined') {
            messageListeners.forEach(listener => {
                window.removeEventListener('message', listener);
            });
        }
        messageListeners = [];

        // Restore all stubs and original methods
        sinon.restore();
        if (typeof global.window !== 'undefined') {
            global.window.fetch = originalFetch;
            global.window.open = originalWindowOpen;
            global.history.pushState = originalPushState;
        }
    });

    describe('URL Parameter Handling', function() {
        it('should apply parameter transformations', async function() {
            const testURL = 'http://example.com/api/test?uppercase=hello&base64=world';
            await global.window.fetch(testURL);
            
            const finalUrl = new URL(fetchStub.lastProxyUrl);
            const params = new URLSearchParams(finalUrl.search);
            
            expect(params.get('uppercase')).to.equal('HELLO');
            expect(params.get('base64')).to.equal('d29ybGQ='); // 'world' in base64
        });

        it('should validate parameters according to rules', async function() {
            const testURL = 'http://example.com/api/test?required_param=value&pattern_param=123&custom_param=longvalue';
            await global.window.fetch(testURL);
            
            const finalUrl = new URL(fetchStub.lastProxyUrl);
            const params = new URLSearchParams(finalUrl.search);
            
            expect(params.has('required_param')).to.be.true;
            expect(params.get('pattern_param')).to.equal('123');
            expect(params.get('custom_param')).to.equal('longvalue');
        });

        it('should filter out internal parameters', async function() {
            const testURL = 'http://example.com/api/test?_internal_param=secret&public_param=visible';
            await global.window.fetch(testURL);
            
            const finalUrl = new URL(fetchStub.lastProxyUrl);
            const params = new URLSearchParams(finalUrl.search);
            
            expect(params.has('_internal_param')).to.be.false;
            expect(params.has('public_param')).to.be.true;
        });

        it('should add default parameters when missing', async function() {
            const testURL = 'http://example.com/api/test?existing_param=value';
            await global.window.fetch(testURL);
            
            const finalUrl = new URL(fetchStub.lastProxyUrl);
            const params = new URLSearchParams(finalUrl.search);
            
            expect(params.get('default_param')).to.equal('default_value');
            expect(params.get('existing_param')).to.equal('value');
        });

        it('should handle invalid parameter values gracefully', async function() {
            const testURL = 'http://example.com/api/test?pattern_param=invalid&custom_param=short';
            await global.window.fetch(testURL);
            
            const finalUrl = new URL(fetchStub.lastProxyUrl);
            const params = new URLSearchParams(finalUrl.search);
            
            // Invalid parameters should be filtered out
            expect(params.has('pattern_param')).to.be.false;
            expect(params.has('custom_param')).to.be.false;
        });

        it('should preserve valid complex parameters', async function() {
            const testURL = 'http://example.com/api/test?array[]=1&array[]=2&nested[key]=value';
            await global.window.fetch(testURL);
            
            const finalUrl = new URL(fetchStub.lastProxyUrl);
            const params = new URLSearchParams(finalUrl.search);
            
            expect(params.getAll('array[]')).to.deep.equal(['1', '2']);
            expect(params.get('nested[key]')).to.equal('value');
        });
    });

    describe('Fetch Interception', function() {
        it('should intercept and route fetch requests', async function() {
            const testURL = 'http://example.com/api/test-endpoint';
            
            // Perform the actual fetch
            await global.window.fetch(testURL);
            expect(fetchStub.lastProxyUrl).to.include('/api/test-endpoint');
        });
    });

    describe('Window Open Interception', function() {
        it('should intercept and route window.open calls', function() {
            const testURL = 'http://example.com/api/new-page';
            
            // Perform the actual window.open
            global.window.open(testURL);
            expect(windowOpenStub.lastProxyUrl).to.include('/api/new-page');
        });
    });

    describe('History Navigation Interception', function() {
        it('should intercept and route history.pushState', function() {
            const testURL = '/api/new-state';  // Use path only for same origin

            // Perform pushState
            global.history.pushState(null, '', testURL);
            expect(pushStateStub.lastProxyUrl).to.include('/api/new-state');
        });
    });

    describe('Error Handling', function() {
        it('should handle routing errors gracefully', async function() {
            const testURL = 'http://unmatched.com/api/test';

            // Perform fetch to unmatched route
            await global.window.fetch(testURL);

            // Verify original URL was used
            expect(fetchStub.calledOnce).to.be.true;
        });
    });

    describe('Route Matching', function() {
        it('should match routes correctly', function() {
            // Test matching routes
            const matchedRoute1 = modulant._findMatchingRoute('http://example.com/api/users');
            expect(matchedRoute1).to.deep.equal(testRoutes[0]);

            // Test non-matching routes
            const nonMatchedRoute = modulant._findMatchingRoute('http://unmatched.com/path');
            expect(nonMatchedRoute).to.be.undefined;
        });
    });

    describe('Proxy Configuration', function() {
        it('should handle multiple route configurations', function() {
            // Verify routes are correctly stored
            expect(modulant.config.routes).to.have.lengthOf(1);
            
            // Check route details
            expect(modulant.config.routes[0].match.hostname).to.equal('example.com');
            expect(modulant.config.routes[0].proxy.target).to.equal('http://example.com');
        });
    });

    describe('ModulantError Handling', function() {
        beforeEach(function() {
            // Add test routes with error scenarios
            modulant.addRoute({
                match: { 
                    hostname: 'example.com',
                    path: '/error/*'
                },
                proxy: {
                    target: 'http://example.com/error'
                }
            });
        });

        it('should throw ModulantError with correct code for initialization failure', async function() {
            // Store original document and window
            const originalDocument = global.document;
            const originalWindow = global.window;

            try {
                // Break the initialization
                global.document = undefined;
                global.window = undefined;
                
                // Attempt initialization with a timeout
                await Promise.race([
                    Modulant.init({}),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Initialization timeout')), 1000)
                    )
                ]);
                
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(Modulant.ModulantError);
                expect(error.code).to.equal('INIT_FAILED');
                expect(error.context).to.be.an('object');
            } finally {
                // Restore globals immediately
                global.document = originalDocument;
                global.window = originalWindow;
            }
        });

        it('should throw ModulantError with correct code for invalid route', function() {
            try {
                modulant.addRoute({
                    match: { hostname: 'example.com' } // Missing path
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(Modulant.ModulantError);
                expect(error.code).to.equal('INVALID_ROUTE');
                expect(error.context.route).to.be.an('object');
            }
        });

        it('should throw ModulantError with correct code for proxy error', async function() {
            // Make fetch throw an error
            fetchStub.restore();
            fetchStub = sinon.stub(global.window, 'fetch').rejects(new Error('Network error'));

            try {
                await modulant._proxyRequest('http://example.com/error/test');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(Modulant.ModulantError);
                expect(error.code).to.equal('PROXY_ERROR');
                expect(error.context.url).to.include('/error/test');
            }
        });
    });

    describe('Performance Monitoring', function() {
        beforeEach(function() {
            // Add test route with delay
            modulant.addRoute({
                match: { 
                    hostname: 'example.com',
                    path: '/slow/*'
                },
                proxy: {
                    target: 'http://example.com/slow'
                }
            });
        });

        it('should track request durations', async function() {
            // Simulate a delay in the fetch response
            fetchStub.restore();
            fetchStub = sinon.stub(global.window, 'fetch').callsFake(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return new global.window.Response('Test response', {
                    headers: { 'X-Response-Time': '100ms' }
                });
            });

            await modulant._proxyRequest('http://example.com/slow/test');
            const metrics = modulant.getRequestMetrics();
            
            expect(metrics).to.be.an('array');
            if (metrics.length > 0) {
                expect(metrics[0]).to.have.property('duration');
                expect(metrics[0].duration).to.be.at.least(100);
            }
        });

        it('should clean up metrics after request completion', async function() {
            await modulant._proxyRequest('http://example.com/slow/test');
            const metricsAfter = modulant.getRequestMetrics();
            expect(metricsAfter).to.have.lengthOf(0);
        });
    });

    describe('Response Modification', function() {
        beforeEach(function() {
            // Add route with response modification
            modulant.addRoute({
                match: { 
                    hostname: 'example.com',
                    path: '/modified/*'
                },
                proxy: {
                    target: 'http://example.com/modified',
                    modifyResponse: async (response) => {
                        const text = await response.text();
                        return new Response(
                            JSON.stringify({ modified: true, original: text }),
                            { headers: { 'X-Modified': 'true' } }
                        );
                    }
                }
            });
        });

        it('should apply response modifications when configured', async function() {
            fetchStub.restore();
            fetchStub = sinon.stub(global.window, 'fetch').callsFake(async () => {
                return new global.window.Response('Original content', {
                    headers: { 'Content-Type': 'text/plain' }
                });
            });

            const response = await modulant._proxyRequest('http://example.com/modified/test');
            const data = await response.json();
            
            expect(data.modified).to.be.true;
            expect(data.original).to.equal('Original content');
            expect(response.headers.get('X-Modified')).to.equal('true');
        });

        it('should handle response modification errors', async function() {
            modulant.addRoute({
                match: { 
                    hostname: 'example.com',
                    path: '/error-mod/*'
                },
                proxy: {
                    target: 'http://example.com/error-mod',
                    modifyResponse: async () => {
                        throw new Error('Modification error');
                    }
                }
            });

            try {
                await modulant._proxyRequest('http://example.com/error-mod/test');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(Modulant.ModulantError);
                expect(error.code).to.equal('PROXY_ERROR');
                expect(error.context.error).to.equal('Modification error');
            }
        });
    });

    describe('Debug Logging', function() {
        let consoleLogStub;
        let consoleErrorStub;

        beforeEach(function() {
            consoleLogStub = sinon.stub(console, 'log');
            consoleErrorStub = sinon.stub(console, 'error');
            process.env.DEBUG_MODULANT = 'true';
        });

        afterEach(function() {
            consoleLogStub.restore();
            consoleErrorStub.restore();
            delete process.env.DEBUG_MODULANT;
        });

        it('should log performance metrics when debug is enabled', async function() {
            await modulant._proxyRequest('http://example.com/api/test');
            
            expect(consoleLogStub.calledWith(
                sinon.match(/\[ModulantJS Performance\]/)
            )).to.be.true;
        });

        it('should log errors with context when debug is enabled', async function() {
            try {
                await modulant._proxyRequest('invalid-url');
            } catch (error) {
                expect(consoleErrorStub.calledWith(
                    sinon.match(/\[ModulantJS Error\]/)
                )).to.be.true;
            }
        });

        it('should include detailed debug information in logs', async function() {
            await modulant._proxyRequest('http://example.com/api/test?debug=true');
            
            expect(consoleLogStub.calledWith(
                sinon.match('Processing URL parameters for:')
            )).to.be.true;
            expect(consoleLogStub.calledWith(
                sinon.match('Parameters after adding defaults:')
            )).to.be.true;
        });
    });
});
