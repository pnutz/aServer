// text class
var id, template_id, element_id, text_id, alignment, text,
_template, _element, _text,
Element = require("./element"),
Template = require("./template"),
Access = require("./simple_table");

// constructor
function Text(id, template_id, element_id, text_id, alignment, text) {
  if (template_id == null || element_id == null || alignment == null || text == null) {
    throw("text: invalid input");
  } else if (alignment != "root" && alignment != "left" && alignment != "right") {
    throw("text: invalid alignment");
  }
  
  this.id = id;
  
  this.template_id = template_id;
  this._template = null;
  
  this.element_id = element_id;
  this._element = null;
  
  this.text_id = text_id;
  this._text = null;
  
  this.alignment = alignment;
  
  this.text = text;
}

// save to db
Text.prototype.save = function(callback) {
  var local = this;
  var post = {
    template_id: local.template_id,
    element_id: local.element_id,
    text_id: local.text_id,
    alignment: local.alignment,
    text: local.text
  };
  insertText(post, function(id) {
    local.id = id;
    callback(id);
  });
};

function insertText(post, callback) {
  var query = db.query("INSERT INTO ser_text SET ?", post, function(err, result) {
    if (err) {
      db.rollback(function() {
        throw err;
      });
      callback(null);
    } else {
      console.log("Inserted ID " + result.insertId + " into ser_text");
      callback(result.insertId);
    }
  });
  console.log(query.sql);
}

// GET: template
Object.defineProperty(Text.prototype, "template", {
  get: function() {
    var local = this;
    if (local._template == null) {
      Template.getTemplateById(local.template_id, function(template) {
        local._template = template;
        return local._template;
      });
    } else {
      return local._template;
    }
  }
});

// GET: element
Object.defineProperty(Text.prototype, "element", {
  get: function() {
    var local = this;
    if (local._element == null && local.element_id != null) {
      Element.getElementById(local.element_id, function(element) {
        local._element = element;
        return local._element;
      });
    } else {
      return local._element;
    }
  }
});

// GET: text
Object.defineProperty(Text.prototype, "sibling", {
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

Text.getTextById = function(id, callback) {
  Access.selectByColumn("ser_text", "id", id, "", function(result) {
    if (result != null) {
      callback(new Text(result[0].id,
        result[0].template_id, result[0].element_id,
        result[0].text_id, result[0].alignment
      ));
    } else {
      callback(new Error("No text with ID " + id));
    }
  });
};

module.exports = Text;