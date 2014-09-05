var server = require("./server");
var mysql = require("./db");
var async = require("async");

async.series([
  function(callback) {
    mysql.connect(function(connection) {
      global.db = connection;
      return callback();
    });
  },
  function(callback) {
    server.start();
    return callback();
  }
]);
