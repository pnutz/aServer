var cheerio = require("cheerio"),
async = require("async"),
CLASS_NAME = "TwoReceipt",
TEXT_ID = "-!|_|!-",
CHILDREN_LIMIT = 2,
Element = require("./model/element"),
Template = require("./model/template"),
TemplateDomain = require("./model/template_domain"),
ElementAttribute = require("./model/element_attribute"),
ReceiptAttribute = require("./model/receipt_attribute"),
Text = require("./model/text"),
Url = require("./model/url"),
SimpleTable = require("./model/simple_table");

exports.generateTemplate = function(userID, attribute, selection, element, html, body_text, url, domain) {
  var url_id, newUrl, template_id, newTemplate, elementDom, elementText,
  $, element_id, left_text_id, right_text_id, text, parent_element_id, root_order;
  
  async.series([
    // create url
    function(callback) {
      console.log("----------------URL----------------------");
      newUrl = new Url(null, domain, url);
      newUrl.save(function(newUrl_id) {
        if (newUrl_id != null) {
          url_id = newUrl_id;
          callback();
        } else {
          callback(new Error("failed to create new url"));
        }
      });
    },
    // create template for receipt attribute
    function(callback) {
      SimpleTable.getIdByValue("ser_receipt_attribute", "attribute_name", attribute, function(attribute_id) {
        // receipt attribute does not exist
        if (attribute_id != null) {
          console.log("----------------TEMPLATE----------------------");
          newTemplate = new Template(null, attribute_id, url_id, null, userID);
          newTemplate.save(function(newTemplate_id) {
            if (newTemplate_id != null) {
              template_id = newTemplate_id;
              callback();
            } else {
              callback(new Error("failed to create new template"));
            }
          });
        } else {
          callback(new Error("Attribute " + attribute + " does not exist"));
        }
      });
    },
    // create template_domain for template & domain
    function(callback) {
      console.log("----------------TEMPLATE DOMAIN----------------------");
      var newTemplateDomain = new TemplateDomain(template_id, newUrl.domain_id, null, null);
      newTemplateDomain.save(callback);
    },
    // parse HTML & create root element
    function(callback) {
      $ = cheerio.load(html);
      console.log("Created DOM");
      // find defined element. if it doesn't exist, take the root (body)
      var tag;
      elementDom = $("." + CLASS_NAME);

      if (elementDom.length == 0) {
        elementDom = $.root();
        tag = "body";
      } else {
        tag = elementDom[0].name;
      }
      elementText = elementDom.text();
      
      // set text
      if (selection == "") {
        text = elementText;
      } else {
        text = selection;
      }
      
      // create root element
      console.log("----------------ROOT ELEMENT----------------------");
      var rootElement = new Element(null, null, template_id, tag, "root", 0, element, null);
      rootElement.save(function(rootElement_id) {
        if (rootElement_id != null) {
          element_id = rootElement_id;
          callback();
        } else {
          callback(new Error("failed to create root element"));
        }
      });
    },
    // save root element attributes
    function(callback) {
      saveAttributes(element_id, elementDom[0].attribs, callback);
    },
    // save root text
    function(callback) {
      console.log("----------------ROOT TEXT----------------------");
      var rootText = new Text(null, template_id, element_id, null, "root", text);
      rootText.save(function(rootText_id) {
        if (rootText_id != null) {
          left_text_id = rootText_id;
          right_text_id = rootText_id;

          // update template text_id
          newTemplate.text_id = rootText_id;
          newTemplate.save(function() {
            console.log("Added text_id to template");
            callback();
          });
        } else {
          callback(new Error("failed to create text"));
        }
      });
    },
    // check if left text node is within element text (if TEXT_ID exists)
    function(callback) {
      var firstIndex = elementText.indexOf(TEXT_ID);
      var secondIndex = elementText.indexOf(TEXT_ID, firstIndex + 1);
      // leftText is in rootElement
      if (firstIndex != -1 && firstIndex != 0) {
        var left = elementText.substring(0, firstIndex);
        console.log("----------------LEFT TEXT----------------------");
        var leftTextNode = new Text(null, template_id, element_id, left_text_id, "left", left);
        leftTextNode.save(function (leftTextNode_id) {
          if (leftTextNode_id != null) {
            left_text_id = leftTextNode_id;
            callback();
          } else {
            callback(new Error("failed to create left text of element"));
          }
        });
      } else {
        callback();
      }
    },
    // check if right text node is within element text (if TEXT_ID exists)
    function(callback) {
      var firstIndex = elementText.indexOf(TEXT_ID);
      var secondIndex = elementText.indexOf(TEXT_ID, firstIndex + 1);
      // rightText is in rootElement
      if (firstIndex != -1 && secondIndex != elementText.length - TEXT_ID.length) {
        var right = elementText.substring(secondIndex + TEXT_ID.length);
        console.log("----------------RIGHT TEXT----------------------");
        var rightTextNode = new Text(null, template_id, element_id, right_text_id, "right", right);
        rightTextNode.save(function (rightTextNode_id) {
          if (rightTextNode_id != null) {
            right_text_id = rightTextNode_id;
            callback();
          } else {
            callback(new Error("failed to create right text of element"));
          }
        });
      } else {
        callback();
      }
    },
    // create parent element, to use for finishing sibling element/text nodes
    function(callback) {
      // if element is not body (root), it will have a parent element
      if (elementDom[0].type !== "root") {
        var parentDom = elementDom.parent();
        var tag;
        // parentDom is root
        if (parentDom.length == 0) {
          parentDom = $.root();
          tag = "body";
          html = "<body>" + $.html(parentDom) + "</body>";
        } else {
          tag = parentDom[0].name;
          html = $.html(parentDom);
        }
        console.log("----------------PARENT ELEMENT----------------------");
        var parentElement = new Element(null, element_id, template_id, tag, "parent", -1, $.html(parentDom), null);
        parentElement.save(function(parentElement_id) {
          if (parentElement_id != null) {
            parent_element_id = parentElement_id;
            callback();
          } else {
            callback(new Error("failed to create parent element"));
          }
        });
      } else {
        callback();
      }
    },
    // save parent element attributes
    function(callback) {
      if (parent_element_id != null) {
        if (elementDom.parent().length == 0) {
          saveAttributes(parent_element_id, $.root()[0].attribs, callback);
        } else {
          saveAttributes(parent_element_id, elementDom.parent()[0].attribs, callback);
        }
      } else {
        callback();
      }
    },
    // find order
    function(func_callback) {
      root_order = 0;
      if (parent_element_id != null) {
        // root node
        var parentDom = elementDom.parent();
        var root_node = parentDom.prevObject[0];
        var count = 0;
        async.eachSeries(parentDom.children(), function(child, callback) {
          var childDom = parentDom.children(count);
          // match to root node, update order
          if (childDom[0] == root_node) {
            root_order = count;
            count++;
            // update root element with order
            Element.getElementById(element_id, function(root_element) {
              root_element.order = root_order;
              root_element.save(callback);
            });
          } else {
            count++;
            callback();
          }
        }, function(err) {
          if (err) {
            func_callback(err.message);
          } else {
            console.log("Found order of root node " + root_order);
          }
          func_callback();
        });
      }
    },
    // calculate left sibling elements & text
    function(callback) {
      if (parent_element_id != null) {
        console.log("----------------LEFT SIBLINGS----------------------");
        iterate_siblings("left", root_order, elementDom[0], elementDom, template_id, left_text_id, null, parent_element_id, $, callback);
      } else {
        callback();
      }
    },
    // calculate right sibling elements & text
    function(callback) {
      if (parent_element_id != null) {
        console.log("----------------RIGHT SIBLINGS----------------------");
        iterate_siblings("right", root_order, elementDom[0], elementDom, template_id, right_text_id, null, parent_element_id, $, callback);
      } else {
        callback();
      }
    },
    // calculate all children elements
    function(callback) {
      console.log("----------------CHILD ELEMENTS----------------------");
      iterate_children(CHILDREN_LIMIT, 1, elementDom, element_id, template_id, 0, $, callback);
    },
    // calculate all parent elements
    function(callback) {
      if (parent_element_id != null) {
        console.log("----------------PARENT ELEMENTS----------------------");
        iterate_parent(elementDom.parent(), parent_element_id, template_id, -1, $, callback);
      } else {
        callback();
      }
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Completed generateTemplate method");
    }
  });
};

