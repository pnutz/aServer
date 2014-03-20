// text class
var id, template_id, element_id, text_id, alignment, text,
_template, _element, _text,
SimpleTable = require("./simple_table");

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
    if (this._template == null) {
      this._template = Access.getTemplateById(this.template_id);
    }
    return this._template;
  }
});

// GET: element
Object.defineProperty(Text.prototype, "element", {
  get: function() {
    if (this._element == null && this.element_id != null) {
      this._element = Access.getElementById(this.element_id);
    }
    return this._element;
  }
});

// GET: text
Object.defineProperty(Text.prototype, "sibling", {
  get: function() {
    if (this._text == null && this.text_id != null) {
      this._text = Access.getTextById(this.text_id);
    }
    return this._text;
  }
});

Text.getTextById = function(id, callback) {
  SimpleTable.selectByColumn("ser_text", "id", id, function(result) {
    if (result != null) {
      callback(new Text(result.id,
        result.template_id, result.element_id,
        result.text_id, result.alignment
      ));
    } else {
      callback(null);
    }
  });
};

module.exports = Text;