// template class
var attribute_id, url_id, text_id, user_id,
attribute, url, text,
Access = require("./table_access");

// constructor
function Template(attribute_id, url_id, text_id, user_id) {
	if (attribute_id == null || url == null || user_id == null) {
		throw("template: invalid input");
	}
	
	this.attribute_id = attribute_id;
	this.attribute = null;
	
	this.url_id = url_id;
	this.url = null;
	
	if (text_id != null) {
		this.text_id = text_id;
	}	else {
		this.text_id = null;
	}
	this.text = null;
	
	this.user_id = user_id;
}

// save to db
Element.prototype.save = function() {
	var post = {
		attribute_id: this.attribute_id,
		url_id: this.url_id,
		text_id: this.text_id,
		user_id: this.user_id
	};
	
	var query = db.query("INSERT INTO ser_template SET ?", post, function(err, rows) {
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

// GET: receipt_attribute
Object.defineProperty(Template.prototype, "attribute", {
	get: function() {
		if (this.attribute == null) {
			this.attribute = Access.getReceiptAttributeById(this.attribute_id);
		}
		return this.attribute;
	}
});

// GET: url
Object.defineProperty(Template.prototype, "url", {
	get: function() {
		if (this.url == null) {
			this.url = Access.getUrlById(this.url_id);
		}
		return this.url;
	}
});

// GET: text
Object.defineProperty(Template.prototype, "text", {
	get: function() {
		if (this.text == null && this.text_id != null) {
			this.text = Access.getTextById(this.text_id);
		}
		return this.text;
	}
});


module.exports = Template;