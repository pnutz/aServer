var cheerio = require("cheerio");
var async = require("async");
var CHILDREN_LIMIT = 0;
var Element = require("./model/element");
var Template = require("./model/template");
var TemplateDomain = require("./model/template_domain");
var TemplateGroup = require("./model/template_group");
var ReceiptAttribute = require("./model/receipt_attribute");
var Text = require("./model/text");
var Url = require("./model/url");
var SimpleTable = require("./model/simple_table");
var Entities = require("html-entities").AllHtmlEntities;
var entities = new Entities();

exports.generateTemplates = function(userId, domain, url, html, attributeData) {
  var newUrl;
  var individualAttributes = attributeData;
  var groupedAttributes = {};
  var keys;
  var groupedKeys;

  if (Object.keys(individualAttributes).length === 0) {
    console.log("No attribute data sent");
    return;
  }

  async.series([
    // calculate grouped attribute keys - groupedAttributes = { items: {}, other: {} }
    function(callback) {
      SimpleTable.selectByColumn("ser_receipt_attribute_group", "'TRUE'", "TRUE", "", function(resultGroups) {
        if (resultGroups != null) {
          for (var i = 0; i < resultGroups.length; i++) {
            var group = resultGroups[i];
            if (attributeData.hasOwnProperty(group.group_name)) {
              groupedAttributes[group.group_name] = attributeData[group.group_name];
              delete individualAttributes[group.group_name];
            }
          }
        } else {
          console.log("No receipt attribute groups found");
        }

        // set grouped and individual keys
        keys = Object.keys(individualAttributes);
        groupedKeys = Object.keys(groupedAttributes);
        return callback();
      });
    },
    // create url id
    function(callback) {
      console.log("----------------URL----------------------");
      newUrl = new Url(null, domain, url);
      newUrl.save(function(newUrlId) {
        if (newUrlId != null) {
          return callback();
        } else {
          return callback(new Error("failed to create new url"));
        }
      });
    },
    // generate templates for each individual attribute
    function(callback) {
      if (keys.length > 0) {
        async.eachSeries(keys,
        function(key, eachCallback) {
          generateTemplate(userId, key, html, newUrl.id,
                             newUrl.domain_id, null, null, eachCallback);
        },
        function(err) {
          if (err) {
            console.log(err.message);
          }
          console.log("Generated templates for individual attributes");
          return callback();
        });
      } else {
        return callback();
      }
    },
    // generate templates for each grouped attribute
    function(callback) {
      if (groupedKeys.length > 0) {
        async.eachSeries(groupedKeys, function(groupName, eachCallback) {
          if (groupedAttributes.hasOwnProperty(groupName)) {
            // iterate through each key contained within grouped attribute
            async.eachSeries(Object.keys(groupedAttributes[groupName]), function(key, eachCallback2) {
              generateTemplateGroup(html, userId, newUrl.id, newUrl.domain_id, groupName, groupedAttributes[groupName][key], key, eachCallback2);
            },
            function(err) {
              if (err) {
                console.log(err.message);
              }
              return eachCallback();
            });
          } else {
            return eachCallback();
          }
        },
        function(err) {
          if (err) {
            console.log(err.message);
          } else {
            console.log("Generated templates for grouped attributes");
          }
          return callback();
        });
      } else {
        return callback();
      }
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Completed generateTemplates method");
    }
  });
};

function generateTemplateGroup(html, userId, urlId, domainId, groupName, attributeGroup, index, templateCallback) {
  var templateGroupId;

  async.series([
    // create template group
    function(callback) {
      SimpleTable.getIdByValue("ser_receipt_attribute_group", "group_name", groupName, function(groupId) {
        if (groupId != null) {
          var templateGroup = new TemplateGroup(null, domainId, groupId, 1, null, 1, 1);
          templateGroup.save(function(id) {
            templateGroupId = id;
            return callback();
          });
        } else {
          return callback(new Error("Receipt attribute group does not exist"));
        }
      });
    },
    // generate templates for each grouped attribute
    function(callback) {
      var attributeKeys = Object.keys(attributeGroup);
      async.eachSeries(attributeKeys, function(attr, eachCallback) {
        generateTemplate(userId, attr, html, urlId, domainId,
                           templateGroupId, index, eachCallback);
      }, function(err) {
        if (err) {
          console.log(err.message);
        } else {
          console.log("Ran generateTemplate for each grouped attribute.");
        }
        return callback();
      });
    },
    // generate (optional) row template for template group
    function(callback) {
      generateRowTemplate(userId, urlId, templateGroupId, callback);
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Completed generateTemplateGroup method");
    }
    return templateCallback();
  });
}

