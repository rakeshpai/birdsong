tsc --build tsconfig.json
tsc --build tsconfig.cjs.json
vite build
rm -rf ./dist/server/cjs/src/client
rm -rf ./dist/server/cjs/src/tests
rm -rf ./dist/server/esm/src/client
rm -rf ./dist/server/esm/src/tests
mv ./dist/client/shared/* ./dist/client/
mv ./dist/client/client/* ./dist/client/
rm -rf ./dist/client/shared
rm -rf ./dist/client/client