module.exports = {
  routes: [
    {
      // Primary AliExpress routing
      match: {
        hostname: 'www.aliexpress.com',
        path: '/product/*'
      },
      proxy: {
        target: 'https://www.aliexpress.com',
        changeOrigin: true
      }
    },
    {
      // Checkout flow routing to secondary server
      match: {
        hostname: 'www.aliexpress.com',
        path: '/checkout/*'
      },
      proxy: {
        target: 'http://localhost:4000',
        changeOrigin: true,
        pathRewrite: {
          '^/checkout': '/api/checkout'
        }
      }
    },
    {
      // Specific API routing for checkout
      match: {
        hostname: 'www.aliexpress.com',
        path: '/api/checkout/*'
      },
      proxy: {
        target: 'http://localhost:4000',
        changeOrigin: true,
        pathRewrite: {
          '^/api/checkout': '/api/checkout'
        }
      }
    }
  ]
};