function generateRowTemplate(userId, urlId, templateGroupId, templateCallback) {
  // attribute id for row
  var rowAttributeId;
  // grouped templates for templateGroupId
  var templates;
  // body elements for grouped templates
  var templateElements = [];
  var bodyElement;
  var rowElement;
  var elementLevel;
  var currentElementId;
  var templateId;

  async.series([
    // get row attribute id
    function(callback) {
      SimpleTable.getIdByValue("ser_receipt_attribute", "attribute_name", "row", function(attributeId) {
        // check if row attribute exists
        if (attributeId != null) {
          rowAttributeId = attributeId;
          return callback();
        } else {
          return callback(new Error("Row attribute does not exist"));
        }
      });
    },
    // get grouped templates
    function(callback) {
      Template.getTemplatesByGroup(templateGroupId, function(groupedTemplates) {
        if (groupedTemplates != null && groupedTemplates.length > 0) {
          templates = groupedTemplates;
          return callback();
        } else {
          return callback(new Error("Grouped templates do not exist"));
        }
      });
    },
    // load template body elements into array
    function(callback) {
      async.each(templates, function(template, eachCallback) {
        Element.getBodyElementByTemplate(template.id, function(err, element) {
          if (err == null) {
            if (bodyElement == null) {
              bodyElement = element;
            }
            templateElements.push(element);
            return eachCallback();
          } else {
            return eachCallback(err);
          }
        });
      }, function(err) {
        if (err) {
          return callback(err);
        } else {
          return callback();
        }
      });
    },
    // while templates match, keep iterating from body to root element
    function(callback) {
      var match = true;

      async.whilst(
        // whilst loop condition - while tagId & order match all templates and root element is not hit
        function() { return match; },
        // whilst loop function
        function(whilstCallback) {
          async.series([
            // set each template element to its child element
            function(seriesCallback) {
              var tempElements = [];
              async.each(templateElements, function(templateElement, eachCallback) {
                templateElement.element = function(elementResult) {
                    tempElements.push(elementResult);
                    return eachCallback();
                  };
              }, function(err) {
                if (err) {
                  return seriesCallback(err);
                } else {
                  templateElements = tempElements;
                  return seriesCallback();
                }
              });
            },
            // prepare variables for synchronous whilst test function
            function(seriesCallback) {
              match = true;
              var order;
              var tagId;

              for (var i = 0; i < templateElements.length; i++) {
                var templateElement = templateElements[i];
                if (templateElement.relation === "root" || templateElement.element_id == null) {
                  match = false;
                }

                if (tagId == null) {
                  tagId = templateElement.tag_id;
                  order = templateElement.order;
                } else if (templateElement.tag_id !== tagId || templateElement.order !== order) {
                  match = false;
                }
              }

              templateElements[0].tag = function(tagResult) {
                // elements matched and tag is a row, store as row_element
                if (match === true && (tagResult === "tr" || tagResult === "li" || tagResult === "dl" || tagResult === "dd")) {
                  rowElement = templateElements[0];
                }
                return seriesCallback();
              };
            }
          ], function(err) {
            if (err) {
              return whilstCallback(err);
            } else if (rowElement == null) {
              return whilstCallback(new Error("row element does not exist"));
            } else {
              return whilstCallback();
            }
          });
        },
        function(err) {
          if (err) {
            return callback(err);
          } else {
            return callback();
          }
        }
      );
    },
    // create template for row if rowElement exists
    function(callback) {
      var newTemplate = new Template(null, rowAttributeId, templateGroupId, urlId, userId);
      newTemplate.save(function(newTemplateId) {
        if (newTemplateId != null) {
          templateId = newTemplateId;
          return callback();
        } else {
          return callback(new Error("failed to create new template"));
        }
      });
    },
    // create row element for row template
    function(callback) {
      elementLevel = 0;
      var newElement = new Element(null, null, templateId, rowElement.tag_id, "root", elementLevel, rowElement.order);
      newElement.save(function(elementId) {
        if (elementId != null) {
          currentElementId = elementId;
          elementLevel--;
          return callback();

          // no longer using element attribute
          /*ElementAttribute.getElementAttributesByElement(rowElement.id, function(attributes) {
            if (attributes != null) {
              // iterate through row_element attributes, adding it to newElement
              async.each(attributes, function(attribute, eachCallback) {
                var element_attribute = new ElementAttribute(attribute.type_id, attribute.value_id, currentElementId);
                element_attribute.save(eachCallback);
              }, function(err) {
                if (err) {
                  return callback(err);
                } else {
                  return callback();
                }
              });
            } else {
              return callback();
            }
          });*/
        } else {
          return callback(new Error("failed to create body element for row template"));
        }
      });
    },
    function(callback) {
      Element.getParentElementById(rowElement.id, function(err, parentElement) {
        if (err == null) {
          rowElement = parentElement;
          return callback();
        } else {
          return callback(new Error("Completed generateRowTemplate method"));
        }
      });
    },
    // create elements from body element to row element for row template
    function(callback) {
      var parentExists = true;

      async.whilst(
        // whilst condition - parent element must exist
        function() { return parentExists; },
        // whilst loop
        function(whilstCallback) {
          async.series([
            // create new element and element attributes for row template
            function(seriesCallback) {
              var newElement = new Element(null, currentElementId, templateId, rowElement.tag_id, "parent", elementLevel, rowElement.order);
              newElement.save(function(elementId) {
                if (elementId != null) {
                  currentElementId = elementId;
                  elementLevel--;
                  return seriesCallback();

                  // no longer using element attribute
                  /*ElementAttribute.getElementAttributesByElement(row_element.id, function(attributes) {
                    if (attributes != null) {
                      // iterate through row_element attributes, adding it to newElement
                      async.each(attributes, function(attribute, eachCallback) {
                        var element_attribute = new ElementAttribute(attribute.type_id, attribute.value_id, current_element_id);
                        element_attribute.save(eachCallback);
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
                  });*/
                } else {
                  return seriesCallback(new Error("failed to create element for row template"));
                }
              });
            },
            // set row element to its parent element
            function(seriesCallback) {
              Element.getParentElementById(rowElement.id, function(err, parentElement) {
                if (err == null) {
                  rowElement = parentElement;
                  parentExists = true;
                } else {
                  parentExists = false;
                }
                return seriesCallback();
              });
            }
          ], function(err) {
            if (err) {
              return whilstCallback(err);
            } else {
              return whilstCallback();
            }
          });
        },
        function(err) {
          if (err) {
            return callback(err);
          } else {
            console.log("Finished adding row elements for row template");
            return callback();
          }
        }
      );
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Completed generateRowTemplate method");
    }
    return templateCallback();
  });
}

