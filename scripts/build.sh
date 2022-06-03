tsc --build tsconfig.json
tsc --build tsconfig.cjs.json
vite build
tsc src/client/index.ts --declaration --emitDeclarationOnly --jsx react --esModuleInterop --outDir dist
rm -rf ./dist/server/cjs/src/client
rm -rf ./dist/server/cjs/src/tests
rm -rf ./dist/server/esm/src/client
rm -rf ./dist/server/esm/src/tests
