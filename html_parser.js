var cheerio = require("cheerio"),
async = require("async"),
CHILDREN_LIMIT = 0,
Element = require("./model/element"),
Template = require("./model/template"),
TemplateDomain = require("./model/template_domain"),
TemplateGroup = require("./model/template_group"),
ElementAttribute = require("./model/element_attribute"),
ReceiptAttribute = require("./model/receipt_attribute"),
Text = require("./model/text"),
Url = require("./model/url"),
SimpleTable = require("./model/simple_table");

exports.generateTemplates = function(user_id, domain, url, html, attribute_data) {
  var new_url, individual_attributes, grouped_attributes, keys, grouped_keys;

  individual_attributes = attribute_data;
  if (attribute_data.items !== undefined) {
    grouped_attributes = attribute_data.items;
    delete individual_attributes.items;
  } else {
    grouped_attributes = {};
  }

  keys = Object.keys(individual_attributes);
  grouped_keys = Object.keys(grouped_attributes);

  // stop if no data was sent
  if (keys === null || keys.length === 0) {
    console.log("No attribute data sent");
    return;
  }

  async.series([
    // create url id
    function(callback) {
      console.log("----------------URL----------------------");
      new_url = new Url(null, domain, url);
      new_url.save(function(new_url_id) {
        if (new_url_id !== null) {
          callback();
        } else {
          callback(new Error("failed to create new url"));
        }
      });
    },
    // generate templates for each individual attribute
    function(callback) {
      if (keys !== null) {
        async.eachSeries(keys,
        function(key, each_callback) {
          generateTemplate(user_id, key, html,
                          new_url.id, new_url.domain_id, null, null, each_callback);
        },
        function(err) {
          if (err) {
            console.log(err.message);
          }
          console.log("Generated templates for individual attributes");
          callback();
        });
      } else {
        callback();
      }
    },
    // generate templates for each grouped attribute
    function(callback) {
      if (grouped_keys !== null) {
        async.eachSeries(grouped_keys,
        function(key, each_callback) {
          generateTemplateGroup(html, user_id, new_url.id, new_url.domain_id, grouped_attributes[key], key, each_callback);
        },
        function(err) {
          if (err) {
            console.log(err.message);
          } else {
            console.log("Generated templates for grouped attributes");
          }
          callback();
        });
      } else {
        callback();
      }
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Completed generateTemplates method");
    }
  });
};

function generateTemplateGroup(html, user_id, url_id, domain_id, attribute_group, index, template_callback) {
  var template_group_id, template_elements = [];

  async.series([
    // create template group
    function(callback) {
      SimpleTable.getIdByValue("ser_receipt_attribute_group", "group_name", "Receipt Items", function(group_id) {
        var template_group = new TemplateGroup(null, domain_id, group_id, 1, null, 1, 1);
        template_group.save(function(id) {
          template_group_id = id;
          callback();
        });
      });
    },
    // generate templates for each grouped attribute
    function(callback) {
      var attribute_keys = Object.keys(attribute_group);
      async.eachSeries(attribute_keys,
      function(attr, each_callback) {
        generateTemplate(user_id, attr, html, url_id,
                        domain_id, template_group_id, index, each_callback);
      }, function(err) {
        if (err) {
          console.log(err.message);
        } else {
          console.log("Ran generateTemplate for each grouped attribute.");
        }
        callback();
      });
    },
    // generate (optional) row template for template group
    function(callback) {
      generateRowTemplate(user_id, url_id, template_group_id, callback);
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Completed generateTemplateGroup method");
    }
    template_callback();
  });
}

