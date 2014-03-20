// element class
var id, template_id, element_id, relation, level, tag_id, html, order,
_template, _element, _tag,
TAG_TABLE = "ser_html_tag",
TAG_COLUMN = "tag_name",
SimpleTable = require("./simple_table"),
Template = require("./template");

// constructor
// tag can be either tag_id or tag
function Element(id, element_id, template_id, tag, relation, level, html, order) {
  if (template_id == null || relation == null || level == null || tag == null || html == null) {
    throw("element: invalid input");
  } else if (relation != "root" && relation != "sibling" && relation != "child" && relation != "parent") {
    throw("element: invalid relation");
  }
  
  this.id = id;
  
  this.element_id = element_id;
  this._element = null;

  this.template_id = template_id;
  this._template = null;
  
  if (typeof tag == "number") {
    this.tag_id = tag;
    this._tag = null;
  } else {
    this.tag_id = null;
    this._tag = tag;
  }
  
  this.relation = relation;
  this.level = level;
  this.html = html;
  this.order = order;
}

// save to db
Element.prototype.save = function(callback) {
  var local = this;
  // check if tag exists in db
  var post = {
    template_id: local.template_id,
    element_id: local.element_id,
    relation: local.relation,
    level: local.level,
    tag_id: local.tag_id,
    html: local.html,
    order: local.order
  };
  
  if (local.id == null) {
    if (local.tag_id == null) {
      SimpleTable.save(TAG_TABLE, TAG_COLUMN, local._tag, function (tag_id) {
        local.tag_id = tag_id;
        post = {
          template_id: local.template_id,
          element_id: local.element_id,
          relation: local.relation,
          level: local.level,
          tag_id: local.tag_id,
          html: local.html,
          order: local.order
        };
        insertElement(post, function(id) {
          local.id = id;
          callback(id);
        });
      });
    }
    // we know tag already exists in db
    else {
      insertElement(post, function(id) {
        local.id = id;
        callback(id);
      });
    }
  } else {
    updateElement(local.id, post, function() {
      callback();
    });
  }
};

function insertElement(post, callback) {
  var query = db.query("INSERT INTO ser_element SET ?", post, function(err, result) {
    if (err) {
      db.rollback(function() {
        throw err;
      });
      callback(null);
    } else {
      console.log("Inserted ID " + result.insertId + " into ser_element");
      callback(result.insertId);
    }
  });
  console.log(query.sql);
}

function updateElement(id, post, callback) {
  var query = db.query("UPDATE ser_element SET ? WHERE id = ?", [post, id], function(err, result) {
    if (err) {
      db.rollback(function() {
        throw err;
      });
    } else {
      console.log("Updated ser_element");
    }
    callback();
  });
  console.log(query.sql);
}

// GET: element
Object.defineProperty(Element.prototype, "element", {
  get: function() {
    if (this._element == null && this.element_id != null) {
      this._element = Access.getElementById(this.element_id);
    }
    return this._element;
  }
});

// GET: template
Object.defineProperty(Element.prototype, "template", {
  get: function() {
    if (this._template == null) {
      this._template = Access.getTemplateById(this.template_id);
    }
    return this._template;
  }
});

// GET: tag
Object.defineProperty(Element.prototype, "tag", {
  get: function() {
    if (this._tag == null) {
      this._tag = SimpleTable.getValueById(TAG_TABLE, TAG_COLUMN, this.tag_id)
    }
    return this._tag;
  }
});

Element.getElementById = function(id, callback) {
  SimpleTable.selectByColumn("ser_element", "id", id, function(result) {
    if (result != null) {
      var select_element = new Element(result.id,
        result.element_id, result.template_id,
        result.tag_id, result.relation,
        result.level, result.html,
        result.order)
      callback(select_element);
    } else {
      callback(null);
    }
  });
};

Element.getElementsByTemplate = function(template_id, callback) {
  SimpleTable.selectByColumn("ser_element", "template_id", template_id, function(result) {
    if (result != null) {
      // foreach
      /*callback(new Element(result.id,
        result.element_id, result.template_id,
        result.tag_id,  result.relation,
        result.level,  result.html
      ));*/
    } else {
      callback(null);
    }
  });
};

module.exports = Element;