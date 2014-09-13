var server = require("./server");
var mysql = require("./db");
var async = require("async");

var Init = require("./mysql_db/attributeInit");
var ReceiptAttribute = require("./model/receipt_attribute");
var Access = require("./model/simple_table");

async.series([
  function(callback) {
    mysql.connect(function(connection) {
      global.db = connection;
      return callback();
    });
  },
  // load global.attributes with receipt attribute data (init database if data doesn't exist)
  // individual receipt attributes
  function(callback) {
    global.attributes = { "groupedAttributes": {}, "individualAttributes": {} };
    var query = "SELECT * FROM ser_receipt_attribute WHERE group_id IS NULL;";
    db.query(query, function(err, result) {
      if (err) {
        console.log(query);
        console.log(err.message);
        return callback(err);
      } else if (result.length !== 0) {
        for (var i = 0; i < result.length; i++) {
          global.attributes.individualAttributes[result[i].attribute_name] = { id: result[i].id, datatype: result[i].data_type };
        }
        return callback();
      }
      // initialize database
      else {
        var attrData = Init.attrData;
        // iterate through receipt attributes
        async.eachSeries(attrData, function(attribute, eachCallback) {
          var newAttr = new ReceiptAttribute(null, null, attribute.attribute, attribute.datatype);
          newAttr.save(function(attributeId) {
            if (attributeId != null) {
              global.attributes.individualAttributes[attribute.attribute] = { id: attributeId, datatype: attribute.datatype };
              return eachCallback();
            } else {
              return eachCallback(new Error("failed attribute creation"));
            }
          });
        }, function(err) {
          if (err) {
            console.log(err.message);
          }
          return callback(err);
        });
      }
    });
  },
  // grouped receipt attributes
  function(callback) {
    var query = "SELECT a.id AS group_id, a.group_name AS groupname, b.id AS attribute_id, b.attribute_name AS attribute, b.data_type AS datatype " +
                "FROM ser_receipt_attribute_group AS a INNER JOIN ser_receipt_attribute AS b ON a.id = b.group_id ORDER BY a.group_name;";
    db.query(query, function(err, result) {
      if (err) {
        console.log(query);
        console.log(err.message);
        return callback(err);
      } else if (result.length !== 0) {
        for (var i = 0; i < result.length; i++) {
          // initialize group
          if (!global.attributes.groupedAttributes.hasOwnProperty(result[i].groupname)) {
            global.attributes.groupedAttributes[result[i].groupname] = { id: result[i].group_id };
          }
          global.attributes.groupedAttributes[result[i].groupname][result[i].attribute] = { id: result[i].attribute_id, datatype: result[i].datatype };
        }
        return callback();
      }
      // initialize database
      else {
        var groupedData = Init.groupData;
        // iterate through grouped attributes
        async.eachSeries(groupedData, function(group, eachCallback) {
          Access.save("ser_receipt_attribute_group", "group_name", group.groupname, function(groupId) {
            if (groupId != null) {
              global.attributes.groupedAttributes[group.groupname] = { id: groupId };

              async.eachSeries(group.attributes, function(attribute, eachCallback2) {
                var newAttr = new ReceiptAttribute(null, groupId, attribute.attribute, attribute.datatype);
                newAttr.save(function(attributeId) {
                  if (attributeId != null) {
                    global.attributes.groupedAttributes[group.groupname][attribute.attribute] = { id: attributeId, datatype: attribute.datatype };
                    return eachCallback2();
                  } else {
                    return eachCallback2(new Error("failed attribute creation"));
                  }
                });
              }, function(err) {
                return eachCallback(err);
              });
            } else {
              return eachCallback(new Error("failed group creation"));
            }
          });
        }, function(err) {
          if (err) {
            console.log(err.message);
          }
          return callback(err);
        });
      }
    });
  },
  function(callback) {
    server.start();
    return callback();
  }
]);