/*
* groupId: groupId contains a value if template is in a template group
* groupIndex: each grouped attribute is grouped by an index to help in selecting the elements in the dom
*/
function generateTemplate(userId, attribute, html, urlId, domainId, groupId, groupIndex, templateCallback) {
  var templateId;
  var elementDom;
  var $;
  var elementId;
  var leftTextId;
  var rightTextId;
  var parentElementId;
  var dataAttrSelector;
  var startIndex;
  var endIndex;

  async.series([
    // create template for receipt attribute
    function(callback) {
      SimpleTable.getIdByValue("ser_receipt_attribute", "attribute_name", attribute, function(attributeId) {
        // receipt attribute does not exist
        if (attributeId != null) {
          console.log("----------------TEMPLATE----------------------");
          var newTemplate = new Template(null, attributeId, groupId, urlId, userId);
          newTemplate.save(function(newTemplateId) {
            if (newTemplateId != null) {
              templateId = newTemplateId;
              return callback();
            } else {
              return callback(new Error("failed to create new template"));
            }
          });
        } else {
          return callback(new Error("Attribute " + attribute + " does not exist"));
        }
      });
    },
    // create template_domain for template & domain
    function(callback) {
      console.log("----------------TEMPLATE DOMAIN----------------------");
      var newTemplateDomain = new TemplateDomain(null, templateId, domainId, 1, null, 1, 1);
      newTemplateDomain.save(callback);
    },
    // parse HTML & create root element
    function(callback) {
      $ = cheerio.load(html);
      console.log("Created DOM");

      if (groupId != null) {
        dataAttrSelector = "data-tworeceipt-" + attribute + groupIndex;
      } else {
        dataAttrSelector = "data-tworeceipt-" + attribute;
      }
      elementDom = $("[" + dataAttrSelector + "-start]");

      // create root element
      console.log("----------------ROOT ELEMENT----------------------");
      var rootElement = new Element(null, null, templateId, elementDom[0].name /* tag */, "root", 0, null);
      rootElement.save(function(rootElementId) {
        if (rootElementId != null) {
          elementId = rootElementId;
          return callback();
        } else {
          return callback(new Error("failed to create root element"));
        }
      });
    },
    // calculate selected text
    function(callback) {
      getElementText($, elementDom, function(text) {
        // HARD-CODED &nbsp; REMOVAL (case: amazon.ca)
        text = text.replace(/&nbsp;/g, "");
        // convert html-entities to symbols (ex. &amp; to &)
        var textSelection = entities.decode(text);

        startIndex = elementDom.attr(dataAttrSelector + "-start");
        endIndex = elementDom.attr(dataAttrSelector + "-end");
        textSelection = textSelection.substring(startIndex, endIndex).trim().replace(/\n/g, "");

        console.log("----------------ROOT TEXT----------------------");
        var rootText = new Text(null, templateId, elementId, null, "root", textSelection);
        rootText.save(function(rootTextId) {
          if (rootTextId != null) {
            leftTextId = rootTextId;
            rightTextId = rootTextId;
            return callback();
          } else {
            return callback(new Error("failed to create text"));
          }
        });
      });
    },
    // find index of child nodes that contain start_index and end_index. add left/right text node for these nodes
    function(callback) {
      // tracks current child index
      var childIndex = -1;
      // since space characters are added between text nodes, ensures first child (and blank children before first) does not append a space
      var firstIndex = true;
      // tracks current element index
      var elementIndex = 0;
      // tracks current character index to calculate if indices are included - each node's text length is added
      var characterIndex = 0;

      var firstTextChild;
      var secondTextChild;

      // iterate through all element's children
      async.eachSeries(elementDom[0].children, function(child, eachCallback) {
        childIndex++;

        var containsStart;
        var containsEnd;
        var localStartIndex;
        var localEndIndex;
        var childText;

        if (child.type === "text") {
          // only do text calculations if (first and) second text_child indices have not been found
          if (secondTextChild == null) {
            childText = child.data.trim().replace(/&nbsp;/g, "");
            childText = entities.decode(childText);

            if (!isBlank(childText)) {
              // possible to contain start_index
              if (characterIndex < startIndex) {
                containsStart = true;
                containsEnd = true;
                localStartIndex = startIndex - characterIndex;
                localEndIndex = endIndex - characterIndex;
              }
              // possible to contain end_index
              else if (characterIndex < endIndex) {
                containsStart = false;
                containsEnd = true;
                localEndIndex = endIndex - characterIndex;
              }
              // cannot contain any index
              else {
                containsStart = false;
                containsEnd = false;
              }

              // if first child, don't add space character to element text
              if (childIndex !== 0 && !firstIndex) {
                childText = " " + childText;
              }
              if (firstIndex) {
                firstIndex = false;
              }
              characterIndex += childText.length;

              // check if node contains end_index
              if (characterIndex < startIndex) {
                containsStart = false;
                containsEnd = false;
              }
              else if (characterIndex < endIndex) {
                containsEnd = false;
              }

              async.series([
                // calculate left_text
                function(seriesCallback) {
                  // node contains start_index
                  if (containsStart) {
                    firstTextChild = childIndex;
                    var leftText = childText.substring(0, localStartIndex);

                    if (!isBlank(leftText)) {
                      // if start_index is at end of text, first_text_child should increase so 2nd iteration looks at index for left_text
                      if (localStartIndex === childText.length) {
                        firstTextChild++;
                      }

                      console.log("----------------LEFT NODE TEXT----------------------");
                      var leftTextNode = new Text(null, templateId, elementId, leftTextId, "left", leftText.trim().replace(/\n/g, ""));
                      leftTextNode.save(function (leftTextNodeId) {
                        if (leftTextNodeId != null) {
                          leftTextId = leftTextNodeId;
                          return seriesCallback();
                        } else {
                          return seriesCallback(new Error("failed to create left text of element"));
                        }
                      });
                    } else {
                      return seriesCallback();
                    }
                  } else {
                    return seriesCallback();
                  }
                },
                // calculate right_text
                function(seriesCallback) {
                  // node contains end_index
                  if (containsEnd) {
                    secondTextChild = childIndex;
                    var rightText = childText.substring(localEndIndex);

                    if (!isBlank(rightText)) {
                      // if end_index is at beginning of text, second_text_child should decrease so 2nd iteration looks at index for right_text
                      if (localEndIndex === 0) {
                        secondTextChild--;
                      }

                      console.log("----------------RIGHT NODE TEXT----------------------");
                      var rightTextNode = new Text(null, templateId, elementId, rightTextId, "right", rightText.trim().replace(/\n/g, ""));
                      rightTextNode.save(function (rightTextNodeId) {
                        if (rightTextNodeId != null) {
                          rightTextId = rightTextNodeId;
                          return seriesCallback();
                        } else {
                          return seriesCallback(new Error("failed to create right text of element"));
                        }
                      });
                    } else {
                      return seriesCallback();
                    }
                  } else {
                    return seriesCallback();
                  }
                }
              ], function(err, result) {
                if (err) {
                  console.log(err.message);
                }
                return eachCallback();
              });
            } else {
              return eachCallback();
            }
          } else {
            return eachCallback();
          }
        }
        else if (child.type === "tag") {
          var childElement = elementDom.children(elementIndex);
          var childElementId;

          // create child element
          var newElement = new Element(null, elementId, templateId, childElement[0].name, "child", 1, elementIndex);
          newElement.save(function(newElementId) {
            childElementId = newElementId;

            async.series([
              /*function(seriesCallback) {
                saveAttributes(child_element_id, child_element[0].attribs, seriesCallback);
              },*/
              // create children elements
              /*function(seriesCallback) {
                iterateChildren(CHILDREN_LIMIT, childElement, childElementId, templateId, 1, $, seriesCallback);
              },*/
              // calculate left & right text
              function(seriesCallback) {
              // only do text calculations if (first and) second text_child indices have not been found
                if (secondTextChild == null) {
                  getElementText($, childElement, function(text) {
                    text = text.replace(/&nbsp;/g, "");
                    text = entities.decode(text);

                    if (!isBlank(text)) {
                      childText = text;

                      // possible to contain start_index
                      if (characterIndex < startIndex) {
                        containsStart = true;
                        containsEnd = true;
                        localStartIndex = startIndex - characterIndex;
                        localEndIndex = endIndex - characterIndex;
                      }
                      // possible to contain end_index
                      else if (characterIndex < endIndex) {
                        containsStart = false;
                        containsEnd = true;
                        localEndIndex = endIndex - characterIndex;
                      }
                      // cannot contain any index
                      else {
                        containsStart = false;
                        containsEnd = false;
                      }

                      // if first child, don't add space character to element text
                      if (childIndex !== 0 && !firstIndex) {
                        childText = " " + childText;
                      }
                      if (firstIndex) {
                        firstIndex = false;
                      }
                      characterIndex += childText.length;

                      // check if node contains end_index
                      if (characterIndex < startIndex) {
                        containsStart = false;
                        containsEnd = false;
                      }
                      else if (characterIndex < endIndex) {
                        containsEnd = false;
                      }

                      return seriesCallback();
                    } else {
                      return seriesCallback(new Error("blank text"));
                    }
                  });
                } else {
                  return seriesCallback();
                }
              },
              // create text nodes if current node contains start index
              function(seriesCallback) {
                if (firstTextChild == null && containsStart) {
                  firstTextChild = childIndex;
                  var leftText = childText.substring(0, localStartIndex);
                  if (!isBlank(leftText)) {
                    // if start_index is at end of text, first_text_child should increase so 2nd iteration looks at index for left_text
                    if (localStartIndex === childText.length) {
                      firstTextChild++;
                    }

                    console.log("----------------LEFT NODE TEXT----------------------");
                    var leftTextNode = new Text(null, templateId, childElementId, leftTextId, "left", leftText.trim().replace(/\n/g, ""));
                    leftTextNode.save(function (leftTextNodeId) {
                      if (leftTextNodeId != null) {
                        leftTextId = leftTextNodeId;
                        return seriesCallback();
                      } else {
                        return seriesCallback(new Error("failed to create left text of element"));
                      }
                    });
                  } else {
                    return seriesCallback();
                  }
                } else {
                  return seriesCallback();
                }
              },
              // create text nodes if current node contains end index
              function(seriesCallback) {
                if (secondTextChild == null && containsEnd) {
                  secondTextChild = childIndex;
                  var rightText = childText.substring(localEndIndex);

                  if (!isBlank(rightText)) {
                    // if end_index is at beginning of text, second_text_child should decrease so 2nd iteration looks at index for right_text
                    if (localEndIndex === 0) {
                      secondTextChild--;
                    }

                    console.log("----------------RIGHT NODE TEXT----------------------");
                    var rightTextNode = new Text(null, templateId, childElementId, rightTextId, "right", rightText.trim().replace(/\n/g, ""));
                    rightTextNode.save(function (rightTextNodeId) {
                      if (rightTextNodeId != null) {
                        rightTextId = rightTextNodeId;
                        return seriesCallback();
                      } else {
                        return seriesCallback(new Error("failed to create right text of element"));
                      }
                    });
                  } else {
                    return seriesCallback();
                  }
                } else {
                  return seriesCallback();
                }
              }
            ], function(err, result) {
              if (err) {
                console.log(err.message);
              }
              elementIndex++;
              return eachCallback();
            });
          });
        }
        // unknown node type
        else {
          return eachCallback();
        }
      }, function(err) {
        if (err) {
          return callback(err);
        } else {
          return callback();
        }
      });
    },
    // this is unnecessary, adds additional text fields beyond the minimum
    /*
    // iterate through left elements from first_text_child index
    function(callback) {
      if (first_text_child != null) {
        var first_child = element_dom[0].children[first_text_child];
        async.whilst(function () { return first_child.prev != null; },
        function (whilst_callback) {
          first_text_child--;
          first_child = first_child.prev;
          console.log("----------------CHILD LEFT TEXT----------------------");
          var left_text_node;
          if (first_child.type === "text" && !isBlank(first_child.data)) {
            left_text_node = new Text(null, template_id, element_id, left_text_id, "left", first_child.data.trim().replace(/\n/g, ""));
            left_text_node.save(function (left_text_node_id) {
              if (left_text_node_id != null) {
                left_text_id = left_text_node_id;
                whilst_callback();
              } else {
                whilst_callback(new Error("failed to create left text of element"));
              }
            });
          } else if (first_child.type === "tag") {
            var child_element_id = child_elements[first_text_child];
            var child_element = element_dom.children(element_indices[first_text_child]);
            if (child_element != null && !isBlank(child_element.text())) {
              left_text_node = new Text(null, template_id, child_element_id, left_text_id, "left", child_element.text().trim().replace(/\n/g, ""));
              left_text_node.save(function (left_text_node_id) {
                if (left_text_node_id != null) {
                  left_text_id = left_text_node_id;
                  whilst_callback();
                } else {
                  whilst_callback(new Error("failed to create left text of element"));
                }
              });
            } else {
              whilst_callback();
            }
          } else {
            whilst_callback();
          }
        }, function (err) {
          if (err) {
            console.log(err.message);
          }
          callback();
        });
      } else {
        callback();
      }
    },
    // iterate through right elements from second_text_child index
    function(callback) {
      if (second_text_child != null) {
        var second_child = element_dom[0].children[second_text_child];
        async.whilst(function () { return second_child.next !== null; },
        function (whilst_callback) {
          second_text_child++;
          second_child = second_child.next;
          console.log("----------------CHILD RIGHT TEXT----------------------");
          var right_text_node;
          if (second_child.type === "text" && !isBlank(second_child.data)) {
            right_text_node = new Text(null, template_id, element_id, right_text_id, "right", second_child.data.trim().replace(/\n/g, ""));
            right_text_node.save(function (right_text_node_id) {
              if (right_text_node_id != null) {
                right_text_id = right_text_node_id;
                whilst_callback();
              } else {
                whilst_callback(new Error("failed to create left text of element"));
              }
            });
          } else if (second_child.type === "tag") {
            var child_element_id = child_elements[second_text_child];
            var child_element = element_dom.children(element_indices[second_text_child]);
            if (child_element != null && !isBlank(child_element.text())) {
              right_text_node = new Text(null, template_id, child_element_id, right_text_id, "right", child_element.text().trim().replace(/\n/g, ""));
              right_text_node.save(function (right_text_node_id) {
                if (right_text_node_id != null) {
                  right_text_id = right_text_node_id;
                  whilst_callback();
                } else {
                  whilst_callback(new Error("failed to create right text of element"));
                }
              });
            } else {
              whilst_callback();
            }
          } else {
            whilst_callback();
          }
        }, function (err) {
          if (err) {
            console.log(err.message);
          }
          callback();
        });
      } else {
        callback();
      }
    },*/
    // create parent element, to use for finishing sibling element/text nodes
    function(callback) {
      // if element is not body (root), it will have a parent element
      if (elementDom[0].type !== "root") {
        var parentDom = elementDom.parent();
        // parentDom is root
        if (parentDom.length === 0) {
          parentDom = $.root();
        }

        console.log("----------------PARENT ELEMENT----------------------");
        var parentElement = new Element(null, elementId, templateId, parentDom[0].name /* tag */, "parent", -1, null);
        parentElement.save(function(newParentElementId) {
          if (newParentElementId != null) {
            parentElementId = newParentElementId;
            return callback();
          } else {
            return callback(new Error("failed to create parent element"));
          }
        });
      } else {
        return callback();
      }
    },
    // save parent element attributes
    /*function(callback) {
      if (parentElementId !== null) {
        if (element_dom.parent().length === 0) {
          saveAttributes(parentElementId, $.root()[0].attribs, callback);
        } else {
          saveAttributes(parentElementId, element_dom.parent()[0].attribs, callback);
        }
      } else {
        callback();
      }
    },*/
    // find order
    function(callback) {
      var rootOrder = 0;
      if (parentElementId != null) {
        // root node
        var parentDom = elementDom.parent();
        var rootNode = parentDom.prevObject[0];

        for (var i = 0; i < parentDom.children().length; i++) {
          var child_dom = parentDom.children(i);
          if (child_dom[0] === rootNode) {
            rootOrder = i;
            Element.getElementById(elementId, function(err, rootElement) {
              if (err) {
                console.log(err.message);
                return callback();
              } else {
                console.log("Found order of root node " + rootOrder);
                rootElement.order = rootOrder;
                return rootElement.save(callback);
              }
            });
            break;
          }
        }
      } else {
        return callback();
      }
    },
    // calculate left sibling elements & text
    /*function(callback) {
      if (parentElementId != null) {
        console.log("----------------LEFT SIBLINGS----------------------");
        iterateSiblings("left", rootOrder, element_dom[0], element_dom, template_id, left_text_id, null, parentElementId, $, callback);
      } else {
        callback();
      }
    },
    // calculate right sibling elements & text
    function(callback) {
      if (parentElementId != null) {
        console.log("----------------RIGHT SIBLINGS----------------------");
        iterateSiblings("right", rootOrder, element_dom[0], element_dom, template_id, right_text_id, null, parentElementId, $, callback);
      } else {
        callback();
      }
    },*/
    // calculate all parent elements
    function(callback) {
      if (parentElementId != null) {
        console.log("----------------PARENT ELEMENTS----------------------");
        iterateParent(elementDom.parent(), parentElementId, templateId, -1, $, callback);
      } else {
        return callback();
      }
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Completed generateTemplate method");
    }
    return templateCallback();
  });
}

