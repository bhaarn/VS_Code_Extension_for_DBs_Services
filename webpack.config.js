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
    { pg: 'commonjs pg' },
    { 'pg-native': 'commonjs pg-native' },
    { mysql2: 'commonjs mysql2' },
    { mongodb: 'commonjs mongodb' },
    { 'neo4j-driver': 'commonjs neo4j-driver' },
    { ioredis: 'commonjs ioredis' },
    { bullmq: 'commonjs bullmq' },
    { amqplib: 'commonjs amqplib' },
    { kafkajs: 'commonjs kafkajs' },
    { '@elastic/elasticsearch': 'commonjs @elastic/elasticsearch' },
    { 'ssh2': 'commonjs ssh2' },
    { dockerode: 'commonjs dockerode' },
    { 'ftp': 'commonjs ftp' },
    { 'ssh2-sftp-client': 'commonjs ssh2-sftp-client' },
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
