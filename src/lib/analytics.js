// super weird hack to inject all of mixpanel in the service worker
// @ts-nocheck
/* cSpell:disable */

async function analytics() {

	// MIXPANEL
	(function (c, a) {
		if (!a.__SV) {
			var b = window; try { var d, m, j, k = b.location, f = k.hash; d = function (a, b) { return (m = a.match(RegExp(b + "=([^&]*)"))) ? m[1] : null; }; f && d(f, "state") && (j = JSON.parse(decodeURIComponent(d(f, "state"))), "mpeditor" === j.action && (b.sessionStorage.setItem("_mpcehash", f), history.replaceState(j.desiredHash || "", c.title, k.pathname + k.search))); } catch (n) { } var l, h; window.mixpanel = a; a._i = []; a.init = function (b, d, g) {
				function c(b, i) {
					var a = i.split("."); 2 == a.length && (b = b[a[0]], i = a[1]); b[i] = function () {
						b.push([i].concat(Array.prototype.slice.call(arguments,
							0)));
					};
				} var e = a; "undefined" !== typeof g ? e = a[g] = [] : g = "mixpanel"; e.people = e.people || []; e.toString = function (b) { var a = "mixpanel"; "mixpanel" !== g && (a += "." + g); b || (a += " (stub)"); return a; }; e.people.toString = function () { return e.toString(1) + ".people (stub)"; }; l = "disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");
				for (h = 0; h < l.length; h++)c(e, l[h]); var f = "set set_once union unset remove delete".split(" "); e.get_group = function () { function a(c) { b[c] = function () { call2_args = arguments; call2 = [c].concat(Array.prototype.slice.call(call2_args, 0)); e.push([d, call2]); }; } for (var b = {}, d = ["get_group"].concat(Array.prototype.slice.call(arguments, 0)), c = 0; c < f.length; c++)a(f[c]); return b; }; a._i.push([b, d, g]);
			}; a.__SV = 1.2; b = c.createElement("script"); b.type = "text/javascript"; b.async = !0; b.src = "undefined" !== typeof MIXPANEL_CUSTOM_LIB_URL ?
				MIXPANEL_CUSTOM_LIB_URL : "file:" === c.location.protocol && "".match(/^\/\//) ? "" : ""; d = c.getElementsByTagName("script")[0]; d.parentNode.insertBefore(b, d);
		}
	})(document, window.mixpanel || []);

	async function getUser() {
		let url = `https://mixpanel.com/settings/account/`;
		let response = await fetch(url);
		let html = await response.text();
		let user;
		try {
			user = html.split("user_email: '")[1].split("',")[0];
			if (!user.includes("@mixpanel.com")) user = ''; // only mixpanel users
		} catch {
			user = '';
		}
		return user;
	}


	mixpanel.init("99526f575a41223fcbadd9efdd280c7e", {
		persistence: 'localStorage',
		api_host: "https://api.mixpanel.com",
		window: {
			navigator: {
				doNotTrack: '0'
			}
		},
		// record_sessions_percent: 100,
		// record_inline_images: true,
		// record_collect_fonts: true,
		// record_mask_text_selector: "nope",
		// record_block_selector: "nope",
		// record_block_class: "nope",
		ignore_dnt: true,
		loaded: function (mixpanel) {
			mixpanel.reset();
			getUser().then((user) => {
				mixpanel.register({
					"version": APP_VERSION
				});
				if (user) {
					mixpanel.identify(user);
					mixpanel.register({
						"$email": user
					});
					mixpanel.people.set({
						"version": APP_VERSION,
						"$email": user,
						"$name": user
					});
				}
			});
		},		
		secure_cookie: true
	});
}

module.exports = analytics;