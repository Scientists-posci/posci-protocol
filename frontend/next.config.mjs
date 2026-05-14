/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pino is brought in by walletconnect; mark optional deps as falsy.
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    // MetaMask SDK ships an optional React-Native AsyncStorage import that
    // doesn't exist in browser builds — alias it away.
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
  // Required so SharedArrayBuffer + cross-origin isolation are enabled
  // (some GPU debug paths and high-perf workers want this). Optional but harmless.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ];
  },
};

export default nextConfig;
