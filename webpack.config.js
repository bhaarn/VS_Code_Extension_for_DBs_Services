//@ts-check

'use strict';

const path = require('path');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externalsType: 'commonjs',
  externals: [
    { vscode: 'commonjs vscode' },
    { sqlite3: 'commonjs sqlite3' },
    { 'better-sqlite3': 'commonjs better-sqlite3' },
    { 'cpu-features': 'commonjs cpu-features' },
    function ({ request }, callback) {
      if (/\.node$/.test(request)) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    }
  ],
  externalsPresets: { node: true },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  ignoreWarnings: [
    /mongodb/,
    /pg-native/,
    /kerberos/,
    /snappy/,
    /aws4/
  ]
};
module.exports = config;
