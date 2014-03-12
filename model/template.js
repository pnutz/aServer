// template class
var id, attribute_id, url_id, text_id, user_id,
_attribute, _url, _text,
Access = require("./table_access");

// constructor
function Template(id, attribute_id, url_id, text_id, user_id) {
	if (attribute_id == null || url_id == null || user_id == null) {
		throw("template: invalid input");
	}
	
	this.id = id;
	
	this.attribute_id = attribute_id;
	this._attribute = null;
	
	this.url_id = url_id;
	this._url = null;
	
	this.text_id = text_id;
	this._text = null;
	
	this.user_id = user_id;
}

// save to db
Template.prototype.save = function(callback) {
	var post = {
		attribute_id: this.attribute_id,
		url_id: this.url_id,
		text_id: this.text_id,
		user_id: this.user_id
	};
	insertTemplate(post, function(id) {
		this.id = id;
		callback(id);
	});
};

function insertTemplate(post, callback) {
	var query = db.query("INSERT INTO ser_template SET ?", post, function(err, result) {
		if (err) {
			db.rollback(function() {
				throw err;
			});
			callback(null);
		} else {
			console.log("Inserted ID " + result.insertId + " into ser_template");
			callback(result.insertId);
		}
	});
	console.log(query.sql);
}

// GET: receipt_attribute
Object.defineProperty(Template.prototype, "attribute", {
	get: function() {
		if (this._attribute == null) {
			this._attribute = Access.getReceiptAttributeById(this.attribute_id);
		}
		return this._attribute;
	}
});

// GET: url
Object.defineProperty(Template.prototype, "url", {
	get: function() {
		if (this._url == null) {
			this._url = Access.getUrlById(this.url_id);
		}
		return this._url;
	}
});

// GET: text
Object.defineProperty(Template.prototype, "text", {
	get: function() {
		if (this._text == null && this.text_id != null) {
			this._text = Access.getTextById(this.text_id);
		}
		return this._text;
	}
});

module.exports = Template;