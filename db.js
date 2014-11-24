var mysql = require("mysql"),
db_config = {
  host: "",
  user: "b45957d24bf225",
  password: "286efb23",
  database: "heroku_32915eb1e9538bf"
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
