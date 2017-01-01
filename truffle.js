module.exports = {
  build: {
    "index.html": "index.html",
	"app.js": [
      "javascripts/app.js"
    ],
	"spark-MD5.js":[
	   "javascripts/spark-MD5.js"
	],
	"jquery-3.1.1.min.js":[
	   "javascripts/jquery-3.1.1.min.js"
	],
	"bootstrap.min.js":[
	   "javascripts/bootstrap.min.js"
	],
    "main.css": [
      "stylesheets/main.css"
    ],
	"bootstrap.min.css":[
	  "stylesheets/bootstrap.min.css"
	],
    "images/": "images/",
	"fonts/": "fonts/"
  },
  rpc: {
    host: "localhost",
    port: 8545
  }
};
