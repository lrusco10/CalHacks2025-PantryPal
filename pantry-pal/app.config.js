// app.config.js
export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    claudeAPI: process.env.claudeAPI,  // EAS secret
  },
});
