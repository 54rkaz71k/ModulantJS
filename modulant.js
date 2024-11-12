class Modulant {
    constructor(config = {}) {
        // Enhanced configuration with more flexible routing
        this.config = {
            primaryServerURL: window.location.origin,
            secondaryServerURL: null,
            routes: [],
            defaultHeaders: {},
            logging: false,
            injectScript: '', // Simplified script injection
            ...config
        };

        // Tracking for pending fetch requests
        this.pendingFetches = new Map();

        // Logging method with improved type checking
        this.log = this.config.logging 
            ? (message) => {
                if (typeof console !== 'undefined' && console.log) {
                    console.log(`[Modulant] ${message}`);
                }
            }
            : () => {};

        // Create and setup the hidden iframe with more robust error handling
        this.iframe = this.createIframe();

        // Override fetch and attach link interception with improved logging
        this.overrideFetch();
        this.interceptLinks();
    }

    // More detailed iframe creation with error handling
    createIframe() {
        const iframe = document.createElement('iframe');
        iframe.id = 'modulant-iframe';
        iframe.src = this.config.primaryServerURL;
        iframe.style.display = 'none';
        iframe.sandbox = 'allow-scripts allow-same-origin allow-forms';
        
        iframe.onerror = (error) => {
            this.log(`Iframe creation error: ${error}`);
        };

        try {
            document.body.appendChild(iframe);
        } catch (error) {
            this.log(`Error appending iframe: ${error}`);
        }

        // Setup message listener for iframe communication
        window.addEventListener('message', this.handleMessage.bind(this));

        return iframe;
    }

    handleMessage(event) {
        // More robust message validation
        if (!event.origin) {
            this.log('Received message without origin');
            return;
        }

        // Validate message source
        if (event.source !== this.iframe.contentWindow) {
            this.log('Message from unauthorized source');
            return;
        }

        this.log(`Received message: ${JSON.stringify(event.data)}`);

        switch(event.data.type) {
            case 'navigate':
                this.navigateToURL(event.data.url);
                break;
            case 'fetchResponse':
                this.handleFetchResponse(event.data);
                break;
            case 'fetchError':
                this.handleFetchError(event.data);
                break;
            default:
                this.log(`Unhandled message type: ${event.data.type}`);
        }
    }

    navigateToURL(url) {
        // Determine routing
        const routeConfig = this.config.routes.find(route => 
            url.includes(route.pattern)
        );

        const targetServer = routeConfig && routeConfig.target === 'secondary' 
            ? this.config.secondaryServerURL 
            : this.config.primaryServerURL;

        // Fetch content via iframe
        this.iframe.contentWindow.postMessage({
            type: 'fetch',
            url: url,
            method: 'GET',
            headers: {
                ...this.config.defaultHeaders,
                'X-Modulant-Target': targetServer
            }
        }, '*');
    }

    overrideFetch() {
        const originalFetch = window.fetch;
        window.fetch = async (input, init = {}) => {
            const url = typeof input === 'string' ? input : input.url;
            
            this.log(`Intercepting fetch: ${url}`);
            
            // Determine target server based on routes
            const routeConfig = this.config.routes.find(route => 
                url.includes(route.pattern)
            );
            
            const serverURL = routeConfig && routeConfig.target === 'secondary' 
                ? this.config.secondaryServerURL 
                : this.config.primaryServerURL;

            // Create a unique request ID
            const requestId = Date.now() + Math.random().toString(36).substr(2, 9);

            // Send fetch request through iframe
            return new Promise((resolve, reject) => {
                // Store the promise resolvers
                this.pendingFetches.set(requestId, { resolve, reject });

                this.iframe.contentWindow.postMessage({
                    type: 'fetch',
                    requestId: requestId,
                    url: url,
                    method: init.method || 'GET',
                    headers: {
                        ...this.config.defaultHeaders, 
                        ...init.headers,
                        'X-Modulant-Target': serverURL
                    },
                    body: init.body
                }, '*');
            });
        };
    }

    interceptLinks() {
        document.addEventListener('click', (event) => {
            const target = event.target.closest('a');
            if (target && target.href) {
                event.preventDefault();
                this.log(`Intercepted link: ${target.href}`);
                this.navigateToURL(target.href);
            }
        });
    }

    handleFetchResponse(data) {
        // Inject content into the page
        const contentContainer = document.querySelector('#content') || document.body;
        contentContainer.innerHTML = data.response;

        // Resolve the specific fetch promise
        const pendingFetch = this.pendingFetches.get(data.requestId);
        if (pendingFetch) {
            pendingFetch.resolve(new Response(data.response));
            this.pendingFetches.delete(data.requestId);
        }
    }

    handleFetchError(data) {
        this.log(`Fetch error: ${data.error}`);
        
        // Reject the specific fetch promise
        const pendingFetch = this.pendingFetches.get(data.requestId);
        if (pendingFetch) {
            pendingFetch.reject(new Error(data.error));
            this.pendingFetches.delete(data.requestId);
        }
    }

    // Static method to initialize Modulant
    static init(config) {
        return new Modulant(config);
    }
}

// Expose Modulant globally
window.Modulant = Modulant;
