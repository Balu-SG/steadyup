// Lets the web export live under a sub-path (EXPO_BASE_URL=/app) so the SteadyUp
// server can host it for judges. Native builds and local web dev are unaffected.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
