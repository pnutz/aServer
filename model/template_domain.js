// template_domain class
var id, template_id, domain_id, probability_success, variance, correct_count, total_count,
DOMAIN_TABLE = "ser_domain",
DOMAIN_COLUMN = "domain_name",
async = require("async"),
Access = require("./simple_table"),
Template = require("./template");

// constructor
// id represents if the template_domain exists in db
// domain can be either domain_id or domain
function TemplateDomain(id, template_id, domain, probability, variance, correct_count, total_count) {
  if (template_id == null || domain == null) {
    throw("template_domain: invalid input");
  }
  
  this.id = id;
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
  this.correct_count = correct_count;
  this.total_count = total_count;
}

// save to db
TemplateDomain.prototype.save = function(callback) {
  var local = this;
  
  async.series([
    // create domain if it doesn't exist
    function(series_callback) {
      if (local.domain_id == null) {
        Access.save(DOMAIN_TABLE, DOMAIN_COLUMN, local._domain, function (domain_id) {
          local.domain_id = domain_id;
          series_callback();
        });
      } else {
        series_callback();
      }
    },
    // insert template_domain or update template_domain if it does not exist in db
    function(series_callback) {
      var post = {
        template_id: local.template_id,
        domain_id: local.domain_id,
        probability_success: local.probability_success,
        variance: local.variance,
        correct_count: local.correct_count,
        total_count: local.total_count
      };
      
      if (local.id == null) {
        insertTemplateDomain(post, function() {
          local.id = 1;
          series_callback();
        });
      } else {
        updateTemplateDomain(post, series_callback);
      }
    }
  ], function(err, results) {
    if (err) {
      console.log(err.message);
    }
    callback();
  });
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

function updateTemplateDomain(post, callback) {
  var query = db.query("UPDATE ser_template_domain SET ? WHERE template_id = ? AND domain_id = ?", [post, post.template_id, post.domain_id], function(err, result) {
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
                " AND ser_template.template_group_id IS NULL ORDER BY ser_template_domain.probability_success DESC", function(err, rows) {
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

TemplateDomain.getTemplateDomainByIds = function(domain_id, template_id, callback) {
  Access.selectByColumn("ser_template_domain", "template_id", template_id, "AND domain_id = " + domain_id,
    function(result) {
      if (result != null) {
        var template_domain = new TemplateDomain(1, result[0].template_id, result[0].domain_id,
                                                result[0].probability_success, result[0].variance,
                                                result[0].correct_count, result[0].total_count);
        callback(template_domain);
      } else {
        console.log("No template_domain selected");
        callback(null);
      }
    }
  );
};

TemplateDomain.getTemplateDomainsByGroup = function(template_group_id, func_callback) {
  var query = db.query("SELECT * FROM ser_template_domain INNER JOIN ser_template ON ser_template_domain.template_id = ser_template.id " +
                "WHERE ser_template.template_group_id = " + template_group_id, function(err, rows) {
    if (err) throw err;
    
    if (rows.length != 0) {
      var result = rows;
      var template_domains = [];
      async.eachSeries(result, function(template_domain, callback) {
        var selected_template_domain = new TemplateDomain(1, template_domain.template_id,
                                      template_domain.domain_id, template_domain.probability_success, 
                                      template_domain.variance, template_domain.correct_count, template_domain.total_count);
        template_domains.push(selected_template_domain);
        callback();
      }, function(err) {
        if (err) {
          console.log("getTemplateDomainsByGroup: " + err.message);
          func_callback(null);
        } else {
          func_callback(template_domains);
        }
      });
    }
    else {
      console.log("No template domains selected");
      func_callback(null);
    }
  });
  console.log(query.sql);
};

module.exports = TemplateDomain;