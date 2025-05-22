//@ts-nocheck

if (!window.__mpTweaks_catchFetchInjected) {
	window.__mpTweaks_catchFetchInjected = true;

	console.log('mp-tweaks: catchFetch.js injected');
	/* beautify ignore:start */
	var fetchInterceptor = function (r) { function n(e) { if (t[e]) return t[e].exports; var o = t[e] = { exports: {}, id: e, loaded: !1 }; return r[e].call(o.exports, o, o.exports, n), o.loaded = !0, o.exports; } var t = {}; return n.m = r, n.c = t, n.p = "", n(0); }([function (r, n, t) { (function (n, e) { "use strict"; function o(r) { if (Array.isArray(r)) { for (var n = 0, t = Array(r.length); n < r.length; n++)t[n] = r[n]; return t; } return Array.from(r); } function i(r) { if (!r.fetch) try { t(2); } catch (n) { throw Error("No fetch avaibale. Unable to register fetch-intercept"); } r.fetch = function (r) { return function () { for (var n = arguments.length, t = Array(n), e = 0; n > e; e++)t[e] = arguments[e]; return f.apply(void 0, [r].concat(t)); }; }(r.fetch); } function f(r) { for (var n = arguments.length, t = Array(n > 1 ? n - 1 : 0), e = 1; n > e; e++)t[e - 1] = arguments[e]; var i = l.reduce(function (r, n) { return [n].concat(r); }, []), f = Promise.resolve(t); return i.forEach(function (r) { var n = r.request, t = r.requestError; (n || t) && (f = f.then(function (r) { return n.apply(void 0, o(r)); }, t)); }), f = f.then(function (n) { return r.apply(void 0, o(n)); }), i.forEach(function (r) { var n = r.response, t = r.responseError; (n || t) && (f = f.then(n, t)); }), f; } var u = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (r) { return typeof r; } : function (r) { return r && "function" == typeof Symbol && r.constructor === Symbol ? "symbol" : typeof r; }, c = "object" === ("undefined" == typeof navigator ? "undefined" : u(navigator)) && "ReactNative" === navigator.product, s = "object" === ("undefined" == typeof n ? "undefined" : u(n)) && !0, a = "object" === ("undefined" == typeof window ? "undefined" : u(window)), p = "function" == typeof importScripts; if (c) i(e); else if (p) i(self); else if (a) i(window); else { if (!s) throw new Error("Unsupported environment for fetch-intercept"); i(e); } var l = []; r.exports = { register: function (r) { return l.push(r), function () { var n = l.indexOf(r); n >= 0 && l.splice(n, 1); }; }, clear: function () { l = []; } }; }).call(n, t(1), function () { return this; }()); }, function (r, n) { "use strict"; function t() { s = !1, f.length ? c = f.concat(c) : a = -1, c.length && e(); } function e() { if (!s) { var r = setTimeout(t); s = !0; for (var n = c.length; n;) { for (f = c, c = []; ++a < n;)f && f[a].run(); a = -1, n = c.length; } f = null, s = !1, clearTimeout(r); } } function o(r, n) { this.fun = r, this.array = n; } function i() { } var f, u = r.exports = {}, c = [], s = !1, a = -1; u.nextTick = function (r) { var n = new Array(arguments.length - 1); if (arguments.length > 1) for (var t = 1; t < arguments.length; t++)n[t - 1] = arguments[t]; c.push(new o(r, n)), 1 !== c.length || s || setTimeout(e, 0); }, o.prototype.run = function () { this.fun.apply(null, this.array); }, u.title = "browser", u.browser = !0, u.env = {}, u.argv = [], u.version = "", u.versions = {}, u.on = i, u.addListener = i, u.once = i, u.off = i, u.removeListener = i, u.removeAllListeners = i, u.emit = i, u.binding = function (r) { throw new Error("process.binding is not supported"); }, u.cwd = function () { return "/"; }, u.chdir = function (r) { throw new Error("process.chdir is not supported"); }, u.umask = function () { return 0; }; }, function (r, n) { r.exports = require("whatwg-fetch"); }]);
	var querySelectorShadowDom = function (e) { function t(e, t, u, a) { void 0 === a && (a = null), e = function (e) { function t() { r && (u.length > 0 && /^[~+>]$/.test(u[u.length - 1]) && u.push(" "), u.push(r)); } var n, r, l, o, u = [], a = [0], s = 0, h = /(?:[^\\]|(?:^|[^\\])(?:\\\\)+)$/, i = /^\s+$/, c = [/\s+|\/\*|["'>~+[(]/g, /\s+|\/\*|["'[\]()]/g, /\s+|\/\*|["'[\]()]/g, null, /\*\//g]; for (e = e.trim(); ;) { if (r = "", (l = c[a[a.length - 1]]).lastIndex = s, !(n = l.exec(e))) { r = e.substr(s), t(); break; } if ((o = s) < (s = l.lastIndex) - n[0].length && (r = e.substring(o, s - n[0].length)), a[a.length - 1] < 3) { if (t(), "[" === n[0]) a.push(1); else if ("(" === n[0]) a.push(2); else if (/^["']$/.test(n[0])) a.push(3), c[3] = new RegExp(n[0], "g"); else if ("/*" === n[0]) a.push(4); else if (/^[\])]$/.test(n[0]) && a.length > 0) a.pop(); else if (/^(?:\s+|[~+>])$/.test(n[0]) && (u.length > 0 && !i.test(u[u.length - 1]) && 0 === a[a.length - 1] && u.push(" "), 1 === a[a.length - 1] && 5 === u.length && "=" === u[2].charAt(u[2].length - 1) && (u[4] = " " + u[4]), i.test(n[0]))) continue; u.push(n[0]); } else u[u.length - 1] += r, h.test(u[u.length - 1]) && (4 === a[a.length - 1] && (u.length < 2 || i.test(u[u.length - 2]) ? u.pop() : u[u.length - 1] = " ", n[0] = ""), a.pop()), u[u.length - 1] += n[0]; } return u.join("").trim(); }(e); var s = u.querySelector(e); return document.head.createShadowRoot || document.head.attachShadow ? !t && s ? s : n(e, ",").reduce(function (e, s) { if (!t && e) return e; var h = n(s.replace(/^\s+/g, "").replace(/\s*([>+~]+)\s*/g, "$1"), " ").filter(function (e) { return !!e; }).map(function (e) { return n(e, ">"); }), i = h.length - 1, c = o(h[i][h[i].length - 1], u, a), f = function (e, t, n) { return function (o) { for (var u = t, a = o, s = !1; a && !r(a);) { var h = !0; if (1 === e[u].length) h = a.matches(e[u]); else { var i = a, c = [].concat(e[u]).reverse(), f = Array.isArray(c), g = 0; for (c = f ? c : c[Symbol.iterator](); ;) { var d; if (f) { if (g >= c.length) break; d = c[g++]; } else { if ((g = c.next()).done) break; d = g.value; } var p = d; if (!i || !i.matches(p)) { h = !1; break; } i = l(i, n); } } if (h && 0 === u) { s = !0; break; } h && u--, a = l(a, n); } return s; }; }(h, i, u); return t ? e = e.concat(c.filter(f)) : (e = c.find(f)) || null; }, t ? [] : null) : t ? u.querySelectorAll(e) : s; } function n(e, t) { return e.match(/\\?.|^$/g).reduce(function (e, n) { return '"' !== n || e.sQuote ? "'" !== n || e.quote ? e.quote || e.sQuote || n !== t ? e.a[e.a.length - 1] += n : e.a.push("") : (e.sQuote ^= 1, e.a[e.a.length - 1] += n) : (e.quote ^= 1, e.a[e.a.length - 1] += n), e; }, { a: [""] }).a; } function r(e) { return e.nodeType === Node.DOCUMENT_FRAGMENT_NODE || e.nodeType === Node.DOCUMENT_NODE; } function l(e, t) { var n = e.parentNode; return n && n.host && 11 === n.nodeType ? n.host : n === t ? null : n; } function o(e, t, n) { void 0 === e && (e = null), void 0 === n && (n = null); var r = []; if (n) r = n; else { var l = function e(t) { for (var n = 0; n < t.length; n++) { var l = t[n]; r.push(l), l.shadowRoot && e(l.shadowRoot.querySelectorAll("*")); } }; t.shadowRoot && l(t.shadowRoot.querySelectorAll("*")), l(t.querySelectorAll("*")); } return e ? r.filter(function (t) { return t.matches(e); }) : r; } return e.collectAllElementsDeep = o, e.querySelectorAllDeep = function (e, n, r) { return void 0 === n && (n = document), void 0 === r && (r = null), t(e, !0, n, r); }, e.querySelectorDeep = function (e, n, r) { return void 0 === n && (n = document), void 0 === r && (r = null), t(e, !1, n, r); }, Object.defineProperty(e, "__esModule", { value: !0 }), e; }({});
	/* beautify ignore:end */
}

function makeABlob(data) {
	return new Blob([data], {
		type: 'application/json'
	});
}

function isAHit(url) {
	var validReports = ['/insights', '/arb_funnels', '/retention', '/impact', '/adoption', '/propensity', '/correlate', '/experiments', "/metrics"];
	var blacklist = ['confidence'];
	try {
		//check if the url is a valid report and not a blacklisted one
		return validReports.some(rep => url.includes(rep)) && !blacklist.some(rep => url.includes(rep));
	}
	catch (e) {
		return false;
	}
}

var tempStorage = {};


var unregister = fetchInterceptor.register({
	response: async function (response) {
		console.log('mp-tweaks: checking fetch response');
		// these are for explicit "DRAW CHART" clicks
		if (isAHit(response.url) && window.CATCH_FETCH_INTENT === 'response') {
			console.log('mp-tweaks: hit!');
			if (!tempStorage.api_url) tempStorage.api_url = new URL(response.url).pathname;
			tempStorage.ui_url = window.location.pathname;
			//clone the response
			var data = await response.clone().json();
			tempStorage.response = data;
			let blob;

			// ! this powers 'draw chart' clicks
			if (window.ALTERED_MIXPANEL_DATA) {
				console.log('mp-tweaks: got data from worker');
				blob = makeABlob(JSON.stringify(ALTERED_MIXPANEL_DATA));
			}
			else {
				console.log('mp-tweaks: sent data to worker');
				const catchFetchEvent = new CustomEvent("caught-response", { detail: { ...tempStorage } });
				window.dispatchEvent(catchFetchEvent);
				blob = makeABlob(JSON.stringify(data));
			}
			// window.CATCH_FETCH_INTENT = 'none';
			stopIntercept();
			return new Response(blob);
		}

		// ! this powers 'stored overrides'
		if (isAHit(response.url) && window.CATCH_FETCH_INTENT === 'override') {
			const overrides = window.ALTERED_MIXPANEL_OVERRIDES || [];
			if (overrides.length) {
				for (const override of overrides) {
					var chartOrigData = JSON.parse(JSON.stringify(override.chartOrigData));
					var current_response = await response.clone().json();
					//computed @ and date range values mess up the equality check
					delete chartOrigData['computed_at'];
					delete current_response['computed_at'];
					delete chartOrigData['date_range'];
					delete current_response['date_range'];

					const similarity = fuzzySimilarity(current_response, chartOrigData);

					if (similarity > 0.75) {
						console.log('mp-tweaks: found an override');
						const blob = makeABlob(JSON.stringify(override.chartData));
						stopIntercept();
						return new Response(blob);
					}

				}
				console.log('mp-tweaks: no override found');
			}
		}

		// most of the time do nothing
		return response;

	},

	request: function (url, config) {
		console.log('mp-tweaks: checking fetch request');
		if (isAHit(url) && (window.CATCH_FETCH_INTENT === 'request' || window.CATCH_FETCH_INTENT === 'response' || window.CATCH_FETCH_INTENT === 'override')) {
			console.log('mp-tweaks: hit!');
			tempStorage.api_url = url;
			tempStorage.ui_url = window.location.pathname;

			try {
				const data = JSON.parse(config.body);
				tempStorage.request = data;

			}
			catch (e) {
				console.error('mp-tweaks: error while parsing request body', e, config.body);
			}

			//only respond if we're trying to catch a request; need to wait for the response to catch a response
			if (window.CATCH_FETCH_INTENT === 'request') {
				const catchFetchEvent = new CustomEvent("caught-request", { detail: { ...tempStorage } });
				window.dispatchEvent(catchFetchEvent);
			}
		}
		return [url, config];
	},

});


//trigger two clicks
var threeDotsDivSelector = 'div > div.mp-control-bar-truncated-menu-container > mp-select div > div > mp-button a > div.mp-button-content > svg-icon';
var refreshDataSelector = 'div > div.mp-control-bar-truncated-menu-container > mp-select div > div.select-drop-menu__A0YRHQY9 > mp-drop-menu > mp-items-menu div > div > div:nth-child(5) > ul > div > li > div.option-label-section > div > div > span';

//for the three dots; diff for each report
if (window.CATCH_FETCH_INTENT === 'response' || window.CATCH_FETCH_INTENT === 'request') {
	var threeDotsDiv = querySelectorShadowDom.querySelectorAllDeep(threeDotsDivSelector).shift();

	threeDotsDiv.click();

	setTimeout(() => {
		var refreshDataButton = querySelectorShadowDom.querySelectorAllDeep(refreshDataSelector).shift();
		refreshDataButton.click();
	}, 250);
}



//kill the interceptor
function stopIntercept() {
	setTimeout(() => {
		unregister();
		console.log('mp-tweaks: unregistered interceptor');
		MIXPANEL_CATCH_FETCH_ACTIVE = false;
	}, 0);
}


function stableStringify(obj) {
	return JSON.stringify(obj, replacer, 2); // pretty-print with spacing
}

function replacer(key, value) {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return Object.keys(value)
			.sort()
			.reduce((acc, k) => {
				acc[k] = value[k];
				return acc;
			}, {});
	}
	return value;
}

function haveSameShape(obj1, obj2) {
	// Check if both arguments are objects
	if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
		return false;
	}

	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	// Check if both objects have the same number of keys
	if (keys1.length !== keys2.length) {
		return false;
	}

	// Check if all keys in obj1 are in obj2 and have the same shape
	for (let key of keys1) {
		if (!keys2.includes(key)) {
			return false;
		}
		if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
			if (!haveSameShape(obj1[key], obj2[key])) {
				return false;
			}
		} else if (typeof obj1[key] !== typeof obj2[key]) {
			// Check if the types of values are different
			return false;
		}
	}

	return true;
}

// turn objects into strings and compare; this isn't perfect but it's good enough for our purposes
function areEqual(obj1, obj2) {
	return stableStringify(obj1) === stableStringify(obj2);
}



/**
 * Calculate similarity score between two values (0-1)
 * @param {*} a - First value to compare
 * @param {*} b - Second value to compare
 * @param {Object} options - Configuration options
 * @returns {number} Similarity score between 0 and 1
 */
function fuzzySimilarity(a, b, options = {}) {
	const defaultOptions = {
		keyWeights: null, // Optional object mapping keys to weight values
		stringComparer: simpleStringSimilarity, // Function to compare strings
		numberTolerance: 0.1, // Relative tolerance for number comparison
		caseSensitive: false, // Whether string comparisons are case sensitive
		arrayOrderMatters: false, // Whether array element order matters
	};

	const config = { ...defaultOptions, ...options };
	const { matches, total } = compareRecursive(a, b, config);
	return total === 0 ? 1 : matches / total;
}

/**
 * Recursively compare two values and calculate matches/total
 * @param {*} a - First value
 * @param {*} b - Second value
 * @param {Object} config - Configuration options
 * @returns {Object} Object with matches and total counts
 */
function compareRecursive(a, b, config, path = "") {
	// Handle simple equality case
	if (a === b) return { matches: 1, total: 1 };

	// Handle null/undefined cases
	if (a === null || b === null || a === undefined || b === undefined) {
		return { matches: 0, total: 1 };
	}

	// Type mismatch
	if (typeof a !== typeof b) return { matches: 0, total: 1 };

	// Handle primitive types
	if (typeof a === "string") {
		return compareStrings(a, b, config);
	}

	if (typeof a === "number") {
		return compareNumbers(a, b, config);
	}

	if (typeof a === "boolean") {
		return { matches: a === b ? 1 : 0, total: 1 };
	}

	// Handle arrays
	if (Array.isArray(a) && Array.isArray(b)) {
		return compareArrays(a, b, config);
	}

	// Handle objects
	if (typeof a === "object" && typeof b === "object") {
		return compareObjects(a, b, config, path);
	}

	// Fallback for any other types
	return { matches: a === b ? 1 : 0, total: 1 };
}

/**
 * Compare two strings
 */
function compareStrings(a, b, config) {
	if (!config.caseSensitive) {
		a = a.toLowerCase();
		b = b.toLowerCase();
	}

	if (a === b) return { matches: 1, total: 1 };

	const similarity = config.stringComparer(a, b);
	return { matches: similarity, total: 1 };
}

/**
 * Compare two numbers
 */
function compareNumbers(a, b, config) {
	if (a === b) return { matches: 1, total: 1 };

	// Calculate relative difference
	const max = Math.max(Math.abs(a), Math.abs(b));
	if (max === 0) return { matches: 1, total: 1 }; // Both numbers are 0

	const diff = Math.abs(a - b) / max;

	// If within tolerance, give partial credit
	if (diff <= config.numberTolerance) {
		const score = 1 - (diff / config.numberTolerance);
		return { matches: score, total: 1 };
	}

	return { matches: 0, total: 1 };
}

/**
 * Compare two arrays
 */
function compareArrays(a, b, config) {
	let matches = 0;
	let total = 0;

	if (config.arrayOrderMatters) {
		// Ordered comparison (as in your original algorithm)
		const minLen = Math.min(a.length, b.length);
		for (let i = 0; i < minLen; i++) {
			const res = compareRecursive(a[i], b[i], config, `[${i}]`);
			matches += res.matches;
			total += res.total;
		}
		// Penalize length differences
		total += Math.abs(a.length - b.length);
	} else {
		// Best-match comparison (order doesn't matter)
		// For each element in a, find its best match in b
		const bUsed = new Set();

		for (const itemA of a) {
			let bestMatch = 0;
			let bestIndex = -1;

			// Find the best matching unused element in b
			for (let i = 0; i < b.length; i++) {
				if (bUsed.has(i)) continue;

				const { matches: m, total: t } = compareRecursive(itemA, b[i], config);
				const score = m / t;

				if (score > bestMatch) {
					bestMatch = score;
					bestIndex = i;
				}
			}

			if (bestIndex !== -1) {
				const res = compareRecursive(itemA, b[bestIndex], config);
				matches += res.matches;
				total += res.total;
				bUsed.add(bestIndex);
			} else {
				// No match found
				total += 1;
			}
		}

		// Penalize for extra elements in b
		total += b.length - bUsed.size;
	}

	return { matches, total };
}

/**
 * Compare two objects
 */
function compareObjects(a, b, config, path) {
	let matches = 0;
	let total = 0;

	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

	for (const key of keys) {
		const keyPath = path ? `${path}.${key}` : key;
		// Apply weight if available
		const weight = config.keyWeights && config.keyWeights[keyPath] ?
			config.keyWeights[keyPath] : 1;

		const res = compareRecursive(a[key], b[key], config, keyPath);
		matches += res.matches * weight;
		total += res.total * weight;
	}

	return { matches, total };
}

/**
 * Simple string similarity algorithm (Levenshtein distance based)
 * @returns {number} Similarity between 0 and 1
 */
function simpleStringSimilarity(str1, str2) {
	if (str1 === str2) return 1;
	if (!str1 || !str2) return 0;

	const len1 = str1.length;
	const len2 = str2.length;

	// For very different length strings, return low similarity
	if (Math.max(len1, len2) > 100 || Math.max(len1, len2) / Math.min(len1, len2) > 3) {
		return 0.1;
	}

	// Calculate Levenshtein distance
	const distance = levenshteinDistance(str1, str2);
	const maxLen = Math.max(len1, len2);

	return 1 - (distance / maxLen);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
	const m = str1.length;
	const n = str2.length;

	// Create a matrix of size (m+1) x (n+1)
	const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

	// Initialize first row and column
	for (let i = 0; i <= m; i++) dp[i][0] = i;
	for (let j = 0; j <= n; j++) dp[0][j] = j;

	// Fill the matrix
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
			dp[i][j] = Math.min(
				dp[i - 1][j] + 1,      // deletion
				dp[i][j - 1] + 1,      // insertion
				dp[i - 1][j - 1] + cost // substitution
			);
		}
	}

	return dp[m][n];
}

window.MIXPANEL_CATCH_FETCH_ACTIVE = true;
