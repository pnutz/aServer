// template class
var id, attribute_id, template_group_id, url_id, user_id,
async = require("async"),
Access = require("./simple_table");

// constructor
function Template(id, attribute_id, template_group_id, url_id, user_id) {
  if (attribute_id == null || url_id == null || user_id == null) {
    throw("template: invalid input");
  }  
  this.id = id;
  
  this.attribute_id = attribute_id;
  
  this.template_group_id = template_group_id;
  
  this.url_id = url_id;
  
  this.user_id = user_id;
}

// save to db
Template.prototype.save = function(callback) {
  var local = this;
  var post = {
    attribute_id: local.attribute_id,
    template_group_id: local.template_group_id,
    url_id: local.url_id,
    user_id: local.user_id
  };
  if (local.id == null) {
    insertTemplate(post, function(id) {
      local.id = id;
      callback(id);
    });
  } else {
    updateTemplate(local.id, post, callback);
  }
};

function insertTemplate(post, callback) {
  var query = db.query("INSERT INTO ser_template SET ?", post, function(err, result) {
    if (err) {
      db.rollback(function() {
        throw err;
      });
      callback(null);
    } else {
      console.log("Inserted ID " + result.insertId + " into ser_template");
      callback(result.insertId);
    }
  });
  console.log(query.sql);
}

function updateTemplate(id, post, callback) {
  var query = db.query("UPDATE ser_template SET ? WHERE id = ?", [post, id], function(err, result) {
    if (err) {
      db.rollback(function() {
        throw err;
      });
    } else {
      console.log("Updated ser_template");
    }
    callback();
  });
  console.log(query.sql);
}

Template.getTemplateById = function(id, callback) {
  Access.selectByColumn("ser_template", "id", id, "", function(result) {
    if (result != null) {
      var template = new Template(result[0].id,
        result[0].attribute_id, result[0].template_group_id,
        result[0].url_id, result[0].user_id
      );
      callback(null, template);
    } else {
      callback(new Error("No template with ID " + id));
    }
  });
};

Template.getTemplatesByGroup = function(template_group_id, func_callback) {
  Access.selectByColumn("ser_template", "template_group_id", template_group_id, "", function(result) {
    if (result != null) {
      var templates = [];
      async.eachSeries(result, function(template, callback) {
        var selected_template = new Template(template.id,
                                      template.attribute_id, template.template_group_id,
                                      template.url_id, template.user_id);
        templates.push(selected_template);
        callback();
      }, function(err) {
        if (err) {
          console.log("getTemplatesByGroup: " + err.message);
          func_callback(null);
        } else {
          func_callback(templates);
        }
      });
    } else {
      console.log("No templates selected");
      func_callback(null);
    }
  });
};

module.exports = Template;