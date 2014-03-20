var http = require("http"),
sys = require("sys"),
url = require("url"),
qs = require("querystring"),
restify = require("restify");
// Authentication module
auth = require("./routes/auth"),
parse = require("./html_parser"),
// TODO: Change origin to contain chrome extension full url (once ID is set)
originString = "chrome-extension://",
request_count = 0;
var ipAddr = "127.0.0.1";
var port = "8888";

var server;

function start()
{
  server = restify.createServer({name: "aServer"})
  server.use(restify.queryParser());
  server.use(restify.bodyParser());
  //NOTE:Cross Origin Resource sharing, may or may not need this 
  //server.use(restify.CORS());
  
  //Preconditions for all requests
  server.pre(function(req, res, next) {
    //Check the origin string
    var inOriginStr = req.header('origin');
    if (!inOriginStr || inOriginStr.indexOf(originString) === -1) 
    {
      res.send(new Error("Invalid origin."));
      console.log("Invalid Origin : " + req.header('origin'));
      console.log(req.header('origin').indexOf(originString === -1));
    }

    return next();
  });

  //Posting template data
  server.post('/template', function test(req, res, next) {
    console.log(req.params.attribute + " data received for " + req.params.email);
    //Authorization
    if (req.params.userID != null && req.params.email != null && req.params.token != null) 
    {
      auth.authorizeRequest(req.params.token, req.params.userID, req.params.email, function(result) {
        if (result === true) 
        {
          // send http request to WebApp
          setImmediate(parse.generateTemplate(req.params.userID, 
                                              req.params.attribute, 
                                              req.params.selection, 
                                              req.params.element, 
                                              req.params.html, 
                                              req.params.text, 
                                              req.params.url, 
                                              req.params.domain));
          res.header("Content-Type", "text/plain");
          res.send(200, "Authorization Token Accepted");
          console.log("Request Completed");
        }
        else //Webapp authentication failed
        {
          res.send(new Error("Authorization Token Denied"));
          console.log("Request Authorization failed");
        }
      });
    }
    else
    {
      res.send(new Error("Missing user credentials"));
      console.log("Missing user credentials");
    }

    return next();
  });

  //Start listening
  server.listen(port, ipAddr, function() {
    console.log("%s listening at %s", server.name, server.url);
  });

  //Keeping this here until we are sure the behavior is sufficiently reproduced using Restify -ohou
  /*
  function onRequest(request, response) {
    var pathname = url.parse(request.url).pathname;
    console.log("Request for " + pathname + " received");

    //Not from chome extension, ignore
    if (request.headers.origin.indexOf(originString === -1)) {
      console.log("Request for " + pathname + " received");
    }

    incrementRequestCount();
    
    
    
    // POST request
    if (request.method == "POST" && request.headers.origin.indexOf(originString) !== -1) {    
      var requestBody = "";
      // load request data
      request.on("data", function(data) {
        requestBody += data;
        // string too long, destroy connection! can flood RAM
        if (requestBody.length > 1e6) {
          requestBody = "";
          response.writeHead(413);
          response.end();
          request.connection.destroy();
        }
      });
      
      // client finished sending request
      request.on("end", function() {      
        // ignore favicon requests
        if (pathname !== "/favicon.ico") {
          var post = qs.parse(requestBody);
          console.log(post.attribute + " data received for " + post.email);
          //console.log(post);
          
          // send http request to WebApp
          if (post.userID != null && post.email != null && post.token != null) {
            auth.authorizeRequest(post.token, post.userID, post.email, function(result) {
              if (result === true) {
                // request response
                //response.writeHead(200, {"Content-Type": "text/plain"});
                //response.end("Authorization Token Accepted");
              } else {
                // request response
                //response.writeHead(200, {"Content-Type": "text/plain"});
                //response.end("Authorization Token Denied");
              }
              
              setImmediate(parse.generateTemplate(post.userID, post.attribute, post.selection, post.element, post.html, post.text, post.url, post.domain));
              
              response.writeHead(200, {"Content-Type": "text/plain"});
              response.end("Authorization Token Accepted");
              decrementRequestCount();
              console.log("Request Completed");
            });
          }
          console.log("Request End");
        }
      });
      
      request.on("error", function(err) {
        console.log(err);
      });
    }
    else
    {
      // request response
      response.writeHead(404);
      response.end();
      
      decrementRequestCount();
    }
    request.resume();
  }

  http.createServer(onRequest).listen(8888);*/
  console.log("Server Started");
};

function incrementRequestCount() {
  request_count++;
  console.log("Concurrent Requests: " + request_count);
}

function decrementRequestCount() { request_count--; }

module.exports = {
  start: start
};
