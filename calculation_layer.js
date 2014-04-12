var cheerio = require("cheerio"),
async = require("async"),
ReceiptAttribute = require("./model/receipt_attribute");

exports.applyCalculations = function(json_message, callback) {
  var keys = Object.keys(json_message);
  var grouped_keys = Object.keys(json_message.items);
  
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
                    findDefaultValue(key, function(result) {
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
                  } else {
                    series_callback2();
                  }
                },
                // convert values to correct datatype
                function(series_callback2) {
                  convertAttributeDataType(json_message[key][item_key], attribute.datatype, function(result) {
                    json_message[key][item_key] = result;
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
          each_callback2();
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
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    }
    callback(json_message);
  });
};

// convert data to valid datatype
function convertAttributeDataType(result, datatype, callback) {
  // date, decimal, string, integer
  callback(result);
}

function findDefaultValue(attribute, callback) {
  switch(attribute)
  {
  case "date":
    findDefaultDate(callback);
    break;
  case "vendor":
    findDefaultVendor(callback);
    break;
  case "transaction":
    findDefaultTransaction(callback);
    break;
  case "name":
    findDefaultItemName(callback);
    break;
  case "cost":
    findDefaultItemCost(callback);
    break;
  case "quantity":
    findDefaultItemQuantity(callback);
    break;
  case "total":
    findDefaultTotal(callback);
    break;
  default:
    callback();
  }
}

function findDefaultDate(callback) {
  // look for different date formats
  // look for date labels
  // look for common date terms (January, etc)
  // look for common years (2014, 2013)
  callback("");
}

function findDefaultVendor(callback) {
  callback("");
}

function findDefaultTransaction(callback) {
  callback("");
}

function findDefaultItemName(callback) {
  callback("");
}

function findDefaultItemCost(callback) {
  callback("");
}

function findDefaultItemQuantity(callback) {
  callback("1");
}

// largest monetary value?
function findDefaultTotal(callback) {
  callback("");
}