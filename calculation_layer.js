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
              jsonMessage.templates[key] = result.template;
            }
          }

          // convert values to correct datatype
          result = convertAttributeDataType(jsonMessage[key], global.attributes.individualAttributes[key].datatype);
          jsonMessage[key] = result;
          if (result === "") {
            delete jsonMessage.elementPaths[key];
            delete jsonMessage.templates[key];
          }
        }

        // startNodeIndex doesn't exist but value does, calculate it
        if (jsonMessage.templates.hasOwnProperty(key) && jsonMessage.templates[key].hasOwnProperty("start") && !jsonMessage.templates[key].hasOwnProperty("node")) {
          jsonMessage.templates[key].node = findStartNodeIndex($, textNodes, jsonMessage.elementPaths[key], jsonMessage.templates[key].start, jsonMessage.templates[key].end);
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

                  if (result.elementPath != null) {
                    jsonMessage.elementPaths[group][itemKey][attr] = result.elementPath;
                    jsonMessage.templates[group][itemKey][attr] = result.template;
                  }
                }
              }

              // convert values to correct datatype
              jsonMessage[group][itemKey][attr] = convertAttributeDataType(jsonMessage[group][itemKey][attr], attr.datatype);

              // startNodeIndex doesn't exist but value does, calculate it
              if (jsonMessage.templates.hasOwnProperty(group) && jsonMessage.templates[group].hasOwnProperty(itemKey) && jsonMessage.templates[group][itemKey].hasOwnProperty(attr) &&
                  jsonMessage.templates[group][itemKey][attr].hasOwnProperty("start") && !jsonMessage.templates[group][itemKey][attr].hasOwnProperty("node")) {
                jsonMessage.templates[group][itemKey][attr].node = findStartNodeIndex($, textNodes, jsonMessage.elementPaths[group][itemKey][attr],
                                                                                      jsonMessage.templates[group][itemKey][attr].start, jsonMessage.templates[group][itemKey][attr].end);
              }
            }
          }
        }
        // actually look for default values for taxes
        else if (group === "taxes") {
          var result = findDefaultValue($, group, documentText, domain, textNodes);
          if (result != null && result.value !== "") {
            jsonMessage[group] = result.value;

            if (result.elementPath != null) {
              jsonMessage.elementPaths[group] = result.elementPath;
              jsonMessage.templates[group] = result.template;
            }

            itemKeys = Object.keys(jsonMessage[group]);
            if (itemKeys.length > 0) {
              for (var i = 0; i < itemKeys.length; i++) {
                var itemKey = itemKeys[i];

                // loop through each attribute in group for item
                for (var j = 0; j < groupAttributes.length; j++) {
                  var attr = groupAttributes[j];

                  // convert values to correct datatype
                  jsonMessage[group][itemKey][attr] = convertAttributeDataType(jsonMessage[group][itemKey][attr], attr.datatype);

                  // startNodeIndex doesn't exist but value does, calculate it
                  if (jsonMessage.templates.hasOwnProperty(group) && jsonMessage.templates[group].hasOwnProperty(itemKey) && jsonMessage.templates[group][itemKey].hasOwnProperty(attr) &&
                      jsonMessage.templates[group][itemKey][attr].hasOwnProperty("start") && !jsonMessage.templates[group][itemKey][attr].hasOwnProperty("node")) {
                    jsonMessage.templates[group][itemKey][attr].node = findStartNodeIndex($, textNodes, jsonMessage.elementPaths[group][itemKey][attr],
                                                                                          jsonMessage.templates[group][itemKey][attr].start, jsonMessage.templates[group][itemKey][attr].end);
                  }
                }
              }
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
  case "item_cost":
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

function processDate($, text, textNodes, yearLength) {
  var date = new Date();
  var yearIndices = [];
  var dateString = "";
  var elementPath = [];
  var dateValues = [];
  var template = {};
  var monthStrings = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  var currentYear = date.getFullYear();

  // shrink currentYear to # of digits in yearLength
  if (yearLength < 4) {
    var mod = 10000;
    for (var i = 0; i < 4 - yearLength; i++) {
      mod /= 10;
    }
    currentYear %= mod;
  }

  // find all years in text
  var targetYear = currentYear - 2;
  // iterate through each year
  while (targetYear !== currentYear + 1) {
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
    var year = text.substring(yearIndex.index, yearIndex.index + yearLength);
    var month, day;
    // split by newline or 14 chars from either side of year
    if (yearIndex.index - 10 - yearLength > 0 && yearIndex.index + 14 + yearLength < text.length) {
      prevText = text.substring(yearIndex.index - 10 - yearLength, yearIndex.index).toLowerCase();
      nextText = text.substring(yearIndex.index + yearLength, yearIndex.index + 14 + yearLength).toLowerCase();
    } else if (yearIndex.index - 10 - yearLength > 0) {
      prevText = text.substring(yearIndex.index - 10 - yearLength, yearIndex.index).toLowerCase();
    } else if (yearIndex.index + 14 + yearLength < text.length) {
      nextText = text.substring(yearIndex.index + yearLength, yearIndex.index + 14 + yearLength).toLowerCase()
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

    // find matching month from monthStrings, then calculate for date
    var monthIndex = 0;

    // dates MUST have year at either one end or the other, so look only at next or prev
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

          // decrease from start until month index
          var startChange = prevIndex - prevText.length;
          yearIndex = alterSearchData("start", startChange, yearIndex, textNodes);
        } else if (parseInt(subPrevText) > 0 && parseInt(subPrevText) < 32) {
          day = subPrevText;
          // find index of subPrevText in prevText
          var dayIndex = prevText.indexOf(subPrevText);

          // decrease from start until day index
          var startChange = dayIndex - prevText.length + dayIndex;
          yearIndex = alterSearchData("start", startChange, yearIndex, textNodes);
        }
      } else if (nextText != null && nextIndex !== -1) {
        month = monthIndex;
        var subPrevText = nextText.substring(0, nextIndex).replace(/[^0-9]/g, "");
        var subNextText = nextText.substring(nextIndex + monthString.length).replace(/[^0-9]/g, "");
        if (parseInt(subNextText) > 0 && parseInt(subNextText) < 32) {
          day = parseInt(subNextText);
          var dayIndex = nextText.substring(nextIndex + monthString.length).indexOf(subNextText);

          // add to end up to day index (include day length)
          var endChange = dayIndex + subNextText.length;
          yearIndex = alterSearchData("end", endChange, yearIndex, textNodes);
        } else if (parseInt(subPrevText) > 0 && parseInt(subPrevText) < 32) {
          day = parseInt(subPrevText);

          var monthString = nextText.substring(nextIndex).replace("[^A-Za-z]", " ");
          var monthLength;
          for (monthLength = 0; monthLength < monthString.length; monthLength++) {
            if (monthString.charAt(monthLength) === " ") {
              break;
            }
          }

          // add to end up to month (include month length)
          var endChange = nextIndex + monthLength;
          yearIndex = alterSearchData("end", endChange, yearIndex, textNodes);
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
        var dayIndex;
        var monthIndex;
        var startChange;

        month = parseInt(prevNums[prevNums.length - 2]) - 1;
        // if month is invalid, use as day
        if (month > 11 && month < 31) {
          day = month + 1;
          month = parseInt(prevNums[prevNums.length - 1]) - 1;

          monthIndex = prevText.lastIndexOf(month + 1) - 1;
          dayIndex = prevText.lastIndexOf(day, monthIndex);

          // decrease from start until day index
          startChange = dayIndex - prevText.length;
        } else {
          day = parseInt(prevNums[prevNums.length - 1]);

          dayIndex = prevText.lastIndexOf(day) - 1;
          monthIndex = prevText.lastIndexOf(month + 1, dayIndex);

          // decrease from start until month index
          startChange = monthIndex - prevText.length;
        }

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

          // add to end up to day index (include day length)
          var endChange = dayIndex + nextNums[1].length;
          yearIndex = alterSearchData("end", endChange, yearIndex, textNodes);
        }
      }
    }

    if (yearLength === 1) {
      year = "201".concat(year);
    } else if (yearLength === 2) {
      year = "20".concat(year);
    } else if (yearLength === 3) {
      year = "2".concat(year);
    }

    // add date to dateValues if all values are valid
    if (month != null && month < 12 && day != null && day > 0 && day < 32) {
      var elePath;
      // find element to add to dateValues based on text nodes
      if (yearIndex.startNodeIndex === yearIndex.endNodeIndex) {
        elePath = findElementPath($, textNodes[yearIndex.startNodeIndex]);
        dateValues.push({ date: new Date(year, month, day), elementPath: elePath, template: { start: yearIndex.start, end: yearIndex.end, node: yearIndex.startNodeIndex } });
      }
      // text nodes are not the same, find parent element
      else {
        var nodeParent = textNodes[yearIndex.startNodeIndex].parent;
        var secondParent = textNodes[yearIndex.endNodeIndex].parent;
        while (!$.contains(nodeParent, secondParent) && nodeParent !== secondParent && nodeParent.name !== "body") {
          nodeParent = nodeParent.parent;
        }

        elePath = findElementPath($, nodeParent);
        dateValues.push({ date: new Date(year, month, day), elementPath: elePath, template: { start: yearIndex.start, end: yearIndex.end, node: yearIndex.startNodeIndex } });
      }
    }
  }

  var currentDate;
  for (var i = 0; i < dateValues.length; i++) {
    var value = dateValues[i];
    if (currentDate == null) {
      currentDate = value.date;
      elementPath = value.elementPath;
      template = value.template;
    } else if (value.date.getTime() - currentDate.getTime() < 0) {
      currentDate = value.date;
      elementPath = value.elementPath;
      template = value.template;
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
    return { value: dateString, elementPath: elementPath, template: template }
  } else {
    return null;
  }
}

// to avoid shipping date, take earliest found date
function findDefaultDate($, text, textNodes) {
  var result = processDate($, text, textNodes, 4);

  if (result == null) {
    result = processDate($, text, textNodes, 2);
  }

  if (result != null) {
    return result;
  } else {
    return { value: "", elementPath: null, template: null };
  }
}

// domain name text? not always
function findDefaultVendor($, text, domain, textNodes) {
  if (domain.indexOf("www.") === 0) {
    domain = domain.substring(4);
  }
  domain = domain.charAt(0).toUpperCase() + domain.slice(1);
  return { value: domain, elementPath: null, template: null };
}

function findDefaultTransaction($, text, textNodes) {
  return { value: "", elementPath: null, template: null };
}

function findDefaultItemName($, text, textNodes) {
  return { value: "", elementPath: null, template: null };
}

function findDefaultItemCost($, text, textNodes) {
  return { value: "0.00", elementPath: null, template: null };
}

function findDefaultItemQuantity($, text, textNodes) {
  return { value: "1", elementPath: null, template: null };
}

// monetary value immediately after keyword 'Total'
// last instance (loop until valid) or first instance in document
function findDefaultTotal($, text, textNodes) {
  var firstTotalIndex = text.indexOf("Total") + "Total".length;
  var firstTotal;
  var firstResult;
  var lastTotal;
  var lastResult;
  var textNodeIndex = 0;

  if (firstTotalIndex !== -1) {
    // character count to find text node element
    var count = 0;

    var firstTotalElement;
    for (; textNodeIndex < textNodes.length; textNodeIndex++) {
      count += textNodes[textNodeIndex].data.trim().length + 1;
      // textNodes[textNodeIndex] equals Total text node
      if (count >= firstTotalIndex) {
        firstTotalElement = $(textNodes[textNodeIndex].parent);
        // return count to its proper value for future calculations
        count -= textNodes[textNodeIndex].data.trim().length + 1;
        break;
      }
    }

    // all numbers following, separated by spaces
    var firstTotalNumbers = text.substring(firstTotalIndex, firstTotalIndex + 30).replace(/[^0-9.\-]/g, " ").replace(/\s+/g, " ").replace(/[-]\s+/g, "-").trim();

    // loop through all characters to form numbers (by searching for space characters) until a valid number appears or end of string
    var startIndex;
    var endIndex = -1;
    while (endIndex !== firstTotalNumbers.length) {
      startIndex = endIndex + 1;
      endIndex = firstTotalNumbers.indexOf(" ", startIndex);
      if (endIndex === -1) {
        endIndex = firstTotalNumbers.length;
      }

      firstTotal = firstTotalNumbers.substring(startIndex, endIndex);
      if (firstTotal.length > 0 && !isNaN(parseFloat(firstTotal)) && parseFloat(firstTotal) >= 0) {
        // check if element is within a few levels
        var resultIndex = text.substring(firstTotalIndex, firstTotalIndex + 30).indexOf(firstTotal.replace(/[-]\s+/g, "")) + firstTotal.length;

        var totalElement;
        for (; textNodeIndex < textNodes.length; textNodeIndex++) {
          count += textNodes[textNodeIndex].data.trim().length + 1;
          // textNodes[textNodeIndex] equals Total value text node
          if (count >= firstTotalIndex + resultIndex) {
            totalElement = $(textNodes[textNodeIndex].parent);
            var parentLength = totalElement.parents().length;

            // compare firstTotalElement and totalElement
            var parent = $(findParent(totalElement, firstTotalElement));
            // parent doesn't exist or too many parents between total and value
            if (parent == null || parentLength - 5 > parent.parents().length) {
              firstTotal = null;
            }

            // return count to its proper value for future calculations
            count -= textNodes[textNodeIndex].data.trim().length + 1;
            break;
          }
        }

        if (firstTotal != null) {
          var elePath = findElementPath($, textNodes[textNodeIndex]);
          var start = totalElement.text().indexOf(firstTotal);
          var end = start + firstTotal.length;
          firstResult = { value: firstTotal, elementPath: elePath, template: { start: start, end: end, node: textNodeIndex }};
        }
        break;
      } else {
        firstTotal = null;
      }
    }

    var lastTotalIndex = text.lastIndexOf("Total") + "Total".length;

    // loop through lastTotal values until a valid one appears
    while (lastTotalIndex !== -1 && lastTotalIndex !== firstTotalIndex && lastTotal == null) {
      var lastTotalElement;
      for (; textNodeIndex < textNodes.length; textNodeIndex++) {
        count += textNodes[textNodeIndex].data.trim().length + 1;
        // textNodes[textNodeIndex] equals Total text node
        if (count >= lastTotalIndex) {
          lastTotalElement = $(textNodes[textNodeIndex].parent);
          count -= textNodes[textNodeIndex].data.trim().length + 1;
          break;
        }
      }

      // all numbers following, separated by spaces
      var lastTotalNumbers = text.substring(lastTotalIndex, lastTotalIndex + 30).replace(/[^0-9.\-]/g, " ").replace(/\s+/g, " ").replace(/[-]\s+/g, "-").trim();

      // loop through all characters to form numbers (by searching for space characters) until a valid number appears or end of string
      var startIndex;
      var endIndex = -1;
      while (endIndex !== lastTotalNumbers.length) {
        startIndex = endIndex + 1;
        endIndex = lastTotalNumbers.indexOf(" ", startIndex);
        if (endIndex === -1) {
          endIndex = lastTotalNumbers.length;
        }

        lastTotal = lastTotalNumbers.substring(startIndex, endIndex);
        if (lastTotal.length > 0 && !isNaN(parseFloat(lastTotal)) && parseFloat(lastTotal) >= 0) {
          // check if element is within a few levels
          var resultIndex = text.substring(lastTotalIndex, lastTotalIndex + 30).indexOf(lastTotal.replace(/[-]\s+/g, "")) + lastTotal.length;

          var totalElement;
          for (; textNodeIndex < textNodes.length; textNodeIndex++) {
            count += textNodes[textNodeIndex].data.trim().length + 1;
            // textNodes[textNodeIndex] equals Total value text node
            if (count >= lastTotalIndex + resultIndex) {
              totalElement = $(textNodes[textNodeIndex].parent);
              var parentLength = totalElement.parents().length;

              // compare firstTotalElement and totalElement
              var parent = $(findParent(totalElement, lastTotalElement));
              // parent doesn't exist or too many parents between total and value
              if (parent == null || parentLength - 5 > parent.parents().length) {
                lastTotal = null;
              }

              // return count to its proper value for future calculations
              count -= textNodes[textNodeIndex].data.trim().length + 1;
              break;
            }
          }

          if (lastTotal != null) {
            var elePath = findElementPath($, textNodes[textNodeIndex]);
            var start = totalElement.text().indexOf(lastTotal);
            var end = start + lastTotal.length;
            lastResult = { value: lastTotal, elementPath: elePath, template: { start: start, end: end, node: textNodeIndex }};
          }
          break;
        } else {
          lastTotal = null;
        }
      }
      lastTotalIndex = text.lastIndexOf("Total", lastTotalIndex - "Total".length - 1) + "Total".length;
    }
  }

  if (lastTotal != null) {
    return lastResult;
  } else if (firstTotal != null) {
    return firstResult;
  } else {
    return { value: "0.00", elementPath: null, template: null };
  }
}

// DEPRECIATED - shipping is in default taxes
// monetary value immediately after keyword 'Shipping'
// ignores Free Shipping keyword and doesn't look past any Total keywords
// check instances of the word from the end to the beginning for +'ve #s after
function findDefaultShipping($, text, textNodes) {
  text = text.replace("Free Shipping", "");

  var shipping;
  var shippingIndex = text.lastIndexOf("Shipping") + "Shipping".length;

  // workaround to ignore "Free U.S. Shipping" and similar cases
  while (text.substring(shippingIndex - 20, shippingIndex).indexOf("Free") !== -1) {
    shippingIndex = text.lastIndexOf("Shipping", shippingIndex - "Shipping".length - 1) + "Shipping".length;
  }

  if (shippingIndex !== -1 + "Shipping".length) {
    while (shipping == null && shippingIndex - "Shipping".length !== -1) {
      var shippingText = text.substring(shippingIndex, shippingIndex + 45);
      if (shippingText.indexOf("Total") !== -1) {
        shippingText = shippingText.substring(0, shippingText.indexOf("Total"));
      }

      // all numbers following, separated by spaces
      var shippingNumbers = shippingText.replace(/[^0-9.\-]/g, " ").replace(/\s+/g, " ").replace(/[-]\s+/g, "-").trim();

      // loop through all characters to form numbers (by searching for space characters) until a valid number appears or end of string
      var startIndex;
      var endIndex = -1;
      while (endIndex !== shippingNumbers.length) {
        startIndex = endIndex + 1;
        endIndex = shippingNumbers.indexOf(" ", startIndex);
        if (endIndex === -1) {
          endIndex = shippingNumbers.length;
        }

        shipping = shippingNumbers.substring(startIndex, endIndex);
        // if it is a valid number and positive, keep it!
        if (shipping.length > 0 && !isNaN(parseFloat(shipping)) && parseFloat(shipping) >= 0) {
          break;
        } else {
          shipping = null;
        }
      }

      shippingIndex = text.lastIndexOf("Shipping", shippingIndex - "Shipping".length - 1) + "Shipping".length;
    }
  }

  if (shipping != null) {
    return { value: shipping, elementPath: null, template: null };
  } else {
    return { value: "0.00", elementPath: null, template: null };
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

  return { value: currency, elementPath: null, template: null };
}

// tries multiple tax-style keywords and finds all non-total rows around it to add to tax table
// value would be { 0: { tax: "", price: "" } }
function findDefaultTaxes($, text, textNodes) {
  var result;
  // temporarily hold 1st value so it can be ordered properly later
  var tempResult = {};

  var lowerText = text.toLowerCase();
  var keyword = "tax";
  var lastIndex = lowerText.lastIndexOf(keyword);

  if (lastIndex === -1) {
    keyword = "shipping";
    lastIndex = lowerText.lastIndexOf(keyword);
  }

  if (lastIndex === -1) {
    keyword = "fee";
    lastIndex = lowerText.lastIndexOf(keyword);
  }

  if (lastIndex === -1) {
    keyword = "credit";
    lastIndex = lowerText.lastIndexOf(keyword);
  }

  var taxElement;
  var taxElementPath;
  var taxRowElement;
  var taxTextNodeOrder;
  var taxTemplate = {};

  var valueElement;
  var valueElementPath;
  var valueRowElement;
  var valueTextNodeOrder;
  var valueTemplate = {};

  var tax;
  var value;

  // tracking which textNode we are at and how many characters we have passed
  var textNodeIndex = textNodes.length - 1;
  var count = 0;

  while (lastIndex !== -1) {
    var reverseIndex = text.length - lastIndex;

    // count textNodes backwards until reverseIndex char count is hit
    for (; textNodeIndex >= 0; textNodeIndex--) {
      count += textNodes[textNodeIndex].data.trim().length + 1;

      // escape mechanism if elements aren't encapsulated in rows
      if (count >= reverseIndex + textNodes[textNodeIndex].data.trim().length) {
        break;
      } else if (count >= reverseIndex) {
        if (taxElementPath == null) {
          taxElement = $(textNodes[textNodeIndex].parent);
          taxElementPath = findClosestRowElement(taxElement);

          var childNodes = taxElement[0].children;
          for (var i = 0; i < childNodes.length; i++) {
            if (childNodes[i] === textNodes[textNodeIndex]) {
              taxTextNodeOrder = i;
              taxTemplate.node = textNodeIndex;
              break;
            }
          }

          // taxElement is not in a row element, look for next instance of keyword
          if (taxElementPath == null) {
            break;
          }
        }

        tax = textNodes[textNodeIndex].data.trim();
        // trim numbers from tax
        tax = tax.replace(/[0-9.\-]/g, " ").trim();
        taxTemplate.start = textNodes[textNodeIndex].data.trim().indexOf(tax);
        if (taxTemplate.start === -1) {
          taxTemplate.start = 0;
        }
        taxTemplate.end = taxTemplate.start + tax.length;

        tax = tax.replace(/\s+/g, " ");

        if (tax.toLowerCase().indexOf("total") !== -1) {
          break;
        }

        var valueBuffer = 30;
        // keep trying textNodes until a valid value is found or until 30 characters have been searched
        var tempNodeIndex = textNodeIndex;
        while (valueBuffer > 0 && valueElement == null) {
          value = textNodes[tempNodeIndex].data;
          if (value.indexOf(keyword) !== -1) {
            value = value.substring(value.indexOf(keyword) + keyword.length);
          }
          valueBuffer -= value.length;
          var valueNumbers = value.replace(/[^0-9.\-]/g, " ").replace(/\s+/g, " ").replace(/[-]\s+/g, "-").trim();

          var startIndex = 0;
          var endIndex = valueNumbers.indexOf(" ");

          // iterate through valueNumbers until the end or until value is valid
          while (endIndex !== -1) {
            value = valueNumbers.substring(startIndex, endIndex);

            if (value.length > 0 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0) {
              valueElement = $(textNodes[tempNodeIndex].parent);

              var childNodes = valueElement[0].children;
              for (var i = 0; i < childNodes.length; i++) {
                if (childNodes[i] === textNodes[tempNodeIndex]) {
                  valueTextNodeOrder = i;
                  valueTemplate.node = tempNodeIndex;

                  // matchValue alters start calculation for "-" symbol in front
                  var matchValue;
                  if (value.indexOf("-") !== -1) {
                    matchValue = value.replace(/-/g, "");
                  }

                  if (matchValue != null) {
                    valueTemplate.start = textNodes[tempNodeIndex].data.trim().indexOf(matchValue);
                    if (valueTemplate.start === -1) {
                      valueTemplate.start = 0;
                    }
                    valueTemplate.end = valueTemplate.start + matchValue.length;

                    while (textNodes[tempNodeIndex].data.trim().charAt(valueTemplate.start) !== "-" || valueTemplate.start !== 0) {
                      valueTemplate.start = valueTemplate.start - 1;
                    }
                  } else {
                    valueTemplate.start = textNodes[tempNodeIndex].data.trim().indexOf(value);
                    if (valueTemplate.start === -1) {
                      valueTemplate.start = 0;
                    }
                    valueTemplate.end = valueTemplate.start + value.length;
                  }
                  break;
                }
              }
              break;
            } else {
              startIndex = endIndex + 1;
              endIndex = valueNumbers.indexOf(" ", startIndex);
            }
          }

          // final number in valueNumbers
          if (valueElement == null) {
            value = valueNumbers.substring(startIndex);
            if (value.length > 0 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0) {
              valueElement = $(textNodes[tempNodeIndex].parent);

              var childNodes = valueElement[0].children;
              for (var i = 0; i < childNodes.length; i++) {
                if (childNodes[i] === textNodes[tempNodeIndex]) {
                  valueTextNodeOrder = i;
                  valueTemplate.node = tempNodeIndex;

                  // matchValue alters start calculation for "-" symbol in front
                  var matchValue;
                  if (value.indexOf("-") !== -1) {
                    matchValue = value.replace(/-/g, "");
                  }

                  if (matchValue != null) {
                    valueTemplate.start = textNodes[tempNodeIndex].data.trim().indexOf(matchValue);
                    if (valueTemplate.start === -1) {
                      valueTemplate.start = 0;
                    }
                    valueTemplate.end = valueTemplate.start + matchValue.length;

                    while (textNodes[tempNodeIndex].data.trim().charAt(valueTemplate.start) !== "-" || valueTemplate.start !== 0) {
                      valueTemplate.start = valueTemplate.start - 1;
                    }
                  } else {
                    valueTemplate.start = textNodes[tempNodeIndex].data.trim().indexOf(value);
                    if (valueTemplate.start === -1) {
                      valueTemplate.start = 0;
                    }
                    valueTemplate.end = valueTemplate.start + value.length;
                  }
                  break;
                }
              }
            }
          }
          tempNodeIndex++;
        }

        // if valueElement doesn't exist, don't use this textNode
        if (valueElement != null) {
          taxRowElement = taxElement;
          for (var i = 1; i < taxElementPath.length; i++) {
            taxRowElement = taxRowElement.parent();
          }

          if (valueElement[0] !== taxElement[0]) {
            valueElementPath = findClosestRowElement(valueElement);

            // try another keyword match
            if (valueElementPath == null) {
              valueElement = null;
              break;
            } else {
              valueRowElement = valueElement;
              for (var i = 1; i < valueElementPath.length; i++) {
                valueRowElement = valueRowElement.parent();
              }

              // if different row elements, try another keyword match
              if (valueRowElement[0] !== taxRowElement[0]) {
                valueElement = null;
                break;
              }
            }
          }

          tempResult.value = { taxtype: tax, tax_cost: value };
          tempResult.elementPath = { taxtype: findElementPath($, taxElement[0]), tax_cost: findElementPath($, valueElement[0]) };
          tempResult.template = { taxtype: taxTemplate, tax_cost: valueTemplate };
          break;
        }
      }
    }

    // search for other taxes from sibling rows to found result
    if (valueElement != null) {
      // validation has passed, so results are added to taxes for sure
      result = { value: {}, elementPath: {}, template: {} };
      var index = 0;

      var prevRows = taxRowElement.prevAll();
      for (var i = prevRows.length - 1; i >= 0; i--) {
        var row = $(prevRows[i]);

        var taxResult = calculateTaxRow(row, taxElementPath, taxTextNodeOrder, valueElementPath, valueTextNodeOrder);
        // only add if result doesn't contain total
        if (taxResult != null && taxResult.value.taxtype.toLowerCase().indexOf("total") === -1) {
          result.value[index] = taxResult.value;
          taxResult.elementPath.taxtype = findElementPath($, taxResult.elementPath.taxtype);
          taxResult.elementPath.tax_cost = findElementPath($, taxResult.elementPath.tax_cost);
          result.elementPath[index] = taxResult.elementPath;
          result.template[index] = taxResult.template;
          index++;
        }
      }

      // add middle result
      result.value[index] = tempResult.value;
      result.elementPath[index] = tempResult.elementPath;
      result.template[index] = tempResult.template;
      index++;

      var nextRows = taxRowElement.nextAll();
      for (var i = 0; i < nextRows.length; i++) {
        var row = $(nextRows[i]);

        var taxResult = calculateTaxRow(row, taxElementPath, taxTextNodeOrder, valueElementPath, valueTextNodeOrder);
        // only add if result doesn't contain total
        if (taxResult != null && taxResult.value.taxtype.toLowerCase().indexOf("total") === -1) {
          result.value[index] = taxResult.value;
          taxResult.elementPath.taxtype = findElementPath($, taxResult.elementPath.taxtype);
          taxResult.elementPath.tax_cost = findElementPath($, taxResult.elementPath.tax_cost);
          result.elementPath[index] = taxResult.elementPath;
          result.template[index] = taxResult.template;
          index++;
        }
      }

      // stop searching for earlier instances of keyword
      break;
    } else {
      // setup for another iteration of search
      taxElementPath = null;
      lastIndex = lowerText.lastIndexOf(keyword, lastIndex - 1);
    }
  }

  //"Payment made"? how to detect this type

  //Duplicate payment informations? - take last instance on page
  //Check by duplicate name & remove.

  //Cross-reference values with receipt items to ensure no duplicates.
  // or just let user delete them

  // shipping&handling is taxed, should be separate?
  // this method of getting by rows

  // amazon canada uses BR-delimited strings
  // evernote some will be fixed by removing receipt item values? - unless there are no templates

  if (result != null) {
    return result;
  } else {
    return { value: "", elementPath: null };
  }
}

function calculateTaxRow(row, taxElementPath, taxTextNodeOrder, valueElementPath, valueTextNodeOrder) {
  var tax;
  var value;
  var taxElement;
  var valueElement;
  var taxTemplate = {};
  var valueTemplate = {};

  // traverse elementPath for row, see if matches
  var taxElement = traverseElementPath(row, taxElementPath);
  if (taxElement == null || taxElement[0].children.length <= taxTextNodeOrder) {
    return null;
  }

  var textNode = taxElement[0].children[taxTextNodeOrder];
  if (textNode.type !== "text") {
    return null;
  }

  tax = textNode.data.trim();
  // trim numbers from tax
  tax = tax.replace(/[0-9.\-]/g, " ").trim();

  taxTemplate.start = textNode.data.trim().indexOf(tax);
  if (taxTemplate.start === -1) {
    taxTemplate.start = 0;
  }
  taxTemplate.end = taxTemplate.start + tax.length;

  tax = tax.replace(/\s+/g, " ");

  // valueElement is not the same as taxElement
  if (valueElementPath != null) {
    valueElement = traverseElementPath(row, valueElementPath);
  } else {
    valueElement = taxElement;
  }

  if (valueElement == null || valueElement[0].children.length <= valueTextNodeOrder) {
    return null;
  }

  textNode = valueElement[0].children[valueTextNodeOrder];
  if (textNode.type !== "text") {
    return null;
  }

  var valueNumbers = textNode.data.replace(/[^0-9.\-]/g, " ").replace(/\s+/g, " ").replace(/[-]\s+/g, "-").trim();

  var startIndex = 0;
  var endIndex = valueNumbers.indexOf(" ");

  // iterate through valueNumbers until the end or until value is valid
  var valueFound = false;
  while (endIndex !== -1) {
    value = valueNumbers.substring(startIndex, endIndex);

    if (value.length > 0 && !isNaN(parseFloat(value))/* && parseFloat(value) >= 0*/) {
      valueFound = true;
      break;
    } else {
      startIndex = endIndex + 1;
      endIndex = valueNumbers.indexOf(" ", startIndex);
    }
  }

  // final number in valueNumbers
  if (!valueFound) {
    value = valueNumbers.substring(startIndex);
    if (value.length > 0 && !isNaN(parseFloat(value))/* && parseFloat(value) >= 0*/) {
      valueFound = true;
    }
  }

  // add to results
  if (valueFound) {
    // matchValue alters start calculation for "-" symbol in front
    var matchValue;
    if (value.indexOf("-") !== -1) {
      matchValue = value.replace(/-/g, "");
    }

    if (matchValue != null) {
      valueTemplate.start = textNode.data.trim().indexOf(matchValue);
      if (valueTemplate.start === -1) {
        valueTemplate.start = 0;
      }
      valueTemplate.end = valueTemplate.start + matchValue.length;

      while (textNode.data.trim().charAt(valueTemplate.start) !== "-" || valueTemplate.start !== 0) {
        valueTemplate.start = valueTemplate.start - 1;
      }
    } else {
      valueTemplate.start = textNode.data.trim().indexOf(value);
      if (valueTemplate.start === -1) {
        valueTemplate.start = 0;
      }
      valueTemplate.end = valueTemplate.start + value.length;
    }

    return { value: { taxtype: tax, tax_cost: value }, elementPath: { taxtype: taxElement[0], tax_cost: valueElement[0] }, template: { taxtype: taxTemplate, tax_cost: valueTemplate} };
  } else {
    return null;
  }
}

// given a template result, finds start node index with element, start, and end
// startNodeIndex is the index of 1st text node in document containing result
function findStartNodeIndex($, textNodes, elementPath, start, end) {
  var element = traverseElementPath($("body").eq(0), elementPath);

  // iterate through textNodes until parent is contained in element
  // once textNode parent is contained in element, start count for start/end
  var count = 0;
  for (var index = 0; index < textNodes.length; index++) {
    if (contains(element[0], textNodes[index].parent)) {
      if (count === 0) {
        count += textNodes[index].data.trim().length;
      } else {
        count += textNodes[index].data.trim().length + 1;
      }

      if (count > start) {
        return index;
      }
    }
  }
}

// returns elementPath from root element till closestRowElement
// returns null if there is no row element parent
function findClosestRowElement(element) {
  // initial elementPath, implies that root element is a row element
  var elementPath = [];
  var matchFound = matchRowTag(element[0].name);

  while (matchFound == null) {
    if (element.parent().length === 0) {
      return null;
    }
    var order = element.prevAll().length;
    // add order to the beginning of the elementPath
    elementPath.unshift(order);

    element = element.parent();
    matchFound = matchRowTag(element[0].name);
  }

  elementPath.unshift(0);
  return elementPath;
}

function matchRowTag(tag) {
  var rowTags = ["tr", "li", "dl", "dd"];
  for (var i = 0; i < rowTags.length; i++) {
    if (tag === rowTags[i]) {
      return i;
    }
  }
  return null;
}

// first 0 in elementPath is body
function traverseElementPath(element, elementPath) {
  for (var i = 1; i < elementPath.length; i++) {
    var order = elementPath[i];
    element = element.children();
    if (element.length > 0) {
      element = element.eq(order);
      if (element.length === 0) {
        return null;
      }
    } else {
      return null;
    }
  }
  return element;
}


// returns a parent element[0] that contains both element1 and element2 (can be equal to each other)
// parameters are cheerio elements
function findParent(element1, element2) {
  // check if elements are equal
  if (element1[0] === element2[0]) {
    return element1[0];
  }

  var parents1 = element1.parents();
  var parents2 = element2.parents();

  // check if element2 is a parent of element1
  for (var i = 0; i < parents1.length; i++) {
    if (element2[0] === parents1[i]) {
      return parents1[i];
    }
  }

  // check if element1 is a parent of element2
  for (var j = 0; j < parents2.length; j++) {
    if (element1[0] === parents2[j]) {
      return parents2[j];
    }
  }

  // check for closest parent of both element1 and element2
  for (var i = 0; i < parents1.length; i++) {
    for (var j = 0; j < parents2.length; j++) {
      if (parents1[i] === parents2[j]) {
        return parents1[i];
      }
    }
  }

  return null;
}

// replacement for jquery contains function
// parameters are element[0]'s of cheerio
function contains(container, contained) {
  if (contained === container) {
    return true;
  }

  while (contained.parent != null) {
    contained = contained.parent;
    if (contained === container) {
      return true;
    }
  }

  return false;
}

// initializes textNodes and retrieves document text
function initializeContentSearch($, callback) {
  var selector = "body",
      params = { "text": "", "trim": true, "textNodes": [] };

  // iterate through all children of body element
  if ($(selector).length > 0) {
    var children = $(selector)[0].children;
    for (var i = 0; i < children.length; i++) {
      params = iterateText($, children[i], initTextNodes, params);
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

function iterateText($, node, method, methodParams) {
  // run method for non-whitespace text nodes
  if (node.type === "text" && /\S/.test(node.data)) {
    methodParams = method(node, methodParams);
  }
  // exception case to include whitespace text nodes
  else if (node.type === "text" && methodParams.whitespace !== undefined) {
    methodParams = method(node, methodParams);
  }
  // iterateText through children of non-style/script elements
  else if (node.type === "tag" && node.children.length > 0 && !/(style|script|select)/i.test(node.name)) {
    var style = $(node).css();
    if (style.visibility !== "hidden" && style.display !== "none") {
      var children = node.children;
      for (var i = 0; i < children.length; i++) {
        methodParams = iterateText($, children[i], method, methodParams);
        if (methodParams.result != null && methodParams.result === false) {
          break;
        }
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
      params = iterateText($, children[i], findMatch, params);
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
    if (startNodeIndex != null && startNodeIndex === textNodesBackIndex + 1) {
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

      var targetParent = findParent($(startParent), $(endParent));
      if (targetParent == null) {
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
        } else {
          continue;
        }
      }

      // set startNode to node before the parent we are calculating with
      if (textNodesBackIndex !== -1) {
        startNode = textNodes[textNodesBackIndex];
        textNodesBackIndex--;

        var startElement = startNode.parent;

        // continue adding text length to startIndex until parent elements are not contained in targetParent
        while (contains(targetParent, startElement) && textNodesBackIndex !== -1) {
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

// modify start or end index by relative change index
// change is expected to be valid in the scope of textNodes
function alterSearchData(modifyFrom, change, data, textNodes) {
  if (modifyFrom === "start") {
    var finalIndex = data.start + change;

    // new index is < than old, startNodeIndex decreased
    if (finalIndex < 0) {
      // make finalIndex # of characters from end of previous textNode
      finalIndex += data.start;

      // keep iterating back startNodeIndex until finalIndex is a positive index
      while (finalIndex < 0) {
        data.startNodeIndex = data.startNodeIndex - 1;
        finalIndex += textNodes[data.startNodeIndex].data.trim().length + 1;
      }
    }
    // new index is > than old, startNodeIndex maybe increased
    else if (finalIndex > 0) {
      while (finalIndex > textNodes[data.startNodeIndex].data.trim().length) {
        finalIndex -= textNodes[data.startNodeIndex].data.trim().length + 1;
        data.startNodeIndex = data.startNodeIndex + 1;
      }
    }

    // set start index
    data.start = finalIndex;
  } else if (modifyFrom === "end") {
    var finalIndex = data.end + change;

    // new index is < than old, endNodeIndex decreased
    if (finalIndex < 0) {
      // make finalIndex # of characters from end of previous textNode
      finalIndex += data.end;

      // keep iterating back endNodeIndex until finalIndex is a positive index
      while (finalIndex < 0) {
        data.endNodeIndex = data.endNodeIndex - 1;
        finalIndex += textNodes[data.endNodeIndex].data.trim().length + 1;
      }
    }
    // new index is > than old, endNodeIndex maybe increased
    else if (finalIndex > 0) {
      while (finalIndex > textNodes[data.endNodeIndex].data.trim().length) {
        finalIndex -= textNodes[data.endNodeIndex].data.trim().length + 1;
        data.endNodeIndex = data.endNodeIndex + 1;
      }
    }

    // set end index
    data.end = finalIndex;
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
