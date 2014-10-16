var cheerio = require("cheerio");
var async = require("async");
var ccTLD = require("./cctld");
var countries = require("iso-countries");

exports.applyCalculations = function(jsonMessage, html, domain, callback) {
  console.log("----------------CALCULATION LAYER----------------------");
  var $ = cheerio.load(html);

  // force calculation for currency
  jsonMessage.currency = "";

  // hard copy jsonMessage
  var individualAttributes = JSON.parse(JSON.stringify(jsonMessage));
  delete individualAttributes["templates"];
  delete individualAttributes["elementPaths"];

  var documentText = "";
  var textNodes = [];

  var groupedKeys = [];
  // remove grouped attr from individualAttributes and add them to groupedKeys
  var attrGroups = Object.keys(global.attributes.groupedAttributes);
  for (var i = 0; i < attrGroups.length; i++) {
    groupedKeys.push(attrGroups[i]);
    delete individualAttributes[attrGroups[i]];
  }
  var keys = Object.keys(individualAttributes);

  async.series([
    // initialize text nodes and documentText
    function(seriesCallback) {
      initializeContentSearch($, function(results) {
        if (results != null) {
          documentText = results.text;
          textNodes = results.textNodes;
        }
        return seriesCallback();
      });
    },
    // find default value for all independent receipt attributes
    function(seriesCallback) {
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        // find default value if no result was found
        if (jsonMessage[key] === "") {
          var result = findDefaultValue($, key, documentText, domain, textNodes);
          if (result != null && result.value !== "") {
            jsonMessage[key] = result.value;

            if (result.elementPath != null) {
              jsonMessage.elementPaths[key] = result.elementPath;
            }
          }

          // convert values to correct datatype
          result = convertAttributeDataType(jsonMessage[key], global.attributes.individualAttributes[key].datatype);
          jsonMessage[key] = result;
          if (result === "") {
            delete jsonMessage.elementPaths[key];
          }
        }
      }
      return seriesCallback();
    },
    // find default value for all grouped receipt attributes
    function(seriesCallback) {
      // loop through each receipt attribute group
      async.eachSeries(groupedKeys, function(group, eachCallback) {
        var groupAttributes = [];
        var groupedAttrs = Object.keys(global.attributes.groupedAttributes[group]);

        for (var i = 0; i < groupedAttrs.length; i++) {
          if (groupedAttrs[i] !== "id" && groupedAttrs[i] !== "row") {
            groupAttributes.push(groupedAttrs[i]);
          }
        }
        var itemsToDelete = [];

        // loop through receipt items for group in jsonMessage
        var itemKeys = Object.keys(jsonMessage[group]);
        if (itemKeys.length > 0) {
          for (var i = 0; i < itemKeys.length; i++) {
            var itemKey = itemKeys[i];

            // loop through each attribute in group for item
            for (var j = 0; j < groupAttributes.length; j++) {
              var attr = groupAttributes[j];

              // if item contains attribute and it is a real value, check validity
              if (jsonMessage[group][itemKey].hasOwnProperty(attr) && jsonMessage[group][itemKey] !== "") {
                if (attr.datatype === "string") {
                  var isValid = checkInvalidItem(jsonMessage[group][itemKey][attr]);
                  // if item is invalid, store key and itemKey for deleting
                  console.log("valid?: " + jsonMessage[group][itemKey][attr] + " " + isValid);
                  if (!isValid) {
                    itemsToDelete.push(itemKey);
                  }
                }
              }
              // if item needs attribute
              else {
                var result = findDefaultValue($, attr, documentText, domain, textNodes);
                if (result != null && result.value !== "") {
                  jsonMessage[group][itemKey][attr] = result.value;
                }
              }

              // convert values to correct datatype
              jsonMessage[group][itemKey][attr] = convertAttributeDataType(jsonMessage[group][itemKey][attr], attr.datatype);
            }
          }
        }
        // actually look for default values for taxes
        else if (group === "taxes") {
          var result = findDefaultValue($, group, documentText, domain, textNodes);
          if (result != null && result.value !== "") {
            jsonMessage[group] = result.value;

            itemKeys = Object.keys(jsonMessage[group]);
            var itemKey = itemKeys[i];

            // loop through each attribute in group for item
            for (var j = 0; j < groupAttributes.length; j++) {
              var attr = groupAttributes[j];

              // convert values to correct datatype
              jsonMessage[group][itemKey][attr] = convertAttributeDataType(jsonMessage[group][itemKey][attr], attr.datatype);
            }
          }
        }

        // remove receipt items that are invalid
        for (var i = 0; i < itemsToDelete.length; i++) {
          var deleteKey = itemsToDelete[i];
          if (jsonMessage[group][deleteKey] !== null) {
            delete jsonMessage[group][deleteKey];
            delete jsonMessage.templates[group][deleteKey];
            delete jsonMessage.elementPaths[group][deleteKey];
          }
        }
        return eachCallback();
      },
      function(err) {
        if (err) {
          console.log(err.message);
        }
        return seriesCallback();
      });
    }
  ], function(err, result) {
    if (err) {
      console.log(err.message);
    }
    return callback(jsonMessage);
  });
};

