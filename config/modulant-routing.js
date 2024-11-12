module.exports = {
  routes: [
    {
      // Conditional routing rule
      match: (request) => {
        // Example condition: route specific paths to local server
        const localServerPaths = ['/api/products'];
        return localServerPaths.some(path => request.url.includes(path));
      },
      target: 'http://localhost:3000'
    },
    {
      // Default route to AliExpress
      target: 'https://www.aliexpress.com'
    }
  ]
};
