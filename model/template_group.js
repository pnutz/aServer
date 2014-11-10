// template_group class
var id, domain_id, group_id, probability_success, variance, correct_count, total_count,
_domain,
DOMAIN_TABLE = "ser_domain",
DOMAIN_COLUMN = "domain_name",
async = require("async"),
Access = require("./simple_table");

// constructor
// domain can be either domain_id or domain
function TemplateGroup(id, domain, group_id, probability, variance, correct_count, total_count) {
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
  this.correct_count = correct_count;
  this.total_count = total_count;
}

// save to db
TemplateGroup.prototype.save = function(callback) {
  var local = this;
  // check if id exists and domain exists in db
  if (local.id == null && local.domain_id == null) {
    Access.save(DOMAIN_TABLE, DOMAIN_COLUMN, local._domain, function (domain_id) {
      debugger;
      local.domain_id = domain_id;
      var post = {
        domain_id: local.domain_id,
        group_id: local.group_id,
        probability_success: local.probability_success,
        variance: local.variance,
        correct_count: local.correct_count,
        total_count: local.total_count
      };
      insertTemplateGroup(post, callback);
    });
  }
  // check if id exists in db
  else if (local.id == null) {
    var post = {
      domain_id: local.domain_id,
      group_id: local.group_id,
      probability_success: local.probability_success,
      variance: local.variance,
      correct_count: local.correct_count,
      total_count: local.total_count
    };
    insertTemplateGroup(post, callback);
  }
  // we know id/domain already exists in db
  else {
    var post = {
      domain_id: local.domain_id,
      group_id: local.group_id,
      probability_success: local.probability_success,
      variance: local.variance,
      correct_count: local.correct_count,
      total_count: local.total_count
    };
    updateTemplateGroup(local.id, post, callback);
  }
};

function insertTemplateGroup(post, callback) {
  var query = db.query("INSERT INTO ser_template_group SET ?", post, function(err, result) {
    if (err) {
      console.log(err.message);
      db.rollback(function() {
        throw err;
      });
      callback(null);
    } else {
      console.log("Inserted into ser_template_group");
      callback(result.insertId);
    }
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
      console.log("Updated ser_template_group");
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

TemplateGroup.getTemplateGroupById = function(id, callback) {
  Access.selectByColumn("ser_template_group", "id", id, "",
    function(result) {
      if (result != null) {
        var selected_group = new TemplateGroup(result[0].id, result[0].domain_id,
                                              result[0].group_id, result[0].probability,
                                              result[0].variance, result[0].correct_count, result[0].total_count);
        callback(selected_group);
      } else {
        console.log("No template_group selected");
        callback(null);
      }
    }
  );
};

TemplateGroup.getTemplateGroups = function(group_id, domain_id, func_callback) {
  Access.selectByColumn("ser_template_group", "group_id", group_id, "AND domain_id = " + domain_id +
                        " AND probability_success > 0.1 " +
                        "ORDER BY probability_success DESC LIMIT 20",
    function(result) {
      if (result != null) {
        var groups = [];
        async.eachSeries(result, function(group, callback) {
          var selected_group = new TemplateGroup(group.id, group.domain_id,
                                                group.group_id, group.probability,
                                                group.variance, group.correct_count, group.total_count);
          groups.push(selected_group);
          callback();
        }, function(err) {
          if (err) {
            console.log("getTemplateGroups: " + err.message);
            func_callback(null);
          } else {
            func_callback(groups);
          }
        });
      } else {
        console.log("No template_groups selected");
        func_callback(null);
      }
    }
  );
};

module.exports = TemplateGroup;