// return true if item is valid, false if invalid
function checkInvalidItem(item) {
  var valid = true;
  // item is a string
  if (isNaN(parseInt(item)) && typeof(item) === "string") {
    item = item.toLowerCase();
    if (item.indexOf("total") !== -1 || item.indexOf("paid") !== -1 || item.indexOf("pay") !== -1 || item.indexOf("gift certificate") !== -1) {
      valid = false;
    }
  }
  // item is a number
  else {
    // possibly remove 0.00 values?
  }
  return valid;
}

// convert data to valid datatype
function convertAttributeDataType(result, datatype) {
  switch(datatype)
  {
    case "datetime":
      result = convertDateTime(result);
      break;
    case "string":
      result = convertString(result);
      break;
    case "integer":
      result = convertInteger(result);
      break;
    case "decimal":
      result = convertDecimal(result);
      break;
    default:
      break;
  }
  return result;
}

function convertDateTime(result) {
  if (result !== "") {
    var date = new Date(result);
    // date is not valid
    if (!isNaN(date.getTime())) {
      // year parsing
      var year = "" + date.getFullYear();

      // month parsing
      var month = "" + (date.getMonth() + 1);
      if (month.length < 2) {
        month = "0" + month;
      }

      // day parsing
      var day = "" + date.getDate();
      if (day.length < 2) {
        day = "0" + day;
      }

      // resulting format - mm/dd/yyyy
      return [month, day, year].join("/");
    }
  }
  return "";
}

function convertString(result) {
  return result;
}

// default quantity is 1
function convertInteger(result) {
  result = result.replace("[^\\d.-]", "").trim();
  var intResult = parseInt(result);
  if (result !== "" && !isNaN(intResult)) {
    return intResult;
  }
  return "1";
}

// default price is 0
function convertDecimal(result) {
  result = result.replace("[^\\d.-]", "").trim();
  var floatResult = parseFloat(result).toFixed(2);
  if (result !== "" && !isNaN(floatResult)) {
    return floatResult;
  }
  return "0.00";
}

function findDefaultValue($, attribute, text, domain, textNodes) {
  var result = null;

  switch(attribute) {
  case "date":
    result = findDefaultDate($, text, textNodes);
    break;
  case "vendor":
    result = findDefaultVendor($, text, domain, textNodes);
    break;
  case "transaction":
    result = findDefaultTransaction($, text, textNodes);
    break;
  case "itemtype":
    result = findDefaultItemName($, text, textNodes);
    break;
  case "cost":
    result = findDefaultItemCost($, text, textNodes);
    break;
  case "quantity":
    result = findDefaultItemQuantity($, text, textNodes);
    break;
  case "total":
    result = findDefaultTotal($, text, textNodes);
    break;
  case "shipping":
    result = findDefaultShipping($, text, textNodes);
    break;
  case "currency":
    result = findDefaultCurrency($, text, domain, textNodes);
    break;
  // grouped attribute, search for all attributes
  case "taxes":
    result = findDefaultTaxes($, text, textNodes);
    break;
  default:
    break;
  }
  return result;
}

