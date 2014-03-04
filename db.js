var mysql = require("mysql"),
db_config = {
	host: "localhost",
	user: "db_admin",
	password: "templeton",
	database: "aServer"
};

exports.connect = function() {
	// can use url string for production instead of db_config
	var connection = mysql.createConnection(db_config);
	connection.connect(function(err) {
		if (err) throw err;
	});
	
	return connection;
}