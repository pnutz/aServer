exports.authorizeRequest = function (token, userID, email, callback) {
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
};
