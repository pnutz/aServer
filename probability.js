var Template = require("./model/template"),
TemplateDomain = require("./model/template_domain"),
TemplateGroup = require("./model/template_group"),
Access = require("./model/simple_table"),
async = require("async");

exports.compareGeneratedSavedData = function(domain, generatedData, savedData) {
  var domain_id;

  async.series([
    // get domain id
    function(series_callback) {
      Access.getIdByValue("ser_domain", "domain_name", domain, function(access_domain_id) {
        if (access_domain_id !== null) {
          domain_id = access_domain_id;
          series_callback();
        } else {
          series_callback(new Error("invalid domain"));
        }
      });
    },
    // check for changes to generatedData in savedData
    function(series_callback) {
      var template_groups = {};
      var keys = Object.keys(generatedData);

      async.eachSeries(keys, function(key, callback) {
        if (key !== "items" && key !== "templates") {
          if (generatedData.templates[key] !== null) {
            // user has changed generated data
            if (savedData.hasOwnProperty(key) && savedData[key] !== generatedData[key]) {
              TemplateDomain.getTemplateDomainByIds(domain_id, generatedData.templates[key], function(template_domain) {
                console.log("------------- decrease probability for " + key + " template_domain -------------");
                template_domain.total_count++;
                template_domain.probability_success = template_domain.correct_count / template_domain.total_count;
                template_domain.save(callback);
              });
            }
            // user used generated data
            else {
              TemplateDomain.getTemplateDomainByIds(domain_id, generatedData.templates[key], function(template_domain) {
                console.log("------------- increase probability for " + key + " template_domain -------------");
                template_domain.correct_count++;
                template_domain.total_count++;
                template_domain.probability_success = template_domain.correct_count / template_domain.total_count;
                template_domain.save(callback);
              });
            }
          } else {
            callback();
          }
        } else if (key === "items") {
          var template_groups = {};
          var item_keys = Object.keys(generatedData.items);
          async.eachSeries(item_keys, function(item_key, each_callback) {
            if (generatedData.templates.items[item_key] !== null) {
              var item_attributes = generatedData.items[item_key];
              var attribute_keys = Object.keys(item_attributes);
              async.eachSeries(attribute_keys, function(attribute_key, each_callback2) {
                if (generatedData.templates.items[item_key][attribute_key] !== null) {
                  // user deleted item generated
                  if (generatedData.templates.items[item_key].hasOwnProperty("deleted") ||
                      // or user has changed item attribute data
                      (savedData.items[item_key][attribute_key] !== null && savedData.items[item_key][attribute_key] !== item_attributes[attribute_key])) {
                    async.series([
                      function(series_callback2) {
                        Template.getTemplateById(generatedData.templates.items[item_key][attribute_key], function(err, template) {
                          if (err) {
                            series_callback2(err);
                          } else {
                            if (template_groups[template.template_group_id] === null) {
                              template_groups[template.template_group_id] = true;
                            }
                            series_callback2();
                          }
                        });
                      },
                      function(series_callback2) {
                        TemplateDomain.getTemplateDomainByIds(domain_id, generatedData.templates.items[item_key][attribute_key], function(template_domain) {
                          console.log("------------- decrease probability for " + attribute_key + " template_domain -------------");
                          template_domain.total_count++;
                          template_domain.probability_success = template_domain.correct_count / template_domain.total_count;
                          template_domain.save(series_callback2);
                        });
                      }
                    ], function(err, results) {
                      if (err) {
                        console.log(err.message);
                      }
                      each_callback2();
                    });
                  }
                  // item was saved
                  else {
                    async.series([
                      function(series_callback2) {
                        Template.getTemplateById(generatedData.templates.items[item_key][attribute_key], function(err, template) {
                          if (err) {
                            series_callback2(err);
                          } else {
                            if (template_groups[template.template_group_id] === null) {
                              template_groups[template.template_group_id] = true;
                            }
                            series_callback2();
                          }
                        });
                      },
                      function(series_callback2) {
                        TemplateDomain.getTemplateDomainByIds(domain_id, generatedData.templates.items[item_key][attribute_key], function(template_domain) {
                          console.log("------------- increase probability for " + attribute_key + " template_domain -------------");
                          template_domain.correct_count++;
                          template_domain.total_count++;
                          template_domain.probability_success = template_domain.correct_count / template_domain.total_count;
                          template_domain.save(series_callback2);
                        });
                      }
                    ], function(err, results) {
                      if (err) {
                        console.log(err.message);
                      }
                      each_callback2();
                    });
                  }
                } else {
                  each_callback2();
                }
              }, function(err) {
                if (err) {
                  console.log(err.message);
                }

                // track grouped templates probability
                var group_keys = Object.keys(template_groups);
                async.eachSeries(group_keys, function(group_key, each_callback2) {
                  TemplateGroup.getTemplateGroupById(group_key, function(group) {
                    if (group !== null) {
                      group.correct_count = 0;
                      group.total_count = 0;
                      // loop through template_group template's template_domains
                      TemplateDomain.getTemplateDomainsByGroup(group.id, function(template_domains) {
                        if (template_domains !== null) {
                          async.eachSeries(template_domains, function(template_domain, each_callback3) {
                            group.correct_count += template_domain.correct_count;
                            group.total_count += template_domain.total_count;
                            each_callback3();
                          }, function(err) {
                            if (err) {
                              console.log(err.message);
                            }

                            group.probability_success = group.correct_count / group.total_count;
                            group.save(each_callback2);
                          });
                        } else {
                          each_callback2();
                        }
                      });
                    } else {
                      each_callback2();
                    }
                  });
                }, function(err) {
                  if (err) {
                    console.log(err.message);
                  }
                  each_callback();
                });
              });
            } else {
              each_callback();
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
