// static simple_table class

// helper function: runs callback on selected rows, null if no rows selected
function selectByColumn(table, column, id, queryadd, callback) {
  var query = db.query("SELECT * FROM " + table + " WHERE " + column + " = " + id + " " + queryadd, function(err, rows) {
    if (err) throw err;
    
    if (rows.length != 0) {
      var result = rows;
      callback(result);
    }
    else {
      console.log("No rows selected");
      callback(null);
    }
  });
  console.log(query.sql);
}

// returns value of object in db with id. returns null if it does not exist
function getValueById(table, column, id, callback) {
  var query = db.query("SELECT * FROM " + table + " WHERE id = ?", id, function(err, rows) {
    if (err) throw err;
    
    if (rows.length != 0) {
      var result = rows[0];
      console.log(result);
      callback(result[column]);
    } else {
      console.log("No rows selected");
      callback(null);
    }
  });
  console.log(query.sql);
};

// returns id of object in db with value. returns null if it does not exist
function getIdByValue(table, column, value, callback) {
  var query = db.query("SELECT * FROM " + table + " WHERE " + column + " = ?", value, function(err, rows) {
    if (err) throw err;
    
    if (rows.length != 0) {
      var result = rows[0];
      console.log(result);
      callback(result.id);
    } else {
      console.log("No rows selected");
      callback(null);
    }
  });
  console.log(query.sql);
};

// saves object with value in db and returns id
function save(table, column, value, callback) {
  // check if object with value already exists
  getIdByValue(table, column, value, function(resultId) {
    if (resultId == null)
    {
      var post = {};
      post[column] = value;
      
      var query = db.query("INSERT INTO " + table + " SET ?", post, function(err, result) {
        if (err) {
          db.rollback(function() {
            throw err;
          });
          callback(null);
        } else {
          console.log("Inserted ID " + result.insertId + " into " + table);
          callback(result.insertId);
        }
      });
      console.log(query.sql);
    } else {
      callback(resultId);
    }
  });
};

module.exports = {
  selectByColumn: selectByColumn,
  getValueById: getValueById,
  getIdByValue: getIdByValue,
  save: save
};