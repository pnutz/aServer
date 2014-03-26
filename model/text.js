// text class
var id, template_id, element_id, text_id, alignment, text, left_text_id, right_text_id,
_template, _element, _text, _left, _right,
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
  set: function(callback) {
    var local = this;
    if (local._template == null) {
      Template.getTemplateById(local.template_id, function(err, template) {
        if (err) {
          callback(null);
        } else {
          local._template = template;
          callback(local._template);
        }
      });
    } else {
      callback(local._template);
    }
  }
});

// GET: element
Object.defineProperty(Text.prototype, "element", {
  set: function(callback) {
    var local = this;
    if (local._element == null && local.element_id != null) {
      Element.getElementById(local.element_id, function(err, element) {
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

// GET: text
Object.defineProperty(Text.prototype, "sibling", {
  set: function(callback) {
    var local = this;
    if (local._text == null && local.text_id != null) {
      Text.getTextById(local.text_id, function(err, text) {
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

// GET: left text node
Object.defineProperty(Text.prototype, "left", {
  set: function(callback) {
    var local = this;
    if (local._left == null && local.left_text_id == null) {
      Text.getTextByAlignment("left", local.id, function(err, text) {
        if (err) {
          local.left_text_id = -1;
          callback(null);
        } else {
          local._left = text;
          local.left_text_id = text.id;
          callback(local._left);
        }
      });
    } else {
      local.left_text_id = -1;
      callback(local._left);
    }
  }
});

// GET: right text node
Object.defineProperty(Text.prototype, "right", {
  set: function(callback) {
    var local = this;
    if (local._right == null && local.right_text_id == null) {
      Text.getTextByAlignment("right", local.id, function(err, text) {
        if (err) {
          local.right_text_id = -1;
          callback(null);
        } else {
          local._right = text;
          local.right_text_id = text.id;
          callback(local._right);
        }
      });
    } else {
      local.right_text_id = -1;
      callback(local._right);
    }
  }
});

Text.getTextById = function(id, callback) {
  Access.selectByColumn("ser_text", "id", id, "", function(result) {
    if (result != null) {
      var text = new Text(result[0].id, result[0].template_id,
                        result[0].element_id, result[0].text_id,
                        result[0].alignment, result[0].text);
      callback(null, text);
    } else {
      callback(new Error("No text with ID " + id));
    }
  });
};

Text.getTextByAlignment = function(alignment, root_id, callback) {
  Access.selectByColumn("ser_text", "text_id", root_id, "AND alignment = '" + alignment + "'", function(result) {
    if (result != null) {
      var text = new Text(result[0].id, result[0].template_id,
                        result[0].element_id, result[0].text_id,
                        result[0].alignment, result[0].text);
      callback(null, text);
    } else {
      callback(new Error("No text with text_id " + id + " and alignment " + alignment));
    }
  });
};

module.exports = Text;