var http = require("http"),
TIMEOUT_CONST = 10000;
DEBUG_FLAG = true;

function authorizeRequest(token, userID, email, callback) {
	var options = {
		host: "localhost",
		port: "3000",
		// replace path with authentication method
		path: "/currencies.json?email=" + email + "&token=" + token
	};

  if (DEBUG_FLAG) {
    callback(true);
    return;
  }
	var request = http.get(options, function(response) {
		var str = "";
		response.on("data", function (chunk) {
			str += chunk;
			clearTimeout(timeout);
			timeout = setTimeout(to_wrap, TIMEOUT_CONST);
		});
		
		response.on("end", function () {
			console.log("Finished sending http request to WebApp:");
			// print out authentication server response
			console.log(str + "\n");
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
	var timeout = setTimeout(to_wrap, TIMEOUT_CONST);
	
	request.end();
};

function timeout_wrapper(request) {
	return function() {
		// logging, cleaning, depending on request
		console.log("Request Timeout");
		// calls response.on(error)
		request.abort();
	};
}

module.exports = {
	authorizeRequest: authorizeRequest
};
