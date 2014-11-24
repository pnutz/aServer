var http = require("http");
var sys = require("sys");
var url = require("url");
var qs = require("querystring");
var restify = require("restify");
// Authentication module
var auth = require("./routes/auth");
var parse = require("./html_parser");
var compose = require("./html_composer");
var layer = require("./calculation_layer");
var probability = require("./probability");
// TODO: Change origin to contain chrome extension full url (once ID is set)
var originString = "chrome-extension://";
var requestCount = 0;
//var ipAddr = "127.0.0.1";
var port = (process.env.PORT || "8888");

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
    if (req.params.userID != null && req.params.email != null && req.params.token != null) {
      auth.authorizeRequest(req.params.token, req.params.userID, req.params.email, function(result) {
        if (result === true) {
          var attributeData = JSON.parse(req.params.attributes);
          var generatedData = JSON.parse(req.params.generated);
          var savedData = JSON.parse(req.params.savedData);
          probability.compareGeneratedSavedData(req.params.domain, generatedData, savedData);

          // send http request to WebApp
          parse.generateTemplates(req.params.userID, req.params.domain, req.params.url, req.params.html, attributeData);
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
    } else if (req.params.userID != null && req.params.email != null && req.params.token != null) {
      auth.authorizeRequest(req.params.token, req.params.userID, req.params.email, function(result) {
        if (result === true) {
          // send http request to WebApp
          compose.readTemplate(req.params.userID,
                               req.params.html,
                               req.params.url,
                               req.params.domain,
                               function(jsonMessage) {
                                 console.log(jsonMessage);
                                 // 2nd layer calculations
                                 layer.applyCalculations(jsonMessage, req.params.html, req.params.domain, function(alteredMessage) {
                                   res.header("Content-Type", "text/plain");
                                   console.log(alteredMessage);
                                   res.send(200, JSON.stringify(alteredMessage));
                                   console.log("Request Completed");
                                 });
                               });
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
  server.listen(port, function() {
    console.log("%s listening at %s", server.name, server.url);
  });
  console.log("Server Started");
}

function incrementRequestCount() {
  requestCount++;
  console.log("Concurrent Requests: " + requestCount);
}

function decrementRequestCount() { requestCount--; }

module.exports = {
  start: start
};
