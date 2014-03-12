var cheerio = require("cheerio"),
CLASS_NAME = "TwoReceipt",
TEXT_ID = "-!|_|!-",
Element = require("./model/element"),
Template = require("./model/template"),
ElementAttribute = require("./model/element_attribute"),
ReceiptAttribute = require("./model/receipt_attribute"),
Text = require("./model/text"),
Url = require("./model/url"),
SimpleTable = require("./model/simple_table");

exports.generateTemplate = function(userID, attribute, selection, element, html, text, url, domain) {
	// create domain & url
	var newUrl = new Url(null, domain, url);
	setImmediate(newUrl.save(function(url_id) {
		// create template for receipt attribute
		if (url_id != null) {
			SimpleTable.getIdByValue("ser_receipt_attribute", "attribute_name", attribute, function(attribute_id) {
				// receipt attribute does not exist
				if (attribute_id != null) {
					var newTemplate = new Template(null, attribute_id, url_id, null, userID);
					setImmediate(newTemplate.save(function(template_id) {
						if (template_id != null) {
							// parse HTML
							console.log(html);
							var $ = cheerio.load(html);
							console.log("Created DOM");
							var elementDom = $(".TwoReceipt")[0];
							console.log(elementDom);
							debugger;
							// elementDom length 0... body/html not included?!
							
							// create root element
							//selection
							//var test7 = text;
							var rootElement = new Element(null, null, template_id, elementDom.name, "root", 0, element);
							rootElement.save(function(element_id) {
								console.log(element_id);
							});
						}
					}));
				} else {
					console.log("Attribute " + attribute + " does not exist");
				}
			});
		}
	}));
};

// iterates through all DOM children of parent_node and runs function child_calculation
/*function iterate_children(parent_node, child_calculation) {
	
	//parent_node.
	
	foreach parent_node.children
	{
		child_calculation(parent_node.element_id);
	}
	
}
// "-!|_|!-"

// find element with classname "TwoReceipt"
function createRootElement() {
	var root = new Element(null, null, 1, tag_id, "root", level, html)
	element.save();
}

function createElement(element_id) {
	var element = new Element(null, element_id, 1, tag_id, relation, level, html)
	element.save();
}*/