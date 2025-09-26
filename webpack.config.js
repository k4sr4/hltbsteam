const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      background: './background.js',
      content: './content.js',
      popup: './popup.js'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'manifest.json',
            to: 'manifest.json'
          },
          {
            from: 'popup.html',
            to: 'popup.html'
          },
          {
            from: 'popup.css',
            to: 'popup.css'
          },
          {
            from: 'styles.css',
            to: 'styles.css'
          },
          {
            from: 'icons',
            to: 'icons'
          }
        ]
      })
    ],
    devtool: isProduction ? false : 'cheap-module-source-map',
    mode: argv.mode || 'development',
    resolve: {
      extensions: ['.js', '.json']
    },
    optimization: {
      splitChunks: false // Chrome extensions don't support code splitting
    }
  };
};