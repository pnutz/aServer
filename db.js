var mysql = require("mysql"),
db_config = {
	host: "localhost",
	user: "root",
	password: "",
	database: "db_name"
};

exports.connect = function() {
	var connection = mysql.createConnection(db_config);
	connection.connect();
}