// receipt_attribute class
var id, name, datatype, group_id,
_group,
GROUP_TABLE = "ser_receipt_attribute_group",
GROUP_COLUMN = "group_name",
Access = require("./simple_table");

// constructor
// group can be either group_id or group
function ReceiptAttribute(id, group, name, datatype) {
  if (name == null || datatype == null) {
    throw("receipt_attribute: invalid input");
  }
  
  this.id = id;

  if (typeof group == "number") {
    this.group_id = group;
    this._group = null;
  } else {
    this.group_id = null;
    this._group = group;
  }
  
  this.name = name;
  this.datatype = datatype;
}

// save to db
ReceiptAttribute.prototype.save = function(callback) {
  var local = this;
  // check if group exists in db
  if (local.group_id == null && local._group != null) {
    Access.save(GROUP_TABLE, GROUP_COLUMN, local._group, function(group_id) {
      local.group_id = group_id;
      var post = {
        attribute_name: this.name,
        data_type: this.datatype,
        group_id: this.group_id
      };
      insertReceiptAttribute(post, function(id) {
        local.id = id;
        callback(id);
      });
    });
  }
  // we know group already exists in db
  else {
    var post = {
      attribute_name: this.name,
      data_type: this.datatype,
      group_id: this.group_id
    };
    insertReceiptAttribute(post, function(id) {
      local.id = id;
      callback(id);
    });
  }
};

function insertReceiptAttribute(post, callback) {
  var query = db.query("INSERT INTO ser_receipt_attribute SET ?", post, function(err, result) {
    if (err) {
      db.rollback(function() {
        throw err;
      });
      callback(null);
    } else {
      console.log("Inserted ID " + result.insertId + " into ser_receipt_attribute");
      callback(result.insertId);
    }
  });
  console.log(query.sql);
}

// GET: group
Object.defineProperty(ReceiptAttribute.prototype, "group", {
  set: function(callback) {
    var local = this;
    if (local._group == null && local.group_id != null) {
      Access.getValueById(TAG_TABLE, TAG_COLUMN, local.group_id, function(group) {
        local._group = group;
        callback(local._group);
      });
    } else {
      callback(local._group);
    }
  }
});

ReceiptAttribute.getReceiptAttributeById = function(id, callback) {
  Access.selectByColumn("ser_receipt_attribute", "id", id, "", function(result) {
    if (result != null) {
      callback(new ReceiptAttribute(
        result[0].id, result[0].group_id, result[0].attribute_name, result[0].data_type
      ));
    } else {
      callback(new Error("No Receipt Attribute for ID " + id));
    }
  });
};

module.exports = ReceiptAttribute;