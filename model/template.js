// template class
var id, attribute_id, url_id, text_id, user_id,
_attribute, _url, _text,
Url = require("./url"),
Text = require("./text"),
Access = require("./simple_table");

// constructor
function Template(id, attribute_id, url_id, text_id, user_id) {
  if (attribute_id == null || url_id == null || user_id == null) {
    throw("template: invalid input");
  }
  
  this.id = id;
  
  this.attribute_id = attribute_id;
  this._attribute = null;
  
  this.url_id = url_id;
  this._url = null;
  
  this.text_id = text_id;
  this._text = null;
  
  this.user_id = user_id;
}

// save to db
Template.prototype.save = function(callback) {
  var local = this;
  var post = {
    attribute_id: local.attribute_id,
    url_id: local.url_id,
    text_id: local.text_id,
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
  get: function() {
    var local = this;
    if (local._attribute == null) {
      Template.getReceiptAttributeById(local.attribute_id, function(attribute) {
        local._attribute = attribute;
        return local._attribute;
      });
    } else {
      return local._attribute;
    }
  }
});

// GET: url
Object.defineProperty(Template.prototype, "url", {
  get: function() {
    var local = this;
    if (local._url == null) {
      Url.getUrlById(local.url_id, function(url) {
        local._url = url;
        return local._url;
      });
    } else {
      return local._url;
    }
  }
});

// GET: text
Object.defineProperty(Template.prototype, "text", {
  get: function() {
    var local = this;
    if (local._text == null && local.text_id != null) {
      Text.getTextById(local.text_id, function(text) {
        local._text = text;
        return local._text;
      });
    } else {
      return local._text;
    }
  }
});

Template.getTemplateById = function(id, callback) {
  Access.selectByColumn("ser_template", "id", id, function(result) {
    if (result != null) {
      callback(new Template(result[0].id,
        result[0].attribute_id, result[0].url_id,
        result[0].text_id, result[0].user_id
      ));
    } else {
      callback(new Error("No template with ID " + id));
    }
  });
};

module.exports = Template;