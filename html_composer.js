var cheerio = require("cheerio");
var async = require("async");

var Element = require("./model/element");
var Template = require("./model/template");
var TemplateDomain = require("./model/template_domain");
var TemplateGroup = require("./model/template_group");
var Text = require("./model/text");
var Url = require("./model/url");
var SimpleTable = require("./model/simple_table");

exports.readTemplate = function(userId, html, url, domain, jsonCallback) {
  var domainId;
  var $;
  // default create these attributes
  var jsonMessage = { date: "", vendor: "", transaction: "", total: "", items: {}, templates: {}, elementPaths: {} };

  async.series([
    // load domain
    function(callback) {
      console.log("----------------LOAD DOMAIN----------------------");
      SimpleTable.getIdByValue("ser_domain", "domain_name", domain, function(_domainId) {
        // found domain
        if (_domainId != null) {
          domainId = _domainId;
          // if body tag doesn't exist in html
          if (html.indexOf("<body") === -1) {
            $ = cheerio.load("<body>" + html + "</body>");
          } else {
            $ = cheerio.load(html);
          }
          console.log("Created DOM");
          return callback();
        } else {
          return callback(new Error("Domain does not exist in DB"));
        }
      });
    },
    // load attribute & build json message for attribute
    function(callback) {
      var attrKeys = Object.keys(global.attributes.individualAttributes);
      async.eachSeries(attrKeys, function(attr, eachCallback) {
        var templates;
        var attribute = attr;
        var attributeId = global.attributes.individualAttributes[attr].id;
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
                processTemplate(template, $, null, null, function(templateResult, elementPath) {
                  debugger;
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
    }/*,
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
            var rowKey = rowKeys[rowIndex];
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
    },*/
    // load grouped attributes & build json message for attribute
    /*function(callback) {
      var rowAttributeId = global.attributes.groupedAttributes.items.row.id;
      var groupedData = {};

      async.eachSeries(Object.keys(global.attributes.groupedAttributes), function(group, eachCallback) {
        var templateGroups;
        var groupedAttrs = Object.keys(global.attributes.groupedAttributes[group]);
        var groupedAttributes = {};
        for (var i = 0; i < groupedAttrs.length; i++) {
          if (groupedAttrs[i] !== "id") {
            groupedAttributes[global.attributes.groupedAttributes[group][groupedAttrs[i]].id] = groupedAttrs[i];
          }
        }

        async.series([
          // set templateGroups for attribute_group and domainId
          function(seriesCallback) {
            TemplateGroup.getTemplateGroups(global.attributes.groupedAttributes[group].id, domainId, function(resultGroups) {
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
                      if (groupedData[group] == null) {
                        groupedData[group] = {};
                      }
                      groupedData[group][templateGroup.id] = results;
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
            if (groupedData[group] != null) {
              var formattedItems = {};
              jsonMessage.templates[group] = {};
              jsonMessage.elementPaths[group] = {};
              var keys = Object.keys(groupedData[group]);
              var nonRowIndex = 0;
              // grouped attribute keys, except row attribute
              var attributeKeys = Object.keys(groupedAttributes);
              attributeKeys.splice(attributeKeys.indexOf(rowAttributeId), 1);

              // loop through each template_group
              async.eachSeries(keys, function(key, eachCallback) {
                var rowKeys = Object.keys(groupedData[group][key]);

                // loop through each row in item
                async.eachSeries(rowKeys, function(rowKey, eachCallback2) {
                  if (rowKey !== "templates" && rowKey !== "elementPaths" && rowKey !== "0") {
                    // row already exists, compare with selected row
                    if (formattedItems.hasOwnProperty(rowKey)) {
                      // loop through each attribute to compare individual results
                      async.eachSeries(attributeKeys, function(attributeKey, eachCallback3) {
                        var attr = groupedAttributes[attributeKey];
                        // attribute already exists for row
                        if (formattedItems[rowKey].hasOwnProperty(attr) && groupedData[group][key][rowKey].hasOwnProperty(attr)) {
                          var replaceAttr = compareAttributeResults(formattedItems[rowKey][attr], groupedData[group][key][rowKey][attr]);
                          if (replaceAttr) {
                            // lower probability for old template
                            TemplateDomain.getTemplateDomainByIds(domainId, jsonMessage.templates[group][rowKey][attr], function(templateDomain) {
                              // replace attribute
                              formattedItems[rowKey][attr] = groupedData[group][key][rowKey][attr];
                              jsonMessage.templates[group][rowKey][attr] = groupedData[group][key].templates[rowKey][attr];
                              jsonMessage.elementPaths[group][rowKey] = groupedData[group][key].elementPaths;

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
                            TemplateDomain.getTemplateDomainByIds(domainId, groupedData[group][key].templates[rowKey][attr], function(templateDomain) {
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
                          if (groupedData[group][key][rowKey].hasOwnProperty(attr)) {
                            formattedItems[rowKey][attr] = groupedData[group][key][rowKey][attr];
                            jsonMessage.templates[group][rowKey][attr] = groupedData[group][key].templates[rowKey][attr];
                            jsonMessage.elementPaths[group][rowKey] = groupedData[group][key].elementPaths;
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
                      formattedItems[rowKey] = groupedData[group][key][rowKey];
                      jsonMessage.templates[group][rowKey] = groupedData[group][key].templates[rowKey];
                      jsonMessage.elementPaths[group][rowKey] = groupedData[group][key].elementPaths;
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
                      var newKeys = Object.keys(groupedData[group][key][rowKey]);
                      // existing item has the same # of attributes as new item
                      if (existingKeys.length === newKeys.length) {
                        // track if match is duplicate or replacement
                        var duplicate = true;
                        var noMatchFound = false;

                        for (var i = 0; i < existingKeys.length; i++) {
                          var existingKey = existingKeys[i];
                          if (groupedData[group][key][rowKey].hasOwnProperty(existingKey)) {
                            // no exact match, possible replacement match
                            if (formattedItems[compareRowIndex][existingKey] !== groupedData[group][key][rowKey][existingKey]) {
                              duplicate = false;
                              var replaceAttr = compareAttributeResults(formattedItems[compareRowIndex][existingKey], groupedData[group][key][rowKey][existingKey]);
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
                          TemplateDomain.getTemplateDomainByIds(domainId, jsonMessage.templates[group][matchIndex][attr], function(templateDomain) {
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

                        formattedItems[matchIndex] = groupedData[group][key][rowKey];
                        jsonMessage.templates[group][matchIndex] = groupedData[group][key].templates[rowKey];
                        jsonMessage.elementPaths[group][matchIndex] = groupedData[group][key].elementPaths;
                        return eachCallback2();
                      });
                    }
                    // toss new item & lower probability for new item
                    else if (matchFound) {
                      // loop through item attributes
                      async.eachSeries(attributeKeys, function(attributeKey, eachCallback3) {
                        var attr = groupedAttributes[attributeKey];
                        // attribute exists for row
                        if (groupedData[group][key][rowKey].hasOwnProperty(attr)) {
                          TemplateDomain.getTemplateDomainByIds(domainId, groupedData[group][key].templates[rowKey][attr], function(templateDomain) {
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
                      formattedItems[nonRowIndex] = groupedData[group][key][rowKey];
                      jsonMessage.templates[group][nonRowIndex] = groupedData[group][key].templates[rowKey];
                      jsonMessage.elementPaths[group][nonRowIndex] = groupedData[group][key].elementPaths;
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
                  jsonMessage[group] = formattedItems;
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
    }*/
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Completed readTemplate method");
    }
    debugger;
    return jsonCallback(jsonMessage);
  });
};

// compares template with $ html dom, returns value if matches, null if doesn't match
function processTemplate(template, $, matchClass, bodyElementId, callback) {
  traverseElementPath(template.id, $, function(err, elementPath, element) {
    debugger;
    if (err) {
      console.log(err.message);
      return callback();
    } else {
      findTextSelection(template.id, element, function(result) {
        debugger;
        if (result !== "") {
          return callback(result, elementPath);
        } else {
          return callback();
        }
      });
    }
  });

  /*constructElementPath(template.id, $, matchClass, bodyElementId, function(selection, elementId, elementPath) {
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
  });*/
}

// forms text from selection that matches template text and returns it (or empty string if it can't be found)
function findTextSelection(templateId, element, funcCallback) {
  var textNode;
  var leftText;
  var rightText;
  var leftIndex;
  var textResult = element.text().trim().replace(/\n/g, "");
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
    // get left text node if it exists
    function(callback) {
      textNode.left = function(leftResult) {
        debugger;
        if (leftResult != null) {
          leftText = leftResult;
        }
        return callback();
      };
    },
    // get right text node if it exists
    function(callback) {
      textNode.right = function(rightResult) {
        debugger;
        if (rightResult != null) {
          rightText = rightResult;
        }
        return callback();
      };
    },
    // calculate textResult from left & right text
    function(callback) {
      debugger;
      // calculation for finding leftText match and for money values to find negatives
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
    if (err) {
      console.log(err.message);
      return funcCallback(null);
    } else {
      return funcCallback(textResult);
    }
  });
}

// traverse from body to root element
// returns err, elementPath, rootElement
// for row element, instead just calculate row first and return row element as root
function traverseElementPath(templateId, $, callback) {
  var element = $("body");
  var elementPath = [];

  Element.getElementPathByTemplate(templateId, function(err, elementArray) {
    if (err) {
      return callback(err);
    } else {
      for (var i = 0; i < elementArray.length; i++) {
        elementPath.push(elementArray[i].order);
        if (i !== 0) {
          element = element.children();
          if (element.length > 0) {
            element = element.eq(elementArray[i].order);
          }

          if (element.length === 0) {
            return callback(new Error("elementPath param error"));
          }

          // check if tag matches template
          if (elementArray[i]._tag !== element[0].name) {
            return callback(new Error("tag does not match"));
          }
        }
      }

      return callback(null, elementPath, element);

      // return elementPath to send to chrome extension
      // return element to calculate text from
      // elementId is for rowElementId. change how this is calculated - calculate row first?
      // for each row, run all templates - need to
      // more efficient to

    }
  });
}

// constructs a dom selection from the body (or optional bodyElementId) to the root element and returns the root element (or null if it can't be found)
// returns elementId of optional matchClass (indicates rowElement).  if matchClass is found while constructing path, elementId will be returned
// returns array representing the element path, listing order of child elements where each index is an extra level from body
function constructElementPath(templateId, $, matchClass, bodyElementId, funcCallback) {
  var element;
  var selection;
  var elementId;
  var elementPath = [];

  console.log("----------------CONSTRUCT ELEMENT PATH----------------------");
  async.series([
    // set element to template bodyElement
    function(callback) {
      if (bodyElementId == null) {
        selection = $("body");
        Element.getBodyElementByTemplate(templateId, function(err, bodyElement) {
          if (err || bodyElement == null) {
            return callback(new Error("body element not found"));
          } else {
            element = bodyElement;
            return callback();
          }
        });
      } else {
        Element.getElementById(bodyElementId, function(err, bodyElement) {
          if (err || bodyElement == null) {
            return callback(new Error("body element not found"));
          } else {
            selection = $("." + matchClass);
            element = bodyElement;
            return callback();
          }
        });
      }
    },
    // construct selector path from body to root element
    function(callback) {
      async.whilst(
        // whilst loop condition
        function() { return element.element_id != null; },
        // whilst loop function
        function(whilstCallback) {
          async.series([
            // set element as child element
            function(seriesCallback2) {
              element.element = function(elementResult) {
                element = elementResult;

                selection = selection.children();
                if (selection.length !== 0) {
                  elementPath.push(element.order);
                  selection = selection.eq(element.order);
                }

                if (selection.length === 0) {
                  return seriesCallback2(new Error("selection has no children or order does not exist"));
                } else {
                  // check if (optional) matchClass
                  if (matchClass != null && bodyElementId == null &&
                      selection.attr("class") != null &&
                      selection.attr("class").indexOf(matchClass) !== -1) {
                    console.log("Set elementId from element path");
                    elementId = element.id;
                  }
                  return seriesCallback2();
                }
              };
            },
            // compare with tag for additional accuracy
            function(seriesCallback2) {
              element.tag = function(tagResult) {
                if (selection[0].name !== tagResult) {
                  return seriesCallback2(new Error("tag does not match"));
                } else {
                  return seriesCallback2();
                }
              };
            }
          ], function(err, result) {
            if (err) {
              return whilstCallback(new Error(err.message));
            } else {
              return whilstCallback();
            }
          });
        },
        function(err) {
          if (err) {
            return callback(new Error(err.message));
          }
          // check if there is a match
          else if (selection != null && selection.length !== 0) {
            return callback(null, selection);
          } else {
            return callback();
          }
        }
      );
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
      return funcCallback(null);
    } else {
      return funcCallback(result[result.length-1], elementId, elementPath);
    }
  });
}

// compares templates with $ html dom, returns all matched values, null if doesn't match
function processGroupedTemplates(templates, $, rowAttributeId, domainId, groupedAttributes, callback) {
  var tableRowId /* 0-0 */;
  var rowClass /* TwoReceipt0-0 */;
  var siblingRows;
  var jsonElementPath;
  var rowElementId = {};
  var jsonResults = {};
  var jsonTemplates = {};

  async.series([
    // setup grouped calculation if row template exists and matches
    function(seriesCallback) {
      if (rowAttributeId == null) {
        tableRowId = 0;
      }
      async.each(templates, function(template, eachCallback) {
        if (tableRowId !== 0 && template.attribute_id === rowAttributeId) {
          constructElementPath(template.id, $, null, null, function(rowElement, elementId, elementPath) {
            if (rowElement != null) {
              jsonElementPath = elementPath;
              rowClass = rowElement.attr("class");
              rowClass = rowClass.substring(rowClass.indexOf("TwoReceipt"));
              tableRowId = rowClass.substring("TwoReceipt".length);
              // store siblings with same tag name
              siblingRows = rowElement.siblings(rowElement[0].name);
              return eachCallback();
            }
            // row not found, so no templates will match
            else {
              return eachCallback(new Error("Row template did not match"));
            }
          });
        } else {
          return eachCallback();
        }
      }, function(err) {
        if (err) {
          return seriesCallback(err);
        } else {
          if (tableRowId == null) {
            tableRowId = 0;
          }
          return seriesCallback();
        }
      });
    },
    // complete first calculation, store rowElementId if row template exists
    function(seriesCallback) {
      async.eachSeries(templates, function(template, eachCallback) {
        if (template.attribute_id !== rowAttributeId) {
          processTemplate(template, $, rowClass, null, function(templateResult, elementId, elementPath) {
            // match found, store element_id for template and json results (can be empty string)
            if (templateResult != null) {
              if (jsonResults[tableRowId] == null) {
                jsonResults[tableRowId] = {};
                jsonTemplates[tableRowId] = {};
              }
              jsonResults[tableRowId][groupedAttributes[template.attribute_id]] = templateResult;
              jsonTemplates[tableRowId][groupedAttributes[template.attribute_id]] = template.id;
              rowElementId[template.id] = elementId;

              return eachCallback();
            }
            // no match is found, stop calculating with template
            else {
              TemplateDomain.getTemplateDomainByIds(domainId, template.id, function(templateDomain) {
                if (templateDomain != null) {
                  templateDomain.total_count++;
                  templateDomain.probability_success = templateDomain.correct_count / templateDomain.total_count;
                  templateDomain.save(function() {
                    return eachCallback(new Error("Initial template did not return results"));
                  });
                } else {
                  return eachCallback(new Error("Initial template did not return results"));
                }
              });
            }
          });
        } else {
          return eachCallback();
        }
      }, function(err) {
        if (err) {
          return seriesCallback(err);
        } else {
          return seriesCallback();
        }
      });
    },
    // calculate other rows if row template exists
    function(seriesCallback) {
      if (tableRowId !== 0) {
        // loop through each sibling row
        async.eachSeries(siblingRows, function(targetRow, eachCallback) {
          // set row variables
          rowClass = targetRow.attribs["class"];
          rowClass = rowClass.substring(rowClass.indexOf("TwoReceipt"));
          tableRowId = rowClass.substring("TwoReceipt".length);

          async.eachSeries(templates, function(template, eachCallback2) {
            if (template.attribute_id !== rowAttributeId) {
              // different function
              processTemplate(template, $, rowClass, rowElementId[template.id], function(templateResult) {
                if (templateResult != null) {
                  if (jsonResults[tableRowId] == null) {
                    jsonResults[tableRowId] = {};
                    jsonTemplates[tableRowId] = {};
                  }
                  jsonResults[tableRowId][groupedAttributes[template.attribute_id]] = templateResult;
                  jsonTemplates[tableRowId][groupedAttributes[template.attribute_id]] = template.id;
                  return eachCallback2();
                }
                // no match is found, stop calculating with template
                else {
                  TemplateDomain.getTemplateDomainByIds(domainId, template.id, function(templateDomain) {
                    if (templateDomain != null) {
                      templateDomain.total_count++;
                      templateDomain.probability_success = templateDomain.correct_count / templateDomain.total_count;
                      templateDomain.save(function() {
                        return eachCallback2(new Error("Template did not return results"));
                      });
                    } else {
                      return eachCallback2(new Error("Template did not return results"));
                    }
                  });
                }
              });
            } else {
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
            return seriesCallback(err);
          } else {
            return seriesCallback();
          }
        });
      } else {
        return seriesCallback();
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
