var cheerio = require("cheerio"),
async = require("async"),
Element = require("./model/element"),
Template = require("./model/template"),
TemplateDomain = require("./model/template_domain"),
TemplateGroup = require("./model/template_group"),
ElementAttribute = require("./model/element_attribute"),
ReceiptAttribute = require("./model/receipt_attribute"),
Text = require("./model/text"),
Url = require("./model/url"),
SimpleTable = require("./model/simple_table");

exports.readTemplate = function(userID, html, url, domain, json_callback) {
  var domain_id, attribute, attribute_id, _templates, $, row_attribute_id, attribute_groups,
      grouped_data = {},
      // default create these attributes
      json_message = { date: "", vendor: "", transaction: "", templates: {}, elementPaths: {} };

  async.series([
    // load domain
    function(callback) {
      console.log("----------------LOAD DOMAIN----------------------");
      SimpleTable.getIdByValue("ser_domain", "domain_name", domain, function(select_domain_id) {
        // found domain
        if (select_domain_id !== null) {
          domain_id = select_domain_id;
          $ = cheerio.load("<body>" + html + "</body>");
          console.log("Created DOM");
          callback();
        } else {
          // only add total if domain does not exist
          json_message.total = "";
          callback(new Error("Domain does not exist in DB"));
        }
      });
    },
    // load attribute & build json message for attribute
    function(callback) {
      // select all rows of ser_receipt_attribute that are not grouped
      ReceiptAttribute.getIndividualReceiptAttributes(function(attributes) {
        async.eachSeries(attributes, function(attr, each_callback) {
          attribute = attr.name;
          console.log("----------------LOAD ATTRIBUTE " + attribute + "----------------------");
          attribute_id = attr.id;

          // calculations for attribute
          async.series([
            // load all templates for attribute
            function(series_callback) {
              console.log("----------------LOAD TEMPLATES----------------------");
              TemplateDomain.getTemplatesByDomain(domain_id, attribute_id, function(templates) {
                // found templates
                if (templates !== null && templates.length > 0) {
                  _templates = templates;
                } else {
                  _templates = null;
                  json_message[attribute] = "";
                }
                series_callback();
              });
            },
            // iterate through templates to find text
            function(series_callback) {
              if (_templates !== null) {
                async.eachSeries(_templates, function(template, each_callback) {
                  console.log("----------------PROCESS TEMPLATE " + template.id + "----------------------");
                  processTemplate(template, $, null, null, function(template_result, element_id, elementPath) {
                    if (template_result !== null && template_result !== "") {
                      // return found text to add to message
                      json_message[attribute] = template_result;
                      json_message.templates[attribute] = template.id;
                      json_message.elementPaths[attribute] = elementPath;
                      each_callback(new Error(true));
                    } else {
                      TemplateDomain.getTemplateDomainByIds(domain_id, template.id, function(template_domain) {
                        if (template_domain !== null) {
                          template_domain.total_count++;
                          template_domain.probability_success = template_domain.correct_count / template_domain.total_count;
                          template_domain.save(each_callback);
                        } else {
                          each_callback();
                        }
                      });
                    }
                  });
                }, function(err) {
                  if (err && err.message !== "true") {
                    json_message[attribute] = "";
                    console.log(err.message);
                  } else if (!err) {
                    json_message[attribute] = "";
                  }
                  series_callback();
                });
              } else {
                series_callback();
              }
            }
          ], function(err, result) {
            if (err) {
              each_callback(new Error(err.message));
            } else {
              each_callback();
            }
          });
        }, function(err) {
          if (err) {
            callback(new Error(err.message));
          } else {
            callback();
          }
        });
      });
    },
    // label row html elements in DOM
    function(callback) {
      console.log("----------------PREPARE $ FOR GROUPED TEMPLATES----------------------");
      var index = 0;
      var tables = $("table, ul, ol, dl");
      // add class TwoReceipt# to each table, where # is index
      async.eachSeries(Object.keys(tables),
      function(key, each_callback) {
        if (key === "length") {
          each_callback(new Error("Completed iteration of table elements"));
        } else {
          var current_table = tables.eq(index);
          current_table.addClass("TwoReceipt" + index);

          // loop through rows and add class TwoReceipt#-# to each row, where # is table index & # is row index
          var row_index = 0, rows;
          if (current_table[0].name == "table") {
            // table can either have child rows or rows nested under tbody elements
            rows = current_table.find("tr").eq(0).parent().children("tr");
          } else {
            rows = current_table.find("li, dt, dd").eq(0).parent().children("li, dt, dd");
          }

          async.eachSeries(Object.keys(rows),
          function(row_key, each_callback2) {
            if (row_key === "length") {
              each_callback2(new Error("Completed iteration of row elements"));
            } else {
              rows.eq(row_index).addClass("TwoReceipt" + index + "-" + row_index);
              row_index++;
              each_callback2();
            }
          }, function(err) {
            if (err) {
              console.log(err.message);
            }
            index++;
            each_callback();
          });
        }
      }, function(err) {
        if (err) {
          console.log(err.message);
        }
        callback();
      });
    },
    // set row_attribute_id
    function(callback) {
      SimpleTable.getIdByValue("ser_receipt_attribute", "attribute_name", "row", function(row_id) {
        row_attribute_id = row_id;
        callback();
      });
    },
    // set attribute_groups
    function(callback) {
      SimpleTable.selectByColumn("ser_receipt_attribute_group", "'TRUE'", "TRUE", "", function(result_groups) {
        if (result_groups !== null) {
          attribute_groups = result_groups;
          callback();
        } else {
          callback(new Error("No receipt attribute groups found"));
        }
      });
    },
    // load grouped attributes & build json message for attribute
    function(callback) {
      async.eachSeries(attribute_groups, function(group, each_callback) {
        var template_groups, grouped_attributes = {};
        async.series([
          // set grouped attributes
          function(series_callback) {
            ReceiptAttribute.getGroupedReceiptAttributes(group.id, function(attributes) {
              if (attributes != null) {
                async.eachSeries(attributes, function(attribute, each_callback2) {
                  grouped_attributes[attribute.id] = attribute.name;
                  each_callback2();
                }, function(err) {
                  if (err) {
                    series_callback(err);
                  } else {
                    series_callback();
                  }
                });
              } else {
                series_callback(new Error("No receipt attributes for attribute group"));
              }
            });
          },
          // set template_groups for attribute_group and domain_id
          function(series_callback) {
            TemplateGroup.getTemplateGroups(group.id, domain_id, function(result_groups) {
              if (result_groups != null) {
                template_groups = result_groups;
                series_callback();
              } else {
                series_callback(new Error("No template_groups for domain"));
              }
            });
          },
          // iterate through template groups
          function(series_callback) {
            async.eachSeries(template_groups, function(template_group, each_callback2) {
              // get all templates in template_group
              Template.getTemplatesByGroup(template_group.id, function(templates) {
                if (templates != null) {
                  console.log("----------------PROCESS GROUPED TEMPLATES----------------------");
                  processGroupedTemplates(templates, $, row_attribute_id, domain_id, grouped_attributes, function(results) {
                    if (results != null) {
                      if (grouped_data[group.group_name] === undefined) {
                        grouped_data[group.group_name] = {};
                      }
                      grouped_data[group.group_name][template_group.id] = results;
                    }
                    each_callback2();
                  });
                } else {
                  console.log("No templates in template_group");
                  each_callback2();
                }
              });
            }, function(err) {
              if (err) {
                series_callback(err);
              } else {
                series_callback();
              }
            });
          },
          // remove duplicate results and attach results to json_message
          function(series_callback) {
            if (grouped_data[group.group_name] != null) {
              var formatted_items = {};
              json_message.templates[group.group_name] = {};
              json_message.elementPaths[group.group_name] = {};
              var keys = Object.keys(grouped_data[group.group_name]);
              var non_row_index = 0;
              // grouped attribute keys, except row attribute
              var attribute_keys = Object.keys(grouped_attributes);
              attribute_keys.splice(attribute_keys.indexOf(row_attribute_id), 1);

              // loop through each template_group
              async.eachSeries(keys, function(key, each_callback) {
                var row_keys = Object.keys(grouped_data[group.group_name][key]);

                // loop through each row in item
                async.eachSeries(row_keys, function(row_key, each_callback2) {
                  if (row_key !== "templates" && row_key !== "elementPaths" && row_key !== "0") {
                    // row already exists, compare with selected row
                    if (formatted_items.hasOwnProperty(row_key)) {
                      // loop through each attribute to compare individual results
                      async.eachSeries(attribute_keys, function(attribute_key, each_callback3) {
                        var attr = grouped_attributes[attribute_key];
                        // attribute already exists for row
                        if (formatted_items[row_key].hasOwnProperty(attr) && grouped_data[group.group_name][key][row_key].hasOwnProperty(attr)) {
                          compareAttributeResults(formatted_items[row_key][attr], grouped_data[group.group_name][key][row_key][attr], function(replace_attr) {
                            if (replace_attr) {
                              // lower probability for old template
                              TemplateDomain.getTemplateDomainByIds(domain_id, json_message.templates[group.group_name][row_key][attr], function(template_domain) {
                                // replace attribute
                                formatted_items[row_key][attr] = grouped_data[group.group_name][key][row_key][attr];
                                json_message.templates[group.group_name][row_key][attr] = grouped_data[group.group_name][key].templates[row_key][attr];
                                json_message.elementPaths[group.group_name][row_key] = grouped_data[group.group_name][key].elementPaths;

                                if (template_domain != null) {
                                  template_domain.total_count++;
                                  template_domain.probability_success = template_domain.correct_count / template_domain.total_count;
                                  template_domain.save(each_callback3);
                                } else {
                                  each_callback3();
                                }
                              });
                            } else {
                              // lower probability for new template
                              TemplateDomain.getTemplateDomainByIds(domain_id, grouped_data[group.group_name][key].templates[row_key][attr], function(template_domain) {
                                if (template_domain != null) {
                                  template_domain.total_count++;
                                  template_domain.probability_success = template_domain.correct_count / template_domain.total_count;
                                  template_domain.save(each_callback3);
                                } else {
                                  each_callback3();
                                }
                              });
                            }
                          });
                        }
                        // attribute does not exist for row, but exists for current template group
                        else {
                          if (grouped_data[group.group_name][key][row_key].hasOwnProperty(attr)) {
                            formatted_items[row_key][attr] = grouped_data[group.group_name][key][row_key][attr];
                            json_message.templates[group.group_name][row_key][attr] = grouped_data[group.group_name][key].templates[row_key][attr];
                            json_message.elementPaths[group.group_name][row_key] = grouped_data[group.group_name][key].elementPaths;
                          }
                          each_callback3();
                        }
                      }, function(err) {
                        if (err) {
                          console.log(err.message);
                        }
                        each_callback2();
                      });
                    }
                    // row does not exist, add row
                    else {
                      formatted_items[row_key] = grouped_data[group.group_name][key][row_key];
                      json_message.templates[group.group_name][row_key] = grouped_data[group.group_name][key].templates[row_key];
                      json_message.elementPaths[group.group_name][row_key] = grouped_data[group.group_name][key].elementPaths;
                      each_callback2();
                    }
                  }
                  // template group did not have row attribute, do not allow duplicates
                  else if (row_key === "0") {
                    // loop through existing non_row_indices to find matches
                    var compare_row_index = 0, match_index;
                    async.whilst(function() { return compare_row_index < non_row_index; },
                    function(whilst_callback) {
                      var existing_keys = Object.keys(formatted_items[compare_row_index]);
                      var new_keys = Object.keys(grouped_data[group.group_name][key][row_key]);
                      // existing item has the same # of attributes as new item
                      if (existing_keys.length === new_keys.length) {
                        // track if match is duplicate or replacement
                        var duplicate = true;
                        async.eachSeries(existing_keys, function(existing_key, each_callback3) {
                          if (grouped_data[group.group_name][key][row_key].hasOwnProperty(existing_key)) {
                            // exact match
                            if (formatted_items[compare_row_index][existing_key] === grouped_data[group.group_name][key][row_key][existing_key]) {
                              each_callback3();
                            }
                            // possible replacement match
                            else {
                              duplicate = false;
                              compareAttributeResults(formatted_items[compare_row_index][existing_key], grouped_data[group.group_name][key][row_key][existing_key],
                                function(replace_attr) {
                                  if (!replace_attr) {
                                    each_callback3(new Error("no match found"));
                                  } else {
                                    each_callback3();
                                  }
                                }
                              );
                            }
                          } else {
                            duplicate = false;
                            each_callback3(new Error("no match found"));
                          }
                        }, function(err) {
                          if (err && err.message !== "no match found") {
                            console.log(err.message);
                          }

                          if (err && err.message === "no match found") {
                            compare_row_index++;
                            whilst_callback();
                          }
                          // if identical match is found
                          else if (duplicate) {
                            whilst_callback(new Error("match found"));
                          }
                          // if replacement
                          else {
                            match_index = compare_row_index;
                            whilst_callback(new Error("match found"));
                          }
                        });
                      }
                      // existing item has different # of attributes than new item, no match found
                      else {
                        compare_row_index++;
                        whilst_callback();
                      }
                    }, function(err) {
                      if (err && err.message !== "match found") {
                        console.log(err.message);
                      }

                      // replace existing item & lower probability for replaced item
                      if (match_index != null && err && err.message === "match found") {
                        // loop through item attributes
                        async.eachSeries(attribute_keys, function(attribute_key, each_callback3) {
                          var attr = grouped_attributes[attribute_key];
                          // attribute exists for row
                          if (formatted_items[match_index].hasOwnProperty(attr)) {
                            TemplateDomain.getTemplateDomainByIds(domain_id, json_message.templates[group.group_name][match_index][attr], function(template_domain) {
                              if (template_domain != null) {
                                template_domain.total_count++;
                                template_domain.probability_success = template_domain.correct_count / template_domain.total_count;
                                template_domain.save(each_callback3);
                              } else {
                                each_callback3();
                              }
                            });
                          } else {
                            each_callback3();
                          }
                        }, function(err2) {
                          if (err2) {
                            console.log(err2.message);
                          }

                          formatted_items[match_index] = grouped_data[group.group_name][key][row_key];
                          json_message.templates[group.group_name][match_index] = grouped_data[group.group_name][key].templates[row_key];
                          json_message.elementPaths[group.group_name][match_index] = grouped_data[group.group_name][key].elementPaths;
                          each_callback2();
                        });
                      }
                      // toss new item & lower probability for new item
                      else if (err && err.message === "match found") {
                        // loop through item attributes
                        async.eachSeries(attribute_keys, function(attribute_key, each_callback3) {
                          var attr = grouped_attributes[attribute_key];
                          // attribute exists for row
                          if (grouped_data[group.group_name][key][row_key].hasOwnProperty(attr)) {
                            TemplateDomain.getTemplateDomainByIds(domain_id, grouped_data[group.group_name][key].templates[row_key][attr], function(template_domain) {
                              if (template_domain != null) {
                                template_domain.total_count++;
                                template_domain.probability_success = template_domain.correct_count / template_domain.total_count;
                                template_domain.save(each_callback3);
                              } else {
                                each_callback3();
                              }
                            });
                          } else {
                            each_callback3();
                          }
                        }, function(err2) {
                          if (err2) {
                            console.log(err2.message);
                          }
                          each_callback2();
                        });
                      }
                      // add new item
                      else {
                        formatted_items[non_row_index] = grouped_data[group.group_name][key][row_key];
                        json_message.templates[group.group_name][non_row_index] = grouped_data[group.group_name][key].templates[row_key];
                        json_message.elementPaths[group.group_name][non_row_index] = grouped_data[group.group_name][key].elementPaths;
                        non_row_index++;
                        each_callback2();
                      }
                    });
                  }
                  // templates key
                  else {
                    each_callback2();
                  }
                }, function(err) {
                  if (err) {
                    console.log(err.message);
                  }
                  each_callback();
                });
              }, function(err) {
                if (err) {
                  console.log(err.message);
                }

                // re-calculate template group probability
                async.eachSeries(template_groups, function(template_group, each_callback) {
                  // get all templates in template_group
                  Template.getTemplatesByGroup(template_group.id, function(templates) {
                    if (templates != null) {
                      var correct_count = 0, total_count = 0;
                      async.eachSeries(templates, function(template, each_callback2) {
                        TemplateDomain.getTemplateDomainByIds(domain_id, template.id, function(template_domain) {
                          if (template_domain != null) {
                            correct_count += template_domain.correct_count;
                            total_count += template_domain.total_count;
                          }
                          each_callback2();
                        });
                      }, function(err2) {
                        if (err2) {
                          console.log(err2.message);
                        }
                        template_group.correct_count = correct_count;
                        template_group.total_count = total_count;
                        template_group.probability_success = correct_count / total_count;
                        template_group.save(each_callback);
                      });
                    } else {
                      each_callback(new Error("No templates in template_group"));
                    }
                  });
                }, function(err2) {
                  if (err2) {
                    console.log(err2.message);
                  }
                  // set json_message attribute groups
                  json_message[group.group_name] = formatted_items;
                  series_callback();
                });
              });
            } else {
              series_callback();
            }
          }
        ], function(err, results) {
          if (err) {
            each_callback(err);
          } else {
            each_callback();
          }
        });
      }, function(err) {
        if (err) {
          console.log(err.message);
        }
        callback();
      });
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Completed readTemplate method");
    }
    json_callback(json_message);
  });
};