// for each attribute, create ElementAttribute
function saveAttributes(element_id, attributes, func_callback) {
  if (attributes != null) {
    async.eachSeries(Object.keys(attributes), function(key, callback) {
      if (attributes.hasOwnProperty(key)) {
        if (key == "class") {
          attributes[key] = attributes[key].replace(" " + CLASS_NAME, "");
        }
        if (!isBlank(attributes[key])) {
          var attr = new ElementAttribute(key, attributes[key], element_id);
          attr.save(callback);
        } else {
          callback();
        }
      } else {
        callback();
      }
    }, function(err) {
      if (err) {
        func_callback(new Error("An error occurred in saveAttributes for element " + element_id));
      } else {
        console.log("Added attributes for element " + element_id);
        func_callback();
      }
    });
  } else {
    func_callback();
  }
}

// iterates through all DOM children of parent_node and creates element and attributes
function iterate_children(level_limit, level_change, parentDom, parent_element_id, template_id, parent_level, $, func_callback) {
  if (parentDom.children().length != 0 && level_limit != 0) {
    var level = parent_level + level_change;
    var count = 0;
    async.eachSeries(parentDom.children(), function(child, callback) {
      var childDom = parentDom.children(count);
      var newElement = new Element(null, parent_element_id, template_id, child.name, "child", level, $.html(child), count);
      count++;
      newElement.save(function(element_id) {
        if (element_id != null) {
          saveAttributes(element_id, child.attribs, function() {
            iterate_children(level_limit - 1, level_change, childDom, element_id, template_id, level, $, callback);
          });
        } else {
          callback(new Error("failed to create child element"));
        }
      });
    }, function(err) {
      if (err) {
        func_callback(new Error(err.message));
      } else {
        console.log("Added child elements of level " + level);
        func_callback();
      }
    });
  } else {
    func_callback();
  }
}

