// text class
var template_id, element_id, text_id, alignment,
template, element, text,
Access = require("./table_access");

// constructor
function Text(template_id, element_id, text_id, alignment) {
	if (template_id == null || element_id == null || text_id == null || alignment == null) {
		throw("text: invalid input");
	} else if (alignment != "root" || alignment != "left" || alignment != "right") {
		throw("text: invalid alignment");
	}
	
	this.template_id = template_id;
	this.template = null;
	
	if (element_id != null) {
		this.element_id = element_id;
	} else {
		this.element_id = null;
	}
	this.element = null;
	
	if (text_id != null) {
		this.text_id = text_id;
	}	else {
		this.text_id = null;
	}
	this.text = null;
	
	this.alignment = alignment;
}

// save to db
Element.prototype.save = function() {
	var post = {
		template_id: this.template_id,
		element_id: this.element_id,
		text_id: this.text_id,
		alignment: this.alignment
	};
	
	var query = db.query("INSERT INTO ser_text SET ?", post, function(err, rows) {
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

// GET: template
Object.defineProperty(Text.prototype, "template", {
	get: function() {
		if (this.template == null) {
			this.template = Access.getTemplateById(this.template_id);
		}
		return this.template;
	}
});

// GET: element
Object.defineProperty(Text.prototype, "element", {
	get: function() {
		if (this.element == null && this.element_id != null) {
			this.element = Access.getElementById(this.element_id);
		}
		return this.element;
	}
});

// GET: text
Object.defineProperty(Text.prototype, "text", {
	get: function() {
		if (this.text == null && this.text_id != null) {
			this.text = Access.getTextById(this.text_id);
		}
		return this.text;
	}
});

module.exports = Text;