// to avoid shipping date, take earliest found date
function findDefaultDate($, text, textNodes) {
  var date = new Date(),
      yearIndices = [],
      dateString = "",
      elementPath = [],
      dateValues = [],
      monthStrings = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  // what if years are 2 digit? (13, 14)
  // find all years in text
  var targetYear = date.getFullYear() - 2;
  // iterate through each year
  while (targetYear !== date.getFullYear() + 1) {
    var result = searchText(targetYear, $, text, textNodes);
    if (result != null) {
      yearIndices = yearIndices.concat(result);
    }
    targetYear++;
  }

  // process text by year to try and find date
  for (var i = 0; i < yearIndices.length; i++) {
    var yearIndex = yearIndices[i];

    var prevText, nextText;
    var year = text.substring(yearIndex.index, yearIndex.index + 4);
    var month, day;
    // split by newline
    if (yearIndex.index - 14 > 0 && yearIndex.index + 18 < text.length) {
      prevText = text.substring(yearIndex.index - 14, yearIndex.index).toLowerCase();
      nextText = text.substring(yearIndex.index + 4, yearIndex.index + 18).toLowerCase();
    } else if (yearIndex.index - 14 > 0) {
      prevText = text.substring(yearIndex.index - 14, yearIndex.index).toLowerCase();
    } else if (yearIndex.index + 18 < text.length) {
      nextText = text.substring(yearIndex.index + 4, yearIndex.index + 18).toLowerCase()
    } else {
      continue;
    }

    // date won't be split up by newlines
    if (prevText != null && prevText.indexOf("\n") !== -1) {
      prevText = prevText.substring(prevText.indexOf("\n"));
    }
    if (nextText != null && nextText.indexOf("\n") !== -1) {
      nextText = nextText.substring(0, nextText.indexOf("\n"));
    }

    // find matching month, then calculate for date
    var monthIndex = 0;

    for (var j = 0; j < monthStrings.length; j++) {
      var monthString = monthStrings[j];

      var prevIndex = prevText.indexOf(monthString);
      var nextIndex = nextText.indexOf(monthString);

      if (prevText != null && prevIndex !== -1) {
        month = monthIndex;
        var subPrevText = prevText.substring(0, prevIndex).replace(/[^0-9]/g, "");
        var subNextText = prevText.substring(prevIndex).replace(/[^0-9]/g, "");
        if (parseInt(subNextText) > 0 && parseInt(subNextText) < 32) {
          day = subNextText;
          var startChange = prevText.length - prevIndex;
          yearIndex = alterSearchData("start", startChange, yearIndex, textNodes);
        } else if (parseInt(subPrevText) > 0 && parseInt(subPrevText) < 32) {
          day = subPrevText;
          // find index of subPrevText in prevText
          var dayIndex = prevText.indexOf(subPrevText);
          var endChange = prevText.length - dayIndex;
          yearIndex = alterSearchData("end", endChange, yearIndex, textNodes);
        }
      } else if (nextText != null && nextIndex !== -1) {
        month = monthIndex;
        var subPrevText = nextText.substring(0, nextIndex).replace(/[^0-9]/g, "");
        var subNextText = nextText.substring(nextIndex + monthString.length).replace(/[^0-9]/g, "");
        if (parseInt(subNextText) > 0 && parseInt(subNextText) < 32) {
          day = parseInt(subNextText);
          var dayIndex = nextText.substring(nextIndex + monthString.length).indexOf(subNextText);
          var endChange = nextIndex + dayIndex + subNextText.length;
          yearIndex = alterSearchData("end", endChange, yearIndex, textNodes);
        } else if (parseInt(subPrevText) > 0 && parseInt(subPrevText) < 32) {
          day = parseInt(subPrevText);
          var startChange = nextIndex;
          yearIndex = alterSearchData("start", startChange, yearIndex, textNodes);
        }
      } else {
        monthIndex++;
      }
    }

    // month string was not found, try numeric calculation
    // possible for numeric calculation to get wrong data if it passes month & date validity
    if (month == null) {
      prevText = prevText.replace(/[^0-9]/g, " ").replace(/\s+/g, " ").trim();
      var prevNums = prevText.split(" ");
      if (prevNums.length > 1) {
        var originalMonth = parseInt(prevNums[prevNums.length - 2]);
        month = originalMonth - 1;
        day = parseInt(prevNums[prevNums.length - 1]);

        var dayIndex = prevText.lastIndexOf(prevNums[prevNums.length - 1]) - 1;
        var monthIndex = prevText.lastIndexOf(prevNums[prevNums.length - 2], dayIndex);
        var startChange = prevText.length - monthIndex;
        yearIndex = alterSearchData("start", startChange, yearIndex, textNodes);
      } else {
        nextText = nextText.replace(/[^0-9]/g, " ").replace(/\s+/g, " ").trim();
        var nextNums = nextText.split(" ");
        if (nextNums.length > 1) {
          var originalMonth = parseInt(nextNums[0]);
          month = originalMonth - 1;
          day = parseInt(nextNums[1]);

          var monthIndex = nextText.indexOf(nextNums[0]) + nextNums[0].length;
          var dayIndex = nextText.indexOf(nextNums[1], monthIndex);
          var endChange = monthIndex + dayIndex + nextNums[1].length;
          yearIndex = alterSearchData("end", endChange, yearIndex, textNodes);
        }
      }
    }

    // add date to dateValues if all values are valid
    if (month != null && month < 12 && day !== null && day > 0 && day < 32) {
      var elePath;
      // find element to add to dateValues based on text nodes
      if (yearIndex.startNodeIndex === yearIndex.endNodeIndex) {
        elePath = findElementPath($, textNodes[yearIndex.startNodeIndex]);
        dateValues.push({ date: new Date(year, month, day), elementPath: elePath });
      }
      // text nodes are not the same, find parent element
      else {
        var nodeParent = textNodes[yearIndex.startNodeIndex].parent;
        var secondParent = textNodes[yearIndex.endNodeIndex].parent;
        while (!$.contains(nodeParent, secondParent) && nodeParent !== secondParent && nodeParent.name !== "body") {
          nodeParent = nodeParent.parent;
        }

        elePath = findElementPath($, nodeParent);
        dateValues.push({ date: new Date(year, month, day), elementPath: elePath });
      }
    }
  }

  var currentDate;
  for (var i = 0; i < dateValues.length; i++) {
    var value = dateValues[i];
    if (currentDate == null) {
      currentDate = value.date;
      elementPath = value.elementPath;
    } else if (value.date.getTime() - currentDate.getTime() < 0) {
      currentDate = value.date;
      elementPath = value.elementPath;
    }
  }

  if (currentDate != null) {
    var month = currentDate.getMonth() + 1;
    if (month < 10) {
      dateString = "0" + month;
    } else {
      dateString = "" + month;
    }

    var day = currentDate.getDate();
    if (day < 10) {
      dateString += "/0" + day + "/" + currentDate.getFullYear();
    } else {
      dateString += "/" + day + "/" + currentDate.getFullYear();
    }
  }

  if (dateString.length >= 10) {
    return { value: dateString, elementPath: elementPath }
  } else {
    return null;
  }
}