// compares template with $ html dom, returns value if matches, null if doesn't match
function processTemplate(template, $, match_class, body_element_id, callback) {
  constructElementPath(template.id, $, match_class, body_element_id, function(selection, element_id, elementPath) {
    if (selection != null) {
      // calculate text off of selection
      findTextSelection(template.id, selection, function(result) {
        if (result !== "") {
          callback(result, element_id, elementPath);
        } else {
          callback(null);
        }
      });
    } else {
      callback(null);
    }
  });
}

// forms text from selection that matches template text and returns it (or empty string if it can't be found)
function findTextSelection(templateId, selection, funcCallback) {
  var textNode, element, leftText, rightText, leftIndex;
  var textResult = selection.text().trim().replace(/\n/g, "");
  var negative = false;
  console.log("----------------CALCULATE TEXT----------------------");
  async.series([
    // get root text node from template
    function(callback) {
      Text.getRootTextByTemplate(templateId, function(err, rootText) {
        if (err) {
          return callback(new Error("rootText not found"));
        } else {
          textNode = rootText;
          return callback();
        }
      });
    },
    // get element from textNode
    function(callback) {
      if (textNode.element_id != null) {
        Element.getElementById(textNode.element_id, function(err, rootElement) {
          if (err) {
            return callback(new Error("root element not found"));
          } else {
            element = rootElement;
            return callback();
          }
        });
      } else {
        return callback(new Error("textNode does not have an element_id"));
      }
    },
    // get left text node if it exists and is under root element
    function(callback) {
      textNode.left = function(leftResult) {
        if (leftResult != null) {
          Element.getElementById(leftResult.element_id, function(err, leftElement) {
            // leftResult element cannot be a sibling
            if (leftElement != null && leftElement.relation !== "sibling") {
              leftText = leftResult;
            }
            return callback();
          });
        } else {
          return callback();
        }
      };
    },
    // get right text node if it exists and is under root element
    function(callback) {
      textNode.right = function(rightResult) {
        if (rightResult != null) {
          Element.getElementById(rightResult.element_id, function(err, rightElement) {
            // rightResult element cannot be a sibling
            if (rightElement != null && rightElement.relation !== "sibling") {
              rightText = rightResult;
            }
            return callback();
          });
        } else {
          return callback();
        }
      };
    },
    // calculation for finding leftText match and for money values to find negatives
    function(callback) {
      if (leftText != null) {
        leftIndex = textResult.indexOf(leftText.text);

        // keep trimming off leftText to match until it is 3 characters long
        while (leftIndex === -1 && leftText.text.length > 3) {
          leftText.text = leftText.text.substring(1);
          leftIndex = textResult.indexOf(leftText.text);
        }

        if (leftIndex !== -1) {
          var negativeCount = 0;

          // find how many negative signs exist in the text left of end result
          var leftTextResult = textResult.substring(0, leftIndex);
          var negativeIndex = leftTextResult.indexOf("-");

          while (negativeIndex !== -1) {
            negativeCount++;
            negativeIndex = leftTextResult.indexOf("-", negativeIndex + 1);
          }

          // if there are negative signs in the text to the left of leftText, result is negative
          // reasoning is leftText is a static match, so negative sign would not be included. it may be to the left
          if (negativeCount > 0) {
            negative = true;
          }
        }
      }
      return callback();
    },
    // calculate left & right text
    function(callback) {
      // cut off left side of textResult
      if (leftIndex != null && leftIndex !== -1) {
        textResult = textResult.substring(leftIndex + leftText.text.length);
      }

      if (rightText != null) {
        var rightIndex = textResult.indexOf(rightText.text);

        // keep trimming off rightText to match until it is 3 characters long
        while (rightIndex === -1 && rightText.text.length > 3) {
          rightText.text = rightText.text.substring(0, rightText.text.length - 1);
          rightIndex = textResult.indexOf(rightText.text);
        }

        // cut off right side of textResult
        if (rightIndex !== -1) {
          textResult = textResult.substring(0, rightIndex);
        }
      }
      textResult = textResult.trim();

      // check if result is a number before applying negative
      if (!isNaN(parseInt(textResult, 10)) && negative) {
        textResult = "-" + textResult;
      }

      return callback();
    }
  ], function(err, result) {
    if (err && err.message !== "true") {
      console.log(err.message);
      return funcCallback(null);
    } else {
      return funcCallback(textResult);
    }
  });
}

