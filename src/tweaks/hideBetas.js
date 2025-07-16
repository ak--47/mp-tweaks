// //@ts-nocheck

// var betaCount = 0;
// var maximumExecutions = 25;
// var initialDelay = 100;
// var delayIncrement = 108;

// if (!window.__mpTweaks_betaKillerRunning) {
// 	window.__mpTweaks_betaKillerRunning = true;

// 	/* beautify ignore:start */
// 	var querySelectorShadowDom = function (e) { function t(e, t, u, a) { void 0 === a && (a = null), e = function (e) { function t() { r && (u.length > 0 && /^[~+>]$/.test(u[u.length - 1]) && u.push(" "), u.push(r)); } var n, r, l, o, u = [], a = [0], s = 0, h = /(?:[^\\]|(?:^|[^\\])(?:\\\\)+)$/, i = /^\s+$/, c = [/\s+|\/\*|["'>~+[(]/g, /\s+|\/\*|["'[\]()]/g, /\s+|\/\*|["'[\]()]/g, null, /\*\//g]; for (e = e.trim(); ;) { if (r = "", (l = c[a[a.length - 1]]).lastIndex = s, !(n = l.exec(e))) { r = e.substr(s), t(); break; } if ((o = s) < (s = l.lastIndex) - n[0].length && (r = e.substring(o, s - n[0].length)), a[a.length - 1] < 3) { if (t(), "[" === n[0]) a.push(1); else if ("(" === n[0]) a.push(2); else if (/^["']$/.test(n[0])) a.push(3), c[3] = new RegExp(n[0], "g"); else if ("/*" === n[0]) a.push(4); else if (/^[\])]$/.test(n[0]) && a.length > 0) a.pop(); else if (/^(?:\s+|[~+>])$/.test(n[0]) && (u.length > 0 && !i.test(u[u.length - 1]) && 0 === a[a.length - 1] && u.push(" "), 1 === a[a.length - 1] && 5 === u.length && "=" === u[2].charAt(u[2].length - 1) && (u[4] = " " + u[4]), i.test(n[0]))) continue; u.push(n[0]); } else u[u.length - 1] += r, h.test(u[u.length - 1]) && (4 === a[a.length - 1] && (u.length < 2 || i.test(u[u.length - 2]) ? u.pop() : u[u.length - 1] = " ", n[0] = ""), a.pop()), u[u.length - 1] += n[0]; } return u.join("").trim(); }(e); var s = u.querySelector(e); return document.head.createShadowRoot || document.head.attachShadow ? !t && s ? s : n(e, ",").reduce(function (e, s) { if (!t && e) return e; var h = n(s.replace(/^\s+/g, "").replace(/\s*([>+~]+)\s*/g, "$1"), " ").filter(function (e) { return !!e; }).map(function (e) { return n(e, ">"); }), i = h.length - 1, c = o(h[i][h[i].length - 1], u, a), f = function (e, t, n) { return function (o) { for (var u = t, a = o, s = !1; a && !r(a);) { var h = !0; if (1 === e[u].length) h = a.matches(e[u]); else { var i = a, c = [].concat(e[u]).reverse(), f = Array.isArray(c), g = 0; for (c = f ? c : c[Symbol.iterator](); ;) { var d; if (f) { if (g >= c.length) break; d = c[g++]; } else { if ((g = c.next()).done) break; d = g.value; } var p = d; if (!i || !i.matches(p)) { h = !1; break; } i = l(i, n); } } if (h && 0 === u) { s = !0; break; } h && u--, a = l(a, n); } return s; }; }(h, i, u); return t ? e = e.concat(c.filter(f)) : (e = c.find(f)) || null; }, t ? [] : null) : t ? u.querySelectorAll(e) : s; } function n(e, t) { return e.match(/\\?.|^$/g).reduce(function (e, n) { return '"' !== n || e.sQuote ? "'" !== n || e.quote ? e.quote || e.sQuote || n !== t ? e.a[e.a.length - 1] += n : e.a.push("") : (e.sQuote ^= 1, e.a[e.a.length - 1] += n) : (e.quote ^= 1, e.a[e.a.length - 1] += n), e; }, { a: [""] }).a; } function r(e) { return e.nodeType === Node.DOCUMENT_FRAGMENT_NODE || e.nodeType === Node.DOCUMENT_NODE; } function l(e, t) { var n = e.parentNode; return n && n.host && 11 === n.nodeType ? n.host : n === t ? null : n; } function o(e, t, n) { void 0 === e && (e = null), void 0 === n && (n = null); var r = []; if (n) r = n; else { var l = function e(t) { for (var n = 0; n < t.length; n++) { var l = t[n]; r.push(l), l.shadowRoot && e(l.shadowRoot.querySelectorAll("*")); } }; t.shadowRoot && l(t.shadowRoot.querySelectorAll("*")), l(t.querySelectorAll("*")); } return e ? r.filter(function (t) { return t.matches(e); }) : r; } return e.collectAllElementsDeep = o, e.querySelectorAllDeep = function (e, n, r) { return void 0 === n && (n = document), void 0 === r && (r = null), t(e, !0, n, r); }, e.querySelectorDeep = function (e, n, r) { return void 0 === n && (n = document), void 0 === r && (r = null), t(e, !1, n, r); }, Object.defineProperty(e, "__esModule", { value: !0 }), e; }({});
// 	/* beautify ignore:end */

