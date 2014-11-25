var mysql = require("mysql"),
db_config = {
  host: "us-cdbr-iron-east-01.cleardb.net",
  user: "b172f42d78e5bb",
  password: "043a4171",
  database: "heroku_ab38145fd331c3a"
};

var connection;

function initHandleDisconnect(callback) {
  connection = mysql.createConnection(db_config);

  connection.connect(function(err) {
    if (err) {
      console.log("Error when connecting to DB:", err);
      setTimeout(handleDisconnect, 2000);
    }
    console.log("Connected to MySQL Database");
  });

  // connection lost due to server restart, connection idle timeout
  connection.on("error", function(err) {
    console.log("DB Error", err);
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      handleDisconnect();
    } else {
      throw err;
    }
  });

  global.db = connection;
  return callback();
}

function handleDisconnect() {
  connection = mysql.createConnection(db_config);

  connection.connect(function(err) {
    if (err) {
      console.log("Error when connecting to DB:", err);
      setTimeout(handleDisconnect, 2000);
    }
    console.log("Reconnected to MySQL Database");
  });

  // connection lost due to server restart, connection idle timeout
  connection.on("error", function(err) {
    console.log("DB Error", err);
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      handleDisconnect();
    } else {
      throw err;
    }
  });

  global.db = connection;
}

function connect(callback) {
  initHandleDisconnect(callback);
}

module.exports = {
  connect: connect
};
