// element class
var template_id, element_id, relation, level, tag_id, html;

// constructor
function Element(template_id, element_id, relation, level, tag_id, html) {
	this.template_id = template_id;
	if (element_id !== null) {
		this.element_id = element_id;
	}
	this.relation = relation;
	this.level = level;
	this.tag_id = tag_id;
	this.html = html;
	
	save();
}
exports = Element;

// insert
function save() {
	var post = {
		template_id: template_id,
		element_id: element_id,
		relation: relation,
		level: level,
		tag_id: tag_id,
		html: html
	};
	
	var query = db.query("INSERT INTO ser_element SET ?", post, function(err, rows) {
		if (err) throw err;
		console.log(rows);
		return rows;
	});
	
	console.log(query.sql);
}

function getElementById(id) {
	var query = db.query("SELECT * FROM ser_element WHERE id = ?", id, function(err, rows) {
		if (err) throw err;
		console.log(rows);
		return rows;
	});
	
	console.log(query.sql);
}

function getElementsByTemplate(template_id) {
	var query = db.query("SELECT * FROM ser_element WHERE template_id = ?", template_id, function(err, rows) {
		if (err) throw err;
		console.log(rows);
		return rows;
	});
	
	console.log(query.sql);
}