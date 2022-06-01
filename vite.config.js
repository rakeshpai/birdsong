/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const { defineConfig } = require('vite');
const dts = require('vite-plugin-dts');

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/client/client.ts'),
      name: 'birdsongHttpClient',
      fileName: format => `client.${format}.js`
    },
    outDir: path.resolve(__dirname, 'dist/client'),
    sourcemap: true
  },
  plugins: [dts({ outputDir: path.resolve(__dirname, 'dist/client') })]
});
