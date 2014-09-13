// element class
var id;
var template_id;
var tag_id;
var _tag;
var index;
var order;

var TAG_TABLE = "ser_html_tag";
var TAG_COLUMN = "tag_name";
var async = require("async");
var Access = require("./simple_table");

// constructor
// tag can be either tag_id or tag
function Element(id, template_id, tag, index, order) {
  if (template_id == null || index == null || tag == null) {
    throw("element: invalid input");
  }
  this.id = id;

  this.template_id = template_id;

  if (typeof tag == "number") {
    this.tag_id = tag;
    this._tag = null;
  } else {
    this.tag_id = null;
    this._tag = tag;
  }

  this.index = index;
  this.order = order;
}

// save to db
Element.prototype.save = function(callback) {
  var local = this;
  // check if tag exists in db
  var post = {
    template_id: local.template_id,
    index: local.index,
    tag_id: local.tag_id,
    order: local.order
  };

  if (local.id == null) {
    if (local.tag_id == null) {
      Access.save(TAG_TABLE, TAG_COLUMN, local._tag, function (tag_id) {
        local.tag_id = tag_id;
        post = {
          template_id: local.template_id,
          index: local.index,
          tag_id: local.tag_id,
          order: local.order
        };
        insertElement(post, function(id) {
          local.id = id;
          return callback(id);
        });
      });
    }
    // we know tag already exists in db
    else {
      insertElement(post, function(id) {
        local.id = id;
        return callback(id);
      });
    }
  } else {
    updateElement(local.id, post, callback);
  }
};

function insertElement(post, callback) {
  var query = db.query("INSERT INTO ser_element SET ?", post, function(err, result) {
    if (err) {
      console.log(err.message);
      db.rollback(function() {
        throw err;
      });
      return callback(null);
    } else {
      console.log("Inserted ID " + result.insertId + " into ser_element");
      return callback(result.insertId);
    }
  });
  console.log(query.sql);
}

function updateElement(id, post, callback) {
  var query = db.query("UPDATE ser_element SET ? WHERE id = ?", [post, id], function(err, result) {
    if (err) {
      console.log(err.message);
      db.rollback(function() {
        throw err;
      });
    } else {
      console.log("Updated ser_element");
    }
    return callback();
  });
  console.log(query.sql);
}

// GET: tag
Object.defineProperty(Element.prototype, "tag", {
  set: function(callback) {
    var local = this;
    if (local._tag == null) {
      Access.getValueById(TAG_TABLE, TAG_COLUMN, local.tag_id, function(tag) {
        local._tag = tag;
        return callback(local._tag);
      });
    } else {
      return callback(local._tag);
    }
  }
});

Element.getElementById = function(id, callback) {
  Access.selectByColumn("ser_element", "id", id, "", function(result) {
    if (result != null) {
      var element = new Element(result[0].id,
        result[0].template_id, result[0].tag_id,
        result[0].index, result[0].order);
      callback(null, element);
    } else {
      callback(new Error("No element with id " + id));
    }
  });
};

// exclude elements with index of -1 (children of root element)
Element.getElementPathByTemplate = function(templateId, callback) {
  var statement = "SELECT a.*, b.tag_name AS tag FROM ser_element AS a INNER JOIN ser_html_tag AS b ON a.tag_id = b.id " +
                "WHERE a.template_id = " + templateId + " AND a.index >= 0 ORDER BY a.index";
  var query = db.query(statement, function(err, rows) {
    if (rows != null) {
      var elementPath = [];
      for (var i = 0; i < rows.length; i++) {
        elementPath.push(new Element(rows[i].id, rows[i].template_id,
                                     rows[i].tag_id, rows[i].index, rows[i].order));
        // set _tag as html tag
        elementPath[i]._tag = rows[i].tag;
      }

      return callback(null, elementPath);
    } else {
      return callback(new Error("No elements for templateId " + templateId));
    }
  });
  console.log(query.sql);
};

module.exports = Element;
