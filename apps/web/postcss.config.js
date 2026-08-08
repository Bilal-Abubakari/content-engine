const { join } = require('path');

module.exports = {
  plugins: {
    // Pin the Tailwind config by absolute path. Next runs with the process CWD
    // at the workspace root, so a bare `tailwindcss: {}` looks for the config
    // there, fails to find it, and falls back to an empty-content default that
    // purges every utility. Referencing it explicitly makes it CWD-independent.
    tailwindcss: { config: join(__dirname, 'tailwind.config.js') },
    autoprefixer: {},
  },
};
