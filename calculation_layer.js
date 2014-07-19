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
  delete individual_attributes["element_paths"];
  var keys = [];
  var grouped_keys = [];
  var document_text = "";
  var text_nodes = [];

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
    // initialize text nodes and document_text
    function(series_callback) {
      initializeContentSearch($, function(results) {
        if (results != null) {
          document_text = results.text;
          text_nodes = results.text_nodes;
        }
        series_callback();
      });
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
                  findDefaultValue($, key, document_text, text_nodes, function(result, element_path) {
                    if (result != null && result != "") {
                      json_message[key] = result;
                      json_message.element_paths[key] = element_path;
                    }
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
                  if (result === "") {
                    delete json_message.element_paths[key];
                  }
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
                        findDefaultValue($, attr.name, document_text, text_nodes, function(result, element_path) {
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
              delete json_message.element_paths[key.group_name][delete_key];
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

function findDefaultValue($, attribute, text, text_nodes, callback) {
  switch(attribute)
  {
  case "date":
    findDefaultDate($, text, text_nodes, callback);
    break;
  case "vendor":
    findDefaultVendor($, text, text_nodes, callback);
    break;
  case "transaction":
    findDefaultTransaction($, text, text_nodes, callback);
    break;
  case "itemtype":
    findDefaultItemName($, text, text_nodes, callback);
    break;
  case "cost":
    findDefaultItemCost($, text, text_nodes, callback);
    break;
  case "quantity":
    findDefaultItemQuantity($, text, text_nodes, callback);
    break;
  case "total":
    findDefaultTotal($, text, text_nodes, callback);
    break;
  default:
    callback();
  }
}

// to avoid shipping date, take earliest found date
function findDefaultDate($, text, text_nodes, callback) {
  var date = new Date(),
      year_indices = [],
      date_string = "",
      element_path = [],
      date_values = [],
      month_strings = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  // what if years are 2 digit? (13, 14)
  async.series([
    // find all years in text
    function(series_callback) {
      var target_year = date.getFullYear() - 2;

      // iterate through each year
      async.whilst(function() { return target_year !== date.getFullYear() + 1; },
        function(whilst_callback) {

          // iterate through each year
          searchText(target_year, $, text, text_nodes, function(result) {
            if (result != null) {
              year_indices = year_indices.concat(result);
            }
            target_year++;
            whilst_callback();
          });
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
        var year = text.substring(year_index.index, year_index.index + 4);
        var month, day;
        // split by newline
        if (year_index.index - 14 > 0 && year_index.index + 18 < text.length) {
          prev_text = text.substring(year_index.index - 14, year_index.index).toLowerCase();
          next_text = text.substring(year_index.index + 4, year_index.index + 18).toLowerCase();
        } else if (year_index.index - 14 > 0) {
          prev_text = text.substring(year_index.index - 14, year_index.index).toLowerCase();
        } else if (year_index.index + 18 < text.length) {
          next_text = text.substring(year_index.index + 4, year_index.index + 18).toLowerCase()
        } else {
          each_callback();
          return;
        }

        // date won't be split up by newlines
        if (prev_text != null && prev_text.indexOf("\n") !== -1) {
          prev_text = prev_text.substring(prev_text.indexOf("\n"));
        }
        if (next_text != null && next_text.indexOf("\n") !== -1) {
          next_text = next_text.substring(0, next_text.indexOf("\n"));
        }

        // find matching month, then calculate for date
        var month_index = 0;
        async.eachSeries(month_strings, function(month_string, each_callback2) {
          var prev_index = prev_text.indexOf(month_string);
          var next_index = next_text.indexOf(month_string);

          if (prev_text != null && prev_index !== -1) {
            month = month_index;
            var sub_prev_text = prev_text.substring(0, prev_index).replace(/[^0-9]/g, "");
            var sub_next_text = prev_text.substring(prev_index).replace(/[^0-9]/g, "");
            if (parseInt(sub_next_text) > 0 && parseInt(sub_next_text) < 32) {
              day = sub_next_text;
              var start_change = prev_text.length - prev_index;
              alterSearchData("start", start_change, year_index, text_nodes, function (result) {
                year_index = result;
                each_callback2(new Error("month match found"));
              });
            } else if (parseInt(sub_prev_text) > 0 && parseInt(sub_prev_text) < 32) {
              day = sub_prev_text;
              // find index of sub_prev_text in prev_text
              var day_index = prev_text.indexOf(sub_prev_text);
              var end_change = prev_text.length - day_index;
              alterSearchData("end", end_change, year_index, text_nodes, function (result) {
                year_index = result;
                each_callback2(new Error("month match found"));
              });
            } else {
              each_callback2(new Error("month match found"));
            }
          } else if (next_text != null && next_index !== -1) {
            month = month_index;
            var sub_prev_text = next_text.substring(0, next_index).replace(/[^0-9]/g, "");
            var sub_next_text = next_text.substring(next_index + month_string.length).replace(/[^0-9]/g, "");
            if (parseInt(sub_next_text) > 0 && parseInt(sub_next_text) < 32) {
              day = parseInt(sub_next_text);
              var day_index = next_text.substring(next_index + month_string.length).indexOf(sub_next_text);
              var end_change = next_index + day_index + sub_next_text.length;
              alterSearchData("end", end_change, year_index, text_nodes, function (result) {
                year_index = result;
                each_callback2(new Error("month match found"));
              });
            } else if (parseInt(sub_prev_text) > 0 && parseInt(sub_prev_text) < 32) {
              day = parseInt(sub_prev_text);
              var start_change = next_index;
              alterSearchData("start", start_change, year_index, text_nodes, function (result) {
                year_index = result;
                each_callback2(new Error("month match found"));
              });
            } else {
              each_callback2(new Error("month match found"));
            }
          } else {
            month_index++;
            each_callback2();
          }
        }, function(err) {
          if (err) {
            console.log(err.message);
          }

          async.series([
            // month string was not found, try numeric calculation
            // possible for numeric calculation to get wrong data if it passes month & date validity
            function(series_callback2) {
              if (month == null) {
                prev_text = prev_text.replace(/[^0-9]/g, " ").replace(/\s+/g, " ").trim();
                var prev_nums = prev_text.split(" ");
                if (prev_nums.length > 1) {
                  var original_month = parseInt(prev_nums[prev_nums.length - 2]);
                  month = original_month - 1;
                  day = parseInt(prev_nums[prev_nums.length - 1]);

                  var day_index = prev_text.lastIndexOf(prev_nums[prev_nums.length - 1]) - 1;
                  var month_index = prev_text.lastIndexOf(prev_nums[prev_nums.length - 2], day_index);
                  var start_change = prev_text.length - month_index;
                  alterSearchData("start", start_change, year_index, text_nodes, function (result) {
                    year_index = result;
                    series_callback2();
                  });
                } else {
                  next_text = next_text.replace(/[^0-9]/g, " ").replace(/\s+/g, " ").trim();
                  var next_nums = next_text.split(" ");
                  if (next_nums.length > 1) {
                    var original_month = parseInt(next_nums[0]);
                    month = original_month - 1;
                    day = parseInt(next_nums[1]);

                    var month_index = next_text.indexOf(next_nums[0]) + next_nums[0].length;
                    var day_index = next_text.indexOf(next_nums[1], month_index);
                    var end_change = month_index + day_index + next_nums[1].length
                    alterSearchData("end", end_change, year_index, text_nodes, function (result) {
                      year_index = result;
                      series_callback2();
                    });
                  } else {
                    series_callback2();
                  }
                }
              } else {
                series_callback2();
              }
            },
            // add date to date_values if all values are valid
            function(series_callback2) {
              if (month != null && month < 12 && day !== null && day > 0 && day < 32) {
                var ele_path;
                // find element to add to date_values based on text nodes
                if (year_index.start_node_index === year_index.end_node_index) {
                  ele_path = findElementPath($, text_nodes[year_index.start_node_index]);
                  date_values.push({ "date": new Date(year, month, day), "element_path": ele_path });
                  series_callback2();
                }
                // text nodes are not the same, find parent element
                else {
                  var node_parent = $(text_nodes[year_index.start_node_index].parent);
                  var second_parent = $(text_nodes[year_index.end_node_index].parent);
                  async.whilst(function() { return !$.contains(node_parent, second_parent) || node_parent.name === "body"; },
                    function(whilst_callback) {
                      node_parent = node_parent.parent();
                      whilst_callback();
                    }, function(err2) {
                      if (err2) {
                        console.log(err2.message);
                      }
                      ele_path = findElementPath($, node_parent[0]);
                      date_values.push({ "date": new Date(year, month, day), "element_path": ele_path });
                      series_callback2();
                    }
                  );
                }
                return;
              } else {
                series_callback2();
              }
            }
          ], function (err2, results) {
            if (err2) {
              console.log(err2.message);
            }
            each_callback();
          });
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
      async.eachSeries(date_values, function(value, each_callback) {
        if (current_date == null) {
          current_date = value.date;
          element_path = value.element_path;
        } else if (value.date.getTime() - current_date.getTime() < 0) {
          current_date = value.date;
          element_path = value.element_path;
        }
        each_callback();
      }, function(err) {
        if (err) {
          console.log(err.message);
        }

        if (current_date != null) {
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
        }
        series_callback();
      });
    }
  ],
  function(err, result) {
    if (err) {
      console.log(err.message);
    }
    if (date_string.length >= 10) {
      callback(date_string, element_path);
    } else {
      callback();
    }
  });
}

// domain name text? not always
function findDefaultVendor($, text, text_nodes, callback) {
  // last instance of .com? split by \n\t or space

  callback("");
}

function findDefaultTransaction($, text, text_nodes, callback) {
  callback("");
}

function findDefaultItemName($, text, text_nodes, callback) {
  callback("");
}

function findDefaultItemCost($, text, text_nodes, callback) {
  callback("0.00");
}

function findDefaultItemQuantity($, text, text_nodes, callback) {
  callback("1");
}

// largest non-negative monetary value
function findDefaultTotal($, text, text_nodes, callback) {
  // Rs. 584, Rs. 618.45, $354.34
  //

  // look for $ symbols, etc. we don't know if $ is the currency used, but if it appears, then it is
  // ignore numbers that are too long. plain numbers don't work, transaction#, e-mail, date, number in item description, quantity
  //

  // numbers, separated by spaces
  //text = text.replace(/[^0-9.$\-]/g, " ").replace(/\s+/g, " ").replace(/[$]\s+/g, "$").replace(/[-]\s+/g, "-").trim();
  callback("0.00");
}

// initializes text_nodes and retrieves document text
function initializeContentSearch($, callback) {
  var selector = "body",
      params = { "text": "", "trim": true, "text_nodes": [] };

  // iterate through all children of body element
  if ($(selector).length > 0) {
    var children = $(selector)[0].children;
    for (var i = 0; i < children.length; i++) {
      params = iterateText(children[i], initTextNodes, params);
    }
    callback(params);
  } else {
    console.log("element does not exist. no text retrieved");
    callback();
  }
}

// stores text node in param text_nodes and calls addText
function initTextNodes(node, params) {
  params.text_nodes.push(node);
  params = addText(node, params);
  return params;
}

/* params:  text - total plain-text of all passed text nodes
*           trim - true if the nodeValue will be trimmed before added to text
*/
function addText(node, params) {
  var text = params.text;
  var trim = params.trim;

  if (trim) {
    if (text === "") {
      text = node.data.trim();
    } else {
      text += " " + node.data.trim();
    }
  } else {
    text += node.data;
  }

  params.text = text;
  return params;
}

function iterateText(node, method, method_params) {
  // run method for non-whitespace text nodes
  if (node.type === "text" && /\S/.test(node.data)) {
    method_params = method(node, method_params);
  }
  // exception case to include whitespace text nodes
  else if (node.type === "text" && method_params.whitespace !== undefined) {
    method_params = method(node, method_params);
  }
  // iterateText through children of non-style/script elements
  else if (node.type === "tag" && node.children.length > 0 && !/(style|script)/i.test(node.name)) {
    var children = node.children;
    for (var i = 0; i < children.length; i++) {
      method_params = iterateText(children[i], method, method_params);
    }
  }
  return method_params;
}

// calculates the element_path from param node
function findElementPath($, node) {
  if (node.type === "text") {
    node = node.parent;
  }
  var element_path = [];
  var element = $(node);
  var parent_element = element.parent();
  var order;

  while (parent_element.length > 0 && element[0].name !== "body") {
    order = inArray(element, parent_element.children());
    element_path.unshift(order);
    element = parent_element;
    parent_element = parent_element.parent();
  }
  element_path.unshift(0);
  return element_path;
}

// returns index of element within array
function inArray(element, array) {
  var index = 0;
  for (var i = 0; i < array.length; i++) {
    if (array[i] === element[0]) {
      index = i;
      console.log("Found element inArray");
      break;
    }
  }
  return index;
}

// find all instances of search_term in the document
// returns a list of parent elements that contain the search_term
function searchText(search_term, $, text, text_nodes, callback) {
  search_term = String(search_term);
  var total = occurrences(text, search_term, true);

  if (total > 0) {
    var params = {
      "node_index": 0,
      "search_term": search_term,
      "search_elements": [],
      "total": total,
      "count": 0,
      "text": "",
      // holds last valid index
      "current_index": -1,
      "result": true,
      "text_nodes": text_nodes,
      "$": $
    };

    // iterate through all children of body element
    var children = $("body")[0].children;
    for (var i = 0; i < children.length; i++) {
      params = iterateText(children[i], findMatch, params);
      if (params.result === false) {
        console.log("Found all " + search_term + " matches in document");
        break;
      }
    }
    callback(params.search_elements);
  } else {
    callback();
  }
}

/* params: node_index - index in text_nodes iterated through
*          search_term - search term to match
*          search_elements - parent elements of found search terms
*          total - total # of matches found
*          count - current # of matches found
*          text - total plain-text of all passed text nodes
*          current_index - holds last valid index
*          result - set to false to break out of iterateText
*          text_nodes - array of text nodes making up document text
*          $ - jquery methods for page html
*/
function findMatch(node, params) {

  var $ = params.$,
      node_value = node.data.trim(),
      node_index = params.node_index,
      search_term = params.search_term,
      search_elements = params.search_elements,
      total = params.total,
      count = params.count,
      text = params.text,
      current_index = params.current_index,
      text_nodes = params.text_nodes;

  if (text === "") {
    text = node_value;
  } else {
    text += " " + node_value;
  }

  // if search_term is found, current text node is the end node for one count
  var index = text.toLowerCase().indexOf(search_term.toLowerCase(), current_index + 1);
  // if there is multiple instances of search_term in text (loops through while loop), use old_start_index to calculate start_index
  var old_start_index, start_node_index;

  // stores the number of characters the start of search_term is from the end of text
  var characters_from_end = text.length - index;

  // loop through text node in case there is more than one search_term instance in text
  while (index !== -1) {
    current_index = index;

    // remember how many text nodes before current node we are pulling from text_nodes
    var text_nodes_back_index = node_index - 1;

    // text_selection will contain a combined string of all text nodes where current search_term spans over
    var text_selection = node_value;
    var start_node;

    // set text_selection to contain prevSibling text nodes until the current search_term matches
    while (text_selection.length < characters_from_end) {
      //console.log("text_selection.length: " + text_selection.length + " < " + characters_from_end);
      //console.log("old text_selection: " + text_selection);
      text_selection = text_nodes[text_nodes_back_index].data.trim() + " " + text_selection;
      //console.log("space added: " + text_selection);
      text_nodes_back_index--;
    }

    // use old start_node_index value before re-calculating it if its the same as new start_node_index
    // start_index needs to ignore previous instances of text
    var start_index;
    if (start_node_index !== undefined && start_node_index === text_nodes_back_index + 1) {
      // find index search_term starts on in text node (or prevSibling)
      start_index = text_selection.toLowerCase().indexOf(search_term.toLowerCase(), old_start_index + 1);
    } else {
      start_index = text_selection.toLowerCase().indexOf(search_term.toLowerCase());
    }
    old_start_index = start_index;

    // start_node contains beginning of search_term and node contains end of search_term
    var start_node_index = text_nodes_back_index + 1;
    // possibly null parentNode because highlighted text before, adding MARK tag and then removed it
    start_node = text_nodes[start_node_index];
    //console.log("final text_selection: " + text_selection);

    if (start_index !== -1) {
      // set parent as first element parent of text_node
      var end_parent = node.parent;

      var start_parent = start_node.parent;

      var target_parent;
      // start and end parents are the same
      if (start_parent === end_parent) {
        console.log("start parent is end parent");
        target_parent = start_parent;
      }
      // start parent is target parent element
      else if ($.contains(start_parent, end_parent)) {
        console.log("start parent is larger");
        target_parent = start_parent;
      }
      // end parent is target parent element
      else if ($.contains(end_parent, start_parent)) {
        console.log("end parent is larger");
        target_parent = end_parent;
      }
      // neither parents contain one another
      else {
        console.log("neither parent contains the other");
        // iterate upwards until start_parent contains end_parent
        while (!$.contains(start_parent, end_parent) && start_parent !== end_parent) {
          start_parent = start_parent.parent;
        }
        target_parent = start_parent;
      }
      /*console.log("target parent");
      console.log(target_parent);*/

      // set start_node to node before the parent we are calculating with
      if (text_nodes_back_index !== -1) {
        start_node = text_nodes[text_nodes_back_index];
        text_nodes_back_index--;

        var start_element = start_node.parent;

        // continue adding text length to start_index until parent elements are not contained in target_parent
        while (($.contains(target_parent, start_element) || target_parent === start_element) && text_nodes_back_index !== -1) {
          start_index += start_node.data.trim().length + 1;
          start_node = text_nodes[text_nodes_back_index];
          text_nodes_back_index--;
          start_element = start_node.parent;
        }
      }

      // find index search_term ends on in text node
      var end_index = start_index + search_term.length;
      /*console.log("start index: " + start_index);
      console.log("end index: " + end_index);*/

      search_elements.push({
        index: current_index,
        start: start_index,
        end: end_index,
        start_node_index: start_node_index,
        end_node_index: node_index
      });

      count++;
    } else {
      console.log(text_selection);
      console.log(search_term);
    }

    index = text.toLowerCase().indexOf(search_term.toLowerCase(), current_index + 1);
    characters_from_end = text.length - index;
    //console.log("characters from end: " + characters_from_end);

    if (count === total) {
      console.log("Completed calculations for all matched search_terms");
      node_index++;
      return ({
              "node_index": node_index,
              "search_term": search_term,
              "search_elements": search_elements,
              "total": total,
              "count": count,
              "text": text,
              "current_index": current_index,
              "result": false,
              "text_nodes": text_nodes,
              "$": $
            });
    }
  }
  node_index++;
  return ({
            "node_index": node_index,
            "search_term": search_term,
            "search_elements": search_elements,
            "total": total,
            "count": count,
            "text": text,
            "current_index": current_index,
            "result": true,
            "text_nodes": text_nodes,
            "$": $
          });
}

function alterSearchData(modify_from, change, data, text_nodes, callback) {
  if (modify_from === "start") {
    if (change > data.start) {
      change -= data.start;
      data.start_node_index = data.start_node_index - 1;
      while (text_nodes[year_index.start_node_index].data.trim().length > change) {
        change -= text_nodes[data.start_node_index].data.trim().length;
        data.start_node_index = data.start_node_index - 1;
      }
    }
  } else if (modify_from === "end") {
    if (change > text_nodes[data.end_node_index].data.trim().length - data.end) {
      change -= text_nodes[data.end_node_index].data.trim().length - data.end;
      data.end_node_index = data.end_node_index + 1;
      while (text_nodes[data.end_node_index].data.trim().length > change) {
        change -= text_nodes[data.end_node_index].data.trim().length;
        data.end_node_index = data.end_node_index + 1;
      }
    }
  }
  callback(data);
}

// source: http://stackoverflow.com/questions/4009756/how-to-count-string-occurrence-in-string
/** Function count the occurrences of substring in a string; not case sensitive
 * @param {String} string   Required. The string;
 * @param {String} subString    Required. The string to search for;
 * @param {Boolean} allowOverlapping    Optional. Default: false;
 */
function occurrences(string, subString, allowOverlapping){

    string+="", subString+="";
    string = string.toLowerCase();
    subString = subString.toLowerCase();
    //console.log(string);
    //console.log(subString);
    if(subString.length<=0) return string.length+1;

    var n=0, pos=0;
    var step=(allowOverlapping)?(1):(subString.length);

    while(true){
        pos=string.indexOf(subString,pos);
        if(pos>=0){ n++; pos+=step; } else break;
    }
    return (n);
}
