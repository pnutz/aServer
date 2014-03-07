// url class
var url, domain_id, html, text,
domain,
DOMAIN_TABLE = "ser_domain",
DOMAIN_COLUMN = "domain_name",
SimpleTable = require("./simple_table");

// constructor
// domain can be either domain_id or domain
function Url(domain, url, html, text) {
	if (domain == null || url == null) {
		throw("url: invalid input");
	}
	
	if (typeof domain == "number") {
		this.domain_id = domain;
		this.domain = null;
	} else {
		this.domain_id = null;
		this.domain = domain;
	}
	
	this.url = url;
	
	if (html != null) {
		this.html = html;
	}
	
	if (text != null) {
		this.text = text;
	}
}

// save to db
Url.prototype.save = function() {
	if (this.domain_id == null) {
		this.domain_id = SimpleTable.save(DOMAIN_TABLE, DOMAIN_COLUMN, this.domain);
	}

	var post = {
		url: this.url,
		domain_id: this.domain_id,
		html: this.html,
		text: this.text
	};
	
	var query = db.query("INSERT INTO ser_url SET ?", post, function(err, rows) {
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

// GET: domain
Object.defineProperty(Url.prototype, "domain", {
	get: function() {
		if (this.domain == null) {
			this.domain = SimpleTable.getValueById(DOMAIN_TABLE, DOMAIN_COLUMN, this.domain_id)
		}
		return this.domain;
	}
});

module.exports = Url;