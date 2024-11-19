// Modulant.js - Stealth Web Extension Framework
(() => {
  // Error codes
  const ERROR_CODES = {
    INITIALIZATION_FAILED: 'INIT_FAILED',
    INVALID_ROUTE: 'INVALID_ROUTE',
    PROXY_ERROR: 'PROXY_ERROR',
    PARAMETER_ERROR: 'PARAM_ERROR',
    SCRIPT_ERROR: 'SCRIPT_ERROR'
  };

  // Custom error class
  class ModulantError extends Error {
    constructor(message, code, context = {}) {
      super(message);
      this.name = 'ModulantError';
      this.code = code;
      this.context = context;
    }
  }

  // Store metrics in localStorage to persist across navigation
  const storage = {
    memoryStore: new Map(),
    getMetrics() {
      try {
        // Try localStorage first
        if (typeof localStorage !== 'undefined') {
          const stored = localStorage.getItem('modulant_metrics');
          if (stored) {
            const parsed = JSON.parse(stored);
            return new Map(parsed.map(([id, metric]) => [
              Number(id),
              {
                ...metric,
                startTime: Number(metric.startTime)
              }
            ]));
          }
        }
        // Fallback to memory store
        return new Map(this.memoryStore);
      } catch (e) {
        debug.error(ERROR_CODES.PARAMETER_ERROR, 'Failed to load metrics:', e);
        return new Map(this.memoryStore);
      }
    },
    setMetrics(metrics) {
      try {
        // Update memory store
        this.memoryStore = new Map(metrics);
        // Try localStorage if available
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('modulant_metrics', 
            JSON.stringify(Array.from(metrics.entries()))
          );
        }
      } catch (e) {
        debug.error(ERROR_CODES.PARAMETER_ERROR, 'Failed to save metrics:', e);
      }
    }
  };

  // Performance monitoring
  const performance = {
    metrics: storage.getMetrics(),
    nextId: 1,
    generateId: () => {
      // Ensure unique IDs even for concurrent requests
      const id = Date.now() * 1000 + performance.nextId;
      performance.nextId = (performance.nextId + 1) % 1000;
      return id;
    },
    startTimer: (id) => {
      debug.log('Starting timer for request:', id);
      performance.metrics.set(id, {
        startTime: Date.now(),
        status: 'in-progress'
      });
      storage.setMetrics(performance.metrics);
    },
    endTimer: (id, status = 'completed') => {
      debug.log('Ending timer for request:', id);
      const metric = performance.metrics.get(id);
      if (metric) {
        const duration = Date.now() - metric.startTime;
        debug.performance('Request completed:', duration);
        // Update metric status but keep in metrics Map
        performance.metrics.set(id, {
          startTime: metric.startTime,
          duration,
          status
        });
        storage.setMetrics(performance.metrics);
        return duration;
      }
      return null;
    },
    clearMetrics: (id) => {
      if (id) {
        debug.log('Clearing metrics for request:', id);
        performance.metrics.delete(id);
      } else {
        debug.log('Clearing all metrics');
        performance.metrics.clear();
      }
      storage.setMetrics(performance.metrics);
    }
  };

  // Debug logging utility
  const debug = {
    log: (...args) => {
      if (typeof process !== 'undefined' && process.env.DEBUG_MODULANT === 'true') {
        const log = Function.prototype.bind.call(console.log, console);
        log('[ModulantJS Debug]', ...args);
      }
    },
    error: (code, message, context) => {
      if (typeof process !== 'undefined' && process.env.DEBUG_MODULANT === 'true') {
        const error = Function.prototype.bind.call(console.error, console);
        error(`[ModulantJS Error] ${code}:`, message, context);
      }
    },
    performance: (operation, duration) => {
      if (typeof process !== 'undefined' && process.env.DEBUG_MODULANT === 'true') {
        const log = Function.prototype.bind.call(console.log, console);
        log(`[ModulantJS Performance] ${operation}: ${duration}ms`);
      }
    }
  };

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
        },
        // New URL parameter configuration
        parameterConfig: {
          ...config.parameterConfig,
          transformHooks: config.parameterConfig?.transformHooks || {},
          parameterRules: config.parameterConfig?.parameterRules || {},
          defaultValues: config.parameterConfig?.defaultValues || {},
          filterPatterns: config.parameterConfig?.filterPatterns || []
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

    // New URL parameter handling methods
    _processURLParameters(url, route) {
      try {
        debug.log('Processing URL parameters for:', url);
        const parsedUrl = new URL(url, window.location.origin);
        debug.log('Parsed URL:', parsedUrl.toString());
        
        const params = new URLSearchParams(parsedUrl.search);
        debug.log('Original parameters:', Object.fromEntries(params.entries()));
        
        const processedParams = new URLSearchParams();

        // Apply parameter rules and transformations
        parameterLoop: for (const [key, value] of params.entries()) {
          debug.log(`\nProcessing parameter: ${key}=${value}`);

          // Check filter patterns
          if (this._shouldFilterParameter(key)) {
            debug.log(`Parameter ${key} filtered by pattern`);
            continue parameterLoop;
          }

          // Apply transformation hooks
          const transformedValue = this._applyTransformHooks(key, value);
          debug.log(`Transformed value for ${key}:`, transformedValue);

          // Get validation rules for this parameter
          const rules = this.config.parameterConfig.parameterRules[key];
          debug.log(`Validation rules for ${key}:`, rules);

          // If parameter has rules, validate it
          if (rules) {
            debug.log(`Validating parameter ${key} with rules:`, rules);
            const isValid = this._validateParameter(key, transformedValue);
            debug.log(`Validation result for ${key}: ${isValid}`);
            
            if (!isValid) {
              debug.log(`Parameter ${key} failed validation, skipping`);
              continue parameterLoop;
            }
          }

          // Add parameter if it passed validation or has no rules
          debug.log(`Adding parameter ${key}=${transformedValue} to processed params`);
          processedParams.append(key, transformedValue);
        }

        // Add default values for missing parameters
        this._addDefaultParameters(processedParams);
        debug.log('Parameters after adding defaults:', Object.fromEntries(processedParams.entries()));

        // Build final URL
        const targetUrl = new URL(route.proxy.target + parsedUrl.pathname);
        targetUrl.search = processedParams.toString();
        debug.log('Final processed URL:', targetUrl.toString());
        
        return targetUrl.toString();
      } catch (error) {
        debug.error(ERROR_CODES.PARAMETER_ERROR, 'Error processing URL parameters:', error);
        return url;
      }
    }

    _shouldFilterParameter(key) {
      const shouldFilter = this.config.parameterConfig.filterPatterns.some(pattern => 
        new RegExp(pattern).test(key)
      );
      debug.log(`Filter check for ${key}: ${shouldFilter}`);
      return shouldFilter;
    }

    _applyTransformHooks(key, value) {
      const hook = this.config.parameterConfig.transformHooks[key];
      if (typeof hook === 'function') {
        try {
          const transformed = hook(value);
          debug.log(`Transform hook applied for ${key}: ${value} -> ${transformed}`);
          return transformed;
        } catch (error) {
          debug.error(ERROR_CODES.PARAMETER_ERROR, `Error in transform hook for ${key}:`, error);
          return value;
        }
      }
      return value;
    }

    _validateParameter(key, value) {
      const rules = this.config.parameterConfig.parameterRules[key];
      if (!rules) {
        debug.log(`No validation rules for ${key}`);
        return true;
      }

      try {
        // Check required rule
        if (rules.required && (!value || value.trim() === '')) {
          debug.log(`Parameter ${key} failed required validation`);
          return false;
        }

        // Check pattern rule
        if (rules.pattern) {
          const pattern = new RegExp(rules.pattern);
          const matches = pattern.test(value);
          debug.log(`Pattern validation for ${key}: ${rules.pattern} -> ${matches}`);
          if (!matches) {
            debug.log(`Parameter ${key} failed pattern validation`);
            return false;
          }
        }

        // Check custom validation
        if (rules.validate && typeof rules.validate === 'function') {
          const isValid = rules.validate(value);
          debug.log(`Custom validation for ${key}: ${isValid}`);
          if (!isValid) {
            debug.log(`Parameter ${key} failed custom validation`);
            return false;
          }
        }

        debug.log(`Parameter ${key} passed all validations`);
        return true;
      } catch (error) {
        debug.error(ERROR_CODES.PARAMETER_ERROR, `Error validating parameter ${key}:`, error);
        return false;
      }
    }

    _addDefaultParameters(params) {
      for (const [key, value] of Object.entries(this.config.parameterConfig.defaultValues)) {
        if (!params.has(key)) {
          debug.log(`Adding default value for ${key}: ${value}`);
          params.append(key, value);
        }
      }
    }

    _initialize() {
      return new Promise((resolve, reject) => {
        try {
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
            debug.log('[Modulant Parent] Received message:', event.data);
          });
        } catch (error) {
          reject(new ModulantError('Initialization failed', ERROR_CODES.INITIALIZATION_FAILED, error));
        }
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
                if (typeof process !== 'undefined' && process.env.DEBUG_MODULANT === 'true') {
                  console.log('[Modulant Frame]', msg);
                }
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
      debug.log('[Modulant Parent] Sending test event');
      if (this._state.proxyFrame && this._state.proxyFrame.contentWindow) {
        this._state.proxyFrame.contentWindow.postMessage('test-custom-event', '*');
        debug.log('[Modulant Parent] Test event sent');
      } else {
        debug.log('[Modulant Parent] No proxy frame available');
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
      } catch (error) {
        debug.error(ERROR_CODES.INVALID_ROUTE, 'Error finding matching route:', error);
        return null;
      }
    }

    async _proxyRequest(url, init = {}) {
      const route = this._findMatchingRoute(url);
      if (!route || !route.proxy || !route.proxy.target) {
        try {
          return await this._state.originalFunctions.get('fetch')(url, init);
        } catch (error) {
          throw new ModulantError(error.message, ERROR_CODES.PROXY_ERROR, { url, error });
        }
      }

      return new Promise((resolve, reject) => {
        const id = performance.generateId();
        performance.startTimer(id);

        const cleanup = setTimeout(() => {
          window.removeEventListener('message', handler);
          // Keep as in-progress for timeout
          debug.performance('Request timeout');
          performance.endTimer(id, 'in-progress');
          reject(new ModulantError('Request timeout', ERROR_CODES.PROXY_ERROR, { url }));
        }, 30000);

        const handler = async (event) => {
          if (!event.data || event.data.id !== id) return;
          window.removeEventListener('message', handler);
          clearTimeout(cleanup);

          if (event.data.error) {
            // Keep as in-progress for error
            debug.performance('Failed request');
            performance.endTimer(id, 'in-progress');
            reject(new ModulantError(event.data.error, ERROR_CODES.PROXY_ERROR, { url }));
            return;
          }

          try {
            let response = new Response(event.data.body, {
              status: event.data.status,
              headers: event.data.headers
            });

            // Handle error status codes
            if (response.status >= 400) {
              // Keep as in-progress for error responses
              debug.performance('Error response');
              performance.endTimer(id, 'in-progress');
              reject(new ModulantError(
                `HTTP error ${response.status}`,
                ERROR_CODES.PROXY_ERROR,
                { url, status: response.status }
              ));
              return;
            }

            // Apply response modifications if configured
            if (route.proxy.modifyResponse) {
              debug.log('Applying response modifications');
              response = await route.proxy.modifyResponse(response);
            }

            // Process URL parameters for the proxy URL
            const proxyUrl = this._processURLParameters(url, route);
            Object.defineProperties(response, {
              url: { value: proxyUrl },
              text: { value: async () => event.data.body }
            });

            const duration = performance.endTimer(id, 'completed');
            debug.performance('Successful request', duration);
            resolve(response);
          } catch (error) {
            // Keep as in-progress for error
            debug.performance('Response processing error');
            performance.endTimer(id, 'in-progress');
            reject(new ModulantError(
              'Error processing response',
              ERROR_CODES.PROXY_ERROR,
              { url, error: error.message }
            ));
          }
        };

        window.addEventListener('message', handler);
        // Use processed URL for the proxy request
        const processedUrl = this._processURLParameters(url, route);
        this._state.proxyFrame.contentWindow.postMessage({
          type: 'proxy',
          id,
          url: processedUrl,
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
        // Process URL parameters for navigation
        const proxyUrl = this._processURLParameters(link.href, route);
        window.location.href = proxyUrl;
      }, true);

      window.open = (url, ...args) => {
        const route = this._findMatchingRoute(url);
        if (!route) return this._state.originalFunctions.get('open')(url, ...args);

        // Process URL parameters for window.open
        const proxyUrl = this._processURLParameters(url, route);
        return this._state.originalFunctions.get('open')(proxyUrl, ...args);
      };

      history.pushState = (state, title, url) => {
        const route = this._findMatchingRoute(url);
        if (!route) return this._state.originalFunctions.get('pushState').call(history, state, title, url);

        const parsedUrl = new URL(url, window.location.origin);
        // Process URL parameters for pushState
        const proxyUrl = this._processURLParameters(url, route);
        return this._state.originalFunctions.get('pushState').call(
          history,
          { ...state, modulant: true, targetUrl: proxyUrl },
          title,
          parsedUrl.pathname
        );
      };
    }

    addRoute(route) {
      try {
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

        // Validate route configuration
        if (!route.match?.hostname || !route.match?.path || !route.proxy?.target) {
          throw new ModulantError(
            'Invalid route configuration',
            ERROR_CODES.INVALID_ROUTE,
            { route }
          );
        }
        
        this.config.routes.push(route);
        return route;
      } catch (error) {
        if (error instanceof ModulantError) throw error;
        throw new ModulantError(
          'Error adding route',
          ERROR_CODES.INVALID_ROUTE,
          { route, error: error.message }
        );
      }
    }

    isActive() {
      return this._state.isActive;
    }

    static async init(config) {
      try {
        const instance = new Modulant(config);
        await instance._initPromise;
        return instance;
      } catch (error) {
        throw new ModulantError(
          'Initialization failed',
          ERROR_CODES.INITIALIZATION_FAILED,
          { error: error.message }
        );
      }
    }

    // Performance monitoring methods
    getRequestMetrics() {
      // Load latest metrics from storage
      performance.metrics = storage.getMetrics();
      
      const metrics = Array.from(performance.metrics.entries()).map(([id, metric]) => {
        const duration = metric.duration || (
          metric.status === 'in-progress' ? Date.now() - metric.startTime : undefined
        );
        return {
          id,
          duration,
          status: metric.status
        };
      });
      debug.log('Current metrics:', metrics);
      return metrics;
    }
  }

  // Expose Modulant and its error types
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Modulant;
    module.exports.ModulantError = ModulantError;
    module.exports.ERROR_CODES = ERROR_CODES;
  }
  if (typeof window !== 'undefined') {
    window.Modulant = Modulant;
    window.Modulant.ModulantError = ModulantError;
    window.Modulant.ERROR_CODES = ERROR_CODES;
  }
})();
