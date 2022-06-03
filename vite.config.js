/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const { defineConfig } = require('vite');

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/client/index.ts'),
      name: 'birdsongHttpClient',
      fileName: format => `index.${format}.js`
    },
    outDir: path.resolve(__dirname, 'dist/client'),
    sourcemap: true
  }
});
