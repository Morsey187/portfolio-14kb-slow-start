const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const BrowserSyncPlugin = require("browser-sync-webpack-plugin");
const { exec } = require("child_process");

const devMode = process.env.NODE_ENV === "development";
const DEV_PORT = 8080;
const BROWSER_SYNC_PORT = process.env.PORT || 8081;

class MinifyHtmlClassesPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tapAsync(
      "MinifyHtmlClassesPlugin",
      (_compilation, callback) => {
        exec("node minify-classes.js", (err, stdout, stderr) => {
          if (err) {
            console.error("❌ Error running class name minifier:", stderr);
          } else {
            console.log("✅ Class names minified:\n", stdout);
          }
          callback();
        });
      }
    );
  }
}

module.exports = {
  entry: ["./src/main.js"],
  output: {
    path: path.resolve(__dirname, "static"),
    filename: "[name].js",
    clean: true,
  },
  mode: devMode ? "development" : "production",
  plugins: [
    ...(devMode
      ? [
          new BrowserSyncPlugin(
            {
              host: "localhost",
              port: BROWSER_SYNC_PORT,
              server: {
                baseDir: [path.resolve(__dirname, "static")],
              },
              files: path.resolve(__dirname, "static/**/*"),
              watchOptions: {
                ignoreInitial: true,
              },
              notify: false,
              open: true,
              reloadOnRestart: true,
            },
            {
              reload: true,
            }
          ),
        ]
      : []),
    // Files are copied into static and then minified via MinifyHtmlClassesPlugin
    new CopyWebpackPlugin({
      patterns: [
        { from: "src/styles.css", to: "styles.css" },
        { from: "src/index.html", to: "index.html" },
        { from: "src/public", to: "public" },
      ],
    }),
    new MinifyHtmlClassesPlugin(),
  ],
  cache: false,
  ...(devMode && {
    devServer: {
      port: DEV_PORT,
      static: {
        directory: path.resolve(__dirname, "static"),
        watch: false, // BrowserSyncPlugin handles watching
      },
      devMiddleware: {
        writeToDisk: true,
      },
      watchFiles: {
        paths: ["src/**/*"],
      },
      liveReload: false,
      hot: false,
      compress: true,
      open: false,
    },
  }),
};