// for each attribute, create ElementAttribute
/*function saveAttributes(element_id, attributes, funcCallback) {
  if (attributes != null) {
    async.eachSeries(Object.keys(attributes), function(key, callback) {
      if (attributes.hasOwnProperty(key)) {
        // ignore two-receipt data attributes
        if (key.indexOf("data-tworeceipt") === -1 && !isBlank(attributes[key])) {
          var attr = new ElementAttribute(key, attributes[key].trim(), element_id);
          attr.save(callback);
        } else {
          callback();
        }
      } else {
        callback();
      }
    }, function(err) {
      if (err) {
        funcCallback(new Error("An error occurred in saveAttributes for element " + element_id));
      } else {
        console.log("Added attributes for element " + element_id);
        funcCallback();
      }
    });
  } else {
    funcCallback();
  }
}*/

// iterates through all DOM children of parent_node and creates element and attributes
function iterateChildren(levelLimit, parentDom, parentElementId, templateId, parentLevel, $, funcCallback) {
  if (parentDom.children().length !== 0 && levelLimit !== 0) {
    var level = parentLevel + 1;
    var count = 0;
    async.eachSeries(parentDom.children(), function(child, callback) {
      var childDom = parentDom.children(count);
      var newElement = new Element(null, parentElementId, templateId, child.name, "child", level, count);
      count++;
      newElement.save(function(elementId) {
        if (elementId != null) {
          //saveAttributes(elementId, child.attribs, function() {
            iterateChildren(levelLimit-1, childDom, elementId, templateId, level, $, callback);
          //});
        } else {
          return callback(new Error("failed to create child element"));
        }
      });
    }, function(err) {
      if (err) {
        return funcCallback(err);
      } else {
        console.log("Added child elements of level " + level);
        return funcCallback();
      }
    });
  } else {
    return funcCallback();
  }
}