// constructs a dom selection from the body (or optional body_element_id) to the root element and returns the root element (or null if it can't be found)
// returns element_id of optional match_class.  if match_class is found while constructing path, element_id will be returned
// returns array representing the element path, listing order of child elements where each index is an extra level from body
function constructElementPath(template_id, $, match_class, body_element_id, func_callback) {
  var element, selection, element_id, elementPath = [];
  console.log("----------------CONSTRUCT ELEMENT PATH----------------------");
  async.series([
    // set element to template body_element
    function(callback) {
      if (body_element_id == null) {
        selection = $("body");
        Element.getBodyElementByTemplate(template_id, function(err, body_element) {
          if (err) {
            callback(new Error("body element not found"));
          } else {
            element = body_element;
            callback();
          }
        });
      } else {
        Element.getElementById(body_element_id, function(err, body_element) {
          if (err) {
            callback(new Error("body element not found"));
          } else {
            selection = $("." + match_class);
            element = body_element;
            callback();
          }
        });
      }
    },
    // construct selector path from body to root element
    function(callback) {
      // body element starts at 0
      //elementPath.push(0);

      async.whilst(
        // whilst loop condition
        function() { return element.element_id != null; },
        // whilst loop function
        function(whilst_callback) {
          async.series([
            // set element as child element
            function(series2_callback) {
              element.element = function(element_result) {
                element = element_result;
                series2_callback();
              };
            },
            // select element
            function(series2_callback) {
              selection = selection.children();
              if (selection.length === 0) {
                series2_callback(new Error("selection has no children"));
              } else {
                series2_callback();
              }
            },
            // select order (does not work with tag & attributes)
            function(series2_callback) {
              elementPath.push(element.order);

              selection = selection.eq(element.order);
              if (selection.length === 0) {
                series2_callback(new Error("order selected does not exist"));
              } else {
                series2_callback();
              }
            },
            // compare with tag for additional accuracy
            function(series2_callback) {
              element.tag = function(tag_result) {
                if (selection[0].name !== tag_result) {
                  series2_callback(new Error("tag does not match"));
                }
                series2_callback();
              };
            },
            // check if (optional) match_class
            function(series2_callback) {
              if (match_class != null && body_element_id == null &&
                  selection.attr("class") != null &&
                  selection.attr("class").indexOf(match_class) !== -1) {
                console.log("Set element_id from element path");
                element_id = element.id;
              }
              series2_callback();
            }
          ], function(err, result) {
            if (err) {
              whilst_callback(new Error(err.message));
            } else {
              whilst_callback();
            }
          });
        },
        function(err) {
          if (err) {
            callback(new Error(err.message));
          } else {
            callback();
          }
        }
      );
    },
    // calculate on match
    function(callback) {
      // check if there is a match
      if (selection != null && selection.length !== 0) {
        callback(null, selection);
      } else {
        callback();
      }
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
      func_callback(null);
    } else {
      func_callback(result[result.length-1], element_id, elementPath);
    }
  });
}

