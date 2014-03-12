// text class
var id, template_id, element_id, text_id, alignment,
_template, _element, _text,
Access = require("./table_access");

// constructor
function Text(id, template_id, element_id, text_id, alignment) {
	if (template_id == null || element_id == null || text_id == null || alignment == null) {
		throw("text: invalid input");
	} else if (alignment != "root" || alignment != "left" || alignment != "right") {
		throw("text: invalid alignment");
	}
	
	this.id = id;
	
	this.template_id = template_id;
	this._template = null;
	
	this.element_id = element_id;
	this._element = null;
	
	this.text_id = text_id;
	this._text = null;
	
	this.alignment = alignment;
}

// save to db
Text.prototype.save = function(callback) {
	var post = {
		template_id: this.template_id,
		element_id: this.element_id,
		text_id: this.text_id,
		alignment: this.alignment
	};
	insertText(post, function(id) {
		this.id = id;
		callback(id);
	});
};

function insertText(post, callback) {
	var query = db.query("INSERT INTO ser_text SET ?", post, function(err, result) {
		if (err) {
			db.rollback(function() {
				throw err;
			});
			callback(null);
		} else {
			console.log("Inserted ID " + result.insertId + " into ser_text");
			callback(result.insertId);
		}
	});
	console.log(query.sql);
}

// GET: template
Object.defineProperty(Text.prototype, "template", {
	get: function() {
		if (this._template == null) {
			this._template = Access.getTemplateById(this.template_id);
		}
		return this._template;
	}
});

// GET: element
Object.defineProperty(Text.prototype, "element", {
	get: function() {
		if (this._element == null && this.element_id != null) {
			this._element = Access.getElementById(this.element_id);
		}
		return this._element;
	}
});

// GET: text
Object.defineProperty(Text.prototype, "text", {
	get: function() {
		if (this._text == null && this.text_id != null) {
			this._text = Access.getTextById(this.text_id);
		}
		return this._text;
	}
});

module.exports = Text;