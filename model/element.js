// element class
var id, template_id, element_id, relation, level, tag_id, html,
_template, _element, _tag,
TAG_TABLE = "ser_html_tag",
TAG_COLUMN = "tag_name",
SimpleTable = require("./simple_table"),
Access = require("./table_access"),
Template = require("./template");

// constructor
// tag can be either tag_id or tag
function Element(id, element_id, template_id, tag, relation, level, html) {
	if (template_id == null || relation == null || level == null || tag == null || html == null) {
		throw("element: invalid input");
	} else if (relation != "root" && relation != "sibling" && relation != "child" && relation != "parent") {
		throw("element: invalid relation");
	}
	
	this.id = id;
	
	this.element_id = element_id;
	this._element = null;

	this.template_id = template_id;
	this._template = null;
	
	if (typeof tag == "number") {
		this.tag_id = tag;
		this._tag = null;
	} else {
		this.tag_id = null;
		this._tag = tag;
	}
	
	this.relation = relation;
	this.level = level;
	this.html = html;
}

// save to db
Element.prototype.save = function(callback) {
	var local = this;
	// check if tag exists in db
	if (local.tag_id == null) {
		SimpleTable.save(TAG_TABLE, TAG_COLUMN, local._tag, function (tag_id) {
			local.tag_id = tag_id;
			var post = {
				template_id: local.template_id,
				element_id: local.element_id,
				relation: local.relation,
				level: local.level,
				tag_id: local.tag_id,
				html: local.html
			};
			insertElement(post, function(id) {
				local.id = id;
				callback(id);
			});
		});
	}
	// we know tag already exists in db
	else {
		var post = {
			template_id: local.template_id,
			element_id: local.element_id,
			relation: local.relation,
			level: local.level,
			tag_id: local.tag_id,
			html: local.html
		};
	
		insertElement(post, function(id) {
			local.id = id;
			callback(id);
		});
	}
};

function insertElement(post, callback) {
	var query = db.query("INSERT INTO ser_element SET ?", post, function(err, result) {
		if (err) {
			db.rollback(function() {
				throw err;
			});
			callback(null);
		} else {
			console.log("Inserted ID " + result.insertId + " into ser_element");
			callback(result.insertId);
		}
	});
	console.log(query.sql);
}

// GET: element
Object.defineProperty(Element.prototype, "element", {
	get: function() {
		if (this._element == null && this.element_id != null) {
			this._element = Access.getElementById(this.element_id);
		}
		return this._element;
	}
});

// GET: template
Object.defineProperty(Element.prototype, "template", {
	get: function() {
		if (this._template == null) {
			this._template = Access.getTemplateById(this.template_id);
		}
		return this._template;
	}
});

// GET: tag
Object.defineProperty(Element.prototype, "tag", {
	get: function() {
		if (this._tag == null) {
			this._tag = SimpleTable.getValueById(TAG_TABLE, TAG_COLUMN, this.tag_id)
		}
		return this._tag;
	}
});

module.exports = Element;