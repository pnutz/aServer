// element_attribute class
var type_id, value_id, element_id,
_type, _value, _element,
TYPE_TABLE = "ser_element_attribute_type",
TYPE_COLUMN = "attribute_type",
VALUE_TABLE = "ser_element_attribute_value",
VALUE_COLUMN = "attribute_value",
SimpleTable = require("./simple_table"),
Element = require("./element"),
Access = require("./table_access");

// constructor
// type/value can be either type_id/value_id or type/value
function ElementAttribute(type, value, element_id) {
	if (type == null || value == null || element_id == null) {
		throw("element_attribute: invalid input");
	}
	
	if (typeof type == "number") {
		this.type_id = type;
		this._type = null;
	} else {
		this.type_id = null;
		this._type = type;
	}
	
	if (typeof value == "number") {
		this.value_id = value;
		this._value = null;
	} else {
		this.value_id = null;
		this._value = value;
	}

	this.element_id = element_id;
	this._element = null;
}

// save to db
ElementAttribute.prototype.save = function(callback) {
	var local = this;
	// check if type exists in db
	if (local.type_id == null && local.value_id == null) {
		SimpleTable.save(TYPE_TABLE, TYPE_COLUMN, local._type, function(type_id) {
			local.type_id = type_id;
			// check if type & value exist in db
			if (local.value_id == null) {
				SimpleTable.save(VALUE_TABLE, VALUE_COLUMN, local._value, function(value_id) {
					local.value_id = value_id;
					var post = {
						attribute_type_id: local.type_id,
						attribute_value_id: local.value_id,
						element_id: local.element_id
					};
					insertElementAttribute(post, function() {
						callback();
					});
				});
			} else {
				var post = {
					attribute_type_id: local.type_id,
					attribute_value_id: local.value_id,
					element_id: local.element_id
				};
				insertElementAttribute(post, function() {
					callback();
				});
			}
		});
	}
	// we know type already exists in db
	else if (local.value_id == null) {
		SimpleTable.save(VALUE_TABLE, VALUE_COLUMN, local._value, function(value_id) {
			local.value_id = value_id;
			var post = {
				attribute_type_id: local.type_id,
				attribute_value_id: local.value_id,
				element_id: local.element_id
			};
			insertElementAttribute(post, function() {
				callback();
			});
		});
	}
	// we know value & type already exist in db
	else {
		var post = {
			attribute_type_id: local.type_id,
			attribute_value_id: local.value_id,
			element_id: local.element_ids
		};
		insertElementAttribute(post, function() {
			callback();
		});
	}
}

function insertElementAttribute(post, callback) {
	var query = db.query("INSERT INTO ser_element_attribute SET ?", post, function(err, result) {
		if (err) {
			db.rollback(function() {
				throw err;
			});
			callback(null);
		} else {
			console.log("Inserted into ser_element_attribute");
			callback();
		}
	});
	console.log(query.sql);
}

// GET: type
Object.defineProperty(ElementAttribute.prototype, "type", {
	get: function() {
		if (this._type == null) {
			this._type = SimpleTable.getValueById(TYPE_TABLE, TYPE_COLUMN, this.type_id);
		}
		return this._type;
	}
});

// GET: value
Object.defineProperty(ElementAttribute.prototype, "value", {
	get: function() {
		if (this._value == null) {
			this._value = SimpleTable.getValueById(VALUE_TABLE, VALUE_COLUMN, this.value_id);
		}
		return this._value;
	}
});

// GET: element
Object.defineProperty(ElementAttribute.prototype, "element", {
	get: function() {
		if (this._element == null) {
			this._element = Access.getElementById(this.element_id);
		}
		return this._element;
	}
});

module.exports = ElementAttribute;