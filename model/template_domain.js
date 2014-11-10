// template_domain class
var id;
var templateId;
var _domain;
var domainId;
var probabilitySuccess;
var variance;
var correctCount;
var totalCount;
var DOMAIN_TABLE = "ser_domain";
var DOMAIN_COLUMN = "domain_name";
var async = require("async");
var Access = require("./simple_table");
var Template = require("./template");

// constructor
// id represents if the templateDomain exists in db
// domain can be either domain_id or domain
function TemplateDomain(id, templateId, domain, probability, variance, correctCount, totalCount) {
  if (templateId == null || domain == null) {
    throw("templateDomain: invalid input");
  }

  this.id = id;
  this.templateId = templateId;

  if (typeof domain == "number") {
    this.domainId = domain;
    this._domain = null;
  } else {
    this.domainId = null;
    this._domain = domain;
  }

  this.probabilitySuccess = probability;
  this.variance = variance;
  this.correctCount = correctCount;
  this.totalCount = totalCount;
}

// save to db
TemplateDomain.prototype.save = function(callback) {
  var local = this;

  async.series([
    // create domain if it doesn't exist
    function(seriesCallback) {
      if (local.domainId == null) {
        Access.save(DOMAIN_TABLE, DOMAIN_COLUMN, local._domain, function (domainId) {
          local.domainId = domainId;
          return seriesCallback();
        });
      } else {
        return seriesCallback();
      }
    },
    // insert template_domain or update template_domain if it does not exist in db
    function(seriesCallback) {
      var post = {
        template_id: local.templateId,
        domain_id: local.domainId,
        probability_success: local.probabilitySuccess,
        variance: local.variance,
        correct_count: local.correctCount,
        total_count: local.totalCount
      };

      if (local.id == null) {
        insertTemplateDomain(post, function() {
          local.id = 1;
          return seriesCallback();
        });
      } else {
        updateTemplateDomain(post, seriesCallback);
      }
    }
  ], function(err, results) {
    if (err) {
      console.log(err.message);
    }
    return callback();
  });
};

function insertTemplateDomain(post, callback) {
  var query = db.query("INSERT INTO ser_template_domain SET ?", post, function(err, result) {
    if (err) {
      console.log(err.message);
      db.rollback(function() {
        throw err;
      });
    } else {
      console.log("Inserted into ser_template_domain");
    }
    return callback();
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
    return callback();
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
        return callback(local._domain);
      });
    } else {
      return callback(local._domain);
    }
  }
});

TemplateDomain.getTemplatesByDomain = function(domainId, attributeId, funcCallback) {
  var query = db.query("SELECT * FROM ser_template_domain INNER JOIN ser_template ON ser_template_domain.template_id = ser_template.id " +
                "WHERE ser_template_domain.domain_id = " + domainId +
                " AND ser_template.attribute_id = " + attributeId +
                " AND ser_template.template_group_id IS NULL " +
                "AND ser_template_domain.probability_success > 0.1 " +
                "ORDER BY ser_template_domain.probability_success DESC LIMIT 20", function(err, rows) {
    if (err) throw err;

    if (rows.length != 0) {
      var result = rows;
      var templates = [];
      async.eachSeries(result, function(template, callback) {
        var selectedTemplate = new Template(template.id,
                                      template.attribute_id, template.template_group_id,
                                      template.url_id, template.user_id);
        templates.push(selectedTemplate);
        return callback();
      }, function(err) {
        if (err) {
          console.log("getTemplatesByDomain: " + err.message);
          return funcCallback(null);
        } else {
          return funcCallback(templates);
        }
      });
    }
    else {
      console.log("No templates selected");
      return funcCallback(null);
    }
  });
  console.log(query.sql);
};

TemplateDomain.getTemplateDomainByIds = function(domainId, templateId, callback) {
  Access.selectByColumn("ser_template_domain", "template_id", templateId, "AND domain_id = " + domainId,
    function(result) {
      if (result != null) {
        var templateDomain = new TemplateDomain(1, result[0].template_id, result[0].domain_id,
                                                result[0].probability_success, result[0].variance,
                                                result[0].correct_count, result[0].total_count);
        return callback(templateDomain);
      } else {
        console.log("No template_domain selected");
        return callback(null);
      }
    }
  );
};

TemplateDomain.getTemplateDomainsByGroup = function(templateGroupId, funcCallback) {
  var query = db.query("SELECT * FROM ser_template_domain INNER JOIN ser_template ON ser_template_domain.template_id = ser_template.id " +
                "WHERE ser_template.template_group_id = " + templateGroupId +
                " AND ser_template_domain.probability_success > 0.1 " +
                "ORDER BY ser_template_domain.probability_success DESC LIMIT 20", function(err, rows) {
    if (err) throw err;

    if (rows.length != 0) {
      var result = rows;
      var templateDomains = [];
      async.eachSeries(result, function(template_domain, callback) {
        var selectedTemplateDomain = new TemplateDomain(1, template_domain.template_id,
                                      template_domain.domain_id, template_domain.probability_success,
                                      template_domain.variance, template_domain.correct_count, template_domain.total_count);
        templateDomains.push(selectedTemplateDomain);
        callback();
      }, function(err) {
        if (err) {
          console.log("getTemplateDomainsByGroup: " + err.message);
          return funcCallback(null);
        } else {
          return funcCallback(templateDomains);
        }
      });
    }
    else {
      console.log("No template domains selected");
      return funcCallback(null);
    }
  });
  console.log(query.sql);
};

module.exports = TemplateDomain;
