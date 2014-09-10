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

exports.readTemplate = function(userId, html, url, domain, jsonCallback) {
  var domainId;
  var attribute;
  var attributeId;
  var templates;
  var $;
  var rowAttributeId;
  var attributeGroups;
  var groupedData = {};
  // default create these attributes
  var jsonMessage = { date: "", vendor: "", transaction: "", total: "", templates: {}, elementPaths: {} };

  async.series([
    // load domain
    function(callback) {
      console.log("----------------LOAD DOMAIN----------------------");
      SimpleTable.getIdByValue("ser_domain", "domain_name", domain, function(_domainId) {
        // found domain
        if (_domainId != null) {
          domainId = _domainId;
          $ = cheerio.load("<body>" + html + "</body>");
          console.log("Created DOM");
          return callback();
        } else {
          return callback(new Error("Domain does not exist in DB"));
        }
      });
    },
    // load attribute & build json message for attribute
    function(callback) {
      // select all rows of ser_receipt_attribute that are not grouped
      ReceiptAttribute.getIndividualReceiptAttributes(function(attributes) {
        async.eachSeries(attributes, function(attr, eachCallback) {
          attribute = attr.name;
          attributeId = attr.id;
          console.log("----------------LOAD ATTRIBUTE " + attribute + "----------------------");

          // calculations for attribute
          async.series([
            // load all templates for attribute
            function(seriesCallback) {
              console.log("----------------LOAD TEMPLATES----------------------");
              TemplateDomain.getTemplatesByDomain(domainId, attributeId, function(_templates) {
                // found templates
                if (_templates != null && _templates.length > 0) {
                  templates = _templates;
                } else {
                  templates = null;
                  jsonMessage[attribute] = "";
                }
                return seriesCallback();
              });
            },
            // iterate through templates to find text
            function(seriesCallback) {
              if (templates != null) {
                async.eachSeries(templates, function(template, eachCallback) {
                  console.log("----------------PROCESS TEMPLATE " + template.id + "----------------------");
                  processTemplate(template, $, null, null, function(templateResult, elementId, elementPath) {
                    if (templateResult != null && templateResult !== "") {
                      // return found text to add to message
                      jsonMessage[attribute] = templateResult;
                      jsonMessage.templates[attribute] = template.id;
                      jsonMessage.elementPaths[attribute] = elementPath;
                      return eachCallback(new Error(true));
                    } else {
                      TemplateDomain.getTemplateDomainByIds(domainId, template.id, function(templateDomain) {
                        if (templateDomain != null) {
                          templateDomain.total_count++;
                          templateDomain.probability_success = templateDomain.correct_count / templateDomain.total_count;
                          templateDomain.save(eachCallback);
                        } else {
                          return eachCallback();
                        }
                      });
                    }
                  });
                }, function(err) {
                  if (err && err.message !== "true") {
                    jsonMessage[attribute] = "";
                    console.log(err.message);
                  } else if (!err) {
                    jsonMessage[attribute] = "";
                  }
                  return seriesCallback();
                });
              } else {
                return seriesCallback();
              }
            }
          ], function(err, result) {
            if (err) {
              return eachCallback(new Error(err.message));
            } else {
              return eachCallback();
            }
          });
        }, function(err) {
          if (err) {
            return callback(new Error(err.message));
          } else {
            return callback();
          }
        });
      });
    },
    // label row html elements in DOM
    function(callback) {
      console.log("----------------PREPARE $ FOR GROUPED TEMPLATES----------------------");
      var tables = $("table, ul, ol, dl");
      // add class TwoReceipt# to each table, where # is index
      var keys = Object.keys(tables);
      for (var index = 0; index < keys.length; index++) {
        var key = keys[index];
        if (key === "length") {
          console.log("Completed iteration of table elements");
          break;
        } else {
          var currentTable = tables.eq(index);
          currentTable.addClass("TwoReceipt" + index);

          // loop through rows and add class TwoReceipt#-# to each row, where # is table index & # is row index
          var rows;
          if (currentTable[0].name == "table") {
            // table can either have child rows or rows nested under tbody elements
            rows = currentTable.find("tr").eq(0).parent().children("tr");
          } else {
            rows = currentTable.find("li, dt, dd").eq(0).parent().children("li, dt, dd");
          }

          var rowKeys = Object.keys(rows);
          for (var rowIndex = 0; rowIndex < rowKeys.length; rowIndex++) {
            var rowKey = rowKeys[j];
            if (rowKey === "length") {
              console.log("Completed iteration of row elements");
              break;
            } else {
              rows.eq(rowIndex).addClass("TwoReceipt" + index + "-" + rowIndex);
            }
          }
        }
      }
      return callback();
    },
    // set rowAttributeId
    function(callback) {
      SimpleTable.getIdByValue("ser_receipt_attribute", "attribute_name", "row", function(rowId) {
        rowAttributeId = rowId;
        return callback();
      });
    },
    // set attributeGroups
    function(callback) {
      SimpleTable.selectByColumn("ser_receipt_attribute_group", "'TRUE'", "TRUE", "", function(resultGroups) {
        if (resultGroups !== null) {
          attributeGroups = resultGroups;
          return callback();
        } else {
          return callback(new Error("No receipt attribute groups found"));
        }
      });
    },
    // load grouped attributes & build json message for attribute
    function(callback) {
      async.eachSeries(attributeGroups, function(group, eachCallback) {
        var templateGroups;
        var groupedAttributes = {};
        async.series([
          // set grouped attributes
          function(seriesCallback) {
            ReceiptAttribute.getGroupedReceiptAttributes(group.id, function(attributes) {
              if (attributes != null) {
                for (var i = 0; i < attributes.length; i++) {
                  var attribute = attributes[i];
                  groupedAttributes[attribute.id] = attribute.name;
                }
                return seriesCallback();
              } else {
                return seriesCallback(new Error("No receipt attributes for attribute group"));
              }
            });
          },
          // set templateGroups for attribute_group and domainId
          function(seriesCallback) {
            TemplateGroup.getTemplateGroups(group.id, domainId, function(resultGroups) {
              if (resultGroups != null) {
                templateGroups = resultGroups;
                seriesCallback();
              } else {
                seriesCallback(new Error("No templateGroups for domain"));
              }
            });
          },
          // iterate through template groups
          function(seriesCallback) {
            async.eachSeries(templateGroups, function(templateGroup, eachCallback2) {
              // get all templates in template_group
              Template.getTemplatesByGroup(templateGroup.id, function(_templates) {
                if (_templates != null) {
                  console.log("----------------PROCESS GROUPED TEMPLATES----------------------");
                  processGroupedTemplates(_templates, $, rowAttributeId, domainId, groupedAttributes, function(results) {
                    if (results != null) {
                      if (groupedData[group.group_name] == null) {
                        groupedData[group.group_name] = {};
                      }
                      groupedData[group.group_name][templateGroup.id] = results;
                    }
                    return eachCallback2();
                  });
                } else {
                  console.log("No templates in template_group");
                  return eachCallback2();
                }
              });
            }, function(err) {
              if (err) {
                return seriesCallback(err);
              } else {
                return seriesCallback();
              }
            });
          },
          // remove duplicate results and attach results to jsonMessage
          function(seriesCallback) {
            if (groupedData[group.group_name] != null) {
              var formattedItems = {};
              jsonMessage.templates[group.group_name] = {};
              jsonMessage.elementPaths[group.group_name] = {};
              var keys = Object.keys(groupedData[group.group_name]);
              var nonRowIndex = 0;
              // grouped attribute keys, except row attribute
              var attributeKeys = Object.keys(groupedAttributes);
              attributeKeys.splice(attributeKeys.indexOf(rowAttributeId), 1);

              // loop through each template_group
              async.eachSeries(keys, function(key, eachCallback) {
                var rowKeys = Object.keys(groupedData[group.group_name][key]);

                // loop through each row in item
                async.eachSeries(rowKeys, function(rowKey, eachCallback2) {
                  if (rowKey !== "templates" && rowKey !== "elementPaths" && rowKey !== "0") {
                    // row already exists, compare with selected row
                    if (formattedItems.hasOwnProperty(rowKey)) {
                      // loop through each attribute to compare individual results
                      async.eachSeries(attributeKeys, function(attributeKey, eachCallback3) {
                        var attr = groupedAttributes[attributeKey];
                        // attribute already exists for row
                        if (formattedItems[rowKey].hasOwnProperty(attr) && groupedData[group.group_name][key][rowKey].hasOwnProperty(attr)) {
                          var replaceAttr = compareAttributeResults(formattedItems[rowKey][attr], groupedData[group.group_name][key][rowKey][attr]);
                          if (replaceAttr) {
                            // lower probability for old template
                            TemplateDomain.getTemplateDomainByIds(domainId, jsonMessage.templates[group.group_name][rowKey][attr], function(templateDomain) {
                              // replace attribute
                              formattedItems[rowKey][attr] = groupedData[group.group_name][key][rowKey][attr];
                              jsonMessage.templates[group.group_name][rowKey][attr] = groupedData[group.group_name][key].templates[rowKey][attr];
                              jsonMessage.elementPaths[group.group_name][rowKey] = groupedData[group.group_name][key].elementPaths;

                              if (templateDomain != null) {
                                templateDomain.total_count++;
                                templateDomain.probability_success = templateDomain.correct_count / templateDomain.total_count;
                                templateDomain.save(eachCallback3);
                              } else {
                                return eachCallback3();
                              }
                            });
                          } else {
                            // lower probability for new template
                            TemplateDomain.getTemplateDomainByIds(domainId, groupedData[group.group_name][key].templates[rowKey][attr], function(templateDomain) {
                              if (templateDomain != null) {
                                templateDomain.total_count++;
                                templateDomain.probability_success = templateDomain.correct_count / templateDomain.total_count;
                                templateDomain.save(eachCallback3);
                              } else {
                                return eachCallback3();
                              }
                            });
                          }
                        }
                        // attribute does not exist for row, but exists for current template group
                        else {
                          if (groupedData[group.group_name][key][rowKey].hasOwnProperty(attr)) {
                            formattedItems[rowKey][attr] = groupedData[group.group_name][key][rowKey][attr];
                            jsonMessage.templates[group.group_name][rowKey][attr] = groupedData[group.group_name][key].templates[rowKey][attr];
                            jsonMessage.elementPaths[group.group_name][rowKey] = groupedData[group.group_name][key].elementPaths;
                          }
                          return eachCallback3();
                        }
                      }, function(err) {
                        if (err) {
                          console.log(err.message);
                        }
                        return eachCallback2();
                      });
                    }
                    // row does not exist, add row
                    else {
                      formattedItems[rowKey] = groupedData[group.group_name][key][rowKey];
                      jsonMessage.templates[group.group_name][rowKey] = groupedData[group.group_name][key].templates[rowKey];
                      jsonMessage.elementPaths[group.group_name][rowKey] = groupedData[group.group_name][key].elementPaths;
                      return eachCallback2();
                    }
                  }
                  // template group did not have row attribute, do not allow duplicates
                  else if (rowKey === "0") {
                    // loop through existing non_row_indices to find matches
                    var compareRowIndex = 0;
                    var matchIndex;
                    var matchFound = false;

                    while (compareRowIndex < nonRowIndex) {
                      var existingKeys = Object.keys(formattedItems[compareRowIndex]);
                      var newKeys = Object.keys(groupedData[group.group_name][key][rowKey]);
                      // existing item has the same # of attributes as new item
                      if (existingKeys.length === newKeys.length) {
                        // track if match is duplicate or replacement
                        var duplicate = true;
                        var noMatchFound = false;

                        for (var i = 0; i < existingKeys.length; i++) {
                          var existingKey = existingKeys[i];
                          if (groupedData[group.group_name][key][rowKey].hasOwnProperty(existingKey)) {
                            // no exact match, possible replacement match
                            if (formattedItems[compareRowIndex][existing_key] !== groupedData[group.group_name][key][rowKey][existingKey]) {
                              duplicate = false;
                              var replaceAttr = compareAttributeResults(formattedItems[compareRowIndex][existingKey], groupedData[group.group_name][key][rowKey][existingKey]);
                              if (!replaceAttr) {
                                console.log("no match found");
                                noMatchFound = true;
                                compareRowIndex++;
                                break;
                              }
                            }
                          } else {
                            duplicate = false;
                            console.log("no match found");
                            noMatchFound = true;
                            compareRowIndex++;
                            break;
                          }
                        }

                        if (!duplicate && !noMatchFound) {
                          matchIndex = compareRowIndex;
                          matchFound = true;
                          break;
                        } else if (!noMatchFound) {
                          matchFound = true;
                          break;
                        }
                      }
                      // existing item has different # of attributes than new item, no match found
                      else {
                        compareRowIndex++;
                      }
                    }

                    // replace existing item & lower probability for replaced item
                    if (matchIndex != null && matchFound) {
                      // loop through item attributes
                      async.eachSeries(attributeKeys, function(attributeKey, eachCallback3) {
                        var attr = groupedAttributes[attributeKey];
                        // attribute exists for row
                        if (formattedItems[matchIndex].hasOwnProperty(attr)) {
                          TemplateDomain.getTemplateDomainByIds(domainId, jsonMessage.templates[group.group_name][matchIndex][attr], function(templateDomain) {
                            if (templateDomain != null) {
                              templateDomain.total_count++;
                              templateDomain.probability_success = templateDomain.correct_count / templateDomain.total_count;
                              templateDomain.save(eachCallback3);
                            } else {
                              eachCallback3();
                            }
                          });
                        } else {
                          eachCallback3();
                        }
                      }, function(err2) {
                        if (err2) {
                          console.log(err2.message);
                        }

                        formattedItems[matchIndex] = groupedData[group.group_name][key][rowKey];
                        jsonMessage.templates[group.group_name][matchIndex] = groupedData[group.group_name][key].templates[rowKey];
                        jsonMessage.elementPaths[group.group_name][matchIndex] = groupedData[group.group_name][key].elementPaths;
                        return eachCallback2();
                      });
                    }
                    // toss new item & lower probability for new item
                    else if (matchFound) {
                      // loop through item attributes
                      async.eachSeries(attributeKeys, function(attributeKey, eachCallback3) {
                        var attr = groupedAttributes[attributeKey];
                        // attribute exists for row
                        if (groupedData[group.group_name][key][rowKey].hasOwnProperty(attr)) {
                          TemplateDomain.getTemplateDomainByIds(domainId, groupedData[group.group_name][key].templates[rowKey][attr], function(templateDomain) {
                            if (templateDomain != null) {
                              templateDomain.total_count++;
                              templateDomain.probability_success = templateDomain.correct_count / templateDomain.total_count;
                              templateDomain.save(eachCallback3);
                            } else {
                              return eachCallback3();
                            }
                          });
                        } else {
                          return eachCallback3();
                        }
                      }, function(err2) {
                        if (err2) {
                          console.log(err2.message);
                        }
                        return eachCallback2();
                      });
                    }
                    // add new item
                    else {
                      formattedItems[nonRowIndex] = groupedData[group.group_name][key][rowKey];
                      jsonMessage.templates[group.group_name][nonRowIndex] = groupedData[group.group_name][key].templates[rowKey];
                      jsonMessage.elementPaths[group.group_name][nonRowIndex] = groupedData[group.group_name][key].elementPaths;
                      nonRowIndex++;
                      return eachCallback2();
                    }
                  }
                  // templates key
                  else {
                    return eachCallback2();
                  }
                }, function(err) {
                  if (err) {
                    console.log(err.message);
                  }
                  return eachCallback();
                });
              }, function(err) {
                if (err) {
                  console.log(err.message);
                }

                // re-calculate template group probability
                async.eachSeries(templateGroups, function(templateGroup, eachCallback) {
                  // get all templates in template_group
                  Template.getTemplatesByGroup(templateGroup.id, function(_templates) {
                    if (_templates != null && _templates.length > 0) {
                      var correctCount = 0;
                      var totalCount = 0;
                      async.eachSeries(_templates, function(template, eachCallback2) {
                        TemplateDomain.getTemplateDomainByIds(domainId, template.id, function(templateDomain) {
                          if (templateDomain != null) {
                            correctCount += templateDomain.correct_count;
                            totalCount += templateDomain.total_count;
                          }
                          return eachCallback2();
                        });
                      }, function(err2) {
                        if (err2) {
                          console.log(err2.message);
                        }
                        templateGroup.correct_count = correctCount;
                        templateGroup.total_count = totalCount;
                        templateGroup.probability_success = correctCount / totalCount;
                        templateGroup.save(eachCallback);
                      });
                    } else {
                      return eachCallback(new Error("No templates in template_group"));
                    }
                  });
                }, function(err2) {
                  if (err2) {
                    console.log(err2.message);
                  }
                  // set jsonMessage attribute groups
                  jsonMessage[group.group_name] = formattedItems;
                  return seriesCallback();
                });
              });
            } else {
              return seriesCallback();
            }
          }
        ], function(err, results) {
          if (err) {
            return eachCallback(err);
          } else {
            return eachCallback();
          }
        });
      }, function(err) {
        if (err) {
          console.log(err.message);
        }
        return callback();
      });
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Completed readTemplate method");
    }
    return jsonCallback(jsonMessage);
  });
};

