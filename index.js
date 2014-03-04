var server = require("./server"),
mysql = require("./db");

global.db = mysql.connect();

// sample use of sql queries
/*
var post = {attribute_name: "Total", data_type: "decimal"};
var query = db.query("INSERT INTO ser_receipt_attribute SET ?", post, function(err, rows) {
	if (err) throw err;
	console.log(rows);
});
console.log(query.sql);
*/

server.start();