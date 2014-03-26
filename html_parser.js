var cheerio = require("cheerio"),
async = require("async"),
CLASS_NAME = "TwoReceipt",
TEXT_ID = "-!|_|!-",
CHILDREN_LIMIT = 2,
Element = require("./model/element"),
Template = require("./model/template"),
template_domain = require("./model/template_domain"),
ElementAttribute = require("./model/element_attribute"),
ReceiptAttribute = require("./model/receipt_attribute"),
Text = require("./model/text"),
Url = require("./model/url"),
SimpleTable = require("./model/simple_table");

exports.generateTemplate = function(userID, attribute, selection, element, html, body_text, url, domain) {
  var url_id, new_url, template_id, new_template, element_dom, element_text,
  $, element_id, left_text_id, right_text_id, text, parent_element_id, root_order;
  
  async.series([
    // create url
    function(callback) {
      console.log("----------------URL----------------------");
      new_url = new Url(null, domain, url);
      new_url.save(function(new_url_id) {
        if (new_url_id != null) {
          url_id = new_url_id;
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
          new_template = new Template(null, attribute_id, url_id, null, userID);
          new_template.save(function(new_template_id) {
            if (new_template_id != null) {
              template_id = new_template_id;
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
      var new_template_domain = new template_domain(template_id, new_url.domain_id, null, null);
      new_template_domain.save(callback);
    },
    // parse HTML & create root element
    function(callback) {
      $ = cheerio.load(html);
      console.log("Created DOM");
      // find defined element. if it doesn't exist, take the root (body)
      var tag;
      element_dom = $("." + CLASS_NAME);

      if (element_dom.length == 0) {
        element_dom = $.root();
        tag = "body";
      } else {
        tag = element_dom[0].name;
      }
      element_text = element_dom.text();
      
      // set text
      if (selection == "") {
        text = element_text;
      } else {
        text = selection;
      }
      
      // create root element
      console.log("----------------ROOT ELEMENT----------------------");
      var root_element = new Element(null, null, template_id, tag, "root", 0, element, null);
      root_element.save(function(root_element_id) {
        if (root_element_id != null) {
          element_id = root_element_id;
          callback();
        } else {
          callback(new Error("failed to create root element"));
        }
      });
    },
    // save root element attributes
    function(callback) {
      saveAttributes(element_id, element_dom[0].attribs, callback);
    },
    // save root text
    function(callback) {
      console.log("----------------ROOT TEXT----------------------");
      var root_text = new Text(null, template_id, element_id, null, "root", text.trim());
      root_text.save(function(root_text_id) {
        if (root_text_id != null) {
          left_text_id = root_text_id;
          right_text_id = root_text_id;

          // update template text_id
          new_template.text_id = root_text_id;
          new_template.save(function() {
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
      var left_index = element_text.indexOf(TEXT_ID);
      var right_index = element_text.indexOf(TEXT_ID, left_index + 1);
      // leftText is in root_element
      if (left_index != -1 && left_index != 0) {
        var left = element_text.substring(0, left_index);
        if (!isBlank(left)) {
          console.log("----------------LEFT TEXT----------------------");
          var left_text_node = new Text(null, template_id, element_id, left_text_id, "left", left.trim());
          left_text_node.save(function (left_text_node_id) {
            if (left_text_node_id != null) {
              left_text_id = left_text_node_id;
              callback();
            } else {
              callback(new Error("failed to create left text of element"));
            }
          });
        } else {
          callback();
        }
      } else {
        callback();
      }
    },
    // check if right text node is within element text (if TEXT_ID exists)
    function(callback) {
      var left_index = element_text.indexOf(TEXT_ID);
      var right_index = element_text.indexOf(TEXT_ID, left_index + 1);
      // rightText is in root_element
      if (left_index != -1 && right_index != element_text.length - TEXT_ID.length) {
        var right = element_text.substring(right_index + TEXT_ID.length);
        if (!isBlank(right)) {
          console.log("----------------RIGHT TEXT----------------------");
          var right_text_node = new Text(null, template_id, element_id, right_text_id, "right", right.trim());
          right_text_node.save(function (right_text_node_id) {
            if (right_text_node_id != null) {
              right_text_id = right_text_node_id;
              callback();
            } else {
              callback(new Error("failed to create right text of element"));
            }
          });
        } else {
          callback();
        }
      } else {
        callback();
      }
    },
    // create parent element, to use for finishing sibling element/text nodes
    function(callback) {
      // if element is not body (root), it will have a parent element
      if (element_dom[0].type !== "root") {
        var parent_dom = element_dom.parent();
        var tag;
        // parent_dom is root
        if (parent_dom.length == 0) {
          parent_dom = $.root();
          tag = "body";
          html = "<body>" + $.html(parent_dom) + "</body>";
        } else {
          tag = parent_dom[0].name;
          html = $.html(parent_dom);
        }
        console.log("----------------PARENT ELEMENT----------------------");
        var parent_element = new Element(null, element_id, template_id, tag, "parent", -1, $.html(parent_dom), null);
        parent_element.save(function(new_parent_element_id) {
          if (new_parent_element_id != null) {
            parent_element_id = new_parent_element_id;
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
        if (element_dom.parent().length == 0) {
          saveAttributes(parent_element_id, $.root()[0].attribs, callback);
        } else {
          saveAttributes(parent_element_id, element_dom.parent()[0].attribs, callback);
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
        var parent_dom = element_dom.parent();
        var root_node = parent_dom.prevObject[0];
        var count = 0;
        async.eachSeries(parent_dom.children(), function(child, callback) {
          var child_dom = parent_dom.children(count);
          // match to root node, update order
          if (child_dom[0] == root_node) {
            root_order = count;
            count++;
            // update root element with order
            Element.getElementById(element_id, function(err, root_element) {
              if (err) {
                callback();
              } else {
                root_element.order = root_order;
                root_element.save(callback);
              }
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
        iterateSiblings("left", root_order, element_dom[0], element_dom, template_id, left_text_id, null, parent_element_id, $, callback);
      } else {
        callback();
      }
    },
    // calculate right sibling elements & text
    function(callback) {
      if (parent_element_id != null) {
        console.log("----------------RIGHT SIBLINGS----------------------");
        iterateSiblings("right", root_order, element_dom[0], element_dom, template_id, right_text_id, null, parent_element_id, $, callback);
      } else {
        callback();
      }
    },
    // calculate all children elements
    function(callback) {
      console.log("----------------CHILD ELEMENTS----------------------");
      iterateChildren(CHILDREN_LIMIT, element_dom, element_id, template_id, 0, $, callback);
    },
    // calculate all parent elements
    function(callback) {
      if (parent_element_id != null) {
        console.log("----------------PARENT ELEMENTS----------------------");
        iterateParent(element_dom.parent(), parent_element_id, template_id, -1, $, callback);
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
function iterateChildren(level_limit, parent_dom, parent_element_id, template_id, parent_level, $, func_callback) {
  if (parent_dom.children().length != 0 && level_limit != 0) {
    var level = parent_level + 1;
    var count = 0;
    async.eachSeries(parent_dom.children(), function(child, callback) {
      var child_dom = parent_dom.children(count);
      var new_element = new Element(null, parent_element_id, template_id, child.name, "child", level, $.html(child), count);
      count++;
      new_element.save(function(element_id) {
        if (element_id != null) {
          saveAttributes(element_id, child.attribs, function() {
            iterateChildren(level_limit-1, child_dom, element_id, template_id, level, $, callback);
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
function iterateParent(parent_dom, element_id, template_id, level, $, func_callback) {
  level--;
  // not body element
  if (parent_dom.parent().length != 0) {
    parent_dom = parent_dom.parent();
    var tag = parent_dom[0].name;
    
    var new_element = new Element(null, element_id, template_id, tag, "parent", level, $.html(parent_dom), 0);
    new_element.save(function(parent_element_id) {
      if (parent_element_id != null) {
        console.log("Added parent element of level " + level);
        saveAttributes(parent_element_id, parent_dom[0].attribs, function() {
          async.series([
            // iterate down to parent children
            function(callback) {
              iterateParentChildren(parent_dom, parent_element_id, parent_dom.prevObject[0], element_id, template_id, level, $, callback);
            },
            // iterate up to next parent node
            function(callback) {
              iterateParent(parent_dom, parent_element_id, template_id, level, $, callback);
            }
          ], function(err, result) {
            if (err) {
              func_callback(new Error(err.message));
            } else {
              console.log("Completed iterateParent");
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
    var bodyDom = $.root();
    var new_element = new Element(null, element_id, template_id, "body", "parent", level, "<body>" + $.html(bodyDom) + "</body>", null);
    new_element.save(function(parent_element_id) {
      if (parent_element_id != null) {
        console.log("Added body element at level " + level);
        saveAttributes(parent_element_id, bodyDom[0].attribs, function() {
          // iterate down to parent children
          iterateParentChildren(bodyDom, parent_element_id, parent_dom[0], element_id, template_id, level, $, function() {
            console.log("Completed iterateParent");
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
function iterateParentChildren(parent_dom, parent_element_id, child_node, child_element_id, template_id, parent_level, $, func_callback) {
  if (parent_dom.children().length > 1) {
    var level = parent_level + 1;
    var count = 0;
    async.eachSeries(parent_dom.children(), function(child, callback) {
      // ignore child node
      if (child != child_node) {
        var child_dom = parent_dom.children(count);
        var new_element = new Element(null, parent_element_id, template_id, child.name, "child", level, $.html(child), count);
        count++;
        new_element.save(function(element_id) {
          if (element_id != null) {
            saveAttributes(element_id, child.attribs, function() {
              iterateChildren(CHILDREN_LIMIT, child_dom, element_id, template_id, level, $, callback);
            });
          } else {
            callback(new Error("failed to create child element"));
          }
        });
      } else {
        // update child_node order
        var root_order = count;
        count++;
        Element.getElementById(child_element_id, function(err, child_element) {
          if (err) {
            callback();
          } else {
            child_element.order = root_order;
            child_element.save(callback);
          }
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
    Element.getElementById(child_element_id, function(err, child_element) {
      if (err) {
        func_callback();
      } else {
        child_element.order = 0;
        child_element.save(func_callback);
      }
    });
  }
}

// iterate through siblings in one direction until there are no more siblings
function iterateSiblings(direction, order, element_node, element_dom, template_id, text_id, element_id, parent_element_id, $, func_callback) {
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
      var new_text = new Text(null, template_id, parent_element_id, text_id, direction, element_node.data.trim());
      new_text.save(function(new_text_id) {
        if (new_text_id != null) {
          iterateSiblings(direction, order, element_node, element_dom, template_id, new_text_id, element_id, parent_element_id, $, func_callback);
          console.log("Completed iterateSiblings " + direction + " method for element node");
        } else {
          func_callback("failed at creating sibling text for text node");
        }
      });
    } else {
      iterateSiblings(direction, order, element_node, element_dom, template_id, text_id, element_id, parent_element_id, $, func_callback);
    }
  }
  // element node
  else {
    var element_id;
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
        var new_element = new Element(null, parent_element_id, template_id, element_dom[0].name, "sibling", level, $.html(element_dom), order);
        new_element.save(function(new_element_id) {
          if (new_element_id != null) {
            element_id = new_element_id;
            iterateChildren(CHILDREN_LIMIT, element_dom, element_id, template_id, level, $, callback)
          } else {
            callback(new Error("failed at creating sibling element"));
          }
        });
      }, function(callback) {
        if (!isBlank(element_dom.text())) {
          var new_text = new Text(null, template_id, element_id, text_id, direction, element_dom.text().trim());
          new_text.save(function(new_text_id) {
            if (new_text_id != null) {
              iterateSiblings(direction, order, element_node, element_dom, template_id, new_text_id, element_id, parent_element_id, $, callback);
            } else {
              callback(new Error("failed at creating sibling text for element node"));
            }
          });
        } else {
          iterateSiblings(direction, order, element_node, element_dom, template_id, text_id, element_id, parent_element_id, $, callback);
        }
      }
    ], function(err, result) {
      if (err) {
        func_callback(err.message);
      } else {
        console.log("Completed iterateSiblings " + direction + " method for element node");
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