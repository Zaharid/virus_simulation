const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const WasmPackPlugin = require("@wasm-tool/wasm-pack-plugin");

const dist = path.resolve(__dirname, "dist");


const appConfig = {

  mode: "production",
  entry: {
    index: "./js/index.js",
  },
  output: {
    path: dist,
    filename: "[name].js"
  },
  devServer: {
    contentBase: dist,
  },
  plugins: [
    new CopyPlugin([
      path.resolve(__dirname, "static")
    ])
  ],
  resolve: {
	  extensions: [".js"]
  },

  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      }
	]
   }




};

const workerConfig = {

	mode: "production",
	entry: './webworker/bootstrap.worker.js',
	target: 'webworker',
    devServer: {
      contentBase: dist,
    },
	plugins: [
		new WasmPackPlugin({
		  crateDirectory: __dirname,
		  forceMode: "production"
		})
	],
	resolve: {
		extensions: [".js", ".wasm"]
	},
	output: {
		path: dist,
		filename: "worker.js"
	}

}

module.exports = [appConfig, workerConfig];
