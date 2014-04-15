var cheerio = require("cheerio"),
async = require("async"),
ReceiptAttribute = require("./model/receipt_attribute");

exports.applyCalculations = function(json_message, html, callback) {
  var $ = cheerio.load(html);
  var keys = Object.keys(json_message);
  var grouped_keys = Object.keys(json_message.items);
  var items_to_delete = [];
  
  async.series([
    // find default value for all independent receipt attributes
    function(series_callback) {
      async.eachSeries(keys, function(key, each_callback) {
        if (key != "items") {
          ReceiptAttribute.getReceiptAttributeByName(key, function(err, attribute) {
            if (err) {
              console.log(err.message);
            }
            
            if (attribute != null) {
              async.series([
                // find default value if no result was found
                function(series_callback2) {
                  if (json_message[key] == "") {
                    findDefaultValue(key, $.text(), function(result) {
                      json_message[key] = result;
                      series_callback2();
                    });
                  } else {
                    series_callback2();
                  }
                },
                // convert values to correct datatype
                function(series_callback2) {
                  convertAttributeDataType(json_message[key], attribute.datatype, function(result) {
                    json_message[key] = result;
                    series_callback2();
                  });
                }
              ], function(err) {
                if (err) {
                  console.log(err.message);
                }
                each_callback();
              });
            } else {
              each_callback();
            }
          });
        } else {
          each_callback();
        }
      },
      function(err) {
        if (err) {
          console.log(err.message);
        }
        series_callback();
      });
    },
    // find default value for all grouped receipt attributes
    function(series_callback) {
      // loop through each receipt item
      async.eachSeries(grouped_keys, function(key, each_callback) {
        var item_keys = Object.keys(json_message.items[key]);
        // loop through each receipt item attribute
        async.eachSeries(item_keys, function(item_key, each_callback2) {
          ReceiptAttribute.getReceiptAttributeByName(item_key, function(err, attribute) {
            if (err) {
              console.log(err.message);
            }
            
            if (attribute != null) {   
              async.series([
                // find default value if no result was found
                function(series_callback2) {
                  if (json_message.items[key][item_key] == "") {
                    findDefaultValue(item_key, function(result) {
                      json_message.items[key][item_key] = result;
                      series_callback2();
                    });
                  }
                  // check validity of receipt items
                  else {
                    checkInvalidItem(json_message.items[key][item_key], function(is_valid) {
                      // if item is invalid, store key and item_key for deleting
                      console.log(json_message.items[key][item_key] + " " + is_valid);
                      
                      if (!is_valid) {
                        items_to_delete.push(key);
                      }
                      series_callback2();
                    });
                  }
                },
                // convert values to correct datatype
                function(series_callback2) {
                  convertAttributeDataType(json_message.items[key][item_key], attribute.datatype, function(result) {
                    json_message.items[key][item_key] = result;
                    series_callback2();
                  });
                }
              ], function(err) {
                if (err) {
                  console.log(err.message);
                }
                each_callback2();
              });
            } else {
              each_callback2();
            }
          });
        },
        function(err) {
          if (err) {
            console.log(err.message);
          }
          each_callback();
        });
      },
      function(err) {
        if (err) {
          console.log(err.message);
        }
        series_callback();
      });
    },
    function(series_callback) {
      debugger;
      // remove receipt items that are invalid
      async.eachSeries(items_to_delete, function(delete_key, each_callback3) {
        debugger;
        if (json_message.items[delete_key] != null) {
          delete json_message.items[delete_key];
        }
        each_callback3();
      }, function(err) {
        if (err) {
          console.log(err.message);
        }
        series_callback();
      });
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    }
    callback(json_message);
  });
};

// return true if item is valid, false if invalid
function checkInvalidItem(item, callback) {
  var valid = true;
  // item is a string
  if (isNaN(parseInt(item)) && typeof(item) === "string") {
    item = item.toLowerCase();
    if (item.indexOf("total") != -1 || item.indexOf("paid") != -1 || item.indexOf("pay") != -1 || item.indexOf("gift certificate") != -1) {
      valid = false;
    }
  }
  // item is a number
  else {
    // possibly remove 0.00 values?
  }
  callback(valid);
}

// convert data to valid datatype
function convertAttributeDataType(result, datatype, callback) {
  switch(datatype)
  {
    case "datetime":
      convertDateTime(result, callback);
      break;
    case "string":
      convertString(result, callback);
      break;
    case "integer":
      convertInteger(result, callback);
      break;
    case "decimal":
      convertDecimal(result, callback);
      break;
    default:
      callback(result);
  }
}

function convertDateTime(result, callback) {
  if (result != "") {
    var date = new Date(result);
    // date is not valid
    if (!isNaN(date.getTime())) {
      // year parsing
      var year = "" + date.getFullYear();
      
      // month parsing
      var month = "" + (date.getMonth() + 1);
      if (month.length < 2) {
        month = "0" + month;
      }
      
      // day parsing
      var day = "" + date.getDate();
      if (day.length < 2) {
        day = "0" + day;
      }
      
      // resulting format - mm/dd/yyyy
      callback([month, day, year].join("/"));
    } else {
      callback("");
    }
  } else {
    callback("");
  }
}

function convertString(result, callback) {
  callback(result);
}

function convertInteger(result, callback) {
  var int_result = parseInt(result);
  if (!isNaN(int_result)) {
    callback(int_result);
  } else {
    callback(1);
  }
}

function convertDecimal(result, callback) {
  var float_result = parseFloat(result);
  if (!isNaN(float_result)) {
    callback(float_result);
  } else {
    callback(0);
  }
}

function findDefaultValue(attribute, text, callback) {
  switch(attribute)
  {
  case "date":
    findDefaultDate(text, callback);
    break;
  case "vendor":
    findDefaultVendor(text, callback);
    break;
  case "transaction":
    findDefaultTransaction(text, callback);
    break;
  case "name":
    findDefaultItemName(text, callback);
    break;
  case "cost":
    findDefaultItemCost(text, callback);
    break;
  case "quantity":
    findDefaultItemQuantity(text, callback);
    break;
  case "total":
    findDefaultTotal(text, callback);
    break;
  default:
    callback();
  }
}

function findDefaultDate(text, callback) {
  // look for different date formats
  // look for date labels
  // look for common date terms (January, etc)
  // look for common years (2014, 2013)
  callback("");
}

function findDefaultVendor(text, callback) {
  callback("");
}

function findDefaultTransaction(text, callback) {
  callback("");
}

function findDefaultItemName(text, callback) {
  callback("");
}

function findDefaultItemCost(text, callback) {
  callback("");
}

function findDefaultItemQuantity(text, callback) {
  callback("1");
}

// largest monetary value?
function findDefaultTotal(text, callback) {
  callback("");
}