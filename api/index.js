// Vercel serverless function entry point
const { createServer } = require('http');
const { parse } = require('url');

// Import our Express app
let app;

async function getApp() {
  if (!app) {
    // Dynamically import our compiled app
    const appModule = await import('../dist/index.js');
    app = appModule.default?.app || appModule.app;
  }
  return app;
}

module.exports = async (req, res) => {
  try {
    const app = await getApp();
    
    // Handle the request with Express
    app(req, res);
  } catch (error) {
    console.error('Error in serverless function:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
};