var cheerio = require("cheerio"),
async = require("async"),
Element = require("./model/element"),
Template = require("./model/template"),
TemplateDomain = require("./model/template_domain"),
ElementAttribute = require("./model/element_attribute"),
ReceiptAttribute = require("./model/receipt_attribute"),
Text = require("./model/text"),
Url = require("./model/url"),
SimpleTable = require("./model/simple_table");

exports.readTemplate = function(userID, html, url, domain) {
  var domain_id, attribute_id, _templates;
  
  async.series([
    // load domain
    function(callback) {
      console.log("----------------LOAD DOMAIN----------------------");
      SimpleTable.getIdByValue("ser_domain", "domain_name", domain, function(select_domain_id) {
        // found domain
        if (select_domain_id != null) {
          domain_id = select_domain_id;
          callback();
        } else {
          callback(new Error("Domain does not exist in DB"));
        }
      });
    },
    // load attribute
    function(callback) {
      // iterate through each receipt attribute
      //async.each();
      
      console.log("----------------LOAD ATTRIBUTE----------------------");
      SimpleTable.getIdByValue("ser_receipt_attribute", "attribute_name", "date", function(select_attribute_id) {
        // found attribute
        if (select_attribute_id != null) {
          attribute_id = select_attribute_id;
          callback();
        } else {
          callback(new Error("Attribute does not exist in DB"));
        }
      });
    },
    // load all templates
    function(callback) {
      console.log("----------------LOAD TEMPLATES----------------------");
      TemplateDomain.getTemplatesByDomain(domain_id, function(templates) {
        // found templates
        if (templates != null && templates.length > 0) {
          _templates = templates;
        } else {
          callback(new Error("No templates found for domain"));
        }
      });
    },
    // select first template
    function(callback) {
      if (_templates != null) {
        
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
        if (attributes[key] != "") {
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
        console.log("An error occurred in saveAttributes for element " + element_id);
      } else {
        console.log("Added attributes for element " + element_id);
      }
      func_callback();
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
        console.log(err.message);
      } else {
        console.log("Added child elements of level " + level);
      }
      func_callback();
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
              console.log(err.message);
            } else {
              console.log("Completed iterate_parent");
              func_callback();
            }
          });
        });
      } else {
        console.log("failed to create child element");
        func_callback();
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
        console.log("failed to create child element");
        func_callback();
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
        console.log(err.message);
      } else {
        console.log("Added child elements of level " + level);
      }
      func_callback();
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
          console.log("failed at creating sibling text for text node");
          func_callback();
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
        console.log(err.message);
      } else {
        console.log("Completed iterate_siblings " + direction + " method for element node");
      }
      func_callback();
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