// iterates through all DOM parents of parent_node and creates element and attributes
function iterate_parent(parentDom, element_id, template_id, level, $, func_callback) {
  level--;
  // not body element
  if (parentDom.parent().length != 0) {
    parentDom = parentDom.parent();
    var tag = parentDom[0].name;
    
    var newElement = new Element(null, element_id, template_id, tag, "parent", level, $.html(parentDom), 0);
    newElement.save(function(parent_element_id) {
      if (parent_element_id != null) {
        console.log("Added parent element of level " + level);
        saveAttributes(parent_element_id, parentDom[0].attribs, function() {
          async.series([
            // iterate down to parent children
            function(callback) {
              iterate_parent_children(parentDom, parent_element_id, parentDom.prevObject[0], element_id, template_id, level, $, callback);
            },
            // iterate up to next parent node
            function(callback) {
              iterate_parent(parentDom, parent_element_id, template_id, level, $, callback);
            }
          ], function(err, result) {
            if (err) {
              func_callback(new Error(err.message));
            } else {
              console.log("Completed iterate_parent");
              func_callback();
            }
          });
        });
      } else {
        func_callback(new Error("failed to create child element"));
      }
    });
  } else {
    // body element
    parentDom = $.root();
    var newElement = new Element(null, element_id, template_id, "body", "parent", level, "<body>" + $.html(parentDom) + "</body>", null);
    newElement.save(function(parent_element_id) {
      if (parent_element_id != null) {
        console.log("Added body element at level " + level);
        saveAttributes(parent_element_id, parentDom[0].attribs, function() {
          // iterate down to parent children
          iterate_parent_children(parentDom, parent_element_id, parentDom.prevObject[0], element_id, template_id, level, $, function() {
            console.log("Completed iterate_parent");
            func_callback();
          });
        });
      } else {
        func_callback(new Error("failed to create child element"));
      }
    });
  }
}

