//@ts-nocheck
var fetchInterceptor = function (r) { function n(e) { if (t[e]) return t[e].exports; var o = t[e] = { exports: {}, id: e, loaded: !1 }; return r[e].call(o.exports, o, o.exports, n), o.loaded = !0, o.exports; } var t = {}; return n.m = r, n.c = t, n.p = "", n(0); }([function (r, n, t) { (function (n, e) { "use strict"; function o(r) { if (Array.isArray(r)) { for (var n = 0, t = Array(r.length); n < r.length; n++)t[n] = r[n]; return t; } return Array.from(r); } function i(r) { if (!r.fetch) try { t(2); } catch (n) { throw Error("No fetch avaibale. Unable to register fetch-intercept"); } r.fetch = function (r) { return function () { for (var n = arguments.length, t = Array(n), e = 0; n > e; e++)t[e] = arguments[e]; return f.apply(void 0, [r].concat(t)); }; }(r.fetch); } function f(r) { for (var n = arguments.length, t = Array(n > 1 ? n - 1 : 0), e = 1; n > e; e++)t[e - 1] = arguments[e]; var i = l.reduce(function (r, n) { return [n].concat(r); }, []), f = Promise.resolve(t); return i.forEach(function (r) { var n = r.request, t = r.requestError; (n || t) && (f = f.then(function (r) { return n.apply(void 0, o(r)); }, t)); }), f = f.then(function (n) { return r.apply(void 0, o(n)); }), i.forEach(function (r) { var n = r.response, t = r.responseError; (n || t) && (f = f.then(n, t)); }), f; } var u = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (r) { return typeof r; } : function (r) { return r && "function" == typeof Symbol && r.constructor === Symbol ? "symbol" : typeof r; }, c = "object" === ("undefined" == typeof navigator ? "undefined" : u(navigator)) && "ReactNative" === navigator.product, s = "object" === ("undefined" == typeof n ? "undefined" : u(n)) && !0, a = "object" === ("undefined" == typeof window ? "undefined" : u(window)), p = "function" == typeof importScripts; if (c) i(e); else if (p) i(self); else if (a) i(window); else { if (!s) throw new Error("Unsupported environment for fetch-intercept"); i(e); } var l = []; r.exports = { register: function (r) { return l.push(r), function () { var n = l.indexOf(r); n >= 0 && l.splice(n, 1); }; }, clear: function () { l = []; } }; }).call(n, t(1), function () { return this; }()); }, function (r, n) { "use strict"; function t() { s = !1, f.length ? c = f.concat(c) : a = -1, c.length && e(); } function e() { if (!s) { var r = setTimeout(t); s = !0; for (var n = c.length; n;) { for (f = c, c = []; ++a < n;)f && f[a].run(); a = -1, n = c.length; } f = null, s = !1, clearTimeout(r); } } function o(r, n) { this.fun = r, this.array = n; } function i() { } var f, u = r.exports = {}, c = [], s = !1, a = -1; u.nextTick = function (r) { var n = new Array(arguments.length - 1); if (arguments.length > 1) for (var t = 1; t < arguments.length; t++)n[t - 1] = arguments[t]; c.push(new o(r, n)), 1 !== c.length || s || setTimeout(e, 0); }, o.prototype.run = function () { this.fun.apply(null, this.array); }, u.title = "browser", u.browser = !0, u.env = {}, u.argv = [], u.version = "", u.versions = {}, u.on = i, u.addListener = i, u.once = i, u.off = i, u.removeListener = i, u.removeAllListeners = i, u.emit = i, u.binding = function (r) { throw new Error("process.binding is not supported"); }, u.cwd = function () { return "/"; }, u.chdir = function (r) { throw new Error("process.chdir is not supported"); }, u.umask = function () { return 0; }; }, function (r, n) { r.exports = require("whatwg-fetch"); }]);

var validReports = ['/insights', '/arb_funnels', '/retention', '/impact', '/adoption', '/propensity', '/correlate', '/experiments'];
var blacklist = ['confidence'];

function makeABlob(data) {
	return new Blob([data], {
		type: 'application/json'
	});
}

var unregister = fetchInterceptor.register({
	response: async function (response) {
		// console.log('checking fetch request...');
		// intercept requests to report APIs
		if (validReports.some(rep => response.url.includes(rep)) && !blacklist.some(rep => response.url.includes(rep))) {
			

			//clone the response
			var data = await response.clone().json();
			// saveTheFile(data);

			//mutate
			mutateIntegersInJSON(data, val => val * 50 + getRandomInt(100-1));	
			console.log('mp-tweaks: 100X!');					
			var blob = makeABlob(JSON.stringify(data));

			//use
			return new Response(blob);
		}
		//don't do anything for requests that aren't to /insights, etc..
		else {
			return response;
		}
	}
});

function mutateIntegersInJSON(jsonObj, mutationFn) {
    // Base cases for recursion
    if (typeof jsonObj !== "object" || jsonObj === null) {
        return;
    }

    // Check if the key matches a date pattern or is "all" or "count"
    function isDateOrAllOrCount(key) {
        // A regex pattern for dates in the format "YYYY-MM-DDTHH:MM:SS+ZZ:ZZ"
        const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
        // A simpler regex pattern for dates like "2023-10-07"
        const simplerDatePattern = /^\d{4}-\d{2}-\d{2}$/;
        return datePattern.test(key) || simplerDatePattern.test(key) || key === "all" || key === "counts" || key === "count";
    }

    for (const key in jsonObj) {
        if (Array.isArray(jsonObj[key]) && isDateOrAllOrCount(key)) {
            // If the key matches and the value is an array
            jsonObj[key] = jsonObj[key].map(val => {
                if (Number.isInteger(val)) {
                    // Apply the mutation function to each integer in the array
                    return mutationFn(val);
                }
                return val; // If not an integer, return the value unchanged
            });
        } else if (isDateOrAllOrCount(key) && Number.isInteger(jsonObj[key])) {
            // If it's a date-like key or "all" or "counts" and the value is an integer
            jsonObj[key] = mutationFn(jsonObj[key]);
        }

        // If the value is an object or an array, we recurse into it
        mutateIntegersInJSON(jsonObj[key], mutationFn);
    }
}


function getRandomInt(n) {
    return Math.floor(Math.random() * n) + 1;
}

//kill the interceptor
function stopIntercept() {
	setTimeout(() => {
		unregister();
		console.log('unregistered interceptor');
	}, 1000);
}

window.MIXPANEL_MULTIPLIER_ACTIVE = true;

/*
function saveTheFile(saveMe) {
	console.log('saving the file...');
	const stringToSave = JSON.stringify(saveMe, null, 2);
	const blob = new Blob([stringToSave], { type: "text/plain;charset=utf-8" });
	// Create a URL for the blob
	const blobURL = window.URL.createObjectURL(blob);

	// Create a temporary anchor element to initiate the download
	const tempAnchor = document.createElement("a");
	tempAnchor.href = blobURL;
	tempAnchor.download = `RESP-${Date.now()}.json`; // Choose the desired file name
	tempAnchor.style.display = "none"; // Make sure it's not visible

	// Append it to the document
	document.body.appendChild(tempAnchor);

	// Programmatically trigger a click on the anchor to start the download
	tempAnchor.click();

	// Clean up by removing the anchor and revoking the blob URL
	document.body.removeChild(tempAnchor);
	window.URL.revokeObjectURL(blobURL);
	console.log('saved');
} */