var http = require("http"),
sys = require("sys"),
url = require("url"),
qs = require("querystring"),
restify = require("restify");
// Authentication module
auth = require("./routes/auth"),
parse = require("./html_parser"),
compose = require("./html_composer"),
layer = require("./calculation_layer"),
probability = require("./probability"),
// TODO: Change origin to contain chrome extension full url (once ID is set)
originString = "chrome-extension://",
request_count = 0;
var ipAddr = "127.0.0.1";
var port = "8888";

var server;

function start()
{
  server = restify.createServer({name: "aServer"});
  server.use(restify.queryParser());
  server.use(restify.bodyParser());
  // NOTE:Cross Origin Resource sharing, may or may not need this 
  // server.use(restify.CORS());
  
  // Preconditions for all requests
  server.pre(function(req, res, next) {
    // Check the origin string
    var inOriginStr = req.header('origin');
    if (!inOriginStr || inOriginStr.indexOf(originString) === -1) {
      res.send(new Error("Invalid origin."));
      console.log("Invalid Origin : " + req.header('origin'));
      console.log(req.header('origin').indexOf(originString === -1));
    }

    return next();
  });

  // Posting template data
  server.post('/template', function test(req, res, next) {
    console.log("Data received for " + req.params.email);
    // Authorization
    if (req.params.userID !== null && req.params.email !== null && req.params.token !== null) {
      auth.authorizeRequest(req.params.token, req.params.userID, req.params.email, function(result) {
        if (result === true) {
          var attribute_data = JSON.parse(req.params.attributes);
          var generated_data = JSON.parse(req.params.generated);
          var saved_data = JSON.parse(req.params.saved_data);
          setImmediate(probability.compareGeneratedSavedData(req.params.domain, generated_data, saved_data));
          
          // send http request to WebApp
          setImmediate(parse.generateTemplates(req.params.userID, req.params.domain, req.params.url, req.params.html, attribute_data));
          res.header("Content-Type", "text/plain");
          res.send(200, "Authorization Token Accepted");
          console.log("Request Completed");
        }
        // Webapp authentication failed
        else {
          res.send(new Error("Authorization Token Denied"));
          console.log("Request Authorization failed");
        }
      });
    } else {
      res.send(new Error("Missing user credentials"));
      console.log("Missing user credentials");
    }

    return next();
  });

  // Posting html data to load template
  server.post('/load', function test(req, res, next) {
    console.log(req.params.domain + " data received for " + req.params.email);
    // Authorization
    if (req.params.domain === "") {
        res.send(new Error("Invalid domain"));
        console.log("Invalid domain");
        return next();
    } else if (req.params.userID !== null && req.params.email !== null && req.params.token !== null) {
      auth.authorizeRequest(req.params.token, req.params.userID, req.params.email, function(result) {
        if (result === true) {
          // send http request to WebApp
          setImmediate(compose.readTemplate(req.params.userID,
                                            req.params.html,
                                            req.params.url,
                                            req.params.domain,
                                            function(json_message) {
                                              console.log(json_message);
                                              // 2nd layer calculations
                                              layer.applyCalculations(json_message, req.params.html, function(altered_message) {
                                                res.header("Content-Type", "text/plain");
                                                console.log(altered_message);
                                                res.send(200, JSON.stringify(altered_message));
                                                console.log("Request Completed");
                                              });
                                            }));
        }
        // Webapp authentication failed
        else {
          res.send(new Error("Authorization Token Denied"));
          console.log("Request Authorization failed");
        }
      });
    } else {
      res.send(new Error("Missing user credentials"));
      console.log("Missing user credentials");
    }

    return next();
  });
  
  // Start listening
  server.listen(port, ipAddr, function() {
    console.log("%s listening at %s", server.name, server.url);
  });
  console.log("Server Started");
}

function incrementRequestCount() {
  request_count++;
  console.log("Concurrent Requests: " + request_count);
}

function decrementRequestCount() { request_count--; }

module.exports = {
  start: start
};