function generateRowTemplate(user_id, url_id, template_group_id, template_callback) {
  var row_attribute_id, templates, template_elements = [], body_element, row_element, element_level, current_element_id, template_id;

  async.series([
    // get row attribute id
    function(callback) {
      SimpleTable.getIdByValue("ser_receipt_attribute", "attribute_name", "row", function(attribute_id) {
        // check if row attribute exists
        if (attribute_id !== null) {
          row_attribute_id = attribute_id;
          callback();
        } else {
          callback(new Error("Row attribute does not exist"));
        }
      });
    },
    // get grouped templates
    function(callback) {
      Template.getTemplatesByGroup(template_group_id, function(selected_templates) {
        if (selected_templates !== null && selected_templates.length > 0) {
          templates = selected_templates;
          callback();
        } else {
          callback(new Error("Grouped templates do not exist"));
        }
      });
    },
    // load template body elements into array
    function(callback) {
      async.each(templates, function(template, each_callback) {
        Element.getBodyElementByTemplate(template.id, function(err, element) {
          if (err === null) {
            if (body_element === null) {
              body_element = element;
            }
            template_elements.push(element);
            each_callback();
          } else {
            each_callback(err);
          }
        });
      }, function(err) {
        if (err) {
          callback(err);
        } else {
          callback();
        }
      });
    },
    // while templates match, keep iterating from body to root element
    function(callback) {
      var match = true, order, tag_id;
      async.whilst(
        // whilst loop condition - while tag_id & order match all templates and root element is not hit
        function() { return match; },
        // whilst loop function
        function(whilst_callback) {
          async.series([
            // set each template element to its child element
            function(series_callback) {
              var temp_elements = [];
              async.each(template_elements, function(template_element, each_callback) {
                template_element.element = function(element_result) {
                    temp_elements.push(element_result);
                    each_callback();
                  };
              }, function(err) {
                if (err) {
                  series_callback(err);
                } else {
                  template_elements = temp_elements;
                  series_callback();
                }
              });
            },
            // prepare variables for synchronous whilst test function
            function(series_callback) {
              match = true;
              order = null;
              tag_id = null;
              async.eachSeries(template_elements, function(template_element, each_callback) {
                if (template_element.relation === "root" || template_element.element_id === null) {
                  match = false;
                }

                if (tag_id === null) {
                  tag_id = template_element.tag_id;
                  order = template_element.order;
                } else if (template_element.tag_id != tag_id || template_element.order != order) {
                  match = false;
                }
                each_callback();
              }, function(err) {
                if (err) {
                  series_callback(err);
                } else {
                  template_elements[0].tag = function(tag_result) {
                    // elements matched and tag is a row, store as row_element
                    if (match === true && (tag_result === "tr" || tag_result === "li" || tag_result === "dl" || tag_result === "dd")) {
                      row_element = template_elements[0];
                    }
                    series_callback();
                  };
                }
              });
            }
          ], function(err) {
            if (err) {
              whilst_callback(err);
            } else {
              whilst_callback();
            }
          });
        },
        function(err) {
          if (err) {
            callback(err);
          } else {
            callback();
          }
        }
      );
    },
    // create template for row if row_element exists
    function(callback) {
      if (row_element !== null) {
        var new_template = new Template(null, row_attribute_id, template_group_id, url_id, user_id);
        new_template.save(function(new_template_id) {
          if (new_template_id !== null) {
            template_id = new_template_id;
            callback();
          } else {
            callback(new Error("failed to create new template"));
          }
        });
      } else {
        callback(new Error("Row element does not exist"));
      }
    },
    // create row element for row template
    function(callback) {
      element_level = 0;
      var new_element = new Element(null, null, template_id, row_element.tag_id, "root", element_level, row_element.html, row_element.order);
      new_element.save(function(element_id) {
        if (element_id !== null) {
          current_element_id = element_id;
          element_level--;

          ElementAttribute.getElementAttributesByElement(row_element.id, function(attributes) {
            if (attributes !== null) {
              // iterate through row_element attributes, adding it to new_element
              async.each(attributes, function(attribute, each_callback) {
                var element_attribute = new ElementAttribute(attribute.type_id, attribute.value_id, current_element_id);
                element_attribute.save(each_callback);
              }, function(err) {
                if (err) {
                  callback(err);
                } else {
                  callback();
                }
              });
            } else {
              callback();
            }
          });
        } else {
          callback(new Error("failed to create body element for row template"));
        }
      });
    },
    function(callback) {
      Element.getParentElementById(row_element.id, function(err, parent_element) {
        if (err === null) {
          row_element = parent_element;
          callback();
        } else {
          callback(new Error("Completed generateRowTemplate method"));
        }
      });
    },
    // create elements from body element to row element for row template
    function(callback) {
      var parent_exists = true;

      async.whilst(
        // whilst condition - parent element must exist
        function() { return parent_exists; },
        // whilst loop
        function(whilst_callback) {
          async.series([
            // create new element and element attributes for row template
            function(series_callback) {
              var new_element = new Element(null, current_element_id, template_id, row_element.tag_id, "parent", element_level, row_element.html, row_element.order);
              new_element.save(function(element_id) {
                if (element_id !== null) {
                  current_element_id = element_id;
                  element_level--;

                  ElementAttribute.getElementAttributesByElement(row_element.id, function(attributes) {
                    if (attributes !== null) {
                      // iterate through row_element attributes, adding it to new_element
                      async.each(attributes, function(attribute, each_callback) {
                        var element_attribute = new ElementAttribute(attribute.type_id, attribute.value_id, current_element_id);
                        element_attribute.save(each_callback);
                      }, function(err) {
                        if (err) {
                          series_callback(err);
                        } else {
                          series_callback();
                        }
                      });
                    } else {
                      series_callback();
                    }
                  });
                } else {
                  series_callback(new Error("failed to create element for row template"));
                }
              });
            },
            // set row element to its parent element
            function(series_callback) {
              Element.getParentElementById(row_element.id, function(err, parent_element) {
                if (err === null) {
                  row_element = parent_element;
                  parent_exists = true;
                } else {
                  parent_exists = false;
                }
                series_callback();
              });
            }
          ], function(err) {
            if (err) {
              whilst_callback(err);
            } else {
              whilst_callback();
            }
          });
        },
        function(err) {
          if (err) {
            callback(err);
          } else {
            console.log("Finished adding row elements for row template");
            callback();
          }
        }
      );
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Completed generateRowTemplate method");
    }
    template_callback();
  });
}

