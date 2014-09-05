var mysql = require("mysql"),
db_config = {
  host: "localhost",
  user: "db_admin",
  password: "templeton",
  database: "aServer"
};

function connect(callback) {
  // can use url string for production instead of db_config
  var connection = mysql.createConnection(db_config);
  connection.connect(function(err) {
    if (err) {
      throw err;
    }

    console.log("Connected to MySQL Database");
    return callback(connection);
  });
}

module.exports = {
  connect: connect
};
