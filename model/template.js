// template class
var id, attribute_id, template_group_id, url_id, user_id,
_attribute, _url, _text, _element,
Url = require("./url"),
Text = require("./text"),
Element = require("./element"),
Access = require("./simple_table");

// constructor
function Template(id, attribute_id, template_group_id, url_id, user_id) {
  if (attribute_id == null || url_id == null || user_id == null) {
    throw("template: invalid input");
  }  
  this.id = id;
  
  this.attribute_id = attribute_id;
  this._attribute = null;
  
  this.template_group_id = template_group_id;
  
  this.url_id = url_id;
  this._url = null;
  
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

// GET: receipt_attribute
Object.defineProperty(Template.prototype, "attribute", {
  set: function(callback) {
    var local = this;
    if (local._attribute == null) {
      ReceiptAttribute.getReceiptAttributeById(local.attribute_id, function(err, attribute) {
        if (err) {
          callback(null);
        } else {
          local._attribute = attribute;
          callback(local._attribute);
        }
      });
    } else {
      callback(local._attribute);
    }
  }
});

// GET: url
Object.defineProperty(Template.prototype, "url", {
  set: function(callback) {
    var local = this;
    if (local._url == null) {
      Url.getUrlById(local.url_id, function(err, url) {
        if (err) {
          callback(null);
        } else {
          local._url = url;
          callback(local._url);
        }
      });
    } else {
      callback(local._url);
    }
  }
});

// GET: text
Object.defineProperty(Template.prototype, "text", {
  set: function(callback) {
    var local = this;
    if (local._text == null) {
      Text.getRootTextByTemplate(local.id, function(err, text) {
        if (err) {
          callback(null);
        } else {
          local._text = text;
          callback(local._text);
        }
      });
    } else {
      callback(local._text);
    }
  }
});

// GET: element
Object.defineProperty(Template.prototype, "element", {
  set: function(callback) {
    var local = this;
    if (local._element == null) {
      Element.getRootElementByTemplate(local.id, function(err, element) {
        if (err) {
          callback(null);
        } else {
          local._element = element;
          callback(local._element);
        }
      });
    } else {
      callback(local._element);
    }
  }
});

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

Template.getTemplatesByGroup = function(template_group_id, callback) {
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
      callback(null, template);
    } else {
      callback(new Error("No rows selected"));
    }
  });
};

module.exports = Template;