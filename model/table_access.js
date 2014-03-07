// complex table accessor functions
var Element = require("./element"),
Template = require("./template"),
ReceiptAttribute = require("./receipt_attribute"),
Url = require("./url"),
Text = require("./text");

function getElementById(id) {
	var query = db.query("SELECT * FROM ser_element WHERE id = ?", id, function(err, rows) {
		if (err) throw err;
		
		console.log(rows);
		if (rows.length > 0) {
			var result = rows[0];
			return new Element(
				result.element_id, result.template_id,
				result.tag_id,	result.relation,
				result.level,	result.html
			);
		}
		else
		{
			return null;
		}
	});
	
	console.log(query.sql);
}

function getElementsByTemplate(template_id) {
	var query = db.query("SELECT * FROM ser_element WHERE template_id = ?", template_id, function(err, rows) {
		if (err) {
			db.rollback(function() {
				throw err;
			});
		}
		console.log(rows);
		return rows;
	});
	// create array and push to it each element
	console.log(query.sql);
}

function getReceiptAttributeById(id) {
	var query = db.query("SELECT * FROM ser_receipt_attribute WHERE id = ?", id, function(err, rows) {
		if (err) throw err;
		
		console.log(rows);
		if (rows.length > 0) {
			var result = rows[0];
			return new ReceiptAttribute(
				result.group_id, result.attribute_name, result.data_type
			);
		}
		else
		{
			return null;
		}
	});
	
	console.log(query.sql);
}

function getTemplateById(id) {
	var query = db.query("SELECT * FROM ser_template WHERE id = ?", id, function(err, rows) {
		if (err) throw err;
		
		console.log(rows);
		if (rows.length > 0) {
			var result = rows[0];
			return new Template(
				result.attribute_id, result.url_id,
				result.text_id, result.user_id
			);
		}
		else
		{
			return null;
		}
	});
	
	console.log(query.sql);
}

function getTextById(id) {
	var query = db.query("SELECT * FROM ser_text WHERE id = ?", id, function(err, rows) {
		if (err) throw err;
		
		console.log(rows);
		if (rows.length > 0) {
			var result = rows[0];
			return new Text(
				
			);
		}
		else
		{
			return null;
		}
	});
	
	console.log(query.sql);
}

function getUrlById(id) {
	var query = db.query("SELECT * FROM ser_url WHERE id = ?", id, function(err, rows) {
		if (err) throw err;
		
		console.log(rows);
		if (rows.length > 0) {
			var result = rows[0];
			return new Url(
				result.domain_id, result.url
				result.html, result.text
			);
		}
		else
		{
			return null;
		}
	});
	
	console.log(query.sql);
}

module.exports = {
	getElementById: getElementById,
	getElementsByTemplate: getElementsByTemplate,
	getReceiptAttributeById: getReceiptAttributeById,
	getTemplateById: getTemplateById,
	getTextById: getTextById,
	getUrlById: getUrlById
};