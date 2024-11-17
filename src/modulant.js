// Modulant.js - Stealth Web Extension Framework
(function(global) {
  class Modulant {
    constructor(config = {}) {
      // Core configuration
      this.config = {
        primaryServerURL: config.primaryServerURL || (typeof window !== 'undefined' ? window.location.origin : null),
        secondaryServerURL: config.secondaryServerURL,
        routes: config.routes || [],
        injectScript: config.injectScript,
        defaultHeaders: {
          ...config.defaultHeaders,
          'X-Requested-With': 'XMLHttpRequest',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin'
        }
      };

      // State tracking
      this._state = {
        isActive: false,
        proxyFrame: null,
        originalFunctions: new Map()
      };

      // Initialize only if in browser
      if (typeof window !== 'undefined' && window.document) {
        this._initPromise = this._initialize();
      }
    }

    _initialize() {
      return new Promise((resolve) => {
        // Create proxy frame
        this._state.proxyFrame = this._createProxyFrame();
        
        // Store original functions
        this._state.originalFunctions.set('fetch', window.fetch);
        this._state.originalFunctions.set('XMLHttpRequest', window.XMLHttpRequest);
        this._state.originalFunctions.set('open', window.open);
        this._state.originalFunctions.set('pushState', history.pushState);
        
        // Initialize interceptors
        this._interceptFetch();
        this._interceptXHR();
        this._interceptNavigation();

        // Wait for frame to be ready
        const readyHandler = (event) => {
          if (event.data === 'modulant:ready') {
            window.removeEventListener('message', readyHandler);
            this._state.isActive = true;
            resolve();
          }
        };
        window.addEventListener('message', readyHandler);

        // Add test event handler
        window.addEventListener('message', (event) => {
          console.log('[Modulant Parent] Received message:', event.data);
        });
      });
    }

    _createProxyFrame() {
      const frame = document.createElement('iframe');
      frame.style.display = 'none';
      frame.sandbox = 'allow-scripts allow-same-origin';
      
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <script>
              // Debug logging
              function log(msg) {
                console.log('[Modulant Frame]', msg);
              }

              // Execute injected script
              try {
                log('Executing injected script');
                ${this.config.injectScript || ''}
                log('Injected script executed');
              } catch (error) {
                log('Error executing injected script: ' + error);
              }

              // Set up message handling
              window.addEventListener('message', async (event) => {
                log('Received raw message: ' + JSON.stringify(event));
                if (!event.data) return;
                
                log('Processing message: ' + JSON.stringify(event.data));
                
                if (event.data.type === 'proxy') {
                  try {
                    const response = await fetch(event.data.url, {
                      ...event.data.init,
                      headers: {
                        ...event.data.init?.headers,
                        ...${JSON.stringify(this.config.defaultHeaders)}
                      }
                    });
                    const body = await response.text();
                    event.source.postMessage({
                      id: event.data.id,
                      body,
                      status: response.status,
                      headers: Object.fromEntries(response.headers)
                    }, event.origin);
                  } catch (error) {
                    event.source.postMessage({
                      id: event.data.id,
                      error: error.message
                    }, event.origin);
                  }
                } else if (event.data === 'test-custom-event') {
                  log('Received test-custom-event');
                  try {
                    window.parent.postMessage('custom-event-fired', '*');
                    log('Sent custom-event-fired');
                  } catch (error) {
                    log('Error sending custom-event-fired: ' + error);
                  }
                }
              });

              // Signal ready state
              log('Sending ready signal');
              window.parent.postMessage('modulant:ready', '*');
              log('Ready signal sent');
            </script>
          </head>
          <body></body>
        </html>
      `;
      
      const blob = new Blob([html], { type: 'text/html' });
      frame.src = URL.createObjectURL(blob);
      
      document.body.appendChild(frame);
      return frame;
    }

    sendTestEvent() {
      console.log('[Modulant Parent] Sending test event');
      if (this._state.proxyFrame && this._state.proxyFrame.contentWindow) {
        this._state.proxyFrame.contentWindow.postMessage('test-custom-event', '*');
        console.log('[Modulant Parent] Test event sent');
      } else {
        console.log('[Modulant Parent] No proxy frame available');
      }
    }

    _findMatchingRoute(url) {
      try {
        const parsedUrl = new URL(url, window.location.origin);
        return this.config.routes.find(route => {
          if (!route.match || !route.match.hostname || !route.match.path) return false;
          
          const hostMatch = route.match.hostname === parsedUrl.hostname;
          const pathPattern = new RegExp(route.match.path.replace(/\*/g, '.*'));
          const pathMatch = pathPattern.test(parsedUrl.pathname);
          
          return hostMatch && pathMatch;
        });
      } catch {
        return null;
      }
    }

    async _proxyRequest(url, init = {}) {
      const route = this._findMatchingRoute(url);
      if (!route || !route.proxy || !route.proxy.target) {
        return this._state.originalFunctions.get('fetch')(url, init);
      }

      return new Promise((resolve, reject) => {
        const id = Date.now();
        const cleanup = setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('Request timeout'));
        }, 30000);

        const handler = (event) => {
          if (!event.data || event.data.id !== id) return;
          window.removeEventListener('message', handler);
          clearTimeout(cleanup);

          if (event.data.error) {
            reject(new Error(event.data.error));
            return;
          }

          const response = new Response(event.data.body, {
            status: event.data.status,
            headers: event.data.headers
          });

          const proxyUrl = route.proxy.target + new URL(url, window.location.origin).pathname;
          Object.defineProperties(response, {
            url: { value: proxyUrl },
            text: { value: async () => event.data.body }
          });

          resolve(response);
        };

        window.addEventListener('message', handler);
        this._state.proxyFrame.contentWindow.postMessage({
          type: 'proxy',
          id,
          url: route.proxy.target + new URL(url, window.location.origin).pathname,
          init
        }, '*');
      });
    }

    _interceptFetch() {
      window.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input.url;
        return this._proxyRequest(url, init);
      };
    }

    _interceptXHR() {
      const XHR = window.XMLHttpRequest;
      const self = this;

      window.XMLHttpRequest = function() {
        const xhr = new XHR();
        const open = xhr.open;
        
        xhr.open = function(method, url, ...args) {
          this._modulantUrl = url;
          this._modulantMethod = method;
          open.call(this, method, url, ...args);
        };

        const send = xhr.send;
        xhr.send = async function(body) {
          const route = self._findMatchingRoute(this._modulantUrl);
          if (!route) {
            send.call(this, body);
            return;
          }

          try {
            const response = await self._proxyRequest(this._modulantUrl, {
              method: this._modulantMethod,
              body
            });
            
            const text = await response.text();
            Object.defineProperties(this, {
              responseText: { value: text },
              status: { value: response.status },
              readyState: { value: 4 }
            });
            
            this.onload?.();
          } catch (error) {
            this.onerror?.(error);
          }
        };

        return xhr;
      };
    }

    _interceptNavigation() {
      document.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (!link) return;

        const route = this._findMatchingRoute(link.href);
        if (!route) return;

        event.preventDefault();
        const proxyUrl = route.proxy.target + new URL(link.href, window.location.origin).pathname;
        window.location.href = proxyUrl;
      }, true);

      window.open = (url, ...args) => {
        const route = this._findMatchingRoute(url);
        if (!route) return this._state.originalFunctions.get('open')(url, ...args);

        const proxyUrl = route.proxy.target + new URL(url, window.location.origin).pathname;
        return this._state.originalFunctions.get('open')(proxyUrl, ...args);
      };

      history.pushState = (state, title, url) => {
        const route = this._findMatchingRoute(url);
        if (!route) return this._state.originalFunctions.get('pushState').call(history, state, title, url);

        const parsedUrl = new URL(url, window.location.origin);
        return this._state.originalFunctions.get('pushState').call(
          history,
          { ...state, modulant: true, targetUrl: route.proxy.target + parsedUrl.pathname },
          title,
          parsedUrl.pathname
        );
      };
    }

    addRoute(route) {
      // Handle both object and pattern/target formats
      if (typeof route === 'string') {
        const pattern = route;
        const target = arguments[1];
        route = {
          match: {
            hostname: window.location.hostname,
            path: pattern
          },
          proxy: {
            target: target === 'secondary' ? this.config.secondaryServerURL : target
          }
        };
      }
      
      this.config.routes.push(route);
      return route;
    }

    isActive() {
      return this._state.isActive;
    }

    static async init(config) {
      const instance = new Modulant(config);
      await instance._initPromise;
      return instance;
    }
  }

  // Expose Modulant
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Modulant;
  }
  if (typeof window !== 'undefined') {
    window.Modulant = Modulant;
  }
})(typeof window !== 'undefined' ? window : global);
