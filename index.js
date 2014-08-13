var server = require("./server"),
mysql = require("./db");
// need installation of memwatch
//var memwatch = require("memwatch");

global.db = mysql.connect();
server.start();

/*memwatch.on("leak", function(info) {
  console.log("-------------------MEMWATCH LEAK----------------------");
  console.log("------------------------------------------------------");
  console.log(info);
  console.log("------------------------------------------------------");
});

memwatch.on("stats", function(stats) {
  console.log("---------------MEMWATCH STATS (ON GC)-----------------");
  console.log("------------------------------------------------------");
  console.log(stats);
  console.log("------------------------------------------------------");
});*/
