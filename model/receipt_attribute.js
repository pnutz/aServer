// receipt_attribute class
var name, datatype, group_id,
group,
TAG_TABLE = "ser_receipt_attribute_group",
TAG_COLUMN = "group_name",
SimpleTable = require("./simple_table");

// constructor
// group can be either group_id or group
function ReceiptAttribute(group, name, datatype) {
	if (name == null || datatype == null) {
		throw("receipt_attribute: invalid input");
	}
	
	if (group != null) {
		if (typeof group == "number") {
			this.group_id = group;
			this.group = null;
		} else {
			this.group_id = null;
			this.group = group;
		}
	}	else {
		this.group_id = null;
		this.group = null;
	}
	
	this.name = name;
	this.datatype = datatype;
}

// save to db
ReceiptAttribute.prototype.save = function() {
	if (this.group_id == null) {
		this.group_id = SimpleTable.save(TAG_TABLE, TAG_COLUMN, this.group);
	}

	var post = {
		attribute_name: this.name,
		data_type: this.datatype,
		group_id: this.group_id
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
};

// GET: group
Object.defineProperty(ReceiptAttribute.prototype, "group", {
	get: function() {
		if (this.group == null && this.group_id != null) {
			this.group = SimpleTable.getValueById(TAG_TABLE, TAG_COLUMN, this.group_id)
		}
		return this.group;
	}
});

module.exports = ReceiptAttribute;