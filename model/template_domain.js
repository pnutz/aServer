// template_domain class
var template_id, domain_id, probability_success, variance,
_template, _domain,
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
  this._template = null;
  
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

// GET: template
Object.defineProperty(TemplateDomain.prototype, "template", {
  set: function(callback) {
    var local = this;
    if (local._template == null) {
      Template.getTemplateById(local.template_id, function(template) {
        local._template = template;
        callback(local._template);
      });
    } else {
      callback(local._template);
    }
  }
});

TemplateDomain.getTemplatesByDomain = function(domain_id, func_callback) {
  Access.selectByColumn("ser_template_domain", "domain_id", domain_id, "ORDER BY probability_success DESC", function(result) {
    if (result != null) {
      var templates = [];
      async.eachSeries(result, function(template, callback) {
        Template.getTemplateById(template.template_id, function(selected_template) {
          templates.push(selected_template);
          callback();
        });
      }, function(err) {
        if (err) {
          console.log("getTemplatesByDomain: " + err.message);
          func_callback(null);
        } else {
          func_callback(templates);
        }
      });
    } else {
      func_callback(null);
    }
  });
};

module.exports = TemplateDomain;