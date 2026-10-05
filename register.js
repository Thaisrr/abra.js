/**
 * Overrides the tsconfig used for the app.
 */

const tsNode = require('ts-node');
const testTSConfig = require('./test/tsconfig.json');

tsNode.register({
    files: true,
    transpileOnly: true,
    project: './test/tsconfig.json'
});
