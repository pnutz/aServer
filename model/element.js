// element class
var template_id, element_id, relation, level, tag_id, html,
template, element, tag,
TAG_TABLE = "ser_html_tag",
TAG_COLUMN = "tag_name",
SimpleTable = require("./simple_table"),
Access = require("./table_access"),
Template = require("./template");

// constructor
// tag can be either tag_id or tag
function Element(element_id, template_id, tag, relation, level, html) {
	if (template_id == null || relation == null || level == null || tag == null || html == null) {
		throw("element: invalid input");
	} else if (relation != "root" || relation != "sibling" || relation != "child" || relation != "parent") {
		throw("element: invalid relation");
	}
	
	if (element_id != null) {
		this.element_id = element_id;
	} else {
		this.element_id = null;
	}
	this.element = null;

	this.template_id = template_id;
	this.template = null;
	
	if (typeof tag == "number") {
		this.tag_id = tag;
		this.tag = null;
	} else {
		this.tag_id = null;
		this.tag = tag;
	}
	
	this.relation = relation;
	this.level = level;
	this.html = html;
}

// save to db
Element.prototype.save = function() {
	if (this.tag_id == null) {
		this.tag_id = SimpleTable.save(TAG_TABLE, TAG_COLUMN, this.tag);
	}

	var post = {
		template_id: this.template_id,
		element_id: this.element_id,
		relation: this.relation,
		level: this.level,
		tag_id: this.tag_id,
		html: this.html
	};
	
	var query = db.query("INSERT INTO ser_element SET ?", post, function(err, rows) {
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

// GET: element
Object.defineProperty(Element.prototype, "element", {
	get: function() {
		if (this.element == null && this.element_id != null) {
			this.element = Access.getElementById(this.element_id);
		}
		return this.element;
	}
});

// GET: template
Object.defineProperty(Element.prototype, "template", {
	get: function() {
		if (this.template == null) {
			this.template = Access.getTemplateById(this.template_id);
		}
		return this.template;
	}
});

// GET: tag
Object.defineProperty(Element.prototype, "tag", {
	get: function() {
		if (this.tag == null) {
			this.tag = SimpleTable.getValueById(TAG_TABLE, TAG_COLUMN, this.tag_id)
		}
		return this.tag;
	}
});

module.exports = Element;