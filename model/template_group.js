// template_group class
var id, domain_id, group_id, probability_success, variance,
_domain,
DOMAIN_TABLE = "ser_domain",
DOMAIN_COLUMN = "domain_name",
async = require("async"),
Access = require("./simple_table"),
Template = require("./template");

// constructor
// domain can be either domain_id or domain
function TemplateGroup(id, domain, group_id, probability, variance) {
  if (domain == null || group_id == null) {
    throw("template_group: invalid input");
  }

  this.id = id;
  
  if (typeof domain == "number") {
    this.domain_id = domain;
    this._domain = null;
  } else {
    this.domain_id = null;
    this._domain = domain;
  }
  
  this.group_id = group_id;
  this.probability_success = probability;
  this.variance = variance;
}

// save to db
TemplateGroup.prototype.save = function(callback) {
  var local = this;
  // check if domain exists in db
  if (local.domain_id == null) {
    Access.save(DOMAIN_TABLE, DOMAIN_COLUMN, local._domain, function (domain_id) {
      local.domain_id = domain_id;
      var post = {
        domain_id: local.domain_id,
        group_id: local.group_id,
        probability_success: local.probability_success,
        variance: local.variance
      };
      insertTemplateGroup(post, callback);
    });
  }
  // we know domain already exists in db
  else {
    var post = {
      domain_id: local.domain_id,
      group_id: local.group_id
      probability_success: local.probability_success,
      variance: local.variance
    };
    insertTemplateGroup(post, callback);
  }
};

function insertTemplateGroup(post, callback) {
  var query = db.query("INSERT INTO ser_template_group SET ?", post, function(err, result) {
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

function updateTemplateGroup(id, post, callback) {
  var query = db.query("UPDATE ser_template_group SET ? WHERE id = ?", [post, id], function(err, result) {
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
Object.defineProperty(TemplateGroup.prototype, "domain", {
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

TemplateGroup.getGroupsByDomain = function(group_id, domain_id, func_callback) {
  Access.selectByColumn("ser_template_group", "group_id", group_id, "AND domain_id = " + domain_id + " ORDER BY probability_success DESC",
    function(result) {
      if (result != null) {
        var groups = [];
        async.eachSeries(result, function(group, callback) {
          var selected_group = new TemplateGroup(group.id, group.domain_id, group.group_id, group.probability, group.variance);
          groups.push(selected_group);
          callback();
        }, function(err) {
          if (err) {
            console.log("getTemplatesByGroup: " + err.message);
            func_callback(null);
          } else {
            func_callback(groups);
          }
        });
      } else {
        callback(new Error("No rows selected"));
      }
    }
  );
};

module.exports = TemplateGroup;