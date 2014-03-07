// static simple_table class

// returns value of object in db with id. returns null if it does not exist
function getValueById(table, column, id) {
	var query = db.query("SELECT * FROM " + table + " WHERE id = ?", id, function(err, rows) {
		if (err) throw err;
		
		console.log(rows);
		if (rows.length > 0) {
			var result = rows[0];
			return result[column];
		}	else	{
			return null;
		}
	});
	
	console.log(query.sql);
};

// returns id of object in db with value. returns null if it does not exist
function getIdByValue(table, column, value) {
	var query = db.query("SELECT * FROM " + table + " WHERE " + column + " = ?", id, function(err, rows) {
		if (err) throw err;
		
		console.log(rows);
		if (rows.length > 0) {
			var result = rows[0];
			return result.id;
		}	else {
			return null;
		}
	});
	
	console.log(query.sql);
};

// saves object with value in db and returns id
function save(table, column, value) {
	// check if object with value already exists
	var resultId = getObjectByValue(table, column, value);
	
	if (resultId == null)
	{
		var post = {
			column: value
		};
		
		var query = db.query("INSERT INTO " + table + " SET ?", post, function(err, rows) {
			if (err) {
				db.rollback(function() {
					throw err;
				});
			}
			console.log(rows);
			
			if (rows.length > 0) {
				return rows[0].id;
			}
			else
			{
				return null;
			}
		});
		
		console.log(query.sql);
	} else {
		return resultId;
	}
};

module.exports = {
	getValueById: getValueById,
	getIdByValue: getIdByValue,
	save: save
};