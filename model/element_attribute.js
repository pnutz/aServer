// element_attribute class
var type_id, value_id, element_id,
type, value, element,
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
		this.type = null;
	} else {
		this.type_id = null;
		this.type = type;
	}
	
	if (typeof value == "number") {
		this.value_id = value;
		this.value = null;
	} else {
		this.value_id = null;
		this.value = value;
	}
	
	this.element_id = element_id;
	this.element = null;
}

// save to db
ElementAttribute.prototype.save = function() {
	if (this.type_id == null) {
		this.type_id = SimpleTable.save(TYPE_TABLE, TYPE_COLUMN, this.type);
	}
	if (this.value_id == null) {
		this.value_id = SimpleTable.save(VALUE_TABLE, VALUE_COLUMN, this.value);
	}
	
	var post = {
		element_id: this.element_id,
		attribute_type_id: this.type_id,
		attribute_value_id: this.value_id
	};
	
	var query = db.query("INSERT INTO ser_element_attribute SET ?", post, function(err, rows) {
		if (err) {
			db.rollback(function() {
				throw err;
			});
		}
		console.log(rows);
		return rows;
	});
	
	console.log(query.sql);
}

// GET: type
Object.defineProperty(ElementAttribute.prototype, "type", {
	get: function() {
		if (this.type == null) {
			this.type = SimpleTable.getValueById(TYPE_TABLE, TYPE_COLUMN, this.type_id);
		}
		return this.type;
	}
});

// GET: value
Object.defineProperty(ElementAttribute.prototype, "value", {
	get: function() {
		if (this.value == null) {
			this.value = SimpleTable.getValueById(VALUE_TABLE, VALUE_COLUMN, this.value_id);
		}
		return this.value;
	}
});

// GET: element
Object.defineProperty(ElementAttribute.prototype, "element", {
	get: function() {
		if (this.element == null) {
			this.element = Access.getElementById(this.element_id);
		}
		return this.element;
	}
});

module.exports = ElementAttribute;