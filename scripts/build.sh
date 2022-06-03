tsc --build tsconfig.json
tsc --build tsconfig.cjs.json
vite build
rm -rf ./dist/server/cjs/src/client
rm -rf ./dist/server/cjs/src/tests
rm -rf ./dist/server/esm/src/client
rm -rf ./dist/server/esm/src/tests