// iterates through all DOM parents of parent_node and creates element and attributes
function iterateParent(parentDom, elementId, templateId, level, $, funcCallback) {
  var newElement;
  level--;
  // not body element
  if (parentDom.parent().length !== 0) {
    parentDom = parentDom.parent();
    var tag = parentDom[0].name;

    newElement = new Element(null, elementId, templateId, tag, "parent", level, 0);
    newElement.save(function(parentElementId) {
      if (parentElementId != null) {
        console.log("Added parent element of level " + level);
        //saveAttributes(parentElementId, parentDom[0].attribs, function() {
          async.series([
            // iterate down to parent children
            function(callback) {
              iterateParentChildren(parentDom, parentElementId, parentDom.prevObject[0], elementId, templateId, level, $, callback);
            },
            // iterate up to next parent node
            function(callback) {
              iterateParent(parentDom, parentElementId, templateId, level, $, callback);
            }
          ], function(err, result) {
            if (err) {
              return funcCallback(err);
            } else {
              console.log("Completed iterateParent");
              return funcCallback();
            }
          });
        //});
      } else {
        return funcCallback(new Error("failed to create child element"));
      }
    });
  } else {
    // body element
    var bodyDom = $.root();
    newElement = new Element(null, elementId, templateId, "body", "parent", level, null);
    newElement.save(function(parentElementId) {
      if (parentElementId != null) {
        console.log("Added body element at level " + level);
        //saveAttributes(parentElementId, bodyDom[0].attribs, function() {
          // iterate down to parent children
          iterateParentChildren(bodyDom, parentElementId, parentDom[0], elementId, templateId, level, $, function() {
            console.log("Completed iterateParent");
            return funcCallback();
          });
        //});
      } else {
        return funcCallback(new Error("failed to create child element"));
      }
    });
  }
}