// domain name text? not always
function findDefaultVendor($, text, domain, textNodes) {
  if (domain.indexOf("www.") === 0) {
    domain = domain.substring(4);
  }
  domain = domain.charAt(0).toUpperCase() + domain.slice(1);
  return { value: domain, elementPath: null };
}

function findDefaultTransaction($, text, textNodes) {
  return { value: "", elementPath: null };
}

function findDefaultItemName($, text, textNodes) {
  return { value: "", elementPath: null };
}

function findDefaultItemCost($, text, textNodes) {
  return { value: "0.00", elementPath: null };
}

function findDefaultItemQuantity($, text, textNodes) {
  return { value: "1", elementPath: null };
}

// monetary value immediately after keyword 'Total'
// last instance or first instance in document
function findDefaultTotal($, text, textNodes) {
  var firstTotalIndex = text.indexOf("Total") + "Total".length;
  var firstTotal;
  var lastTotal;

  if (firstTotalIndex !== -1) {
    // all numbers following, separated by spaces
    var firstTotalNumbers = text.substring(firstTotalIndex, firstTotalIndex + 30).replace(/[^0-9.\-]/g, " ").replace(/\s+/g, " ").replace(/[-]\s+/g, "-").trim();

    // loop through all characters to form numbers (by searching for space characters) until a valid number appears or end of string
    var charIndex = 0;
    while (charIndex < firstTotalNumbers.length) {
      var startIndex = charIndex;
      while (charIndex !== firstTotalNumbers.length && firstTotalNumbers.charAt(charIndex) !== " ") {
        charIndex++;
      }
      var endIndex = charIndex;
      firstTotal = firstTotalNumbers.substring(startIndex, endIndex);
      if (firstTotal.length > 0 && !isNaN(parseFloat(firstTotal))) {
        break;
      } else {
        firstTotal = null;
      }
      charIndex++;
    }

    text = text.substring(firstTotalIndex);
    var lastTotalIndex = text.lastIndexOf("Total") + "Total".length;

    if (lastTotalIndex !== -1) {
      // all numbers following, separated by spaces
      var lastTotalNumbers = text.substring(lastTotalIndex, lastTotalIndex + 30).replace(/[^0-9.\-]/g, " ").replace(/\s+/g, " ").replace(/[-]\s+/g, "-").trim();

      // loop through all characters to form numbers (by searching for space characters) until a valid number appears or end of string
      charIndex = 0;
      while (charIndex < lastTotalNumbers.length) {
        var startIndex = charIndex;
        while (charIndex !== lastTotalNumbers.length && lastTotalNumbers.charAt(charIndex) !== " ") {
          charIndex++;
        }
        var endIndex = charIndex;
        lastTotal = lastTotalNumbers.substring(startIndex, endIndex);
        if (lastTotal.length > 0 && !isNaN(parseFloat(lastTotal))) {
          break;
        } else {
          lastTotal = null;
        }
        charIndex++;
      }
    }
  }

  if (lastTotal != null) {
    return { value: lastTotal, elementPath: null };
  } else if (firstTotal != null) {
    return { value: firstTotal, elementPath: null };
  } else {
    return { value: "0.00", elementPath: null };
  }
}

