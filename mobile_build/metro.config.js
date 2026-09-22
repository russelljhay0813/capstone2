const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for .wasm asset files
config.resolver.assetExts.push('wasm');

// Add COEP and COOP headers to enable SharedArrayBuffer for expo-sqlite on web
config.server.enhanceMiddleware = (metroMiddleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    // CRUCIAL: You must return the middleware call
    return metroMiddleware(req, res, next); 
  };
};

module.exports = config;