// 	function checkBetaLabelWithDelay(currentDelay) {
// 		betaCount++;
// 		console.log(`mp-checking: checking beta labels! (iteration ${betaCount}, delay ${currentDelay}ms)`);

// 		try {
// 			Array.from(querySelectorShadowDom.querySelectorAllDeep('.mp-text-highlight.information.size-small.length-thin')).forEach((betaLabel) => {
// 				if (betaLabel.style.display !== "none") {
// 					console.log(`mp-tweaks: killed alpha/beta label!`, betaLabel);
// 					betaLabel.style.display = "none";
// 				}
// 			});
// 		} catch (e) {
// 			console.error("mp-tweaks: error while killing beta label!", e);
// 			return; // stop future timeouts on error
// 		}

// 		if (betaCount < maximumExecutions) {
// 			setTimeout(() => checkBetaLabelWithDelay(currentDelay + delayIncrement), currentDelay);
// 		} else {
// 			console.log(`mp-tweaks: Reached maximum executions: ${betaCount}`);
// 		}
// 	}

// 	// Start the recursive timeout loop
// 	checkBetaLabelWithDelay(initialDelay);

// }

var querySelectorShadowDom = function (e) { function t(e, t, u, a) { void 0 === a && (a = null), e = function (e) { function t() { r && (u.length > 0 && /^[~+>]$/.test(u[u.length - 1]) && u.push(" "), u.push(r)); } var n, r, l, o, u = [], a = [0], s = 0, h = /(?:[^\\]|(?:^|[^\\])(?:\\\\)+)$/, i = /^\s+$/, c = [/\s+|\/\*|["'>~+[(]/g, /\s+|\/\*|["'[\]()]/g, /\s+|\/\*|["'[\]()]/g, null, /\*\//g]; for (e = e.trim(); ;) { if (r = "", (l = c[a[a.length - 1]]).lastIndex = s, !(n = l.exec(e))) { r = e.substr(s), t(); break; } if ((o = s) < (s = l.lastIndex) - n[0].length && (r = e.substring(o, s - n[0].length)), a[a.length - 1] < 3) { if (t(), "[" === n[0]) a.push(1); else if ("(" === n[0]) a.push(2); else if (/^["']$/.test(n[0])) a.push(3), c[3] = new RegExp(n[0], "g"); else if ("/*" === n[0]) a.push(4); else if (/^[\])]$/.test(n[0]) && a.length > 0) a.pop(); else if (/^(?:\s+|[~+>])$/.test(n[0]) && (u.length > 0 && !i.test(u[u.length - 1]) && 0 === a[a.length - 1] && u.push(" "), 1 === a[a.length - 1] && 5 === u.length && "=" === u[2].charAt(u[2].length - 1) && (u[4] = " " + u[4]), i.test(n[0]))) continue; u.push(n[0]); } else u[u.length - 1] += r, h.test(u[u.length - 1]) && (4 === a[a.length - 1] && (u.length < 2 || i.test(u[u.length - 2]) ? u.pop() : u[u.length - 1] = " ", n[0] = ""), a.pop()), u[u.length - 1] += n[0]; } return u.join("").trim(); }(e); var s = u.querySelector(e); return document.head.createShadowRoot || document.head.attachShadow ? !t && s ? s : n(e, ",").reduce(function (e, s) { if (!t && e) return e; var h = n(s.replace(/^\s+/g, "").replace(/\s*([>+~]+)\s*/g, "$1"), " ").filter(function (e) { return !!e; }).map(function (e) { return n(e, ">"); }), i = h.length - 1, c = o(h[i][h[i].length - 1], u, a), f = function (e, t, n) { return function (o) { for (var u = t, a = o, s = !1; a && !r(a);) { var h = !0; if (1 === e[u].length) h = a.matches(e[u]); else { var i = a, c = [].concat(e[u]).reverse(), f = Array.isArray(c), g = 0; for (c = f ? c : c[Symbol.iterator](); ;) { var d; if (f) { if (g >= c.length) break; d = c[g++]; } else { if ((g = c.next()).done) break; d = g.value; } var p = d; if (!i || !i.matches(p)) { h = !1; break; } i = l(i, n); } } if (h && 0 === u) { s = !0; break; } h && u--, a = l(a, n); } return s; }; }(h, i, u); return t ? e = e.concat(c.filter(f)) : (e = c.find(f)) || null; }, t ? [] : null) : t ? u.querySelectorAll(e) : s; } function n(e, t) { return e.match(/\\?.|^$/g).reduce(function (e, n) { return '"' !== n || e.sQuote ? "'" !== n || e.quote ? e.quote || e.sQuote || n !== t ? e.a[e.a.length - 1] += n : e.a.push("") : (e.sQuote ^= 1, e.a[e.a.length - 1] += n) : (e.quote ^= 1, e.a[e.a.length - 1] += n), e; }, { a: [""] }).a; } function r(e) { return e.nodeType === Node.DOCUMENT_FRAGMENT_NODE || e.nodeType === Node.DOCUMENT_NODE; } function l(e, t) { var n = e.parentNode; return n && n.host && 11 === n.nodeType ? n.host : n === t ? null : n; } function o(e, t, n) { void 0 === e && (e = null), void 0 === n && (n = null); var r = []; if (n) r = n; else { var l = function e(t) { for (var n = 0; n < t.length; n++) { var l = t[n]; r.push(l), l.shadowRoot && e(l.shadowRoot.querySelectorAll("*")); } }; t.shadowRoot && l(t.shadowRoot.querySelectorAll("*")), l(t.querySelectorAll("*")); } return e ? r.filter(function (t) { return t.matches(e); }) : r; } return e.collectAllElementsDeep = o, e.querySelectorAllDeep = function (e, n, r) { return void 0 === n && (n = document), void 0 === r && (r = null), t(e, !0, n, r); }, e.querySelectorDeep = function (e, n, r) { return void 0 === n && (n = document), void 0 === r && (r = null), t(e, !1, n, r); }, Object.defineProperty(e, "__esModule", { value: !0 }), e; }({});
(function initBetaLabelHider() {
	const selector = '.mp-text-highlight.information';
	let throttleTimeout = null;
	const MAX_FREQUENCY_MS = 300; // don't run more often than this

	function hideBetaLabels() {
		try {
			const betaLabels = querySelectorShadowDom.querySelectorAllDeep(selector);
			let count = 0;
			betaLabels.forEach(label => {
				if (label && label.style.display !== 'none') {
					label.style.display = 'none';
					count++;
				}
			});
			if (count > 0) {
				console.log(`mp-tweaks: Hid ${count} beta labels`);
			}
		} catch (e) {
			console.error("mp-tweaks: error in hideBetaLabels()", e);
		}
	}

	// Observe page for dynamic additions (like when menus open)
	const observer = new MutationObserver(() => {
		if (throttleTimeout) return;
		throttleTimeout = setTimeout(() => {
			hideBetaLabels();
			throttleTimeout = null;
		}, MAX_FREQUENCY_MS);
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: false,
		characterData: false
	});

	// Initial run
	hideBetaLabels();

	console.log("mp-tweaks: beta label hider initialized");
})();
