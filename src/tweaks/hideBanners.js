//@ts-nocheck

var bannersKilled = 0;
var isObserving = false;

if (!window.__mpTweaks_bannerKillerRunning) {
	window.__mpTweaks_bannerKillerRunning = true;
	/* beautify ignore:start */
	var querySelectorShadowDom = function (e) { function t(e, t, u, a) { void 0 === a && (a = null), e = function (e) { function t() { r && (u.length > 0 && /^[~+>]$/.test(u[u.length - 1]) && u.push(" "), u.push(r)); } var n, r, l, o, u = [], a = [0], s = 0, h = /(?:[^\\]|(?:^|[^\\])(?:\\\\)+)$/, i = /^\s+$/, c = [/\s+|\/\*|["'>~+[(]/g, /\s+|\/\*|["'[\]()]/g, /\s+|\/\*|["'[\]()]/g, null, /\*\//g]; for (e = e.trim(); ;) { if (r = "", (l = c[a[a.length - 1]]).lastIndex = s, !(n = l.exec(e))) { r = e.substr(s), t(); break; } if ((o = s) < (s = l.lastIndex) - n[0].length && (r = e.substring(o, s - n[0].length)), a[a.length - 1] < 3) { if (t(), "[" === n[0]) a.push(1); else if ("(" === n[0]) a.push(2); else if (/^["']$/.test(n[0])) a.push(3), c[3] = new RegExp(n[0], "g"); else if ("/*" === n[0]) a.push(4); else if (/^[\])]$/.test(n[0]) && a.length > 0) a.pop(); else if (/^(?:\s+|[~+>])$/.test(n[0]) && (u.length > 0 && !i.test(u[u.length - 1]) && 0 === a[a.length - 1] && u.push(" "), 1 === a[a.length - 1] && 5 === u.length && "=" === u[2].charAt(u[2].length - 1) && (u[4] = " " + u[4]), i.test(n[0]))) continue; u.push(n[0]); } else u[u.length - 1] += r, h.test(u[u.length - 1]) && (4 === a[a.length - 1] && (u.length < 2 || i.test(u[u.length - 2]) ? u.pop() : u[u.length - 1] = " ", n[0] = ""), a.pop()), u[u.length - 1] += n[0]; } return u.join("").trim(); }(e); var s = u.querySelector(e); return document.head.createShadowRoot || document.head.attachShadow ? !t && s ? s : n(e, ",").reduce(function (e, s) { if (!t && e) return e; var h = n(s.replace(/^\s+/g, "").replace(/\s*([>+~]+)\s*/g, "$1"), " ").filter(function (e) { return !!e; }).map(function (e) { return n(e, ">"); }), i = h.length - 1, c = o(h[i][h[i].length - 1], u, a), f = function (e, t, n) { return function (o) { for (var u = t, a = o, s = !1; a && !r(a);) { var h = !0; if (1 === e[u].length) h = a.matches(e[u]); else { var i = a, c = [].concat(e[u]).reverse(), f = Array.isArray(c), g = 0; for (c = f ? c : c[Symbol.iterator](); ;) { var d; if (f) { if (g >= c.length) break; d = c[g++]; } else { if ((g = c.next()).done) break; d = g.value; } var p = d; if (!i || !i.matches(p)) { h = !1; break; } i = l(i, n); } } if (h && 0 === u) { s = !0; break; } h && u--, a = l(a, n); } return s; }; }(h, i, u); return t ? e = e.concat(c.filter(f)) : (e = c.find(f)) || null; }, t ? [] : null) : t ? u.querySelectorAll(e) : s; } function n(e, t) { return e.match(/\\?.|^$/g).reduce(function (e, n) { return '"' !== n || e.sQuote ? "'" !== n || e.quote ? e.quote || e.sQuote || n !== t ? e.a[e.a.length - 1] += n : e.a.push("") : (e.sQuote ^= 1, e.a[e.a.length - 1] += n) : (e.quote ^= 1, e.a[e.a.length - 1] += n), e; }, { a: [""] }).a; } function r(e) { return e.nodeType === Node.DOCUMENT_FRAGMENT_NODE || e.nodeType === Node.DOCUMENT_NODE; } function l(e, t) { var n = e.parentNode; return n && n.host && 11 === n.nodeType ? n.host : n === t ? null : n; } function o(e, t, n) { void 0 === e && (e = null), void 0 === n && (n = null); var r = []; if (n) r = n; else { var l = function e(t) { for (var n = 0; n < t.length; n++) { var l = t[n]; r.push(l), l.shadowRoot && e(l.shadowRoot.querySelectorAll("*")); } }; t.shadowRoot && l(t.shadowRoot.querySelectorAll("*")), l(t.querySelectorAll("*")); } return e ? r.filter(function (t) { return t.matches(e); }) : r; } return e.collectAllElementsDeep = o, e.querySelectorAllDeep = function (e, n, r) { return void 0 === n && (n = document), void 0 === r && (r = null), t(e, !0, n, r); }, e.querySelectorDeep = function (e, n, r) { return void 0 === n && (n = document), void 0 === r && (r = null), t(e, !1, n, r); }, Object.defineProperty(e, "__esModule", { value: !0 }), e; }({});
	/* beautify ignore:end */

	// Cache for found banners to avoid repeated queries
	var foundBanners = new Set();

	function hideBanner(banner) {
		if (banner.style.display !== 'none' && !foundBanners.has(banner)) {
			console.log(`mp-tweaks: killed banner!`, banner);
			banner.style.display = "none";
			foundBanners.add(banner);
			bannersKilled++;
		}
	}

	function checkExistingBanners() {
		try {
			// Check existing banners immediately
			Array.from(querySelectorShadowDom.querySelectorAllDeep('mp-report-banners')).forEach(hideBanner);
			Array.from(querySelectorShadowDom.querySelectorAllDeep('mp-banner')).forEach(hideBanner);
		} catch (e) {
			console.error("mp-tweaks: error while checking existing banners!", e);
		}
	}

	function setupMutationObserver() {
		if (typeof MutationObserver === 'undefined' || isObserving) return;

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					for (const node of mutation.addedNodes) {
						if (node.nodeType === Node.ELEMENT_NODE) {
							// Check if the added node or its children contain banners
							if (node.matches && (node.matches('mp-report-banners') || node.matches('mp-banner'))) {
								hideBanner(node);
							}

							// Check for shadow DOM elements
							if (node.shadowRoot) {
								try {
									Array.from(querySelectorShadowDom.querySelectorAllDeep('mp-report-banners', node)).forEach(hideBanner);
									Array.from(querySelectorShadowDom.querySelectorAllDeep('mp-banner', node)).forEach(hideBanner);
								} catch (e) {
									console.error("mp-tweaks: error checking shadow DOM", e);
								}
							}

							// Check children of added node
							if (node.querySelectorAll) {
								try {
									Array.from(querySelectorShadowDom.querySelectorAllDeep('mp-report-banners', node)).forEach(hideBanner);
									Array.from(querySelectorShadowDom.querySelectorAllDeep('mp-banner', node)).forEach(hideBanner);
								} catch (e) {
									console.error("mp-tweaks: error checking node children", e);
								}
							}
						}
					}
				}
			}
		});

		observer.observe(document.body || document.documentElement, {
			childList: true,
			subtree: true
		});

		isObserving = true;

		// Clean up observer when page unloads
		window.addEventListener('beforeunload', () => {
			observer.disconnect();
			isObserving = false;
		});

		console.log('mp-tweaks: banner hiding MutationObserver started');
	}

	// Initial check for existing banners
	checkExistingBanners();

	// Setup observer for future banners
	setupMutationObserver();

	// Fallback check after a short delay in case some banners load later
	setTimeout(() => {
		checkExistingBanners();
		console.log(`mp-tweaks: banner hiding initialized, killed ${bannersKilled} banners`);
	}, 2000);
}