// complex table accessor functions
var Element = require("./element"),
ElementAttribute = require("./element_attribute"),
Template = require("./template"),
ReceiptAttribute = require("./receipt_attribute"),
Url = require("./url"),
Text = require("./text");

// runs callback on selected rows, null if no rows selected
function selectByColumn(table, column, id, callback) {
	var query = db.query("SELECT * FROM " + table + " WHERE " + column + " = ?", id, function(err, rows) {
		if (err) throw err;
		
		if (rows.length != 0) {
			var result = rows[0];
			callback(result);
		}
		else if (callback) {
			console.log("No rows selected");
			callback(null);
		}
	});
	console.log(query.sql);
}

function getElementById(id, callback) {
	selectByColumn("ser_element", "id", id, function(result) {
		if (result != null) {
			callback(new Element(result.id,
				result.element_id, result.template_id,
				result.tag_id,	result.relation,
				result.level,	result.html
			));
		} else {
			callback(null);
		}
	});
}

function getElementsByTemplate(template_id, callback) {
	selectByColumn("ser_element", "template_id", template_id, function(result) {
		if (result != null) {
			// foreach
			/*callback(new Element(result.id,
				result.element_id, result.template_id,
				result.tag_id,	result.relation,
				result.level,	result.html
			));*/
		} else {
			callback(null);
		}
	});
}

function getElementAttributesByElement(element_id, callback) {
	selectByColumn("ser_element_attribute", "element_id", element_id, function(result) {
		if (result != null) {
			// foreach
			/*callback(new ElementAttribute(
				result.id, result.attribute_type_id, result.attribute_value_id, result.element_id
			));*/
		} else {
			callback(null);
		}
	});
}

function getReceiptAttributeById(id, callback) {
	selectByColumn("ser_receipt_attribute", "id", id, function(result) {
		if (result != null) {
			callback(new ReceiptAttribute(
				result.id, result.group_id, result.attribute_name, result.data_type
			));
		} else {
			callback(null);
		}
	});
}

function getTemplateById(id, callback) {
	selectByColumn("ser_template", "id", id, function(result) {
		if (result != null) {
			callback(new Template(result.id,
				result.attribute_id, result.url_id,
				result.text_id, result.user_id
			));
		} else {
			callback(null);
		}
	});
}

function getTextById(id, callback) {
	selectByColumn("ser_text", "id", id, function(result) {
		if (result != null) {
			callback(new Text(result.id,
				result.template_id, result.element_id,
				result.text_id, result.alignment
			));
		} else {
			callback(null);
		}
	});
}

function getUrlById(id, callback) {
	selectByColumn("ser_url", "id", id, function(result) {
		if (result != null) {
			callback(new Url(result.id,
				result.domain_id, result.url,
				result.html, result.text
			));
		} else {
			callback(null);
		}
	});
}

module.exports = {
	getElementById: getElementById,
	getElementsByTemplate: getElementsByTemplate,
	getElementAttributesByElement: getElementAttributesByElement,
	getReceiptAttributeById: getReceiptAttributeById,
	getTemplateById: getTemplateById,
	getTextById: getTextById,
	getUrlById: getUrlById
};