// monetary value immediately after keyword 'Shipping'
// ignores Free Shipping keyword and doesn't look past any Total keywords
// check instances of the word from the end to the beginning for +'ve #s after
function findDefaultShipping($, text, textNodes) {
  text = text.replace("Free Shipping", "");

  var shipping;
  var shippingIndex = text.lastIndexOf("Shipping") + "Shipping".length;

  // horrible workaround to ignore "Free U.S. Shipping" and similar cases
  while (text.substring(shippingIndex - 20, shippingIndex).indexOf("Free") !== -1) {
    shippingIndex = text.lastIndexOf("Shipping", shippingIndex - "Shipping".length - 1) + "Shipping".length;
  }

  while (shipping == null && shippingIndex - "Shipping".length !== -1) {
    var shippingText = text.substring(shippingIndex, shippingIndex + 45);
    if (shippingText.indexOf("Total") !== -1) {
      shippingText = shippingText.substring(0, shippingText.indexOf("Total"));
    }

    // all numbers following, separated by spaces
    var shippingNumbers = shippingText.replace(/[^0-9.\-]/g, " ").replace(/\s+/g, " ").replace(/[-]\s+/g, "-").trim();

    // loop through all characters to form numbers (by searching for space characters) until a valid number appears or end of string
    var charIndex = 0;
    while (charIndex < shippingNumbers.length) {
      var startIndex = charIndex;
      while (charIndex !== shippingNumbers.length && shippingNumbers.charAt(charIndex) !== " ") {
        charIndex++;
      }
      var endIndex = charIndex;
      shipping = shippingNumbers.substring(startIndex, endIndex);
      // if it is a valid number and positive, keep it!
      if (shipping.length > 0 && !isNaN(parseFloat(shipping)) && parseFloat(shipping) >= 0) {
        break;
      } else {
        shipping = null;
      }
      charIndex++;
    }

    shippingIndex = text.lastIndexOf("Shipping", shippingIndex - "Shipping".length - 1) + "Shipping".length;
  }

  if (shipping != null) {
    return { value: shipping, elementPath: null };
  } else {
    return { value: "0.00", elementPath: null };
  }
}

function findDefaultCurrency($, text, domain, textNodes) {
  var country;
  var currency = "";

  // ignore manually set DOMAIN for local file sites (they have no domain)
  if (domain !== "DOMAIN") {
    var extension = domain.substring(domain.lastIndexOf("."));

    for (var i = 0; i < ccTLD.domainExtensions.length; i++) {
      if (extension === ccTLD.domainExtensions[i][0]) {
        country = ccTLD.domainExtensions[i][1];
        break;
      }
    }
  }

  // find currency from country
  if (country != null) {
    // some countries are not in the iso-countries npm
    switch(country) {
      case "Bonaire, Sint Eustatius and Saba":
        currency = "USD";
        break;
      case "Curaçao":
        currency = "ANG";
        break;
      case "Sint Maarten":
        currency = "ANG";
        break;
      default:
        var countryData = countries.findCountryByName(country);
        if (countryData != null) {
          currency = countryData.currency;
        }
    }
  }

  return { value: currency, elementPath: null };
}

