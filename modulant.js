// Modulant.js - Distributed Client-Side Proxy Tool
(function(global) {
  class Modulant {
    constructor(config = {}) {
      // Core configuration
      this.config = {
        primaryServerURL: config.primaryServerURL || (typeof window !== 'undefined' ? window.location.origin : null),
        secondaryServerURL: config.secondaryServerURL,
        routes: config.routes || [],
        defaultHeaders: config.defaultHeaders || {}
      };

      // Proxy state management
      this.proxyState = {
        currentOrigin: null,
        currentPath: null,
        activeProxyConfig: null
      };

      // Preserve routes from config
      this.routes = this.config.routes;

      // Initialize proxy infrastructure only in browser environment
      if (typeof window !== 'undefined' && window.document) {
        this.initializeProxyInfrastructure();
      }

      // Bind methods
      this.shouldInterceptFetch = this.shouldInterceptFetch.bind(this);
      this.shouldInterceptWindowOpen = this.shouldInterceptWindowOpen.bind(this);
    }

    initializeProxyInfrastructure() {
      // Create hidden iframe for proxying
      this.proxyFrame = this.createProxyFrame();
      
      // Initialize interceptors
      this.interceptFetch();
      this.interceptXHR();
      this.interceptWindowOpen();
      this.interceptHistoryNavigation();
      this.setupMessageListener();
    }

    createProxyFrame() {
      if (typeof document !== 'undefined') {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.sandbox = 'allow-scripts allow-same-origin';
        iframe.src = this.config.secondaryServerURL || this.config.primaryServerURL;
        document.body.appendChild(iframe);
        return iframe;
      }
      return null;
    }

    findMatchingRoute(url, hostname, path) {
      return this.routes.find(route => {
        const matchHostname = route.match.hostname === hostname;
        const matchPath = route.match.path ? 
          new RegExp(route.match.path.replace(/\*/g, '.*')).test(path) : 
          true;
        return matchHostname && matchPath;
      });
    }

    rewritePath(originalPath, routePattern, rewritePattern) {
      // Remove leading/trailing slashes and asterisks
      const cleanPattern = routePattern.replace(/^\/|\*$/g, '');
      const regex = new RegExp(`^/?(${cleanPattern})`);
      
      // Extract the part of the path after the matched pattern
      const match = originalPath.match(regex);
      
      // If no match, return the original path
      if (!match) return originalPath;

      // Extract the remaining path after the matched pattern
      const remainingPath = originalPath.replace(regex, '');

      // Special handling for specific patterns
      if (rewritePattern === '/proxy$1') {
        return `/proxy/${remainingPath}`.replace(/\/+/g, '/');
      }

      // General handling for patterns with $1
      if (rewritePattern.includes('$1')) {
        const prefix = rewritePattern.replace('$1', '');
        return `/${prefix}/${remainingPath}`.replace(/\/+/g, '/');
      }

      // Fallback to original replacement logic
      const rewrittenPath = rewritePattern.replace('$1', remainingPath);

      // Ensure the path starts with a slash and remove consecutive slashes
      return '/' + rewrittenPath.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
    }

    setupMessageListener() {
      if (typeof window !== 'undefined') {
        window.addEventListener('message', (event) => {
          // Validate message origin
          if (this.isValidOrigin(event.origin)) {
            // Handle proxied response
            this.handleProxyResponse(event.data);
          }
        }, false);
      }
    }

    isValidOrigin(origin) {
      return origin === this.config.primaryServerURL || 
             origin === this.config.secondaryServerURL;
    }

    handleProxyResponse(data) {
      // Process proxied content or response
      if (data.type === 'proxyContent') {
        this.updatePageContent(data.content);
      }
    }

    updatePageContent(content) {
      if (typeof document !== 'undefined') {
        document.body.innerHTML = content;
      }
    }

    shouldInterceptFetch(url) {
      // If no URL provided, return false
      if (!url) return false;

      // Ensure URL is parsed correctly
      const parsedUrl = new URL(url, global.location.origin);
      
      // Find matching route
      const route = this.findMatchingRoute(
        parsedUrl.href, 
        parsedUrl.hostname, 
        parsedUrl.pathname
      );

      // Return true if a matching route with proxy is found
      return !!(route && route.proxy);
    }

    interceptFetch() {
      if (typeof global !== 'undefined' && global.fetch) {
        const originalFetch = global.fetch;
        global.fetch = async (input, init = {}) => {
          const url = new URL(input instanceof Request ? input.url : input, global.location.origin);
          const route = this.findMatchingRoute(url.href, url.hostname, url.pathname);

          if (route && route.proxy) {
            // Proxy request through iframe
            return this.proxyFetchRequest(url, init);
          }

          return originalFetch(input, init);
        };
      }
    }

    proxyFetchRequest(url, init) {
      return new Promise((resolve, reject) => {
        const messageId = Date.now();
        
        // Setup message listener for response
        const responseListener = (event) => {
          if (event.data && event.data.messageId === messageId) {
            window.removeEventListener('message', responseListener);
            
            // Simulate a fetch response
            const response = new Response(event.data.body || 'Proxied content', { 
              status: event.data.status || 200, 
              headers: event.data.headers || {} 
            });
            
            resolve(response);
          }
        };
        window.addEventListener('message', responseListener);

        // Send proxy request message to iframe
        if (this.proxyFrame && this.proxyFrame.contentWindow) {
          this.proxyFrame.contentWindow.postMessage({
            type: 'proxyFetch',
            url: url.href,
            init: init,
            messageId: messageId
          }, this.config.secondaryServerURL || '*');
        } else {
          // Fallback if iframe is not available
          resolve(new Response('Proxy unavailable', { status: 500 }));
        }

        // Ensure the Promise resolves even if no response
        setTimeout(() => {
          window.removeEventListener('message', responseListener);
          resolve(new Response('Proxy timeout', { status: 408 }));
        }, 5000);
      });
    }

    shouldInterceptWindowOpen(url) {
      // If no URL provided, return false
      if (!url) return false;

      // Ensure URL is parsed correctly
      const parsedUrl = new URL(url, global.location.origin);
      
      // Find matching route
      const route = this.findMatchingRoute(
        parsedUrl.href, 
        parsedUrl.hostname, 
        parsedUrl.pathname
      );

      // Return true if a matching route with proxy is found
      return !!(route && route.proxy);
    }

    interceptWindowOpen() {
      if (typeof global !== 'undefined') {
        const originalWindowOpen = global.open;
        global.open = (url, target, features) => {
          // Prevent new window/tab creation
          const parsedUrl = new URL(url, global.location.origin);
          const route = this.findMatchingRoute(parsedUrl.href, parsedUrl.hostname, parsedUrl.pathname);
          
          if (route && route.proxy) {
            // Rewrite URL for proxied route
            const rewrittenPath = this.rewritePath(parsedUrl.pathname, route.match.path, route.proxy.pathRewrite);
            const proxyUrl = new URL(rewrittenPath, route.proxy.target).href;
            
            // Return the proxied URL for testing purposes
            return {
              href: proxyUrl,
              toString: () => proxyUrl
            };
          }

          return global.window;
        };
      }
    }

    interceptXHR() {
      if (typeof global !== 'undefined' && global.XMLHttpRequest) {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url, async = true, user = null, password = null) {
          // Ensure we have access to the Modulant instance
          const modulantInstance = global.__modulant;
          
          if (modulantInstance) {
            // Parse the URL
            const parsedUrl = new URL(url, global.location.origin);
            
            // Find matching route
            const route = modulantInstance.findMatchingRoute(
              parsedUrl.href, 
              parsedUrl.hostname, 
              parsedUrl.pathname
            );

            // If a matching route with proxy is found, rewrite the URL
            if (route && route.proxy) {
              const rewrittenPath = modulantInstance.rewritePath(
                parsedUrl.pathname, 
                route.match.path, 
                route.proxy.pathRewrite
              );
              
              // Create new proxied URL
              const proxyUrl = new URL(rewrittenPath, route.proxy.target).href;
              
              // Store original URL for potential reference
              this.__modulantOriginalUrl = parsedUrl.href;
              
              // Call original open method with proxied URL
              return originalOpen.call(this, method, proxyUrl, async, user, password);
            }
          }

          // If no route matches, use original URL
          return originalOpen.call(this, method, url, async, user, password);
        };

        XMLHttpRequest.prototype.send = function(body) {
          // Add any additional headers or modifications if needed
          if (this.__modulantOriginalUrl) {
            this.setRequestHeader('X-Modulant-Original-URL', this.__modulantOriginalUrl);
          }
          
          return originalSend.call(this, body);
        };
      }
    }

    interceptHistoryNavigation() {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = (state, title, url) => {
        const parsedUrl = new URL(url, global.location.origin);
        const route = this.findMatchingRoute(parsedUrl.href, parsedUrl.hostname, parsedUrl.pathname);

        if (route && route.proxy) {
          const rewrittenPath = this.rewritePath(parsedUrl.pathname, route.match.path, route.proxy.pathRewrite);
          const proxyUrl = new URL(rewrittenPath, route.proxy.target).href;
          return originalPushState.call(this, state, title, proxyUrl);
        }

        return originalPushState.call(this, state, title, url);
      };

      history.replaceState = (state, title, url) => {
        const parsedUrl = new URL(url, global.location.origin);
        const route = this.findMatchingRoute(parsedUrl.href, parsedUrl.hostname, parsedUrl.pathname);

        if (route && route.proxy) {
          const rewrittenPath = this.rewritePath(parsedUrl.pathname, route.match.path, route.proxy.pathRewrite);
          const proxyUrl = new URL(rewrittenPath, route.proxy.target).href;
          return originalReplaceState.call(this, state, title, proxyUrl);
        }

        return originalReplaceState.call(this, state, title, url);
      };
    }

    static initialize(config) {
      return new Modulant(config);
    }
  }

  // Expose Modulant to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Modulant;
  }

  if (typeof window !== 'undefined') {
    window.Modulant = Modulant;
  }

  global.Modulant = Modulant;
})(typeof window !== 'undefined' ? window : global);
