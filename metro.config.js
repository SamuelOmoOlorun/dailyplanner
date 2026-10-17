const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo SQLite's web runtime loads a WebAssembly asset.
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

// SharedArrayBuffer requires cross-origin isolation in the browser.
const previousEnhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const enhancedMiddleware = previousEnhanceMiddleware
    ? previousEnhanceMiddleware(middleware, metroServer)
    : middleware;

  return (request, response, next) => {
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    return enhancedMiddleware(request, response, next);
  };
};

module.exports = config;
