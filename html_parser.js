var cheerio = require("cheerio"),
async = require("async"),
CLASS_NAME = "TwoReceipt",
TEXT_ID = "-!|_|!-",
Element = require("./model/element"),
Template = require("./model/template"),
ElementAttribute = require("./model/element_attribute"),
ReceiptAttribute = require("./model/receipt_attribute"),
Text = require("./model/text"),
Url = require("./model/url"),
SimpleTable = require("./model/simple_table");

exports.generateTemplate = function(userID, attribute, selection, element, html, body_text, url, domain) {
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
							var $ = cheerio.load(html);
							console.log("Created DOM");
							// find defined element. if it doesn't exist, take the root (body)
							var text, tag;
							var elementDom = $("." + CLASS_NAME);

							if (elementDom.length == 0) {
								elementDom = $.root();
								tag = "body";
							} else {
								tag = elementDom[0].name;
							}
							var elementText = elementDom.text();
							
							// set text
							if (selection == "") {
								text = elementText;
							} else {
								text = selection;
							}
							
							// create root element
							var rootElement = new Element(null, null, template_id, tag, "root", 0, element, null);
							rootElement.save(function(element_id) {
								saveAttributes(element_id, elementDom[0].attribs);
								
								var rootText = new Text(null, template_id, element_id, null, "root", text);
								rootText.save(function(text_id) {
									// update template text_id
									newTemplate.text_id = text_id;
									newTemplate.save(function() {
										console.log("Added text_id to template");
									});
									
									var leftText = rootText;
									var rightText = rootText;
									
									// determine if TEXT_ID exists (possibility for left/right text nodes within element text
									var firstIndex = elementText.indexOf(TEXT_ID);
									var secondIndex = elementText.indexOf(TEXT_ID, firstIndex + 1);
									// leftText is in rootElement
									if (firstIndex != -1 && firstIndex != 0) {
										var left = elementText.substring(0, firstIndex);
										leftText = new Text(null, template_id, element_id, text_id, "left", left);
										leftText.save(function (left_text_id) {
											
										});
									}
									// rightText is in rootElement
									if (firstIndex != -1 && secondIndex != elementText.length - TEXT_ID.length) {
										var right = elementText.substring(secondIndex + TEXT_ID.length);
										rightText = new Text(null, template_id, element_id, text_id, "right", right);
										rightText.save(function (right_text_id) {
											
										});
									}
								});
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

// for each attribute, create ElementAttribute
function saveAttributes(element_id, attributes) {
	if (attributes != null) {
		async.each(Object.keys(attributes), function(key, callback) {
			if (attributes.hasOwnProperty(key)) {
				if (key == "class") {
					attributes[key] = attributes[key].replace(" " + CLASS_NAME, "");
				}
				if (attributes[key] != "") {
					var attr = new ElementAttribute(key, attributes[key], element_id);
					attr.save(callback);
				}
			} else {
				callback();
			}
		}, function(err) {
			console.log("Added attributes for element " + element_id);
		});
	}
}

// iterates through all DOM children of parent_node and runs function child_calculation
/*function iterate_children(parent_node, child_calculation) {
	
	//parent_node.
	
	foreach parent_node.children
	{
		child_calculation(parent_node.element_id);
	}
	
}
*/
/*function iterate_parents(root_node, ) {

}
*/
function iterate_parents(root_node, root_element_id, template_id, parent_calculation) {
	root_node = root_node.parent();
	// if child of immediate parent, relation = "sibling"
	//element_id, template_id, tag, relation, level, html, order
	// to get html (outerHTML), $.html(elementDom.children(0))
	// awareness, research, treatment
	// i wanted to create a more fun method to donate
}
/*
// find element with classname "TwoReceipt"
function createRootElement() {
	var root = new Element(null, null, 1, tag_id, "root", level, html)
	element.save();
}

function createElement(element_id) {
	var element = new Element(null, element_id, 1, tag_id, relation, level, html)
	element.save();
}
function createText() {

}

*/