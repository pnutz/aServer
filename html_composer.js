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
  var domain_id, attribute_id, _templates, $;
  
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
      // iterate through each receipt attribute - defaulted to date atm
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
          $ = cheerio.load("<body>" + html + "</body>");
          console.log("Created DOM");
          
          callback();
        } else {
          callback(new Error("No templates found for domain"));
        }
      });
    },
    // iterate through templates
    function(func_callback) {
      // assume only 1 template for now
      processTemplate(_templates[0], $, func_callback);
      // detectSeries returns the item 
      /*async.detectSeries(_templates, function(template, callback) {
        processTemplate(template, $, callback);
      }, function(result) {
        // result is template that returned true
        func_callback();
      });*/
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Completed generateTemplate method");
    }
  });
};

// compares template with $ html dom, returns true if matches
function processTemplate(template, $, callback) {
  constructElementPath(template, $, callback);
  // iterate elements and create path string of elements
  // 
  // need to set variable out of scope..
  //callback(true);
  //callback(false);
}

// constructs a selector string from the body to the 
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
          element.element = function(element_result) {
            element = element_result;
            
            element.tag = function(tag_result) {
              selector += ">" + tag_result;
              whilst_callback();
            };
          };
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
      debugger;
      possible_matches = $(selector);
    }
  ], function(err, result) {
    if (err) {
      func_callback();
    } else {
      func_callback();
    }
  });
}