function generateTemplate(user_id, attribute, html, url_id, domain_id, group_id, group_index, template_callback) {
  var template_id, element_dom, $, element_id,
      left_text_id, right_text_id, parent_element_id, root_order,
      first_text_child, second_text_child, child_elements = {}, element_indices = {},
      text_selection, data_attr_selector, start_index, end_index;

  async.series([
    // create template for receipt attribute
    function(callback) {
      SimpleTable.getIdByValue("ser_receipt_attribute", "attribute_name", attribute, function(attribute_id) {
        // receipt attribute does not exist
        if (attribute_id !== null) {
          console.log("----------------TEMPLATE----------------------");
          var new_template = new Template(null, attribute_id, group_id, url_id, user_id);
          new_template.save(function(new_template_id) {
            if (new_template_id !== null) {
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
      var new_template_domain = new TemplateDomain(null, template_id, domain_id, 1, null, 1, 1);
      new_template_domain.save(callback);
    },
    // parse HTML & create root element
    function(callback) {
      $ = cheerio.load(html);
      console.log("Created DOM");

      if (group_id !== null) {
        data_attr_selector = "data-tworeceipt-" + attribute + group_index;
        element_dom = $("[" + data_attr_selector + "-start]");
      } else {
        data_attr_selector = "data-tworeceipt-" + attribute;
        element_dom = $("[" + data_attr_selector + "-start]");
      }

      // create root element
      console.log("----------------ROOT ELEMENT----------------------");
      var root_element = new Element(null, null, template_id, element_dom[0].name /* tag */,
                                    "root", 0, $.html(element_dom) /* element outerHTML */, null);
      root_element.save(function(root_element_id) {
        if (root_element_id !== null) {
          element_id = root_element_id;
          first_element_child = root_element_id;
          second_element_child = root_element_id;
          callback();
        } else {
          callback(new Error("failed to create root element"));
        }
      });
    },
    // calculate selected text
    function(callback) {
      getElementText($, element_dom, function(text) {
        // HARD-CODED &nbsp; REMOVAL (case: amazon.ca)
        text = text.replace(/&nbsp;/g, "");
        text_selection = text;
        start_index = element_dom.attr(data_attr_selector + "-start");
        end_index = element_dom.attr(data_attr_selector + "-end");
        text_selection = text_selection.substring(start_index, end_index);
        callback();
      });
    },
    // save root element attributes
    /*function(callback) {
      saveAttributes(element_id, element_dom[0].attribs, callback);
    },*/
    // save root text
    function(callback) {
      console.log("----------------ROOT TEXT----------------------");
      var root_text = new Text(null, template_id, element_id, null, "root", text_selection.trim().replace(/\n/g, ""));
      root_text.save(function(root_text_id) {
        if (root_text_id !== null) {
          left_text_id = root_text_id;
          right_text_id = root_text_id;
          callback();
        } else {
          callback(new Error("failed to create text"));
        }
      });
    },
    // find index of child nodes that contain start_index and end_index. add left/right text node for these nodes
    function(callback) {
          // tracks current child index
      var child_index = 0,
          // since space characters are added between text nodes, ensures first child (and blank children before first) does not append a space
          first_index = true,
          // tracks current element index
          element_index = 0,
          // tracks current character index to calculate if indices are included - each node's text length is added
          character_index = 0;
      async.eachSeries(element_dom[0].children, function(child, each_callback) {
        if (child.type === "text") {
          // only do text calculations if (first and) second text_child indices have not been found
          if (second_text_child === undefined) {
            var child_text = child.data.trim();
            child_text = child_text.replace(/&nbsp;/g, "");

            if (!isBlank(child_text)) {
              var contains_start, contains_end, local_start_index, local_end_index;
              // possible to contain start_index
              if (character_index < start_index) {
                contains_start = true;
                contains_end = true;
                local_start_index = start_index - character_index;
                local_end_index = end_index - character_index;
              }
              // possible to contain end_index
              else if (character_index < end_index) {
                contains_start = false;
                contains_end = true;
                local_end_index = end_index - character_index;
              }
              // cannot contain any index
              else {
                contains_start = false;
                contains_end = false;
              }

              // if first child, don't add space character to element text
              if (child_index !== 0 && !first_index) {
                child_text = " " + child_text;
              }
              if (first_index) {
                first_index = false;
              }
              character_index += child_text.length;

              // check if node contains end_index
              if (character_index < start_index) {
                contains_start = false;
                contains_end = false;
              }
              else if (character_index < end_index) {
                contains_end = false;
              }

              async.series([
                // calculate left_text
                function(series_callback) {
                  // node contains start_index
                  if (contains_start) {
                    first_text_child = child_index;
                    var left_text = child_text.substring(0, local_start_index);

                    if (!isBlank(left_text)) {
                      // if start_index is at end of text, first_text_child should increase so 2nd iteration looks at index for left_text
                      if (local_start_index === child_text.length) {
                        first_text_child++;
                      }

                      console.log("----------------LEFT NODE TEXT----------------------");
                      var left_text_node = new Text(null, template_id, element_id, left_text_id, "left", left_text.trim().replace(/\n/g, ""));
                      left_text_node.save(function (left_text_node_id) {
                        if (left_text_node_id !== null) {
                          left_text_id = left_text_node_id;
                          series_callback();
                        } else {
                          series_callback(new Error("failed to create left text of element"));
                        }
                      });
                    } else {
                      series_callback();
                    }
                  } else {
                    series_callback();
                  }
                },
                // calculate right_text
                function(series_callback) {
                  // node contains end_index
                  if (contains_end) {
                    second_text_child = child_index;
                    var right_text = child_text.substring(local_end_index);

                    if (!isBlank(right_text)) {
                      // if end_index is at beginning of text, second_text_child should decrease so 2nd iteration looks at index for right_text
                      if (local_end_index === 0) {
                        second_text_child--;
                      }

                      console.log("----------------RIGHT NODE TEXT----------------------");
                      var right_text_node = new Text(null, template_id, element_id, right_text_id, "right", right_text.trim().replace(/\n/g, ""));
                      right_text_node.save(function (right_text_node_id) {
                        if (right_text_node_id !== null) {
                          right_text_id = right_text_node_id;
                          series_callback();
                        } else {
                          series_callback(new Error("failed to create right text of element"));
                        }
                      });
                    } else {
                      series_callback();
                    }
                  } else {
                    series_callback();
                  }
                }
              ], function(err, result) {
                if (err) {
                  console.log(err.message);
                }
                child_index++;
                each_callback();
              });
            } else {
              child_index++;
              each_callback();
            }
          } else {
            child_index++;
            each_callback();
          }
        } else if (child.type === "tag") {
          var child_element = element_dom.children(element_index);
          var contains_start, contains_end, local_start_index, local_end_index, child_text;

          // create child element
          var new_element = new Element(null, element_id, template_id, child_element[0].name, "child", 1, $.html(child_element), element_index);
          new_element.save(function(child_element_id) {
            child_elements[child_index] = child_element_id;
            element_indices[child_index] = element_index;
            async.series([
              /*function(series_callback) {
                saveAttributes(child_element_id, child_element[0].attribs, series_callback);
              },*/
              // create children elements
              function(series_callback) {
                iterateChildren(CHILDREN_LIMIT, child_element, child_element_id, template_id, 1, $, series_callback);
              },
              // calculate left & right text
              function(series_callback) {
              // only do text calculations if (first and) second text_child indices have not been found
                if (second_text_child === undefined) {
                  getElementText($, child_element, function(text) {
                    text = text.replace(/&nbsp;/g, "");
                    if (!isBlank(text)) {
                      child_text = text;
                      series_callback();
                    } else {
                      series_callback(new Error("blank text"));
                    }
                  });
                } else {
                  series_callback();
                }
              },
              function(series_callback) {
                // only do text calculations if (first and) second text_child indices have not been found
                if (second_text_child === undefined) {
                  // possible to contain start_index
                  if (character_index < start_index) {
                    contains_start = true;
                    contains_end = true;
                    local_start_index = start_index - character_index;
                    local_end_index = end_index - character_index;
                  }
                  // possible to contain end_index
                  else if (character_index < end_index) {
                    contains_start = false;
                    contains_end = true;
                    local_end_index = end_index - character_index;
                  }
                  // cannot contain any index
                  else {
                    contains_start = false;
                    contains_end = false;
                  }

                  // if first child, don't add space character to element text
                  if (child_index !== 0 && !first_index) {
                    child_text = " " + child_text;
                  }
                  if (first_index) {
                    first_index = false;
                  }
                  character_index += child_text.length;

                  // check if node contains end_index
                  if (character_index < start_index) {
                    contains_start = false;
                    contains_end = false;
                  }
                  else if (character_index < end_index) {
                    contains_end = false;
                  }
                  series_callback();
                } else {
                  series_callback();
                }
              },
              // create text nodes if current node contains start index
              function(series_callback) {
                if (first_text_child === undefined && contains_start) {
                  first_text_child = child_index;
                  var left_text = child_text.substring(0, local_start_index);
                  if (!isBlank(left_text)) {
                    // if start_index is at end of text, first_text_child should increase so 2nd iteration looks at index for left_text
                    if (local_start_index === child_text.length) {
                      first_text_child++;
                    }

                    console.log("----------------LEFT NODE TEXT----------------------");
                    var left_text_node = new Text(null, template_id, child_elements[child_index], left_text_id, "left", left_text.trim().replace(/\n/g, ""));
                    left_text_node.save(function (left_text_node_id) {
                      if (left_text_node_id !== null) {
                        left_text_id = left_text_node_id;
                        series_callback();
                      } else {
                        series_callback(new Error("failed to create left text of element"));
                      }
                    });
                  } else {
                    series_callback();
                  }
                } else {
                  series_callback();
                }
              },
              // create text nodes if current node contains end index
              function(series_callback) {
                if (second_text_child === undefined && contains_end) {
                  second_text_child = child_index;
                  var right_text = child_text.substring(local_end_index);

                  if (!isBlank(right_text)) {
                    // if end_index is at beginning of text, second_text_child should decrease so 2nd iteration looks at index for right_text
                    if (local_end_index === 0) {
                      second_text_child--;
                    }

                    console.log("----------------RIGHT NODE TEXT----------------------");
                    var right_text_node = new Text(null, template_id, child_elements[child_index], right_text_id, "right", right_text.trim().replace(/\n/g, ""));
                    right_text_node.save(function (right_text_node_id) {
                      if (right_text_node_id !== null) {
                        right_text_id = right_text_node_id;
                        series_callback();
                      } else {
                        series_callback(new Error("failed to create right text of element"));
                      }
                    });
                  } else {
                    series_callback();
                  }
                } else {
                  series_callback();
                }
              }
            ], function(err, result) {
              if (err) {
                console.log(err.message);
              }
              element_index++;
              child_index++;
              each_callback();
            });
          });
        }
        // unknown node type
        else {
          child_index++;
          each_callback();
        }
      }, function(err) {
        if (err) {
          callback(err);
        } else {
          callback();
        }
      });
    },
    // iterate through left elements from first_text_child index
    function(callback) {
      if (first_text_child !== undefined) {
        var first_child = element_dom[0].children[first_text_child];
        async.whilst(function () { return first_child.prev !== null; },
        function (whilst_callback) {
          first_text_child--;
          first_child = first_child.prev;
          console.log("----------------CHILD LEFT TEXT----------------------");
          var left_text_node;
          if (first_child.type === "text" && !isBlank(first_child.data)) {
            left_text_node = new Text(null, template_id, element_id, left_text_id, "left", first_child.data.trim().replace(/\n/g, ""));
            left_text_node.save(function (left_text_node_id) {
              if (left_text_node_id !== null) {
                left_text_id = left_text_node_id;
                whilst_callback();
              } else {
                whilst_callback(new Error("failed to create left text of element"));
              }
            });
          } else if (first_child.type === "tag") {
            var child_element_id = child_elements[first_text_child];
            var child_element = element_dom.children(element_indices[first_text_child]);
            if (child_element !== null && !isBlank(child_element.text())) {
              left_text_node = new Text(null, template_id, child_element_id, left_text_id, "left", child_element.text().trim().replace(/\n/g, ""));
              left_text_node.save(function (left_text_node_id) {
                if (left_text_node_id !== null) {
                  left_text_id = left_text_node_id;
                  whilst_callback();
                } else {
                  whilst_callback(new Error("failed to create left text of element"));
                }
              });
            } else {
              whilst_callback();
            }
          } else {
            whilst_callback();
          }
        }, function (err) {
          if (err) {
            console.log(err.message);
          }
          callback();
        });
      } else {
        callback();
      }
    },
    // iterate through right elements from second_text_child index
    function(callback) {
      if (second_text_child !== undefined) {
        var second_child = element_dom[0].children[second_text_child];
        async.whilst(function () { return second_child.next !== null; },
        function (whilst_callback) {
          second_text_child++;
          second_child = second_child.next;
          console.log("----------------CHILD RIGHT TEXT----------------------");
          var right_text_node;
          if (second_child.type === "text" && !isBlank(second_child.data)) {
            right_text_node = new Text(null, template_id, element_id, right_text_id, "right", second_child.data.trim().replace(/\n/g, ""));
            right_text_node.save(function (right_text_node_id) {
              if (right_text_node_id !== null) {
                right_text_id = right_text_node_id;
                whilst_callback();
              } else {
                whilst_callback(new Error("failed to create left text of element"));
              }
            });
          } else if (second_child.type === "tag") {
            var child_element_id = child_elements[second_text_child];
            var child_element = element_dom.children(element_indices[second_text_child]);
            if (child_element !== null && !isBlank(child_element.text())) {
              right_text_node = new Text(null, template_id, child_element_id, right_text_id, "right", child_element.text().trim().replace(/\n/g, ""));
              right_text_node.save(function (right_text_node_id) {
                if (right_text_node_id !== null) {
                  right_text_id = right_text_node_id;
                  whilst_callback();
                } else {
                  whilst_callback(new Error("failed to create right text of element"));
                }
              });
            } else {
              whilst_callback();
            }
          } else {
            whilst_callback();
          }
        }, function (err) {
          if (err) {
            console.log(err.message);
          }
          callback();
        });
      } else {
        callback();
      }
    },
    // create parent element, to use for finishing sibling element/text nodes
    function(callback) {
      // if element is not body (root), it will have a parent element
      if (element_dom[0].type !== "root") {
        var parent_dom = element_dom.parent();
        // parent_dom is root
        if (parent_dom.length === 0) {
          parent_dom = $.root();
        }

        console.log("----------------PARENT ELEMENT----------------------");
        var parent_element = new Element(null, element_id, template_id, parent_dom[0].name /* tag */,
                                        "parent", -1, $.html(parent_dom) /* element outerHTML */, null);
        parent_element.save(function(new_parent_element_id) {
          if (new_parent_element_id !== null) {
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
    /*function(callback) {
      if (parent_element_id !== null) {
        if (element_dom.parent().length === 0) {
          saveAttributes(parent_element_id, $.root()[0].attribs, callback);
        } else {
          saveAttributes(parent_element_id, element_dom.parent()[0].attribs, callback);
        }
      } else {
        callback();
      }
    },*/
    // find order
    function(func_callback) {
      root_order = 0;
      if (parent_element_id !== null) {
        // root node
        var parent_dom = element_dom.parent();
        var root_node = parent_dom.prevObject[0];
        var count = 0;
        async.eachSeries(parent_dom.children(), function(child, callback) {
          var child_dom = parent_dom.children(count);
          // match to root node, update order
          if (child_dom[0] === root_node) {
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
            func_callback(err);
          } else {
            console.log("Found order of root node " + root_order);
          }
          func_callback();
        });
      }
    },
    // calculate left sibling elements & text
    function(callback) {
      if (parent_element_id !== null) {
        console.log("----------------LEFT SIBLINGS----------------------");
        iterateSiblings("left", root_order, element_dom[0], element_dom, template_id, left_text_id, null, parent_element_id, $, callback);
      } else {
        callback();
      }
    },
    // calculate right sibling elements & text
    function(callback) {
      if (parent_element_id !== null) {
        console.log("----------------RIGHT SIBLINGS----------------------");
        iterateSiblings("right", root_order, element_dom[0], element_dom, template_id, right_text_id, null, parent_element_id, $, callback);
      } else {
        callback();
      }
    },
    // calculate all parent elements
    function(callback) {
      if (parent_element_id !== null) {
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
    template_callback();
  });
}

// for each attribute, create ElementAttribute
function saveAttributes(element_id, attributes, func_callback) {
  if (attributes !== null) {
    async.eachSeries(Object.keys(attributes), function(key, callback) {
      if (attributes.hasOwnProperty(key)) {
        // ignore two-receipt data attributes
        if (key.indexOf("data-tworeceipt") === -1 && !isBlank(attributes[key])) {
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
  if (parent_dom.children().length !== 0 && level_limit !== 0) {
    var level = parent_level + 1;
    var count = 0;
    async.eachSeries(parent_dom.children(), function(child, callback) {
      var child_dom = parent_dom.children(count);
      var new_element = new Element(null, parent_element_id, template_id, child.name, "child", level, $.html(child), count);
      count++;
      new_element.save(function(element_id) {
        if (element_id !== null) {
          //saveAttributes(element_id, child.attribs, function() {
            iterateChildren(level_limit-1, child_dom, element_id, template_id, level, $, callback);
          //});
        } else {
          callback(new Error("failed to create child element"));
        }
      });
    }, function(err) {
      if (err) {
        func_callback(err);
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
  var new_element;
  level--;
  // not body element
  if (parent_dom.parent().length !== 0) {
    parent_dom = parent_dom.parent();
    var tag = parent_dom[0].name;

    new_element = new Element(null, element_id, template_id, tag, "parent", level, $.html(parent_dom), 0);
    new_element.save(function(parent_element_id) {
      if (parent_element_id !== null) {
        console.log("Added parent element of level " + level);
        //saveAttributes(parent_element_id, parent_dom[0].attribs, function() {
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
              func_callback(err);
            } else {
              console.log("Completed iterateParent");
              func_callback();
            }
          });
        //});
      } else {
        func_callback(new Error("failed to create child element"));
      }
    });
  } else {
    // body element
    var bodyDom = $.root();
    new_element = new Element(null, element_id, template_id, "body", "parent", level, "<body>" + $.html(bodyDom) + "</body>", null);
    new_element.save(function(parent_element_id) {
      if (parent_element_id !== null) {
        console.log("Added body element at level " + level);
        //saveAttributes(parent_element_id, bodyDom[0].attribs, function() {
          // iterate down to parent children
          iterateParentChildren(bodyDom, parent_element_id, parent_dom[0], element_id, template_id, level, $, function() {
            console.log("Completed iterateParent");
            func_callback();
          });
        //});
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
          if (element_id !== null) {
            //saveAttributes(element_id, child.attribs, function() {
              iterateChildren(CHILDREN_LIMIT, child_dom, element_id, template_id, level, $, callback);
            //});
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
        func_callback(err);
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
  if (direction === "left" && element_node.prev !== null) {
    element_node = element_node.prev;
  } else if (direction === "right" && element_node.next !== null) {
    element_node = element_node.next;
  } else {
    func_callback();
    return;
  }

  // text node
  if (element_node.type === "text") {
    // if text node is not blank, create text node for parent
    if (!isBlank(element_node.data)) {
      var new_text = new Text(null, template_id, parent_element_id, text_id, direction, element_node.data.trim().replace(/\n/g, ""));
      new_text.save(function(new_text_id) {
        if (new_text_id !== null) {
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
          if (new_element_id !== null) {
            element_id = new_element_id;
            iterateChildren(CHILDREN_LIMIT, element_dom, element_id, template_id, level, $, callback);
          } else {
            callback(new Error("failed at creating sibling element"));
          }
        });
      }, function(callback) {
        if (!isBlank(element_dom.text())) {
          var new_text = new Text(null, template_id, element_id, text_id, direction, element_dom.text().trim().replace(/\n/g, ""));
          new_text.save(function(new_text_id) {
            if (new_text_id !== null) {
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
        func_callback(err);
      } else {
        console.log("Completed iterateSiblings " + direction + " method for element node");
        func_callback();
      }
    });
  }
}

// retrieves the text contents of a dom element
function getElementText($, element, callback) {
  var params = { "text": "", "trim": true };

  // iterate through all children of body element
  if (element.length > 0) {
    var children = element[0].children;
    async.eachSeries(children, function(child, each_callback) {
      iterateText(child, addText, params, function(returned_params) {
        params = returned_params;
        each_callback();
      });
    }, function(err) {
      if (err) {
        console.log(err.message);
      }
      callback(params.text);
    });
  } else {
    console.log("element does not exist. no text retrieved");
    callback("");
  }
}

function iterateText(node, method, method_params, callback) {
  // run method for non-whitespace text nodes
  if (node.type === "text" && /\S/.test(node.data)) {
    method(node, method_params, function(returned_params) {
      callback(returned_params);
    });
  }
  // iterateText through children of non-style/script elements
  else if (node.type === "tag" && node.children && !/(style|script)/i.test(node.name)) {
    async.eachSeries(node.children, function(child, each_callback) {
      iterateText(child, method, method_params, function(returned_params) {
        method_params = returned_params;
        each_callback();
      });
    }, function(err) {
      if (err) {
        console.log(err.message);
      }
      callback(method_params);
    });
  } else {
    callback(method_params);
  }
}

function addText(node, params, callback) {
  var text = params.text;
  var trim = params.trim;
  if (trim) {
    if (text === "") {
      text = node.data.trim();
    } else {
      text += " " + node.data.trim();
    }
  } else {
    text += node.data;
  }
  callback({ "text": text, "trim": trim });
}

function isBlank(text) {
  // remove whitespace (\n, \t, etc)
  if (text.trim() === "") {
    return true;
  } else {
    return false;
  }
}
