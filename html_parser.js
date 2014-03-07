var cheerio = require("cheerio"),
CLASS_NAME = "TwoReceipt",
TEXT_ID = "-!|_|!-",
Element = require("./model/element"),
Template = require("./model/template"),
ElementAttribute = require("./model/element_attribute"),
ReceiptAttribute = require("./model/receipt_attribute"),
Text = require("./model/text"),
Url = require("./model/url");

exports.createTemplate = function(userID, selection, element, html, text, url, domain) {
	var url = new Url(domain, url, html, text);
};

function createDOM(html) {
	return cheerio.load(html);
}

// iterates through all children of parent_node and runs function child_calculation
function iterate_children(parent_node, child_calculation) {
	
	//parent_node.
	/*
	foreach parent_node.children
	{
		child_calculation(parent_node.element_id);
	}
	*/
}

createRootElement() {
	var root = new Element(null, 1, tag_id, "root", level, html)
	iterate_children(root, createElement)
}

createElement(element_id) {
	var root = new Element(element_id, 1, tag_id, relation, level, html)
	iterate_children(root, createElement)
}
