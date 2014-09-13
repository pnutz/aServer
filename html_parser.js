var cheerio = require("cheerio");
var async = require("async");
var Entities = require("html-entities").AllHtmlEntities;
var entities = new Entities();

var Element = require("./model/element");
var Template = require("./model/template");
var TemplateDomain = require("./model/template_domain");
var TemplateGroup = require("./model/template_group");
var Text = require("./model/text");
var Url = require("./model/url");

exports.generateTemplates = function(userId, domain, url, html, attributeData) {
  var newUrl;
  var individualAttributes = attributeData;
  var groupedAttributes = {};

  if (Object.keys(individualAttributes).length === 0) {
    console.log("No attribute data sent");
    return;
  }

  // calculate grouped attribute keys - groupedAttributes = { items: {}, other: {} }
  var attrGroups = Object.keys(global.attributes.groupedAttributes);
  for (var i = 0; i < attrGroups.length; i++) {
    if (attrGroups[i] !== "id" && attributeData.hasOwnProperty(attrGroups[i])) {
      groupedAttributes[attrGroups[i]] = attributeData[attrGroups[i]];
      delete individualAttributes[attrGroups[i]];
    }
  }

  // set grouped and individual keys
  var keys = Object.keys(individualAttributes);
  var groupedKeys = Object.keys(groupedAttributes);

  var $ = cheerio.load(html);
  console.log("Created DOM");

  async.series([
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
        async.eachSeries(keys, function(key, eachCallback) {
          generateTemplate($, userId, key, individualAttributes[key], newUrl.id,
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
          // iterate through each key contained within grouped attribute
          async.eachSeries(Object.keys(groupedAttributes[groupName]), function(key, eachCallback2) {
            generateTemplateGroup($, userId, newUrl.id, newUrl.domain_id, groupName, groupedAttributes[groupName][key], key, eachCallback2);
          }, function(err) {
            if (err) {
              console.log(err.message);
            }
            return eachCallback();
          });
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

function generateTemplateGroup($, userId, urlId, domainId, groupName, attributeGroup, index, templateCallback) {
  var templateGroupId;

  async.series([
    // create template group
    function(callback) {
      var templateGroup = new TemplateGroup(null, domainId, global.attributes.groupedAttributes[groupName].id, 1, null, 1, 1);
      templateGroup.save(function(id) {
        templateGroupId = id;
        return callback();
      });
    },
    // generate templates for each grouped attribute
    function(callback) {
      var attributeKeys = Object.keys(attributeGroup);
      async.eachSeries(attributeKeys, function(attr, eachCallback) {
        if (attr !== "row") {
          generateTemplate($, userId, attr, attributeGroup[attr], urlId, domainId,
                           templateGroupId, index, eachCallback);
        } else {
          return eachCallback();
        }
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
      generateRowTemplate($, userId, attributeGroup["row"], urlId, templateGroupId, callback);
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

function generateRowTemplate($, userId, elementPath, urlId, templateGroupId, callback) {
  // attribute id for row
  var rowAttributeId = global.attributes.groupedAttributes.items.row.id;

  var newTemplate = new Template(null, rowAttributeId, templateGroupId, urlId, userId);
  newTemplate.save(function(templateId) {
    if (templateId != null) {
      saveElementPath($, templateId, elementPath, null, function(err, rootElementId) {
        if (err) {
          return callback(err);
        } else {
          console.log("Completed generateRowTemplate method");
          return callback();
        }
      });
    } else {
      return callback(new Error("failed to create new template"));
    }
  });
}

/*
* groupId: groupId contains a value if template is in a template group
* groupIndex: each grouped attribute is grouped by an index to help in selecting the elements in the dom
*/
function generateTemplate($, userId, attribute, elementPath, urlId, domainId, groupId, groupIndex, templateCallback) {
  var templateId;
  var elementDom;
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
      var attributeId;
      // grouped attribute
      if (groupIndex != null) {
        var groupedAttributes = Object.keys(global.attributes.groupedAttributes);
        for (var i = 0; i < groupedAttributes.length; i++) {
          if (groupedAttributes[i] !== "id" && global.attributes.groupedAttributes[groupedAttributes[i]].hasOwnProperty(attribute)) {
            attributeId = global.attributes.groupedAttributes[groupedAttributes[i]][attribute].id;
          }
        }
      } else if (global.attributes.individualAttributes.hasOwnProperty(attribute)) {
        attributeId = global.attributes.individualAttributes[attribute].id;
      }

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
    },
    // create template_domain for template & domain
    function(callback) {
      console.log("----------------TEMPLATE DOMAIN----------------------");
      var newTemplateDomain = new TemplateDomain(null, templateId, domainId, 1, null, 1, 1);
      newTemplateDomain.save(callback);
    },
    // create elements
    function(callback) {
      if (groupId != null) {
        dataAttrSelector = "data-tworeceipt-" + attribute + groupIndex;
      } else {
        dataAttrSelector = "data-tworeceipt-" + attribute;
      }
      elementDom = $("[" + dataAttrSelector + "-start]");

      // create root element
      console.log("----------------ELEMENT PATH----------------------");
      saveElementPath($, templateId, elementPath, elementDom, function(err, rootElementId) {
        if (err) {
          return callback(err);
        } else {
          elementId = rootElementId;
          return callback();
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
              if (characterIndex < startIndex - 1) {
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

          // create child element (index of -1)
          var newElement = new Element(null, templateId, childElement[0].name, -1, elementIndex);
          newElement.save(function(newElementId) {
            childElementId = newElementId;

            async.series([
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
                      if (characterIndex < startIndex - 1) {
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

// save elements for elementPath and returns error and root element id
function saveElementPath($, templateId, elementPath, rootElement, callback) {
  var element;
  var elementId;
  var index = 0;
  async.eachSeries(elementPath, function(order, eachCallback) {
    if (element == null) {
      element = $("body");
    } else {
      element = element.children();
      if (element.length > 0) {
        element = element.eq(order);
      }
    }

    if (element.length === 0) {
      return eachCallback(new Error("elementPath param error"));
    }

    var tag = element[0].name;
    var newElement = new Element(null, templateId, tag, index, order);
    newElement.save(function(newElementId) {
      if (newElementId != null) {
        elementId = newElementId;
        index++;
        return eachCallback();
      } else {
        return eachCallback(new Error("failed element creation"));
      }
    });
  }, function (err) {
    if (!err && rootElement != null && rootElement[0] !== element[0]) {
      err = new Error("root element does not have data attr selector");
    }
    return callback(err, elementId);
  });
}

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
