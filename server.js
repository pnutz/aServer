var http = require("http"),
sys = require("sys"),
url = require("url"),
qs = require("querystring"),
// Authentication module
auth = require("./routes/auth"),
parse = require("./html_parser"),
// TODO: Change origin to contain chrome extension full url (once ID is set)
originString = "chrome-extension://",
request_count = 0;

function start() {
	function onRequest(request, response) {
		var pathname = url.parse(request.url).pathname;
		console.log("Request for " + pathname + " received");

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
				decrementRequestCount();
			
				// ignore favicon requests
				if (pathname !== "/favicon.ico") {
					var post = qs.parse(requestBody);
					console.log(post);
					
					// send http request to WebApp
					if (post.userID != null && post.email != null && post.token != null) {
						auth.authorizeRequest(post.token, post.userID, post.email, function (result) {

							/*if (result === true)
							{*/
								parse.createTemplate(post.userID, post.selection, post.element, post.html, post.text, post.url, post.domain)
							
							/*	// request response
								response.writeHead(200, {"Content-Type": "text/plain"});
								response.end("Authorization Token Accepted");
							}
							else
							{
								// request response
								response.writeHead(200, {"Content-Type": "text/plain"});
								response.end("Authorization Token Denied");
							}*/
							response.writeHead(200, {"Content-Type": "text/plain"});
							response.end("Authorization Token Accepted");
						});
					}
					console.log("Request End");
				}
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

	http.createServer(onRequest).listen(8888);
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