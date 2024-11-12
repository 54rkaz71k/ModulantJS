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

// Ensure fetch is defined before other operations
if (!global.window.fetch) {
    global.window.fetch = async (url, options) => {
        return new Promise((resolve) => {
            resolve({
                ok: true,
                status: 200,
                json: async () => ({}),
                text: async () => 'Default Mocked Response',
                headers: new global.window.Headers(),
                clone: () => this
            });
        });
    };
}

// Comprehensive Headers implementation
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

// Comprehensive Response implementation
global.window.Response = class Response {
    constructor(body, init = {}) {
        this._body = body;
        this.status = init.status || 200;
        this.ok = true;
        this.headers = new global.window.Headers(init.headers);
        
        this.text = async () => this._body;
        this.json = async () => {
            try {
                return JSON.parse(this._body);
            } catch {
                return this._body;
            }
        };
        this.clone = () => this;

        // Add body getter to match fetch API
        Object.defineProperty(this, 'body', {
            get: () => {
                const stream = new global.window.ReadableStream({
                    start(controller) {
                        controller.enqueue(new TextEncoder().encode(this._body));
                        controller.close();
                    }
                });
                return stream;
            }
        });
    }
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
    let postMessageStub;
    let originalFetch;

    beforeEach(function() {
        // Store original fetch
        originalFetch = global.window.fetch;

        // Create stubs with more comprehensive implementation
        fetchStub = sinon.stub(global.window, 'fetch').callsFake(async (url, options) => {
            return new global.window.Response('Mocked response', { 
                status: 200,
                headers: new global.window.Headers()
            });
        });
        
        // Create Modulant instance with test configuration
        modulant = new Modulant({
            primaryServerURL: 'https://example.com',
            secondaryServerURL: 'https://secondary.com',
            routes: [
                { pattern: '/api/test', target: 'secondary' }
            ],
            logging: false,
            injectScript: '' // Explicitly set empty inject script
        });

        // Stub postMessage on the iframe
        postMessageStub = sinon.stub(modulant.iframe.contentWindow, 'postMessage');
    });

    afterEach(function() {
        // Restore all stubs
        sinon.restore();

        // Restore original fetch
        global.window.fetch = originalFetch;
    });

    describe('Fetch Interception', function() {
        it('should intercept and route fetch requests', async function() {
            const testURL = 'https://example.com/api/test';
            const mockResponseText = 'Mocked response';
            
            // Perform fetch
            const fetchPromise = global.window.fetch(testURL);

            // Verify postMessage was called with the fetch request
            expect(postMessageStub.calledOnce).to.be.true;
            const postMessageArgs = postMessageStub.firstCall.args[0];
            
            // Verify postMessage details
            expect(postMessageArgs.type).to.equal('fetch');
            expect(postMessageArgs.url).to.equal(testURL);
            expect(postMessageArgs.headers['X-Modulant-Target']).to.equal('https://secondary.com');

            // Verify original fetch was not called
            expect(fetchStub.called).to.be.false;

            // Simulate the response handling
            const requestId = postMessageArgs.requestId;
            modulant.handleFetchResponse({ 
                response: mockResponseText,
                url: testURL,
                requestId: requestId
            });

            // Wait for the fetch promise
            const response = await fetchPromise;

            // Verify response text
            const responseText = await response.text();
            expect(responseText).to.equal(mockResponseText);
        });
    });

    describe('Content Injection', function() {
        it('should support custom content injection', function() {
            const mockResponse = { 
                response: '<div>Test Content</div>',
                requestId: 'test-request-id'
            };
            
            // Create a mock content container
            const contentContainer = global.document.createElement('div');
            contentContainer.id = 'content';
            global.document.body.appendChild(contentContainer);

            // Call handleFetchResponse
            modulant.handleFetchResponse(mockResponse);

            // Check content injection
            expect(contentContainer.innerHTML).to.equal(mockResponse.response);
        });
    });

    describe('Error Handling', function() {
        it('should handle fetch errors gracefully', function() {
            const mockError = new Error('Test Error');
            const requestId = 'test-request-id';

            // Create a mock pending fetch
            const rejectSpy = sinon.spy();
            modulant.pendingFetches.set(requestId, { 
                resolve: () => {}, 
                reject: rejectSpy 
            });

            // Simulate fetch error
            modulant.handleFetchError({ 
                error: mockError.message,
                requestId: requestId 
            });

            expect(rejectSpy.calledOnce).to.be.true;
            expect(rejectSpy.firstCall.args[0]).to.be.instanceOf(Error);
            expect(rejectSpy.firstCall.args[0].message).to.equal(mockError.message);
            
            // Verify the pending fetch was removed
            expect(modulant.pendingFetches.has(requestId)).to.be.false;
        });
    });
});
