const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      background: './src/background/service-worker.ts',
      content: './src/content/content-script-hybrid.ts',  // Hybrid: TypeScript + simple DOM
      popup: './popup.ts'  // TypeScript popup controller
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              configFile: 'tsconfig.build.json'
            }
          }
        },
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-typescript']
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
      extensions: ['.ts', '.js', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@/content': path.resolve(__dirname, 'src/content'),
        '@/background': path.resolve(__dirname, 'src/background'),
        '@/popup': path.resolve(__dirname, 'src/popup'),
        '@/shared': path.resolve(__dirname, 'src/shared'),
        '@/types': path.resolve(__dirname, 'src/types'),
        '@/utils': path.resolve(__dirname, 'src/utils')
      }
    },
    optimization: {
      splitChunks: false // Chrome extensions don't support code splitting
    }
  };
};