// iterates through all DOM parent children of parent_node, except for the original child node and creates element and attributes
function iterate_parent_children(parentDom, parent_element_id, child_node, child_element_id, template_id, parent_level, $, func_callback) {
  if (parentDom.children().length > 1) {
    var level = parent_level - 1;
    var count = 0;
    async.eachSeries(parentDom.children(), function(child, callback) {
      // ignore child node
      if (child != child_node) {
        var childDom = parentDom.children(count);
        var newElement = new Element(null, parent_element_id, template_id, child.name, "child", level, $.html(child), count);
        count++;
        newElement.save(function(element_id) {
          if (element_id != null) {
            saveAttributes(element_id, child.attribs, function() {
              iterate_children(CHILDREN_LIMIT, -1, childDom, element_id, template_id, level, $, callback);
            });
          } else {
            callback(new Error("failed to create child element"));
          }
        });
      } else {
        // update child_node order
        var order = count;
        count++;
        Element.getElementById(child_element_id, function(child_element) {
              child_element.order = count;
              child_element.save(callback);
            });
      }
    }, function(err) {
      if (err) {
        func_callback(err.message);
      } else {
        console.log("Added child elements of level " + level);
        func_callback();
      }
    });
  } else {
    Element.getElementById(child_element_id, function(child_element) {
      child_element.order = 0;
      child_element.save(func_callback);
    });
  }
}

// iterate through siblings in one direction until there are no more siblings
function iterate_siblings(direction, order, element_node, elementDom, template_id, text_id, element_id, parent_element_id, $, func_callback) {
  if (direction === "left" && element_node.prev != null) {
    element_node = element_node.prev;
  } else if (direction === "right" && element_node.next != null) {
    element_node = element_node.next;
  } else {
    func_callback();
    return;
  }
  
  // text node
  if (element_node.type === "text") {
    // if text node is not blank, create text node for parent
    if (!isBlank(element_node.data)) {
      var newText = new Text(null, template_id, parent_element_id, text_id, direction, element_node.data.trim());
      newText.save(function(newText_id) {
        if (newText_id != null) {
          iterate_siblings(direction, order, element_node, elementDom, template_id, newText_id, element_id, parent_element_id, $, func_callback);
          console.log("Completed iterate_siblings " + direction + " method for element node");
        } else {
          func_callback("failed at creating sibling text for text node");
        }
      });
    } else {
      iterate_siblings(direction, order, element_node, elementDom, template_id, text_id, element_id, parent_element_id, $, func_callback);
    }
  }
  // element node
  else {
    var element_id;
    if (direction === "left") {
      elementDom = elementDom.prev();
      order--;
    } else {
      elementDom = elementDom.next();
      order++;
    }
    
    async.series([
      function(callback) {
        var level = -2;
        var newElement = new Element(null, parent_element_id, template_id, elementDom[0].name, "sibling", level, $.html(elementDom), order);
        newElement.save(function(newElement_id) {
          if (newElement_id != null) {
            element_id = newElement_id;
            iterate_children(CHILDREN_LIMIT, -1, elementDom, element_id, template_id, level, $, callback)
          } else {
            callback(new Error("failed at creating sibling element"));
          }
        });
      }, function(callback) {
        if (!isBlank(elementDom.text())) {
          var newText = new Text(null, template_id, element_id, text_id, direction, elementDom.text());
          newText.save(function(newText_id) {
            if (newText_id != null) {
              iterate_siblings(direction, order, element_node, elementDom, template_id, newText_id, element_id, parent_element_id, $, callback);
            } else {
              callback(new Error("failed at creating sibling text for element node"));
            }
          });
        } else {
          iterate_siblings(direction, order, element_node, elementDom, template_id, text_id, element_id, parent_element_id, $, callback);
        }
      }
    ], function(err, result) {
      if (err) {
        func_callback(err.message);
      } else {
        console.log("Completed iterate_siblings " + direction + " method for element node");
        func_callback();
      }
    });
  }
}

function isBlank(text) {
  // remove whitespace (\n, \t, etc)
  if (text.trim() === "") {
    return true;
  } else {
    return false;
  }
}