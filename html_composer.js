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
                processTemplate(template, $, function(templateResult, elementPath) {
                  if (templateResult != null) {
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
    },
    // label row html elements in DOM
    function(callback) {
      console.log("----------------PREPARE $ FOR GROUPED TEMPLATES----------------------");
      var tables = $("table, ul, ol, dl");
      // add class TwoReceipt# to each table, where # is index
      var keys = Object.keys(tables);
      for (var index = 0; index < keys.length; index++) {
        var key = keys[index];
        // at one point, just length showed up in keys. options (&others) appeared later
        if (key === "options" || key === "length") {
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
            // at one point, just length showed up in keys. options (&others) appeared later
            if (rowKey === "options" || rowKey === "length") {
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
    // load grouped attributes & build json message for attribute
    function(callback) {
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
                  processGroupedTemplates(_templates, $, domainId, groupedAttributes, function(results) {
                    if (results != null) {
                      if (groupedData[group] == null) {
                        groupedData[group] = {};
                      }
                      groupedData[group][templateGroup.id] = results;
                    }
                    return eachCallback2();
                  });
                } else {
                  console.log("No templates in templateGroup");
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
              attributeKeys.splice(attributeKeys.indexOf(global.attributes.groupedAttributes.items.row.id), 1);

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
function processTemplate(template, $, callback) {
  getElementPath(template.id, $, function(err, elementPath, element, elementArray) {
    if (err) {
      console.log(err.message);
      return callback();
    } else {
      findTextSelection(template.id, element, function(result) {
        if (result !== "") {
          return callback(result, elementPath, elementArray);
        } else {
          return callback();
        }
      });
    }
  });
}

// compares template with $ html dom, returns value if matches, null if doesn't match
function processGroupedTemplate(template, $, elementArray, callback) {
  traverseElementPath($, elementArray, function(err, elementPath, element) {
    if (err) {
      console.log(err.message);
      return callback();
    } else {
      findTextSelection(template.id, element, function(result) {
        if (result !== "") {
          return callback(result);
        } else {
          return callback();
        }
      });
    }
  });
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
        if (leftResult != null) {
          leftText = leftResult;
        }
        return callback();
      };
    },
    // get right text node if it exists
    function(callback) {
      textNode.right = function(rightResult) {
        if (rightResult != null) {
          rightText = rightResult;
        }
        return callback();
      };
    },
    // calculate textResult from left & right text
    function(callback) {
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
      return funcCallback();
    } else {
      return funcCallback(textResult);
    }
  });
}

// returns err, elementPath, rootElement, elementArray for template
function getElementPath(templateId, $, callback) {
  Element.getElementPathByTemplate(templateId, function(err, elementArray) {
    if (err) {
      return callback(err);
    } else {
      traverseElementPath($, elementArray, callback);
    }
  });
}

// traverse from body to root element, returning err, elementPath, rootElement, elementArray
function traverseElementPath($, elementArray, callback) {
  var element = $("body");
  var elementPath = [];

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

  return callback(null, elementPath, element, elementArray);
}

// compares templates with $ html dom, returns all matched values, null if doesn't match
function processGroupedTemplates(templates, $, domainId, groupedAttributes, callback) {
  var rowAttributeId = global.attributes.groupedAttributes.items.row.id;
  var rowElement;
  var tableRowId /* 0-0 */;
  var jsonElementPaths = {};
  var jsonResults = {};
  var jsonTemplates = {};
  var elementArrays = {};

  async.series([
    // setup grouped calculation if row template exists and matches
    function(seriesCallback) {
      async.each(templates, function(template, eachCallback) {
        if (template.attribute_id === rowAttributeId) {
          getElementPath(template.id, $, function(err, elementPath, element) {
            // row template didn't match, so no templates will match
            if (err) {
              return eachCallback(err);
            } else {
              // create method to find element from elementPath
              jsonElementPaths.row = { index: elementPath.length - 1 };

              rowElement = element;
              var rowClass /* TwoReceipt0-0 */ = element.attr("class");
              rowClass = rowClass.substring(rowClass.indexOf("TwoReceipt"));
              tableRowId = rowClass.substring("TwoReceipt".length);
              return eachCallback();
            }
          });
        } else {
          return eachCallback();
        }
      }, function(err) {
        if (err) {
          return seriesCallback(err);
        } else {
          // set tableRowId to 0 if there is no row template, to allow remaining attributes to be calculated
          if (tableRowId == null) {
            tableRowId = 0;
          }
          return seriesCallback();
        }
      });
    },
    // complete first calculation
    function(seriesCallback) {
      async.eachSeries(templates, function(template, eachCallback) {
        if (template.attribute_id !== rowAttributeId) {
          processTemplate(template, $, function(templateResult, elementPath, elementArray) {
            // match found, store template and results
            if (templateResult != null) {
              if (jsonResults[tableRowId] == null) {
                jsonResults[tableRowId] = {};
                jsonTemplates[tableRowId] = {};
              }
              jsonResults[tableRowId][groupedAttributes[template.attribute_id]] = templateResult;
              jsonTemplates[tableRowId][groupedAttributes[template.attribute_id]] = template.id;
              jsonElementPaths[groupedAttributes[template.attribute_id]] = elementPath;
              elementArrays[groupedAttributes[template.attribute_id]] = elementArray;
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
        // get parent of rowElement and iterate children
        var siblingRows = rowElement.parent().children();
        // add on child index to tableClass to get rowClass /* 0- */
        var tableClass = tableRowId.substring(0, tableRowId.indexOf("-") + 1);
        var rowIndex = 0;

        // loop through each sibling row
        async.eachSeries(siblingRows, function(targetRow, eachCallback) {
          // do not calculate the row we already calculated
          if (rowIndex !== jsonElementPaths.row.index) {
            tableRowId = tableClass + rowIndex;

            var jsonResult = {};
            var jsonTemplate = {};
            async.eachSeries(templates, function(template, eachCallback2) {
              if (template.attribute_id !== rowAttributeId) {
                var elementArray = elementArrays[groupedAttributes[template.attribute_id]];
                elementArray[jsonElementPaths.row.index].order = rowIndex;
                // process using elementPath
                processGroupedTemplate(template, $, elementArray, function(templateResult) {
                  if (templateResult != null) {
                    jsonResult[groupedAttributes[template.attribute_id]] = templateResult;
                    jsonTemplate[groupedAttributes[template.attribute_id]] = template.id;
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
              } else {
                // if row completely matches with templates, add it to jsonResults
                jsonResults[tableRowId] = jsonResult;
                jsonTemplates[tableRowId] = jsonTemplate;
              }

              rowIndex++;
              return eachCallback();
            });
          } else {
            rowIndex++;
            return eachCallback();
          }
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
      return callback();
    } else {
      jsonResults.templates = jsonTemplates;
      jsonResults.elementPaths = jsonElementPaths;
      return callback(jsonResults);
    }
  });
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
