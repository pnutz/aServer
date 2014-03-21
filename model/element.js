// element class
var id, template_id, element_id, relation, level, tag_id, html, order,
_template, _element, _tag,
TAG_TABLE = "ser_html_tag",
TAG_COLUMN = "tag_name",
Template = require("./template"),
Access = require("./simple_table");

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
      Access.save(TAG_TABLE, TAG_COLUMN, local._tag, function (tag_id) {
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
    updateElement(local.id, post, callback);
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

// GET: template
Object.defineProperty(Element.prototype, "template", {
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

// GET: tag
Object.defineProperty(Element.prototype, "tag", {
  get: function() {
    var local = this;
    if (local._tag == null) {
      Access.getValueById(TAG_TABLE, TAG_COLUMN, local.tag_id, function(tag) {
        local._tag = tag;
        return local._tag;
      });
    } else {
      return local._tag;
    }
  }
});

Element.getElementById = function(id, callback) {
  Access.selectByColumn("ser_element", "id", id, function(result) {
    if (result != null) {
      var select_element = new Element(result[0].id,
        result[0].element_id, result[0].template_id,
        result[0].tag_id, result[0].relation,
        result[0].level, result[0].html,
        result[0].order)
      callback(select_element);
    } else {
      callback(new Error("No element with ID " + id));
    }
  });
};

Element.getElementsByTemplate = function(template_id, callback) {
  Access.selectByColumn("ser_element", "template_id", template_id, function(result) {
    if (result != null) {
      // foreach
      /*callback(new Element(result.id,
        result.element_id, result.template_id,
        result.tag_id,  result.relation,
        result.level,  result.html
      ));*/
    } else {
      callback(new Error("No elements with template ID " + template_id));
    }
  });
};

module.exports = Element;