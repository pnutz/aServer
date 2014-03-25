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
      // "'TRUE'" = "TRUE" to select all rows of ser_receipt_attribute
      SimpleTable.selectByColumn("ser_receipt_attribute", "'TRUE'", "TRUE", "", function(attributes) {
        async.eachSeries(attributes, function(attr, each_callback) {
          attribute = attr.attribute_name;
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
                }
                series_callback();
              });
            },
            // find text from template (add iteration through templates)
            function(series_callback) {
              // assume only 1 template for now
              if (_templates != null) {
                processTemplate(_templates[0], $, function(template_result) {
                  if (template_result != null) {
                    // return found text to add to message
                    json_message += '"' + template_result + '"';
                  } else {
                    // nothing found
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
  constructElementPath(template, $, function(result) {
    if (result != null) {
      callback(result);
    } else {
      callback(null);
    }
  });
}

// constructs a selector string from the body to the root element
function constructElementPath(template, $, func_callback) {
  var element, selector = "body", possible_matches;
  
  async.series([
    // set element to template body_element
    function(callback) {
      Element.getBodyElementByTemplate(template.id, function(body_element) {
        element = body_element;
        callback();
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
            function(series2_callback) {
              element.tag = function(tag_result) {
                selector += ">" + tag_result;
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
            }/*,
            // add class if it exists to selector -- NEEDS FIXING
            function(series2_callback) {
              ElementAttribute.getAttributeByElement("class", element.id, function(value) {
                if (value != null) {
                  selector += '.' + value;
                }
                series2_callback();
              });
            }*/
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
    // use selector on dom to get matches
    function(callback) {
      possible_matches = $(selector);
      // check if there is a match
      if (possible_matches.length > 0) {
        callback(null, possible_matches.text());
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