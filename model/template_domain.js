// template_domain class
var template_id, domain_id, probability_success, variance,
DOMAIN_TABLE = "ser_domain",
DOMAIN_COLUMN = "domain_name",
async = require("async"),
Access = require("./simple_table"),
Template = require("./template");

// constructor
// domain can be either domain_id or domain
function TemplateDomain(template_id, domain, probability, variance) {
  if (template_id == null || domain == null) {
    throw("template_domain: invalid input");
  }

  this.template_id = template_id;
  
  if (typeof domain == "number") {
    this.domain_id = domain;
    this._domain = null;
  } else {
    this.domain_id = null;
    this._domain = domain;
  }
  
  this.probability_success = probability;
  this.variance = variance;
}

// save to db
TemplateDomain.prototype.save = function(callback) {
  var local = this;
  // check if domain exists in db
  if (local.domain_id == null) {
    Access.save(DOMAIN_TABLE, DOMAIN_COLUMN, local._domain, function (domain_id) {
      local.domain_id = domain_id;
      var post = {
        template_id: local.template_id,
        domain_id: local.domain_id,
        probability_success: local.probability_success,
        variance: local.variance
      };
      insertTemplateDomain(post, callback);
    });
  }
  // we know domain already exists in db
  else {
    var post = {
      template_id: local.template_id,
      domain_id: local.domain_id,
      probability_success: local.probability_success,
      variance: local.variance
    };
    insertTemplateDomain(post, callback);
  }
};

function insertTemplateDomain(post, callback) {
  var query = db.query("INSERT INTO ser_template_domain SET ?", post, function(err, result) {
    if (err) {
      db.rollback(function() {
        throw err;
      });
    } else {
      console.log("Inserted into ser_template_domain");
    }
    callback();
  });
  console.log(query.sql);
}

function updateTemplateDomain(template_id, domain_id, post, callback) {
  var query = db.query("UPDATE ser_template_domain SET ? WHERE template_id = ? AND domain_id = ?", [post, template_id, domain_id], function(err, result) {
    if (err) {
      db.rollback(function() {
        throw err;
      });
    } else {
      console.log("Updated ser_template_domain");
    }
    callback();
  });
  console.log(query.sql);
}

// GET: domain
Object.defineProperty(TemplateDomain.prototype, "domain", {
  set: function() {
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

TemplateDomain.getTemplatesByDomain = function(domain_id, attribute_id, func_callback) {
  var query = db.query("SELECT * FROM ser_template_domain INNER JOIN ser_template ON ser_template_domain.template_id = ser_template.id " +
                "WHERE ser_template_domain.domain_id = " + domain_id + " AND ser_template.attribute_id = " + attribute_id +
                " ORDER BY ser_template_domain.probability_success DESC", function(err, rows) {
    if (err) throw err;
    
    if (rows.length != 0) {
      var result = rows;
      var templates = [];
      async.eachSeries(result, function(template, callback) {
        var selected_template = new Template(template.id,
                                      template.attribute_id, template.template_group_id, 
                                      template.url_id, template.user_id);
        templates.push(selected_template);
        callback();
      }, function(err) {
        if (err) {
          console.log("getTemplatesByDomain: " + err.message);
          func_callback(null);
        } else {
          func_callback(templates);
        }
      });
    }
    else {
      console.log("No templates selected");
      func_callback(null);
    }
  });
  console.log(query.sql);
};

module.exports = TemplateDomain;