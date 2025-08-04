// Vercel serverless function entry point
// Import the compiled TypeScript application
const { app } = require('../dist/index.js');

// Export the real TypeScript application
module.exports = app;