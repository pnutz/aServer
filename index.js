var server = require("./server"),
mysql = require("./db");

global.db = mysql.connect();
server.start();