var Template = require("./model/template"),
TemplateDomain = require("./model/template_domain"),
TemplateGroup = require("./model/template_group"),
Access = require("./model/simple_table"),
async = require("async");

exports.compareGeneratedSavedData = function(domain, generated_data, saved_data) {
  var domain_id;
  
  async.series([
    // get domain id
    function(series_callback) {
      Access.getIdByValue("ser_domain", "domain_name", domain, function(access_domain_id) {
        if (access_domain_id != null) {
          domain_id = access_domain_id;
          series_callback();
        } else {
          series_callback(new Error("invalid domain"));
        }
      });
    },
    // check for changes to generated_data in saved_data
    function(series_callback) {
      var keys = Object.keys(generated_data);
      async.eachSeries(keys, function(key, callback) {
        if (key != "items" && key != "templates") {
          // user has changed generated data
          if (saved_data.hasOwnProperty(key) && saved_data[key] != generated_data[key]) {
            TemplateDomain.getTemplateDomainByIds(domain_id, generated_data.templates[key], function(template_domain) {
              template_domain.total_count++;
              template_domain.probability_success = template_domain.correct_count/template_domain.total_count;
              template_domain.save(callback);
            });
          } else {
            callback();
          }
        } else if (key == "items") {
          var item_keys = Object.keys(generated_data.items);
          async.eachSeries(item_keys, function(item_key, each_callback) {
            // user deleted item generated
            if (generated_data.items[item_key].hasOwnProperty("deleted")) {
              
            } else {
              var item_attributes = generated_data.items[item_key];
              var attribute_keys = Object.keys(item_attributes);
              async.eachSeries(attribute_keys, function(attribute_key, each_callback2) {
                // user has changed item attribute data
                if (saved_data.items[item_key][attribute_key] != item_attributes[attribute_key]) {
                  
                  // generated_data.templates.items[item_key][attribute_key]
                } else {
                  each_callback2();
                }
              }, function(err) {
                if (err) {
                  console.log(err.message);
                }
                each_callback();
              });
            }
          }, function(err) {
            if (err) {
              console.log(err.message);
            }
            callback();
          });
        } else {
          callback();
        }
      }, function(err) {
        if (err) {
          console.log(err.message);
        } else {
          console.log("Completed compareGeneratedSavedData method");
        }
        series_callback();
      });
    }
  ],
  function(err, results) {
    if (err) {
      console.log(err.message);
    }
  });
};

function decreaseTemplateProbability() {

}

function increaseTemplateProbability() {

}