// compares template with $ html dom, returns value if matches, null if doesn't match
function processTemplate(template, $, matchClass, bodyElementId, callback) {
  constructElementPath(template.id, $, matchClass, bodyElementId, function(selection, elementId, elementPath) {
    if (selection != null) {
      // calculate text off of selection
      findTextSelection(template.id, selection, function(result) {
        if (result !== "") {
          return callback(result, elementId, elementPath);
        } else {
          return callback(null);
        }
      });
    } else {
      return callback(null);
    }
  });
}

// CONTINUE REFACTORING FROM HERE

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
        function(whilstCallback) {
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
              whilstCallback(new Error(err.message));
            } else {
              whilstCallback();
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
function processGroupedTemplates(templates, $, rowAttributeId, domainId, groupedAttributes, callback) {
  var table_row_id /* 0-0 */, row_class /* TwoReceipt0-0 */, sibling_rows, jsonElementPath,
      row_element_id = {},
      jsonResults = {},
      jsonTemplates = {};

  async.series([
    // setup grouped calculation if row template exists and matches
    function(seriesCallback) {
      if (rowAttributeId == null) {
        table_row_id = 0;
      }
      async.each(templates, function(template, eachCallback) {
        if (table_row_id !== 0 && template.attributeId === rowAttributeId) {
          constructElementPath(template.id, $, null, null, function(row_element, element_id, elementPath) {
            if (row_element != null) {
              jsonElementPath = elementPath;
              row_class = row_element.attr("class");
              row_class = row_class.substring(row_class.indexOf("TwoReceipt"));
              table_row_id = row_class.substring("TwoReceipt".length);
              // store siblings with same tag name
              sibling_rows = row_element.siblings(row_element[0].name);
              eachCallback();
            }
            // row not found, so no templates will match
            else {
              eachCallback(new Error("Row template did not match"));
            }
          });
        } else {
          eachCallback();
        }
      }, function(err) {
        if (err) {
          seriesCallback(err);
        } else {
          if (table_row_id == null) {
            table_row_id = 0;
          }
          seriesCallback();
        }
      });
    },
    // complete first calculation, store row_element_id if row template exists
    function(seriesCallback) {
      async.eachSeries(templates, function(template, eachCallback) {
        if (template.attributeId !== rowAttributeId) {
          processTemplate(template, $, row_class, null, function(templateResult, element_id, elementPath) {
            // match found, store element_id for template and json results (can be empty string)
            if (templateResult != null) {
              if (jsonResults[table_row_id] == null) {
                jsonResults[table_row_id] = {};
                jsonTemplates[table_row_id] = {};
              }
              jsonResults[table_row_id][groupedAttributes[template.attributeId]] = templateResult;
              jsonTemplates[table_row_id][groupedAttributes[template.attributeId]] = template.id;
              row_element_id[template.id] = element_id;

              eachCallback();
            }
            // no match is found, stop calculating with template
            else {
              TemplateDomain.getTemplateDomainByIds(domainId, template.id, function(templateDomain) {
                if (templateDomain !== null) {
                  templateDomain.total_count++;
                  templateDomain.probability_success = templateDomain.correct_count / templateDomain.total_count;
                  templateDomain.save(function() {
                    eachCallback(new Error("Initial template did not return results"));
                  });
                } else {
                  eachCallback(new Error("Initial template did not return results"));
                }
              });
            }
          });
        } else {
          eachCallback();
        }
      }, function(err) {
        if (err) {
          seriesCallback(err);
        } else {
          seriesCallback();
        }
      });
    },
    // calculate other rows if row template exists
    function(seriesCallback) {
      if (table_row_id !== 0) {
        // loop through each sibling row
        async.eachSeries(sibling_rows, function(target_row, eachCallback) {
          // set row variables
          row_class = target_row.attribs["class"];
          row_class = row_class.substring(row_class.indexOf("TwoReceipt"));
          table_row_id = row_class.substring("TwoReceipt".length);

          async.eachSeries(templates, function(template, eachCallback2) {
            if (template.attributeId != rowAttributeId) {
              // different function
              processTemplate(template, $, row_class, row_element_id[template.id], function(templateResult) {
                // match found, store element_id for template and json results (can be empty string)
                if (templateResult != null) {

                  if (jsonResults[table_row_id] == null) {
                    jsonResults[table_row_id] = {};
                    jsonTemplates[table_row_id] = {};
                  }
                  jsonResults[table_row_id][groupedAttributes[template.attributeId]] = templateResult;
                  jsonTemplates[table_row_id][groupedAttributes[template.attributeId]] = template.id;
                  eachCallback2();
                }
                // no match is found, stop calculating with template
                else {
                  TemplateDomain.getTemplateDomainByIds(domainId, template.id, function(templateDomain) {
                    if (templateDomain != null) {
                      templateDomain.total_count++;
                      templateDomain.probability_success = templateDomain.correct_count / templateDomain.total_count;
                      templateDomain.save(function() {
                        eachCallback2(new Error("Template did not return results"));
                      });
                    } else {
                      eachCallback2(new Error("Template did not return results"));
                    }
                  });
                }
              });
            } else {
              eachCallback2();
            }
          }, function(err) {
            if (err) {
              console.log(err.message);
            }
            eachCallback();
          });
        }, function(err) {
          if (err) {
            seriesCallback(err);
          } else {
            seriesCallback();
          }
        });
      } else {
        seriesCallback();
      }
    }
  ], function(err, results) {
    if (err) {
      console.log(err.message);
      return callback(null);
    } else {
      jsonResults.templates = jsonTemplates;
      jsonResults.elementPaths = jsonElementPath;
      return callback(jsonResults);
    }
  });
}

// compares two values and returns true if the new value should replace the original value
function compareAttributeResults(originalValue, newValue, callback) {
  // for text, original value contains new value and new value is more specific
  if (typeof(originalValue) == "string" && originalValue.indexOf(newValue) != -1 && newValue.length < originalValue.length) {
    return callback(true);
  }
  // for numbers, new value contains original value and new value is more detailed
  else if (newValue.indexOf(originalValue) != -1 && newValue.length > originalValue.length) {
    return callback(true);
  } else {
    return callback(false);
  }
}

// compares two values and returns true if the new value should replace the original value
function compareAttributeResults(originalValue, newValue) {
  // for text, original value contains new value and new value is more specific
  if (typeof(originalValue) == "string" && originalValue.indexOf(newValue) != -1 && newValue.length < originalValue.length) {
    return true;
  }
  // for numbers, new value contains original value and new value is more detailed
  else if (newValue.indexOf(originalValue) != -1 && newValue.length > originalValue.length) {
    return true;
  } else {
    return false;
  }
}