// iterates through all DOM parent children of parent_node, except for the original child node and creates element and attributes
function iterateParentChildren(parentDom, parentElementId, childNode, childElementId, templateId, parentLevel, $, funcCallback) {
  if (parentDom.children().length > 1) {
    var level = parentLevel + 1;
    var count = 0;
    async.eachSeries(parentDom.children(), function(child, callback) {
      // ignore child node
      if (child !== childNode) {
        var childDom = parentDom.children(count);
        var newElement = new Element(null, parentElementId, templateId, child.name, "child", level, count);
        count++;
        newElement.save(function(elementId) {
          if (elementId != null) {
            //saveAttributes(element_id, child.attribs, function() {
              iterateChildren(CHILDREN_LIMIT, childDom, elementId, templateId, level, $, callback);
            //});
          } else {
            return callback(new Error("failed to create child element"));
          }
        });
      } else {
        // update child_node order
        var rootOrder = count;
        count++;
        Element.getElementById(childElementId, function(err, childElement) {
          if (err) {
            return callback();
          } else {
            childElement.order = rootOrder;
            childElement.save(callback);
          }
        });
      }
    }, function(err) {
      if (err) {
        return funcCallback(err);
      } else {
        console.log("Added child elements of level " + level);
        return funcCallback();
      }
    });
  } else {
    Element.getElementById(childElementId, function(err, childElement) {
      if (err) {
        return funcCallback();
      } else {
        childElement.order = 0;
        childElement.save(funcCallback);
      }
    });
  }
}

