// template class
var id;
var attributeId;
var templateGroupId;
var urlId;
var userId;
var async = require("async");
var Access = require("./simple_table");
var Element = require("./element");

// constructor
function Template(id, attributeId, templateGroupId, urlId, userId) {
  if (attributeId == null || urlId == null || userId == null) {
    throw("template: invalid input");
  }
  this.id = id;

  this.attributeId = attributeId;

  this.templateGroupId = templateGroupId;

  this.urlId = urlId;

  this.userId = userId;
}

// save to db
Template.prototype.save = function(callback) {
  var local = this;
  var post = {
    attribute_id: local.attributeId,
    template_group_id: local.templateGroupId,
    url_id: local.urlId,
    user_id: local.userId
  };
  if (local.id == null) {
    insertTemplate(post, function(id) {
      local.id = id;
      return callback(id);
    });
  } else {
    updateTemplate(local.id, post, callback);
  }
};

function insertTemplate(post, callback) {
  var query = db.query("INSERT INTO ser_template SET ?", post, function(err, result) {
    if (err) {
      console.log(err.message);
      db.rollback(function() {
        throw err;
      });
      return callback(null);
    } else {
      console.log("Inserted ID " + result.insertId + " into ser_template");
      return callback(result.insertId);
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
    return callback();
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
      return callback(null, template);
    } else {
      return callback(new Error("No template with ID " + id));
    }
  });
};

Template.getTemplatesByGroup = function(templateGroupId, funcCallback) {
  Access.selectByColumn("ser_template", "template_group_id", templateGroupId, "", function(result) {
    if (result != null) {
      var templates = [];
      async.eachSeries(result, function(template, callback) {
        var selectedTemplate = new Template(template.id,
                                      template.attribute_id, template.template_group_id,
                                      template.url_id, template.user_id);
        templates.push(selectedTemplate);
        return callback();
      }, function(err) {
        if (err) {
          console.log("getTemplatesByGroup: " + err.message);
          return funcCallback(null);
        } else {
          return funcCallback(templates);
        }
      });
    } else {
      console.log("No templates selected");
      return funcCallback(null);
    }
  });
};

Template.getTextTemplatesByGroup = function(templateGroupId, callback) {
  // select all templates (& left/right text) with domainId, attributeId
  var selectQuery = "SELECT a.id, a.attribute_id, CONVERT(b.text USING utf8) AS left_text, CONVERT(c.text USING utf8) AS right_text";
  var joinQuery = " FROM ser_template AS a LEFT JOIN ser_text AS b ON a.id = b.template_id AND b.alignment = 'left'" +
                  " LEFT JOIN ser_text AS c ON a.id = c.template_id AND c.alignment = 'right'";
  var clauseQuery = " WHERE a.template_group_id = " + templateGroupId;

  var query = db.query(selectQuery + joinQuery + clauseQuery, null, function(err, result) {
    if (err) {
      console.log(err.message);
      db.rollback(function() {
        return callback(new Error(err));
      });
    } else {
      return callback(null, result);
    }
  });
  console.log(query.sql);
};

Template.getTemplatesByElementPath = function(domainId, attributeId, callback) {
  // select all templates (& left/right text) with domainId, attributeId
  var selectQuery = "SELECT a.id, CONVERT(c.text USING utf8) AS left_text, CONVERT(d.text USING utf8) AS right_text";
  var joinQuery = " FROM ser_template AS a INNER JOIN ser_template_domain AS b ON a.id = b.template_id LEFT JOIN" +
                  " ser_text AS c ON a.id = c.template_id AND c.alignment = 'left' LEFT JOIN ser_text AS d ON a.id = d.template_id AND d.alignment = 'right'";
  var clauseQuery = " WHERE a.attribute_id = " + attributeId +" AND b.domain_id = " + domainId;

  var query = db.query(selectQuery + joinQuery + clauseQuery, null, function(err, result) {
    if (err) {
      console.log(err.message);
      db.rollback(function() {
        return callback(new Error(err));
      });
    } else {
      return callback(null, result);
    }
  });
  console.log(query.sql);
};

module.exports = Template;
