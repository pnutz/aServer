var http = require("http"),
url = require("url"),
qs = require("querystring"),
request_count = 0;

exports.start = function start() {
	function onRequest(request, response) {
		var pathname = url.parse(request.url).pathname;
		console.log("Request for " + pathname + " received");

		incrementRequestCount();
		
		// looking for POST requests from chrome extension (set url to include extensionID once that is defined)
		if (request.method == "POST" && request.headers.origin.indexOf("chrome-extension://") !== -1) {		
			var requestBody = "";
			// load request data
			request.on("data", function(data) {
				console.log("data");
				requestBody += data;
				// string too long, destroy connection! can flood RAM
				if (requestBody.length > 1e6) {
					requestBody = "";
					response.writeHead(413, {"Content-Type": "text/plain"}).end();
					request.connection.destroy();
				}
			});
			
			// client finished sending request
			request.on("end", function() {
				// ignore favicon requests
				if (pathname !== "/favicon.ico") {
					console.log("querystring parse");
					var post = qs.parse(requestBody);
					console.log(post);
					
					decrementRequestCount();
					
					// send http request to WebApp
					if (post.userID != null && post.email != null && post.token != null) {
						authorizeRequest(post.token, post.userID, post.email, function (result) {
							if (result === true)
							{
								// request response
								response.writeHead(200, {"Content-Type": "text/plain"});
								response.end("Authorization Token Accepted");
							}
							else
							{
								// request response
								response.writeHead(200, {"Content-Type": "text/plain"});
								response.end("Authorization Token Denied");
							}
						});
					}
					console.log("Request End");
					response.writeHead(200, {"Content-Type": "text/plain"});
					response.write("here");
					response.write("this");
					response.end("Response End");
				}
			});
		}
		else
		{
			// request response
			response.writeHead(200, {"Content-Type": "text/plain"});
			response.end("Invalid Request");
			
			decrementRequestCount();
		}
		request.resume();
	}

	http.createServer(onRequest).listen(8888);
	console.log("Server has started");
};

function incrementRequestCount() {
	request_count++;
	console.log("Concurrent Requests: " + request_count);
}

function decrementRequestCount() { request_count--; }

function timeout_wrapper(request) {
	return function() {
		// logging, cleaning, depending on request
		console.log("Request Timeout");
		// calls response.on(error)
		request.abort();
	};
}

// authorize chrome extension request with webapp
function authorizeRequest(token, userID, email, callback) {
	var options = {
		host: "localhost",
		// replace path with authentication method
		path: "/currencies.json?email=" + email + "&token=" + token,
		port: "3000"
	};

	var request = http.get(options, function(response) {
		var str = "";
		response.on("data", function (chunk) {
			str += chunk;
			clearTimeout(timeout);
			timeout = setTimeout(to_wrap, 10000);
		});
		
		response.on("end", function () {
			console.log("Finished sending http request to WebApp:");
			console.log(str);
			clearTimeout(timeout);
			// if response was false, return callback(false)
			callback(true);
		});
		
		response.on("error", function (error) {
			console.log("Got error: " + error.message);
			clearTimeout(timeout);
			callback(false);
		});
	});
	
	var to_wrap = timeout_wrapper(request);
	var timeout = setTimeout(to_wrap, 10000);
	
	request.end();
}

// post data to chrome extension
function postData() {
	
}