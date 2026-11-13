// Pins PostCSS to this project. Without a local config, PostCSS walks up the folder tree and
// can pick up an unrelated postcss.config.js (e.g. one left in C:\Users\<you>\Downloads) that needs Tailwind.
module.exports = { plugins: [] };