function findDefaultTaxes($, text, textNodes) {
  // value would be { 0: { tax: "", price: "" } }

  // how to find in table in 1st place - find keyword tax in a table with a # value after - last table found
  // shipping in same table? - if getting rid of shipping
  // keyword total should be in same table?
  // find keywords in text first, (and infer other labels/values from surrounding text)
  // values always to the right of text

  // case where no tax? shipping? fee? credit?...
  // no such case? find scope
  var lowerText = text.toLowerCase();
  var lastIndex = lowerText.lastIndexOf("tax");

  if (lastIndex === -1) {
    lastIndex = lowerText.lastIndexOf("shipping");
  }

  if (lastIndex === -1) {
    lastIndex = lowerText.lastIndexOf("fee");
  }

  var reverseIndex = text.length - lastIndex;

  var count = 0;
  var element;
  // count textNodes backwards until reverseIndex char count is hit
  for (var i = textNodes.length - 1; i >= 0; i--) {
    count += textNodes[i].data.trim().length;
    if (count >= reverseIndex) {
      element = $(textNodes[i].parent);
    }

    var valid = false;
    var valueBuffer = 30;
    while (valueBuffer > 0 && !valid) {
      var value = textNodes[i + 1].data.trim();
      valueBuffer -= value.length;
      var valueNumbers = value.replace(/[^0-9.\-]/g, " ").replace(/\s+/g, " ").replace(/[-]\s+/g, "-").trim();

    }

    // account for space between text nodes
    count += 1;
  }

  // repeat entire thing with next lastIndexOf if no $ values closeby

  // then find text in elements - how to do this?
  // find textNode that contains text to the left of monetary value

  //Taxes appear as a separate table.  Not included in subtotal (calculated).
  //Assumption: other fees will be same table/template as taxes. (exclude "total"/"Total" keyword for these)
  //Two attributes: tax name & amount.
  //Include gift certificates? discounts? credits?
  //Don't need to exclude free shipping. (shipping would be included)

  //"Payment made"? how to detect this type

  //Duplicate payment informations? - take last instance on page
  //Check by duplicate name & remove.

  //Can exclude 0.00 values? (no tax, no shipping, no discount, etc.)
  //Cross-reference values with receipt items to ensure no duplicates.

  return { value: "", elementPath: null };
}

// initializes textNodes and retrieves document text
function initializeContentSearch($, callback) {
  var selector = "body",
      params = { "text": "", "trim": true, "textNodes": [] };

  // iterate through all children of body element
  if ($(selector).length > 0) {
    var children = $(selector)[0].children;
    for (var i = 0; i < children.length; i++) {
      params = iterateText(children[i], initTextNodes, params);
    }
    callback(params);
  } else {
    console.log("element does not exist. no text retrieved");
    return callback();
  }
}

// stores text node in param textNodes and calls addText
function initTextNodes(node, params) {
  params.textNodes.push(node);
  params = addText(node, params);
  return params;
}

/* params:  text - total plain-text of all passed text nodes
*           trim - true if the nodeValue will be trimmed before added to text
*/
function addText(node, params) {
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

  params.text = text;
  return params;
}

function iterateText(node, method, methodParams) {
  // run method for non-whitespace text nodes
  if (node.type === "text" && /\S/.test(node.data)) {
    methodParams = method(node, methodParams);
  }
  // exception case to include whitespace text nodes
  else if (node.type === "text" && methodParams.whitespace !== undefined) {
    methodParams = method(node, methodParams);
  }
  // iterateText through children of non-style/script elements
  else if (node.type === "tag" && node.children.length > 0 && !/(style|script)/i.test(node.name)) {
    var children = node.children;
    for (var i = 0; i < children.length; i++) {
      methodParams = iterateText(children[i], method, methodParams);
      if (methodParams.result != null && methodParams.result === false) {
        break;
      }
    }
  }
  return methodParams;
}

// calculates the elementPath from param node
function findElementPath($, node) {
  if (node.type === "text") {
    node = node.parent;
  }
  var elementPath = [];
  var element = $(node);
  var parentElement = element.parent();
  var order;

  while (parentElement.length > 0 && element[0].name !== "body") {
    order = inArray(element, parentElement.children());
    elementPath.unshift(order);
    element = parentElement;
    parentElement = parentElement.parent();
  }
  elementPath.unshift(0);
  return elementPath;
}

