var cheerio = require("cheerio"),
CLASS_NAME = "TwoReceipt",
TEXT_ID = "-!|_|!-";

exports.createTemplate = function() {
	
};

function createDOM(html) {
	return cheerio.load(html);
}

// iterates through all children of parent_node and runs function child_calculation
function iterate_children(parent_node, child_calculation) {
	/*
	foreach parent_node.children
	{
		child_calculation();
	}
	*/
}

createRootElement() {
	var root = new Element(null, 1, tag_id, "root", level, html)
	iterate_children(root, createElement)
}

createElement() {
	var root = new Element(element_id, 1, tag_id, relation, level, html)
	iterate_children(root, createElement)
}
