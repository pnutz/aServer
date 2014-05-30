// text class
var id, template_id, element_id, text_id, alignment, text, left_text_id, right_text_id,
_text, _left, _right,
Access = require("./simple_table"),
Entities = require("html-entities").AllHtmlEntities,
entities = new Entities();

// constructor
function Text(id, template_id, element_id, text_id, alignment, text) {
  if (template_id == null || element_id == null || alignment == null || text == null) {
    throw("text: invalid input");
  } else if (alignment != "root" && alignment != "left" && alignment != "right") {
    throw("text: invalid alignment");
  }
  this.id = id;
  
  this.template_id = template_id;
  
  this.element_id = element_id;
  
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
      console.log(err.message);
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
  var query = db.query("SELECT *, CONVERT(text USING utf8) AS string_text FROM ser_text WHERE id = " + id, function(err, rows) {
    if (err) throw err;
    
    if (rows.length != 0) {
      var text = new Text(rows[0].id, rows[0].template_id,
                              rows[0].element_id, rows[0].text_id,
                              rows[0].alignment, entities.decode(rows[0].string_text));
      callback(null, text);
    } else {
      callback(new Error("No text with ID " + id));
    }
  });
  console.log(query.sql);
};

Text.getRootTextByTemplate = function(template_id, callback) {
  var query = db.query("SELECT *, CONVERT(text USING utf8) AS string_text FROM ser_text WHERE " +
                          "alignment = 'root' AND template_id = " + template_id, function(err, rows) {
    if (err) throw err;
    
    if (rows.length != 0) {
      var text = new Text(rows[0].id, rows[0].template_id,
                              rows[0].element_id, rows[0].text_id,
                              rows[0].alignment, entities.decode(rows[0].string_text));
      callback(null, text);
    } else {
      callback(new Error("No text with template ID " + template_id));
    }
  });
  console.log(query.sql);
};

Text.getTextByAlignment = function(alignment, root_id, callback) {
  var query = db.query("SELECT *, CONVERT(text USING utf8) AS string_text FROM ser_text WHERE " +
                          "text_id = " + root_id + " AND alignment = '" + alignment + "'", function(err, rows) {
    if (err) throw err;
    
    if (rows.length != 0) {
      var text = new Text(rows[0].id, rows[0].template_id,
                              rows[0].element_id, rows[0].text_id,
                              rows[0].alignment, entities.decode(rows[0].string_text));
      callback(null, text);
    } else {
      callback(new Error("No text with text ID " + root_id + " and alignment " + alignment));
    }
  });
  console.log(query.sql);
};

module.exports = Text;