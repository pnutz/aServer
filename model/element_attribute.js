// element_attribute class
var type_id, value_id, element_id,
_type, _value, _element,
TYPE_TABLE = "ser_element_attribute_type",
TYPE_COLUMN = "attribute_type",
VALUE_TABLE = "ser_element_attribute_value",
VALUE_COLUMN = "attribute_value",
Element = require("./element"),
Access = require("./simple_table");

// constructor
// type/value can be either type_id/value_id or type/value
function ElementAttribute(type, value, element_id) {
  if (type == null || value == null || element_id == null) {
    throw("element_attribute: invalid input");
  }
  
  if (typeof type == "number") {
    this.type_id = type;
    this._type = null;
  } else {
    this.type_id = null;
    this._type = type;
  }
  
  if (typeof value == "number") {
    this.value_id = value;
    this._value = null;
  } else {
    this.value_id = null;
    this._value = value;
  }

  this.element_id = element_id;
  this._element = null;
}

// save to db
ElementAttribute.prototype.save = function(callback) {
  var local = this;
  // check if type exists in db
  if (local.type_id == null && local.value_id == null) {
    Access.save(TYPE_TABLE, TYPE_COLUMN, local._type, function(type_id) {
      local.type_id = type_id;
      // check if type & value exist in db
      if (local.value_id == null) {
        Access.save(VALUE_TABLE, VALUE_COLUMN, local._value, function(value_id) {
          local.value_id = value_id;
          var post = {
            attribute_type_id: local.type_id,
            attribute_value_id: local.value_id,
            element_id: local.element_id
          };
          insertElementAttribute(post, callback);
        });
      } else {
        var post = {
          attribute_type_id: local.type_id,
          attribute_value_id: local.value_id,
          element_id: local.element_id
        };
        insertElementAttribute(post, callback);
      }
    });
  }
  // we know type already exists in db
  else if (local.value_id == null) {
    Access.save(VALUE_TABLE, VALUE_COLUMN, local._value, function(value_id) {
      local.value_id = value_id;
      var post = {
        attribute_type_id: local.type_id,
        attribute_value_id: local.value_id,
        element_id: local.element_id
      };
      insertElementAttribute(post, callback);
    });
  }
  // we know value & type already exist in db
  else {
    var post = {
      attribute_type_id: local.type_id,
      attribute_value_id: local.value_id,
      element_id: local.element_ids
    };
    insertElementAttribute(post, callback);
  }
}

function insertElementAttribute(post, callback) {
  var query = db.query("INSERT INTO ser_element_attribute SET ?", post, function(err, result) {
    if (err) {
      db.rollback(function() {
        throw err;
      });
      callback(null);
    } else {
      console.log("Inserted into ser_element_attribute");
      callback();
    }
  });
  console.log(query.sql);
}

// GET: type
Object.defineProperty(ElementAttribute.prototype, "type", {
  set: function(callback) {
    var local = this;
    if (local._type == null) {
      Access.getValueById(TYPE_TABLE, TYPE_COLUMN, local.type_id, function(type) {
        local._type = type;
        callback(local._type);
      });
    } else {
      callback(local._type);
    }
  }
});

// GET: value
Object.defineProperty(ElementAttribute.prototype, "value", {
  set: function() {
    var local = this;
    if (local._value == null) {
      Access.getValueById(VALUE_TABLE, VALUE_COLUMN, local.value_id, function(value) {
        local._value = value;
        callback(local._value);
      });
    } else {
      callback(local._value);
    }
  }
});

// GET: element
Object.defineProperty(ElementAttribute.prototype, "element", {
  set: function(callback) {
    var local = this;
    if (local._element == null) {
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

// find attribute_type_id of attribute, check if attr exists for element, find attribute_value
ElementAttribute.getAttributeByElement = function(attribute, element_id, callback) {
  Access.getIdByValue(TYPE_TABLE, TYPE_COLUMN, attribute, function(type_id) {
    if (type_id != null) {
      Access.selectByColumn("ser_element_attribute", "element_id", element_id, "AND attribute_type_id = " + type_id, function(element_attribute) {
        if (element_attribute != null) {
          Access.getValueById(VALUE_TABLE, VALUE_COLUMN, element_attribute[0].attribute_value_id, callback);
        } else {
          callback(null);
        }
      });
    } else {
      callback(null);
    }
  });
};

ElementAttribute.getElementAttributesByElement = function(element_id, callback) {
  Access.selectByColumn("ser_element_attribute", "element_id", element_id, "", function(result) {
    if (result != null) {
      // foreach
      /*callback(new ElementAttribute(
        result.id, result.attribute_type_id, result.attribute_value_id, result.element_id
      ));*/
    } else {
      callback(null);
    }
  });
};

module.exports = ElementAttribute;