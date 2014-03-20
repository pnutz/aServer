// url class
var id, url, domain_id,
_domain,
DOMAIN_TABLE = "ser_domain",
DOMAIN_COLUMN = "domain_name",
SimpleTable = require("./simple_table");

// constructor
// domain can be either domain_id or domain
function Url(id, domain, url) {
  if (domain == null || url == null) {
    throw("url: invalid input");
  }
  
  this.id = id;
  
  if (typeof domain == "number") {
    this.domain_id = domain;
    this._domain = null;
  } else {
    this.domain_id = null;
    this._domain = domain;
  }
  
  this.url = url;
}

// save to db
Url.prototype.save = function(callback) {
  var local = this;
  // check if domain exists in db
  if (local.domain_id == null) {
    SimpleTable.save(DOMAIN_TABLE, DOMAIN_COLUMN, local._domain, function (domain_id) {
      local.domain_id = domain_id;
      var post = {
        url: local.url,
        domain_id: local.domain_id
      };
      insertUrl(post, function(id) {
        local.id = id;
        callback(id);
      });
    });
  }
  // we know domain already exists in db
  else {
    var post = {
      url: local.url,
      domain_id: local.domain_id
    };
  
    insertUrl(post, function(id) {
      local.id = id;
      callback(id);
    });
  }
};

function insertUrl(post, callback) {
  var query = db.query("INSERT INTO ser_url SET ?", post, function(err, result) {
    if (err) {
      db.rollback(function() {
        throw err;
      });
      callback(null);
    } else {
      console.log("Inserted ID " + result.insertId + " into ser_url");
      callback(result.insertId);
    }
  });
  console.log(query.sql);
}

// GET: domain
Object.defineProperty(Url.prototype, "domain", {
  get: function() {
    if (this._domain == null) {
      this._domain = SimpleTable.getValueById(DOMAIN_TABLE, DOMAIN_COLUMN, this.domain_id)
    }
    return this._domain;
  }
});

Url.getUrlById = function(id, callback) {
  SimpleTable.selectByColumn("ser_url", "id", id, function(result) {
    if (result != null) {
      callback(new Url(result.id,
        result.domain_id, result.url,
        result.html, result.text
      ));
    } else {
      callback(null);
    }
  });
};

module.exports = Url;