// iterate through siblings in one direction until there are no more siblings
/*function iterateSiblings(direction, order, element_node, element_dom, template_id, text_id, element_id, parentElementId, $, funcCallback) {
  if (direction === "left" && element_node.prev != null) {
    element_node = element_node.prev;
  } else if (direction === "right" && element_node.next != null) {
    element_node = element_node.next;
  } else {
    return funcCallback();
  }

  // text node
  if (element_node.type === "text") {
    // if text node is not blank, create text node for parent
    if (!isBlank(element_node.data)) {
      var new_text = new Text(null, template_id, parentElementId, text_id, direction, element_node.data.trim().replace(/\n/g, ""));
      new_text.save(function(new_text_id) {
        if (new_text_id != null) {
          iterateSiblings(direction, order, element_node, element_dom, template_id, new_text_id, element_id, parentElementId, $, funcCallback);
          console.log("Completed iterateSiblings " + direction + " method for element node");
        } else {
          funcCallback("failed at creating sibling text for text node");
        }
      });
    } else {
      iterateSiblings(direction, order, element_node, element_dom, template_id, text_id, element_id, parentElementId, $, funcCallback);
    }
  }
  // element node
  else {
    if (direction === "left") {
      element_dom = element_dom.prev();
      order--;
    } else {
      element_dom = element_dom.next();
      order++;
    }

    async.series([
      function(callback) {
        var level = 0;
        var newElement = new Element(null, parentElementId, template_id, element_dom[0].name, "sibling", level, order);
        newElement.save(function(newElement_id) {
          if (newElement_id != null) {
            element_id = newElement_id;
            iterateChildren(CHILDREN_LIMIT, element_dom, element_id, template_id, level, $, callback);
          } else {
            callback(new Error("failed at creating sibling element"));
          }
        });
      }, function(callback) {
        if (!isBlank(element_dom.text())) {
          var new_text = new Text(null, template_id, element_id, text_id, direction, element_dom.text().trim().replace(/\n/g, ""));
          new_text.save(function(new_text_id) {
            if (new_text_id != null) {
              iterateSiblings(direction, order, element_node, element_dom, template_id, new_text_id, element_id, parentElementId, $, callback);
            } else {
              callback(new Error("failed at creating sibling text for element node"));
            }
          });
        } else {
          iterateSiblings(direction, order, element_node, element_dom, template_id, text_id, element_id, parentElementId, $, callback);
        }
      }
    ], function(err, result) {
      if (err) {
        funcCallback(err);
      } else {
        console.log("Completed iterateSiblings " + direction + " method for element node");
        funcCallback();
      }
    });
  }
}*/

