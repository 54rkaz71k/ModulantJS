const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const net = require('net');

function findAvailablePort(startPort = 4000) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        findAvailablePort(startPort + 1)
          .then(resolve)
          .catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

class SecondaryServer {
  constructor() {
    this.app = express();
    this.port = null;
    this.server = null;
    this.requestLog = [];
    
    // Middleware
    this.app.use(cors());
    this.app.use(bodyParser.json());
    this.app.use(this.logRequests.bind(this));

    // Checkout-related routes
    this.setupRoutes();
  }

  logRequests(req, res, next) {
    this.requestLog.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      timestamp: new Date()
    });
    next();
  }

  setupRoutes() {
    // Mock product details for checkout
    this.app.get('/api/checkout/product/:productId', (req, res) => {
      const productId = req.params.productId;
      res.json({
        id: productId,
        name: `Checkout Product ${productId}`,
        price: 99.99,
        availableForCheckout: true
      });
    });

    // Mock checkout process
    this.app.post('/api/checkout/process', (req, res) => {
      const { productId, quantity, shippingDetails } = req.body;
      
      // Simulate checkout validation
      if (!productId || !quantity || !shippingDetails) {
        return res.status(400).json({ 
          error: 'Incomplete checkout information',
          status: 'failed'
        });
      }

      // Simulate successful checkout
      res.json({
        orderId: `ORDER-${Date.now()}`,
        productId,
        quantity,
        total: 99.99 * quantity,
        status: 'processed',
        shippingDetails
      });
    });

    // Proxy route to simulate complex checkout flow
    this.app.get('/api/checkout/proxy', (req, res) => {
      // Simulate a proxy request that might involve multiple steps
      res.json({
        proxyStatus: 'active',
        availableRoutes: [
          '/api/checkout/product',
          '/api/checkout/process'
        ]
      });
    });

    // New route: Mock product search
    this.app.get('/api/search', (req, res) => {
      const query = req.query.q || '';
      res.json({
        results: [
          { id: '1', name: `${query} Product 1`, price: 19.99 },
          { id: '2', name: `${query} Product 2`, price: 29.99 },
          { id: '3', name: `${query} Product 3`, price: 39.99 },
        ],
        totalResults: 3
      });
    });

    // New route: Mock user authentication
    this.app.post('/api/auth/login', (req, res) => {
      const { username, password } = req.body;
      if (username === 'testuser' && password === 'testpass') {
        res.json({ status: 'success', token: 'mock-jwt-token' });
      } else {
        res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      }
    });

    // New route: Mock product recommendations
    this.app.get('/api/recommendations', (req, res) => {
      res.json({
        recommendations: [
          { id: '4', name: 'Recommended Product 1', price: 49.99 },
          { id: '5', name: 'Recommended Product 2', price: 59.99 },
        ]
      });
    });
  }

  async start(delay = 0) {
    // Find an available port
    this.port = await findAvailablePort();

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Secondary server running on http://localhost:${this.port}`);
        if (delay > 0) {
          console.log(`Simulating ${delay}ms network delay`);
          this.app.use((req, res, next) => setTimeout(next, delay));
        }
        resolve(this);
      }).on('error', reject);
    });
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  clearRequestLog() {
    this.requestLog = [];
  }

  getRequestLog() {
    return this.requestLog;
  }
}

module.exports = new SecondaryServer();
