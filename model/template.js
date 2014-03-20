// template class
var id, attribute_id, url_id, text_id, user_id,
_attribute, _url, _text,
SimpleTable = require("./simple_table");

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
    if (this._attribute == null) {
      this._attribute = Access.getReceiptAttributeById(this.attribute_id);
    }
    return this._attribute;
  }
});

// GET: url
Object.defineProperty(Template.prototype, "url", {
  get: function() {
    if (this._url == null) {
      this._url = Access.getUrlById(this.url_id);
    }
    return this._url;
  }
});

// GET: text
Object.defineProperty(Template.prototype, "text", {
  get: function() {
    if (this._text == null && this.text_id != null) {
      this._text = Access.getTextById(this.text_id);
    }
    return this._text;
  }
});

Template.getTemplateById = function(id, callback) {
  SimpleTable.selectByColumn("ser_template", "id", id, function(result) {
    if (result != null) {
      callback(new Template(result.id,
        result.attribute_id, result.url_id,
        result.text_id, result.user_id
      ));
    } else {
      callback(null);
    }
  });
};

module.exports = Template;