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
	var url_id, template_id, newTemplate,	elementDom,	elementText,
	$, element_id, left_text_id, right_text_id, text,	parent_element_id;
	
	async.series([
		// create url
		function(callback) {
			var newUrl = new Url(null, domain, url);
			newUrl.save(function(newUrl_id) {
				if (newUrl_id != null) {
					url_id = newUrl_id;
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
					newTemplate = new Template(null, attribute_id, url_id, null, userID);
					newTemplate.save(function(newTemplate_id) {
						if (newTemplate_id != null) {
							template_id = newTemplate_id;
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
		// parse HTML & create root element
		function(callback) {
			$ = cheerio.load(html);
			console.log("Created DOM");
			
			// find defined element. if it doesn't exist, take the root (body)
			var tag;
			elementDom = $("." + CLASS_NAME);

			if (elementDom.length == 0) {
				elementDom = $.root();
				tag = "body";
			} else {
				tag = elementDom[0].name;
			}
			elementText = elementDom.text();
			
			// set text
			if (selection == "") {
				text = elementText;
			} else {
				text = selection;
			}
			
			// create root element
			var rootElement = new Element(null, null, template_id, tag, "root", 0, element, null);
			rootElement.save(function(rootElement_id) {
				if (rootElement_id != null) {
					element_id = rootElement_id;
					callback();
				} else {
					callback(new Error("failed to create root element"));
				}
			});
		},
		// save root element attributes & text
		function(callback) {
			// can run in parallel, no callback
			saveAttributes(element_id, elementDom[0].attribs);

			var rootText = new Text(null, template_id, element_id, null, "root", text);
			rootText.save(function(rootText_id) {
				if (rootText_id != null) {
					left_text_id = rootText_id;
					right_text_id = rootText_id;

					// update template text_id
					newTemplate.text_id = rootText_id;
					newTemplate.save(function() {
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
			var firstIndex = elementText.indexOf(TEXT_ID);
			var secondIndex = elementText.indexOf(TEXT_ID, firstIndex + 1);
			// leftText is in rootElement
			if (firstIndex != -1 && firstIndex != 0) {
				var left = elementText.substring(0, firstIndex);
				var leftTextNode = new Text(null, template_id, element_id, left_text_id, "left", left);
				leftTextNode.save(function (leftTextNode_id) {
					if (leftTextNode_id != null) {
						left_text_id = leftTextNode_id;
						callback();
					} else {
						callback(new Error("failed to create left text of element"));
					}
				});
			} else {
				callback();
			}
		},
		// check if right text node is within element text (if TEXT_ID exists)
		function(callback) {
			var firstIndex = elementText.indexOf(TEXT_ID);
			var secondIndex = elementText.indexOf(TEXT_ID, firstIndex + 1);
			// rightText is in rootElement
			if (firstIndex != -1 && secondIndex != elementText.length - TEXT_ID.length) {
				var right = elementText.substring(secondIndex + TEXT_ID.length);
				var rightTextNode = new Text(null, template_id, element_id, right_text_id, "right", right);
				rightTextNode.save(function (rightTextNode_id) {
					if (rightTextNode_id != null) {
						right_text_id = rightTextNode_id;
						callback();
					} else {
						callback(new Error("failed to create right text of element"));
					}
				});
			} else {
				callback();
			}
		},
		// create parent element, to use for finishing sibling element/text nodes
		function(callback) {
			// if element is not body (root), it will have a parent element
			if (elementDom[0].type !== "root") {
				var parentDom = elementDom.parent();
				var tag;
				if (parentDom[0].type === "root") {
					tag = "body";
				} else {
					tag = parentDom[0].name;
				}
				
				var parentElement = new Element(null, element_id, template_id, tag, "parent", -1, $.html(parentDom), null);
				parentElement.save(function(parentElement_id) {
					if (parentElement_id != null) {
						parent_element_id = parentElement_id;
						callback();
					} else {
						callback(new Error("failed to create parent element"));
					}
				});
			} else {
				callback();
			}
		},
		// calculate sibling elements & text
		function(callback) {
			iterate_siblings("left", elementDom[0], elementDom, template_id, left_text_id, null, parent_element_id, $, callback);
			iterate_siblings("right", elementDom[0], elementDom, template_id, right_text_id, null, parent_element_id, $, callback);
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
			if (err) {
				console.log("An error occurred in saveAttributes for element " + element_id);
			} else {
				console.log("Added attributes for element " + element_id);
			}
		});
	}
}

// iterates through all DOM children of parent_node and runs function child_calculation
/*function iterate_children(parent_node, child_calculation, func_callback) {
	
	//parent_node.
	
	foreach parent_node.children
	{
		child_calculation(parent_node.element_id);
	}
}*/

// iterate through previous sibling until there are no more previous siblings
function iterate_siblings(direction, element_node, elementDom, template_id, text_id, element_id, parent_element_id, $, func_callback) {
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
					iterate_siblings(direction, element_node, elementDom, template_id, newText_id, element_id, parent_element_id, $, func_callback);
					console.log("Completed iterate_siblings " + direction + " method for element node");
				} else {
					console.log("failed at creating sibling text for text node");
					func_callback();
				}
			});
		}
	}
	// element node
	else {
		var element_id;
		if (direction === "left") {
			elementDom = elementDom.prev();
		} else {
			elementDom = elementDom.next();
		}
		
		async.series([function(callback) {
			var newElement = new Element(null, parent_element_id, template_id, elementDom[0].name, "sibling", -2, $.html(elementDom), null);
			newElement.save(function(newElement_id) {
				if (newElement_id != null) {
					element_id = newElement_id;
					callback();
				} else {
					callback(new Error("failed at creating sibling element"));
				}
			});
		}, function(callback) {
			if (!isBlank(elementDom.text())) {
				var newText = new Text(null, template_id, element_id, text_id, direction, elementDom.text());
				newText.save(function(newText_id) {
					if (newText_id != null) {
						iterate_siblings(direction, element_node, elementDom, template_id, newText_id, element_id, parent_element_id, $, func_callback);
						callback();
					} else {
						callback(new Error("failed at creating sibling text for element node"));
					}
				});
			} else {
				iterate_siblings(direction, element_node, elementDom, template_id, text_id, element_id, parent_element_id, $, func_callback);
			}
		}], function(err, result) {
			if (err) {
				console.log(err.message);
				func_callback();
			} else {
				console.log("Completed iterate_siblings " + direction + " method for element node");
			}
		});
	}
}

function iterate_parents(root_node, root_element_id, template_id, parent_calculation, callback) {
	root_node = root_node.parent();
	// if child of immediate parent, relation = "sibling"
	//element_id, template_id, tag, relation, level, html, order
	// to get html (outerHTML), $.html(elementDom.children(0))
	// awareness, research, treatment
	// i wanted to create a more fun method to donate
}

function isBlank(text) {
	// remove whitespace (\n, \t, etc)
	if (text.trim() === "") {
		return true;
	} else {
		return false;
	}
}
// old generateTemplate
// create domain & url
	/*var newUrl = new Url(null, domain, url);
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
	}));*/