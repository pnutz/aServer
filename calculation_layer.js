var cheerio = require("cheerio"),
async = require("async"),
ReceiptAttribute = require("./model/receipt_attribute"),
SimpleTable = require("./model/simple_table");

exports.applyCalculations = function(json_message, html, callback) {
  console.log("----------------CALCULATION LAYER----------------------");
  var $ = cheerio.load(html);
  // hard copy json_message
  var individual_attributes = JSON.parse(JSON.stringify(json_message));
  delete individual_attributes["templates"];
  var keys = [];
  var grouped_keys = [];

  async.series([
    // remove grouped attr from individual_attributes and add them to grouped_keys
    function(series_callback) {
      SimpleTable.selectByColumn("ser_receipt_attribute_group", "'TRUE'", "TRUE", "", function(result_groups) {
        if (result_groups !== null) {
          async.eachSeries(result_groups, function(group, each_callback) {
            if (json_message.hasOwnProperty(group.group_name)) {
              grouped_keys.push(group);
              delete individual_attributes[group.group_name];
            }
            each_callback();
          },
          function(err) {
            if (err) {
              console.log(err.message);
            }
            series_callback();
          });
        } else {
          console.log("No receipt attribute groups found");
          series_callback();
        }
      });
    },
    // set keys from individual_attributes
    function(series_callback) {
      keys = Object.keys(individual_attributes);
      series_callback();
    },
    // find default value for all independent receipt attributes
    function(series_callback) {
      async.eachSeries(keys, function(key, each_callback) {
        ReceiptAttribute.getReceiptAttributeByName(key, function(err, attribute) {
          if (err) {
            console.log(err.message);
          }

          if (attribute !== null) {
            async.series([
              // find default value if no result was found
              function(series_callback2) {
                if (json_message[key] === "") {
                  findDefaultValue(key, $.root().text(), function(result) {
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
      // loop through each receipt attribute group
      async.eachSeries(grouped_keys, function(key, each_callback) {
        var group_attributes;
        var items_to_delete = [];
        async.series([
          // get receipt attributes for receipt attribute group
          function(series_callback2) {
            ReceiptAttribute.getGroupedReceiptAttributes(key.id, function(attributes) {
              if (attributes !== null) {
                group_attributes = attributes;
                series_callback2();
              } else {
                series_callback2(new Error(key.group_name + " receipt group has no attributes"));
              }
            });
          },
          // loop through receipt items for group in json_message
          function(series_callback2) {
            var item_keys = Object.keys(json_message[key.group_name]);
            async.eachSeries(item_keys, function(item_key, each_callback2) {
              // loop through each attribute in group for item
              async.eachSeries(group_attributes, function(attr, each_callback3) {
                if (attr.name !== "row") {
                  async.series([
                    function(series_callback3) {
                      // if item contains attribute and it is a real value, check validity
                      if (json_message[key.group_name][item_key].hasOwnProperty(attr.name) && json_message[key.group_name][item_key] !== "") {
                        checkInvalidItem(json_message[key.group_name][item_key][attr.name], function(is_valid) {
                          // if item is invalid, store key and item_key for deleting
                          console.log("valid?: " + json_message[key.group_name][item_key][attr.name] + " " + is_valid);
                          if (!is_valid) {
                            items_to_delete.push(item_key);
                          }
                          series_callback3();
                        });
                      }
                      // if item needs attribute
                      else {
                        findDefaultValue(attr.name, $.root().text(), function(result) {
                          json_message[key.group_name][item_key][attr.name] = result;
                          series_callback3();
                        });
                      }
                    },
                    // convert values to correct datatype
                    function(series_callback3) {
                      convertAttributeDataType(json_message[key.group_name][item_key][attr.name], attr.datatype, function(result) {
                        json_message[key.group_name][item_key][attr.name] = result;
                        series_callback3();
                      });
                    }
                  ], function (err) {
                    if (err) {
                      console.log(err.message);
                    }
                    each_callback3();
                  });
                } else {
                  each_callback3();
                }
              },
              function(err) {
                if (err) {
                  console.log(err.message);
                }
                each_callback2();
              });
            },
            function(err) {
              if (err) {
                console.log(err.message);
              }
              series_callback2();
            });
          }
        ], function (err) {
          if (err) {
            console.log(err.message);
          }
          // remove receipt items that are invalid
          async.eachSeries(items_to_delete, function(delete_key, each_callback2) {
            if (json_message[key.group_name][delete_key] !== null) {
              delete json_message[key.group_name][delete_key];
              delete json_message.templates[key.group_name][delete_key];
            }
            each_callback2();
          }, function(err) {
            if (err) {
              console.log(err.message);
            }
            each_callback();
          });
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

// return true if item is valid, false if invalid
function checkInvalidItem(item, callback) {
  var valid = true;
  // item is a string
  if (isNaN(parseInt(item)) && typeof(item) === "string") {
    item = item.toLowerCase();
    if (item.indexOf("total") !== -1 || item.indexOf("paid") !== -1 || item.indexOf("pay") !== -1 || item.indexOf("gift certificate") !== -1) {
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
  if (result !== "") {
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

// default quantity is 1
function convertInteger(result, callback) {
  result = result.replace("[^\\d.-]", "").trim();
  var int_result = parseInt(result);
  if (result !== "" && !isNaN(int_result)) {
    callback(int_result);
  } else {
    callback("1");
  }
}

// default price is 0
function convertDecimal(result, callback) {
  result = result.replace("[^\\d.-]", "").trim();
  var float_result = parseFloat(result).toFixed(2);
  if (result !== "" && !isNaN(float_result)) {
    callback(float_result);
  } else {
    callback("0.00");
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

// to avoid shipping date, take earliest found date
function findDefaultDate(text, callback) {
  var date = new Date(), year_indices = [], year_found = true, new_year = true, date_string = "",
  target_year = date.getFullYear()-2, date_values = [],
  month_strings = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  // what if years are 2 digit? (13, 14)
  async.series([
    // find all years in text
    function(series_callback) {
      async.whilst(function() { return year_found; },
        function(whilst_callback) {
          var year_index = text.indexOf(target_year, (year_indices.length == 0 || new_year) ? null : year_indices[year_indices.length-1] + 1);
          year_found = false;
          if (year_index !== -1) {
            year_indices.push(year_index);
            year_found = true;
            new_year = false;
          } else if (target_year !== date.getFullYear()) {
            target_year++;
            year_found = true;
            new_year = true;
          }
          whilst_callback();
        },
        function(err) {
          if (err) {
            console.log(err.message);
          }
          series_callback();
        }
      );
    },
    // process text by year to try and find date
    function(series_callback) {
      async.eachSeries(year_indices, function(year_index, each_callback) {
        var prev_text, next_text;
        var year = text.substring(year_index, year_index + 4), month, day;
        // split by newline
        if (year_index - 14 > 0 && year_index + 18 < text.length) {
          prev_text = text.substring(year_index - 14, year_index - 1).toLowerCase();
          next_text = text.substring(year_index + 4, year_index + 18).toLowerCase();
        } else if (year_index - 14 > 0) {
          prev_text = text.substring(year_index - 14, year_index - 1).toLowerCase();
        } else if (year_index + 18 < text.length) {
          next_text = text.substring(year_index + 4, year_index + 18).toLowerCase()
        } else {
          each_callback();
          return;
        }

        // date won't be split up by newlines
        if (prev_text !== null && prev_text.indexOf("\n") !== -1) {
          prev_text = prev_text.substring(prev_text.indexOf("\n"));
        }
        if (next_text !== null && next_text.indexOf("\n") !== -1) {
          next_text = next_text.substring(next_text.indexOf("\n"));
        }

        // find matching month, then calculate for date
        var month_index = 0;
        async.eachSeries(month_strings, function(month_string, each_callback2) {
          var prev_index = prev_text.indexOf(month_string);
          var next_index = next_text.indexOf(month_string);

          if (prev_text !== null && prev_index !== -1) {
            month = month_index;
            var sub_prev_text = prev_text.substring(0, prev_index).replace(/[^0-9]/g, "");
            var sub_next_text = prev_text.substring(prev_index).replace(/[^0-9]/g, "");
            if (parseInt(sub_next_text) > 0 && parseInt(sub_next_text) < 32) {
              day = sub_next_text;
            } else if (parseInt(sub_prev_text) > 0 && parseInt(sub_prev_text) < 32) {
              day = sub_prev_text;
            }
            each_callback2(new Error("month match found"));
          } else if (next_text !== null && next_index !== -1) {
            month = month_index;
            var sub_prev_text = next_text.substring(0, next_index).replace(/[^0-9]/g, "");
            var sub_next_text = next_text.substring(next_index).replace(/[^0-9]/g, "");
            if (parseInt(sub_next_text) > 0 && parseInt(sub_next_text) < 32) {
              day = parseInt(sub_next_text);
            } else if (parseInt(sub_prev_text) > 0 && parseInt(sub_prev_text) < 32) {
              day = parseInt(sub_prev_text);
            }
            each_callback2(new Error("month match found"));
          } else {
            month_index++;
            each_callback2();
          }
        }, function(err) {
          if (err) {
            console.log(err.message);
          }

          // month string was not found, try numeric calculation
          // possible for numeric calculation to get wrong data if it passes month & date validity
          if (month === null) {
            prev_text = prev_text.replace(/[^0-9]/g, " ").replace(/\s+/g, " ").trim();
            var prev_nums = prev_text.split(" ");
            if (prev_nums.length > 1) {
                month = parseInt(prev_nums[prev_nums.length - 2]) - 1;
                day = parseInt(prev_nums[prev_nums.length - 1]);
            } else {
              next_text = next_text.replace(/[^0-9]/g, " ").replace(/\s+/g, " ").trim();
              var next_nums = next_text.split(" ");
              if (next_nums.length > 1) {
                month = parseInt(next_nums[0]) - 1;
                day = parseInt(next_nums[1]);
              }
            }
          }

          if (month !== null && month < 12 && day !== null && day > 0 && day < 32) {
            date_values.push(new Date(year, month, day));
          }
          each_callback();
        });
      }, function(err) {
        if (err) {
          console.log(err.message);
        }
        series_callback();
      });
    },
    // set most recent date in date_strings as date_string
    function(series_callback) {
      var current_date;
      async.eachSeries(date_values, function(date, each_callback) {
        if (current_date === undefined) {
          current_date = date;
        } else if (date.getTime() - current_date.getTime() < 0) {
          current_date = date;
        }
        each_callback();
      }, function(err) {
        if (err) {
          console.log(err.message);
        }

        var month = current_date.getMonth() + 1;
        if (month < 10) {
          date_string = "0" + month;
        } else {
          date_string = "" + month;
        }

        var day = current_date.getDate();
        if (day < 10) {
          date_string += "/0" + day + "/" + current_date.getFullYear();
        } else {
          date_string += "/" + day + "/" + current_date.getFullYear();
        }

        series_callback();
      });
    }
  ],
  function(err, result) {
    if (err) {
      console.log(err.message);
    }
    callback(date_string);
  });
}

// domain name text? not always
function findDefaultVendor(text, callback) {
  // last instance of .com? split by \n\t or space

  callback("");
}

function findDefaultTransaction(text, callback) {
  callback("");
}

function findDefaultItemName(text, callback) {
  callback("");
}

function findDefaultItemCost(text, callback) {
  callback("0.00");
}

function findDefaultItemQuantity(text, callback) {
  callback("1");
}

// largest non-negative monetary value
function findDefaultTotal(text, callback) {
  // Rs. 584, Rs. 618.45, $354.34
  //

  // look for $ symbols, etc. we don't know if $ is the currency used, but if it appears, then it is
  // ignore numbers that are too long. plain numbers don't work, transaction#, e-mail, date, number in item description, quantity
  //

  // numbers, separated by spaces
  text = text.replace(/[^0-9.$\-]/g, " ").replace(/\s+/g, " ").replace(/[$]\s+/g, "$").replace(/[-]\s+/g, "-").trim();
  callback("0.00");
}