// returns index of element within array
function inArray(element, array) {
  var index = 0;
  for (var i = 0; i < array.length; i++) {
    if (array[i] === element[0]) {
      index = i;
      break;
    }
  }
  return index;
}

// find all instances of searchTerm in the document
// returns a list of parent elements that contain the searchTerm
function searchText(searchTerm, $, text, textNodes) {
  searchTerm = String(searchTerm);
  var total = occurrences(text, searchTerm, true);

  if (total > 0) {
    var params = {
      "nodeIndex": 0,
      "searchTerm": searchTerm,
      "searchElements": [],
      "total": total,
      "count": 0,
      "text": "",
      // holds last valid index
      "currentIndex": -1,
      "result": true,
      "textNodes": textNodes,
      "$": $
    };

    // iterate through all children of body element
    var children = $("body")[0].children;
    for (var i = 0; i < children.length; i++) {
      params = iterateText(children[i], findMatch, params);
      if (params.result === false) {
        console.log("Found all " + searchTerm + " matches in document");
        break;
      }
    }
    return params.searchElements;
  }
}

/* params: nodeIndex - index in textNodes iterated through
*          searchTerm - search term to match
*          searchElements - parent elements of found search terms
*          total - total # of matches found
*          count - current # of matches found
*          text - total plain-text of all passed text nodes
*          currentIndex - holds last valid index
*          result - set to false to break out of iterateText
*          textNodes - array of text nodes making up document text
*          $ - jquery methods for page html
*/
function findMatch(node, params) {

  var $ = params.$,
      nodeValue = node.data.trim(),
      nodeIndex = params.nodeIndex,
      searchTerm = params.searchTerm,
      searchElements = params.searchElements,
      total = params.total,
      count = params.count,
      text = params.text,
      currentIndex = params.currentIndex,
      textNodes = params.textNodes;

  if (text === "") {
    text = nodeValue;
  } else {
    text += " " + nodeValue;
  }

  // if searchTerm is found, current text node is the end node for one count
  var index = text.toLowerCase().indexOf(searchTerm.toLowerCase(), currentIndex + 1);
  // if there is multiple instances of searchTerm in text (loops through while loop), use oldStartIndex to calculate startIndex
  var oldStartIndex, startNodeIndex;

  // stores the number of characters the start of searchTerm is from the end of text
  var charactersFromEnd = text.length - index;

  // loop through text node in case there is more than one searchTerm instance in text
  while (index !== -1) {
    currentIndex = index;

    // remember how many text nodes before current node we are pulling from textNodes
    var textNodesBackIndex = nodeIndex - 1;

    // textSelection will contain a combined string of all text nodes where current searchTerm spans over
    var textSelection = nodeValue;
    var startNode;

    // set textSelection to contain prevSibling text nodes until the current searchTerm matches
    while (textSelection.length < charactersFromEnd) {
      //console.log("textSelection.length: " + textSelection.length + " < " + charactersFromEnd);
      //console.log("old textSelection: " + textSelection);
      textSelection = textNodes[textNodesBackIndex].data.trim() + " " + textSelection;
      //console.log("space added: " + textSelection);
      textNodesBackIndex--;
    }

    // use old startNodeIndex value before re-calculating it if its the same as new startNodeIndex
    // startIndex needs to ignore previous instances of text
    var startIndex;
    if (startNodeIndex !== undefined && startNodeIndex === textNodesBackIndex + 1) {
      // find index searchTerm starts on in text node (or prevSibling)
      startIndex = textSelection.toLowerCase().indexOf(searchTerm.toLowerCase(), oldStartIndex + 1);
    } else {
      startIndex = textSelection.toLowerCase().indexOf(searchTerm.toLowerCase());
    }
    oldStartIndex = startIndex;

    // startNode contains beginning of searchTerm and node contains end of searchTerm
    var startNodeIndex = textNodesBackIndex + 1;
    // possibly null parentNode because highlighted text before, adding MARK tag and then removed it
    startNode = textNodes[startNodeIndex];
    //console.log("final textSelection: " + textSelection);

    if (startIndex !== -1) {
      // set parent as first element parent of textNode
      var endParent = node.parent;

      var startParent = startNode.parent;

      var targetParent;
      // start and end parents are the same
      if (startParent === endParent) {
        console.log("start parent is end parent");
        targetParent = startParent;
      }
      // start parent is target parent element
      else if ($.contains(startParent, endParent)) {
        console.log("start parent is larger");
        targetParent = startParent;
      }
      // end parent is target parent element
      else if ($.contains(endParent, startParent)) {
        console.log("end parent is larger");
        targetParent = endParent;
      }
      // neither parents contain one another
      else {
        console.log("neither parent contains the other");
        // iterate upwards until startParent contains endParent
        while (!$.contains(startParent, endParent) && startParent !== endParent) {
          startParent = startParent.parent;
        }
        targetParent = startParent;
      }

      // set startNode to node before the parent we are calculating with
      if (textNodesBackIndex !== -1) {
        startNode = textNodes[textNodesBackIndex];
        textNodesBackIndex--;

        var startElement = startNode.parent;

        // continue adding text length to startIndex until parent elements are not contained in targetParent
        while (($.contains(targetParent, startElement) || targetParent === startElement) && textNodesBackIndex !== -1) {
          startIndex += startNode.data.trim().length + 1;
          startNode = textNodes[textNodesBackIndex];
          textNodesBackIndex--;
          startElement = startNode.parent;
        }
      }

      // find index searchTerm ends on in text node
      var endIndex = startIndex + searchTerm.length;
      /*console.log("start index: " + startIndex);
      console.log("end index: " + endIndex);*/

      searchElements.push({
        index: currentIndex,
        start: startIndex,
        end: endIndex,
        startNodeIndex: startNodeIndex,
        endNodeIndex: nodeIndex
      });

      count++;
    } else {
      console.log(textSelection);
      console.log(searchTerm);
    }

    index = text.toLowerCase().indexOf(searchTerm.toLowerCase(), currentIndex + 1);
    charactersFromEnd = text.length - index;
    //console.log("characters from end: " + charactersFromEnd);

    if (count === total) {
      console.log("Completed calculations for all matched searchTerms");
      nodeIndex++;
      return ({
              "nodeIndex": nodeIndex,
              "searchTerm": searchTerm,
              "searchElements": searchElements,
              "total": total,
              "count": count,
              "text": text,
              "currentIndex": currentIndex,
              "result": false,
              "textNodes": textNodes,
              "$": $
            });
    }
  }
  nodeIndex++;
  return ({
            "nodeIndex": nodeIndex,
            "searchTerm": searchTerm,
            "searchElements": searchElements,
            "total": total,
            "count": count,
            "text": text,
            "currentIndex": currentIndex,
            "result": true,
            "textNodes": textNodes,
            "$": $
          });
}

