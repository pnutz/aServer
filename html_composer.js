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

exports.readTemplate = function(userID, html, url, domain, json_callback) {
  var domain_id, attribute, attribute_id, _templates, $, json_message = "{", first_attr = 1;
  
  async.series([
    // load domain
    function(callback) {
      console.log("----------------LOAD DOMAIN----------------------");
      SimpleTable.getIdByValue("ser_domain", "domain_name", domain, function(select_domain_id) {
        // found domain
        if (select_domain_id != null) {
          domain_id = select_domain_id;
          $ = cheerio.load("<body>" + html + "</body>");
          console.log("Created DOM");
          callback();
        } else {
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
          
          if (first_attr == 1) {
            json_message += '"' + attribute + '": ';
            first_attr = 0;
          } else {
            json_message += ', "' + attribute + '": ';
          }
          
          // calculations for attribute
          async.series([
            // load all templates for attribute
            function(series_callback) {
              console.log("----------------LOAD TEMPLATES----------------------");
              TemplateDomain.getTemplatesByDomain(domain_id, attribute_id, function(templates) {
                // found templates
                if (templates != null && templates.length > 0) {
                  _templates = templates;
                } else {
                  _templates = null;
                  json_message += '""';
                }
                series_callback();
              });
            },
            // iterate through templates to find text
            function(series_callback) {
              if (_templates != null) {
                async.eachSeries(_templates, function(template, each_callback) {
                  console.log("----------------PROCESS TEMPLATE " + template.id + "----------------------");
                  processTemplate(template, $, function(template_result) {
                    if (template_result != null && template_result != "") {
                      // return found text to add to message
                      json_message += '"' + template_result + '"';
                      each_callback(new Error(true));
                    } else {
                      each_callback();
                    }
                  });
                }, function(err) {
                  if (err && err.message != "true") {
                    json_message += '""';
                    console.log(err.message);
                  } else if (!err) {
                    json_message += '""';
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
    }
    // add processing for grouped attributes
  ], function(err, result) {
    if (err) {
      console.log(err.message);
      json_callback(null);
    } else {
      json_message += "}";
      console.log("Completed readTemplate method");
      json_callback(json_message);
    }
  });
};

// compares template with $ html dom, returns value if matches, null if doesn't match
function processTemplate(template, $, callback) {
  constructElementPath(template.id, $, function(selection) {
    if (selection != null) {
      // calculate text off of selection
      console.log();
      console.log("----------------CALCULATE TEXT----------------------");
      findTextSelection(template.id, selection, function(result) {
        if (result != "") {
          callback(result);
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
function findTextSelection(template_id, selection, func_callback) {
  var text_node, element, left_text, right_text, element_text, text_result = selection.text().trim().replace(/\n/g, "");;

  async.series([
    // get root text node from template
    function(callback) {
      Text.getRootTextByTemplate(template_id, function(err, root_text) {
        if (err) {
          callback(new Error("root text not found"));
        } else {
          text_node = root_text;
          callback();
        }
      });
    },
    // get element from text_node
    function(callback) {
      if (text_node.element_id != null) {
        Element.getElementById(text_node.element_id, function(err, root_element) {
          if (err) {
            callback(new Error("root element not found"));
          } else {
            element = root_element;
            callback();
          }
        });
      } else {
        callback(new Error("text node does not have an element_id"));
      }
    },
    // get left text node if it exists and is under root element
    function(callback) {
      text_node.left = function(left_result) {
        if (left_result != null && left_result.element_id == text_node.element_id) {
          left_text = left_result;
        }
        callback();
      };
    },
    // get right text node if it exists and is under root element
    function(callback) {
      text_node.right = function(right_result) {
        if (right_result != null && right_result.element_id == text_node.element_id) {
          right_text = right_result;
        }
        callback();
      };    
    },
    // calculate left & right text
    function(callback) {
      if (left_text != null) {
        var left_index = text_result.indexOf(left_text.text);
        if (left_index != -1) {
          text_result = text_result.substring(left_index + left_text.text.length);
        } else {
          text_result = text_result.substring(left_text.text.length);
        }
      }
      if (right_text != null) {
        var right_index = text_result.indexOf(right_text.text);
        if (right_index != -1) {
          text_result = text_result.substring(0, right_index);
        } else {
          text_result = text_result.substring(0, text_result.length - right_text.text.length);
        }
      }
      text_result = text_result.trim();
      callback();
    }
  ], function(err, result) {
    if (err && err.message != "true") {
      console.log(err.message);
      func_callback(null);
    } else {
      func_callback(text_result);
    }
  });
}

// constructs a dom selection from the body to the root element and returns the root element (or null if it can't be found)
function constructElementPath(template_id, $, func_callback) {
  var element, selector, selection = $("body");
  
  async.series([
    // set element to template body_element
    function(callback) {
      Element.getBodyElementByTemplate(template_id, function(err, body_element) {
        if (err) {
          callback(new Error("body element not found"));
        } else {
          element = body_element;
          callback();
        }
      });
    },
    // construct selector path from body to root element
    function(callback) {
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
            // add tag to selector
            /*function(series2_callback) {
              element.tag = function(tag_result) {
                selector = tag_result;
                series2_callback();
              };
            },
            // add id if it exists to selector
            function(series2_callback) {
              ElementAttribute.getAttributeByElement("id", element.id, function(value) {
                if (value != null) {
                  selector += '[id="' + value + '"]';
                }
                series2_callback();
              });
            },
            // add name if it exists to selector
            function(series2_callback) {
              ElementAttribute.getAttributeByElement("name", element.id, function(value) {
                if (value != null) {
                  selector += '[name="' + value + '"]';
                }
                series2_callback();
              });
            }*//*,
            // add class if it exists to selector -- NEEDS FIXING
            function(series2_callback) {
              ElementAttribute.getAttributeByElement("class", element.id, function(value) {
                if (value != null) {
                  selector += '.' + value;
                }
                series2_callback();
              });
            }*/
            // select element
            function(series2_callback) {
              selection = selection.children(/*selector*/);
              if (selection.length == 0) {
                series2_callback(new Error("selection has no children"));
              } else {
                series2_callback();
              }
            },
            // select order (does not work with tag & attributes)
            function(series2_callback) {
              selection = selection.eq(element.order);
              if (selection.length == 0) {
                series2_callback(new Error("order selected does not exist"));
              } else {
                series2_callback();
              }
            },
            // compare with tag for additional accuracy
            function(series2_callback) {
              element.tag = function(tag_result) {
                if (selection[0].name != tag_result) {
                  // leave whilst loop
                  element.element_id = null;
                  selection = null;
                }
                series2_callback();
              };
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
      if (selection != null && selection.length != 0) {
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
      func_callback(result[result.length-1]);
    }
  });
}