// retrieves the text contents of a dom element
function getElementText($, element, callback) {
  var params = { "text": "", "trim": true };

  // iterate through all children of body element
  if (element.length > 0) {
    var children = element[0].children;
    async.eachSeries(children, function(child, eachCallback) {
      iterateText(child, addText, params, function(returnedParams) {
        params = returnedParams;
        return eachCallback();
      });
    }, function(err) {
      if (err) {
        console.log(err.message);
      }
      return callback(params.text);
    });
  } else {
    console.log("element does not exist. no text retrieved");
    return callback("");
  }
}

function iterateText(node, method, methodParams, callback) {
  // run method for non-whitespace text nodes
  if (node.type === "text" && /\S/.test(node.data)) {
    method(node, methodParams, function(returnedParams) {
      return callback(returnedParams);
    });
  }
  // iterateText through children of non-style/script elements
  else if (node.type === "tag" && node.children && !/(style|script)/i.test(node.name)) {
    async.eachSeries(node.children, function(child, eachCallback) {
      iterateText(child, method, methodParams, function(returnedParams) {
        methodParams = returnedParams;
        return eachCallback();
      });
    }, function(err) {
      if (err) {
        console.log(err.message);
      }
      return callback(methodParams);
    });
  } else {
    return callback(methodParams);
  }
}

function addText(node, params, callback) {
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
  return callback({ "text": text, "trim": trim });
}

function isBlank(text) {
  // remove whitespace (\n, \t, etc)
  if (text.trim() === "") {
    return true;
  } else {
    return false;
  }
}
