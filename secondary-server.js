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
    
    // Middleware
    this.app.use(cors());
    this.app.use(bodyParser.json());

    // Checkout-related routes
    this.setupRoutes();
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
  }

  async start() {
    // Find an available port
    this.port = await findAvailablePort();

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Secondary server running on http://localhost:${this.port}`);
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
}

module.exports = new SecondaryServer();
