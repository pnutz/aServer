// url class
var id, url, domain_id,
_domain,
DOMAIN_TABLE = "ser_domain",
DOMAIN_COLUMN = "domain_name",
Access = require("./simple_table");

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
    Access.save(DOMAIN_TABLE, DOMAIN_COLUMN, local._domain, function (domain_id) {
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
  set: function(callback) {
    var local = this;
    if (local._domain == null) {
      Access.getValueById(DOMAIN_TABLE, DOMAIN_COLUMN, local.domain_id, function(domain) {
        local._domain = domain;
        callback(local._domain);
      });
    } else {
      callback(local._domain);
    }
  }
});

Url.getUrlById = function(id, callback) {
  Access.selectByColumn("ser_url", "id", id, "", function(result) {
    if (result != null) {
      callback(new Url(result[0].id,
        result[0].domain_id, result[0].url,
        result[0].html, result[0].text
      ));
    } else {
      callback(new Error("No url with ID " + id));
    }
  });
};

module.exports = Url;