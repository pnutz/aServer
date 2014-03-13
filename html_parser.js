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
							var $ = cheerio.load(html);
							console.log("Created DOM");
							// find defined element. if it doesn't exist, take the root (body)
							var tag;
							var elementDom = $("." + CLASS_NAME)[0];
							if (elementDom == null) {
								elementDom = $.root()[0];
								if (elementDom.type == "root") {
									tag = "body";
								} else {
									tag = elementDom.name;
								}
							} else {
								tag = elementDom.name;
							}
							
							// create root element
							var rootElement = new Element(null, null, template_id, tag, "root", 0, element);
							rootElement.save(function(element_id) {
								saveAttributes(element_id, elementDom.attribs);
								
								// create root text
								var text = $("." + CLASS_NAME).text();
								if (text === "") {
									text = $.root().text();
								}
								var firstIndex = text.indexOf(TEXT_ID);
								// selected text
								if (firstIndex != -1) {
									var secondIndex = text.indexOf(TEXT_ID, firstIndex);
									
									// no left text node
									if (firstIndex == 0) {
										
									}
									// no right text node
									if (secondIndex == text.length - TEXT_ID.length) {
										
									}
								}
								// clicked element
								else {
									var text = new Text(null, template_id, element_id, null, "root", text);
									text.save(function(text_id) {
										
									});
								}
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