// compares templates with $ html dom, returns all matched values, null if doesn't match
function processGroupedTemplates(templates, $, row_attribute_id, domain_id, grouped_attributes, callback) {
  var table_row_id /* 0-0 */, row_class /* TwoReceipt0-0 */, sibling_rows, json_elementPath,
      row_element_id = {},
      json_results = {},
      json_templates = {};

  async.series([
    // setup grouped calculation if row template exists and matches
    function(series_callback) {
      if (row_attribute_id == null) {
        table_row_id = 0;
      }
      async.each(templates, function(template, each_callback) {
        if (table_row_id !== 0 && template.attribute_id === row_attribute_id) {
          constructElementPath(template.id, $, null, null, function(row_element, element_id, elementPath) {
            if (row_element != null) {
              json_elementPath = elementPath;
              row_class = row_element.attr("class");
              row_class = row_class.substring(row_class.indexOf("TwoReceipt"));
              table_row_id = row_class.substring("TwoReceipt".length);
              // store siblings with same tag name
              sibling_rows = row_element.siblings(row_element[0].name);
              each_callback();
            }
            // row not found, so no templates will match
            else {
              each_callback(new Error("Row template did not match"));
            }
          });
        } else {
          each_callback();
        }
      }, function(err) {
        if (err) {
          series_callback(err);
        } else {
          if (table_row_id == null) {
            table_row_id = 0;
          }
          series_callback();
        }
      });
    },
    // complete first calculation, store row_element_id if row template exists
    function(series_callback) {
      async.eachSeries(templates, function(template, each_callback) {
        if (template.attribute_id !== row_attribute_id) {
          processTemplate(template, $, row_class, null, function(template_result, element_id, elementPath) {
            // match found, store element_id for template and json results (can be empty string)
            if (template_result != null) {
              if (json_results[table_row_id] == null) {
                json_results[table_row_id] = {};
                json_templates[table_row_id] = {};
              }
              json_results[table_row_id][grouped_attributes[template.attribute_id]] = template_result;
              json_templates[table_row_id][grouped_attributes[template.attribute_id]] = template.id;
              row_element_id[template.id] = element_id;

              each_callback();
            }
            // no match is found, stop calculating with template
            else {
              TemplateDomain.getTemplateDomainByIds(domain_id, template.id, function(template_domain) {
                if (template_domain !== null) {
                  template_domain.total_count++;
                  template_domain.probability_success = template_domain.correct_count / template_domain.total_count;
                  template_domain.save(function() {
                    each_callback(new Error("Initial template did not return results"));
                  });
                } else {
                  each_callback(new Error("Initial template did not return results"));
                }
              });
            }
          });
        } else {
          each_callback();
        }
      }, function(err) {
        if (err) {
          series_callback(err);
        } else {
          series_callback();
        }
      });
    },
    // calculate other rows if row template exists
    function(series_callback) {
      if (table_row_id !== 0) {
        // loop through each sibling row
        async.eachSeries(sibling_rows, function(target_row, each_callback) {
          // set row variables
          row_class = target_row.attribs["class"];
          row_class = row_class.substring(row_class.indexOf("TwoReceipt"));
          table_row_id = row_class.substring("TwoReceipt".length);

          async.eachSeries(templates, function(template, each_callback2) {
            if (template.attribute_id != row_attribute_id) {
              // different function
              processTemplate(template, $, row_class, row_element_id[template.id], function(template_result) {
                // match found, store element_id for template and json results (can be empty string)
                if (template_result != null) {

                  if (json_results[table_row_id] == null) {
                    json_results[table_row_id] = {};
                    json_templates[table_row_id] = {};
                  }
                  json_results[table_row_id][grouped_attributes[template.attribute_id]] = template_result;
                  json_templates[table_row_id][grouped_attributes[template.attribute_id]] = template.id;
                  each_callback2();
                }
                // no match is found, stop calculating with template
                else {
                  TemplateDomain.getTemplateDomainByIds(domain_id, template.id, function(template_domain) {
                    if (template_domain != null) {
                      template_domain.total_count++;
                      template_domain.probability_success = template_domain.correct_count / template_domain.total_count;
                      template_domain.save(function() {
                        each_callback2(new Error("Template did not return results"));
                      });
                    } else {
                      each_callback2(new Error("Template did not return results"));
                    }
                  });
                }
              });
            } else {
              each_callback2();
            }
          }, function(err) {
            if (err) {
              console.log(err.message);
            }
            each_callback();
          });
        }, function(err) {
          if (err) {
            series_callback(err);
          } else {
            series_callback();
          }
        });
      } else {
        series_callback();
      }
    }
  ], function(err, results) {
    if (err) {
      console.log(err.message);
      callback(null);
    } else {
      json_results.templates = json_templates;
      json_results.elementPaths = json_elementPath;
      callback(json_results);
    }
  });
}

// compares two values and returns true if the new value should replace the original value
function compareAttributeResults(original_value, new_value, callback) {
  // for text, original value contains new value and new value is more specific
  if (typeof(original_value) == "string" && original_value.indexOf(new_value) != -1 && new_value.length < original_value.length) {
    callback(true);
  }
  // for numbers, new value contains original value and new value is more detailed
  else if (new_value.indexOf(original_value) != -1 && new_value.length > original_value.length) {
    callback(true);
  } else {
    callback(false);
  }
}