function alterSearchData(modifyFrom, change, data, textNodes) {
  if (modifyFrom === "start") {
    if (change > data.start) {
      change -= data.start;
      data.startNodeIndex = data.startNodeIndex - 1;
      while (textNodes[yearIndex.startNodeIndex].data.trim().length > change) {
        change -= textNodes[data.startNodeIndex].data.trim().length;
        data.startNodeIndex = data.startNodeIndex - 1;
      }
    }
  } else if (modifyFrom === "end") {
    if (change > textNodes[data.endNodeIndex].data.trim().length - data.end) {
      change -= textNodes[data.endNodeIndex].data.trim().length - data.end;
      data.endNodeIndex = data.endNodeIndex + 1;
      while (textNodes[data.endNodeIndex].data.trim().length > change) {
        change -= textNodes[data.endNodeIndex].data.trim().length;
        data.endNodeIndex = data.endNodeIndex + 1;
      }
    }
  }
  return data;
}

// source: http://stackoverflow.com/questions/4009756/how-to-count-string-occurrence-in-string
/** Function count the occurrences of substring in a string; not case sensitive
 * @param {String} string   Required. The string;
 * @param {String} subString    Required. The string to search for;
 * @param {Boolean} allowOverlapping    Optional. Default: false;
 */
function occurrences(string, subString, allowOverlapping){

    string+="", subString+="";
    string = string.toLowerCase();
    subString = subString.toLowerCase();
    //console.log(string);
    //console.log(subString);
    if(subString.length<=0) return string.length+1;

    var n=0, pos=0;
    var step=(allowOverlapping)?(1):(subString.length);

    while(true){
        pos=string.indexOf(subString,pos);
        if(pos>=0){ n++; pos+=step; } else break;
    }
    return (n);
}
