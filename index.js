const proxy = require("express-http-proxy");
const app = require("express")();
const port = process.env.PORT || 9000;

// the methods dosn't need to be dependency
// because the express will also install it
const methods = require("methods");

// for test make the root of the site on get request
// will return the succuss msg
// it's optional
app.get("/", (req, res) => res.send(" the route page "));

// the route that you want to be the proxy
// by default is the /proxy
const proxyRoute = "/proxy";

// proxy Handler
app.use(`${proxyRoute}*`, (req, res, next) => {
	const originURL = req.originalUrl;

	// get the requested url
	const proxyUrlTrimmer = (url) =>
		url.replace(new RegExp(`\/?${proxyRoute}\/?`, "i"), "");
	const proxyUrlTrimmerResolver = (req) => proxyUrlTrimmer(req.originalUrl);

	let userReqURL = proxyUrlTrimmer(originURL),
		userURL = "";

	// cheack for if it's url
	try {
		userURL = new URL(userReqURL);
	} catch (e) {
		return res.status(425).send("bad url passed");
	}

	const userResHeaderDecorator = (
		headers,
		userReq,
		userRes,
		proxyReq,
		proxyRes
	) => {
		const origin = proxyRes.req?.protocol + "//" + proxyRes.req?.host;
		if ("location" in headers) {
			const loc = headers.location;
			let theURL = loc;
			// check if valid locaiton
			try {
				new URL(loc);
			} catch (e) {
				theURL = new URL(loc, origin);
			}
			headers.location = theURL;
		}
		headers["Access-Control-Allow-Origin"] = "*";
		headers["Cross-Origin-Resource-Policy"] = "cross-origin";
		// set domin for cookies to the main requested host
		if ("set-cookie" in headers) {
			const host = proxyRes.req?.host;
			for (var i = 0; i < headers["set-cookie"].length; i++) {
				let theCookie = headers["set-cookie"][i];
				const isHaveDomin = !!theCookie.match(/domain\=(?!;).*;/gi);
				if (isHaveDomin) continue;

				theCookie = theCookie.trim();
				theCookie = theCookie.endsWith(";")
					? theCookie
					: theCookie + ";";
				theCookie = theCookie + ` domain=${host};`;
				headers["set-cookie"][i] = theCookie;
			}
		}
		return headers;
	};

	// URL re-writer
	const changeUrl = (req, url) => {
		const parsedUrl = new URL(url);
		req.url = url;
		req.originalUrl = url;
		req.path = parsedUrl.pathname;
		req.search = parsedUrl.search;
		req._parsedUrl = parsedUrl;
		const query = {};
		for (const entry of parsedUrl.searchParams) {
			query[entry[0]] = entry[1];
		}
		req.query = query;
	};

	// set up user configs
	let userCustomHeader = userURL.searchParams.get("mqproxy_headers");
	let userCustomMethod = userURL.searchParams.get("mqproxy_method");
	// add custom header
	if (userCustomHeader) {
		try {
			userCustomHeader = JSON.parse(
				decodeURIComponent(userCustomHeader.trim())
			);

			Object.entries(userCustomHeader).forEach(
				([headerKey, headerValue]) => {
					req.headers[headerKey] = headerValue;
				}
			);
		} catch {}
		userURL.searchParams.delete("mqproxy_headers");
	}
	// add user custom method
	if (userCustomMethod) {
		try {
			const validMethods = methods;
			const userMethod = userCustomMethod.trim().toLowerCase();
			if (validMethods.includes(userMethod)) {
				req.method = userMethod.toUpperCase();
			}
		} catch {}
		userURL.searchParams.delete("mqproxy_method");
	}

	// rewrite URL to request
	userURL = userURL.toString();

	changeUrl(req, userURL);
	// send through the proxy
	return proxy(userURL, {
		proxyReqPathResolver: proxyUrlTrimmerResolver,
		memoizeHost: false,
		userResHeaderDecorator,
	})(req, res, next);
});

// your code here
// ...

app.listen(port);
