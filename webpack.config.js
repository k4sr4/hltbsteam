const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

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
      clean: true,
      // Optimize for browser environment
      environment: {
        arrowFunction: true,
        const: true,
        destructuring: true,
        forOf: true,
        dynamicImport: false, // Chrome extensions don't support dynamic imports
        module: false
      }
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
      splitChunks: false, // Chrome extensions don't support code splitting
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              // Drop console.log in production
              drop_console: isProduction,
              drop_debugger: true,
              pure_funcs: isProduction ? ['console.log', 'console.debug'] : [],
              passes: 2, // Multiple passes for better compression
              unsafe: false, // Don't use unsafe optimizations
              unsafe_comps: false,
              unsafe_math: false,
              unsafe_proto: false,
              warnings: false
            },
            mangle: {
              // Mangle names but keep class names for debugging
              keep_classnames: !isProduction,
              keep_fnames: !isProduction,
              safari10: true
            },
            format: {
              comments: false, // Remove all comments
              ascii_only: true, // Ensure compatibility
              ecma: 2020
            },
            ecma: 2020,
            module: false,
            toplevel: false, // Don't mangle top-level names (Chrome extension compatibility)
            keep_classnames: !isProduction,
            keep_fnames: !isProduction
          },
          extractComments: false, // Don't extract comments to separate file
          parallel: true // Use multiple cores
        })
      ],
      // Tree shaking
      usedExports: true,
      sideEffects: false,
      // Module concatenation for smaller bundles
      concatenateModules: true,
      // Optimize module IDs
      moduleIds: 'deterministic',
      chunkIds: 'deterministic'
    },
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 500000, // 500KB target
      maxAssetSize: 500000
    },
    stats: {
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false,
      assets: true,
      assetsSort: 'size'
    }
  };
};