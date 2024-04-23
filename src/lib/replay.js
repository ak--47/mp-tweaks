function mixpanel_with_session_replay(project_token, lib_url, proxy_url) {
	console.log('mp-tweaks: starting session replay');
	// VARS
	const MIXPANEL_TOKEN = project_token || `7c02ad22ae575ab4e15cdd052cd730fb`;
	const MIXPANEL_CUSTOM_LIB_URL = lib_url || `https://mixpanel.com/libs/mixpanel.dev.min.js`;
	const MIXPANEL_PROXY_URL = proxy_url || `https://api-js.mixpanel.com`;

	// SNIPPET
	(function (f, b) {
		if (!b.__SV) {
			var e, g, i, h; window.mixpanel = b; b._i = []; b.init = function (e, f, c) {
				function g(a, d) { var b = d.split("."); 2 == b.length && (a = a[b[0]], d = b[1]); a[d] = function () { a.push([d].concat(Array.prototype.slice.call(arguments, 0))); }; } var a = b; "undefined" !== typeof c ? a = b[c] = [] : c = "mixpanel"; a.people = a.people || []; a.toString = function (a) { var d = "mixpanel"; "mixpanel" !== c && (d += "." + c); a || (d += " (stub)"); return d; }; a.people.toString = function () { return a.toString(1) + ".people (stub)"; }; i = "disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");
				for (h = 0; h < i.length; h++)g(a, i[h]); var j = "set set_once union unset remove delete".split(" "); a.get_group = function () { function b(c) { d[c] = function () { call2_args = arguments; call2 = [c].concat(Array.prototype.slice.call(call2_args, 0)); a.push([e, call2]); }; } for (var d = {}, e = ["get_group"].concat(Array.prototype.slice.call(arguments, 0)), c = 0; c < j.length; c++)b(j[c]); return d; }; b._i.push([e, f, c]);
			}; b.__SV = 1.2; e = f.createElement("script"); e.type = "text/javascript"; e.async = !0; e.src = "undefined" !== typeof MIXPANEL_CUSTOM_LIB_URL ? MIXPANEL_CUSTOM_LIB_URL : "file:" === f.location.protocol && "//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\/\//) ? "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js" : "//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"; g = f.getElementsByTagName("script")[0]; g.parentNode.insertBefore(e, g);
		}
	})(document, window.mixpanel || []);

	// INIT
	mixpanel.init(MIXPANEL_TOKEN, {
		api_host: MIXPANEL_PROXY_URL,
		ignore_dnt: true,
		debug: true,
		batch_flush_interval_ms: 0,
		record_sessions_percent: 100,
		record_mask_text_selector: "recordAllTheThings",
		loaded: function () {
			mixpanel.reset();
			mixpanel.track('app loaded');
			const name = generateName();
			const welcome = 'mixpanel loaded; your id is\n\n ---------------- \n\n ' + name + '\n\n ---------------- \n';
			console.log(welcome);
			mixpanel.people.set_once({ "$name": name });
			mixpanel.identify(name);
			mixpanel.track('page view');
			eventEmitter();
			openInNewTab(name);
		}
	});


	function openInNewTab(user, href = "https://mixpanel.com/project/3276012/view/3782804/app/profile#distinct_id=") {
		setTimeout(() => {
			Object.assign(document.createElement('a'), {
				target: '_blank',
				rel: 'noopener noreferrer',
				href: href + user,
			}).click();
		}, 3000);
	}

	function generateName() {
		var adjs = [
			"autumn", "hidden", "bitter", "misty", "silent", "empty", "dry", "dark",
			"summer", "icy", "delicate", "quiet", "white", "cool", "spring", "winter",
			"patient", "twilight", "dawn", "crimson", "wispy", "weathered", "blue",
			"billowing", "broken", "cold", "damp", "falling", "frosty", "green",
			"long", "late", "lingering", "bold", "little", "morning", "muddy", "old",
			"red", "rough", "still", "small", "sparkling", "throbbing", "shy",
			"wandering", "withered", "wild", "black", "young", "holy", "solitary",
			"fragrant", "aged", "snowy", "proud", "floral", "restless", "divine",
			"polished", "ancient", "purple", "lively", "nameless", "gentle", "gleaming", "furious", "luminous", "obscure", "poised", "shimmering", "swirling",
			"sombre", "steamy", "whispering", "jagged", "melodic", "moonlit", "starry", "forgotten",
			"peaceful", "restive", "rustling", "sacred", "ancient", "haunting", "solitary", "mysterious",
			"silver", "dusky", "earthy", "golden", "hallowed", "misty", "roaring", "serene", "vibrant",
			"stalwart", "whimsical", "timid", "tranquil", "vast", "youthful", "zephyr", "raging",
			"sapphire", "turbulent", "whirling", "sleepy", "ethereal", "tender", "unseen", "wistful"
		];

		var nouns = [
			"waterfall", "river", "breeze", "moon", "rain", "wind", "sea", "morning",
			"snow", "lake", "sunset", "pine", "shadow", "leaf", "dawn", "glitter",
			"forest", "hill", "cloud", "meadow", "sun", "glade", "bird", "brook",
			"butterfly", "bush", "dew", "dust", "field", "fire", "flower", "firefly",
			"feather", "grass", "haze", "mountain", "night", "pond", "darkness",
			"snowflake", "silence", "sound", "sky", "shape", "surf", "thunder",
			"violet", "water", "wildflower", "wave", "water", "resonance", "sun",
			"wood", "dream", "cherry", "tree", "fog", "frost", "voice", "paper",
			"frog", "smoke", "star", "glow", "wave", "riverbed", "cliff", "deluge", "prairie", "creek", "ocean",
			"peak", "valley", "starlight", "quartz", "woodland", "marsh", "earth", "canopy",
			"petal", "stone", "orb", "gale", "bay", "canyon", "watercourse", "vista", "raindrop",
			"boulder", "grove", "plateau", "sand", "mist", "tide", "blossom", "leaf", "flame",
			"shade", "coil", "grotto", "pinnacle", "scallop", "serenity", "abyss", "skyline",
			"drift", "echo", "nebula", "horizon", "crest", "wreath", "twilight", "balm", "glimmer"
		];


		var adj = adjs[Math.floor(Math.random() * adjs.length)]; // http://stackoverflow.com/a/17516862/103058
		var noun = nouns[Math.floor(Math.random() * nouns.length)];
		var MIN = 1000;
		var MAX = 9999;
		var num = Math.floor(Math.random() * ((MAX + 1) - MIN)) + MIN;

		return adj + '-' + noun + '-' + num;

	}


	function eventEmitter(max = 100) {
		let eventCount = 0; // Counter to keep track of the number of events emitted
		const maxEvents = max; // Maximum number of events to emit

		function emitEvent() {
			if (eventCount >= maxEvents) {
				console.log('Maximum event limit reached');
				clearInterval(intervalId); // Stop the interval when max events are reached
				return;
			}

			try {
				const possibleEvents = [
					'ad viewed', 'comment posted', 'share clicked', 'click', 'scroll', 'click', 'scroll', 'reload', 'type', 'click', 'scroll', 'like', 'dislike', 'click', 'purchase', 'watch video', 'subscribe'
				];
				const eventToTrack = Math.random() > 0.5 ? 'page view' : possibleEvents[Math.floor(Math.random() * possibleEvents.length)];
				mixpanel.track(eventToTrack);
				eventCount++;
			} catch (e) {
				console.error(e);
			}
		}

		function scheduleNextEvent() {
			const interval = Math.random() * (15000 - 3000) + 3000; // Calculate a random interval between 3000ms (3s) and 15000ms (15s)
			setTimeout(() => {
				emitEvent();
				scheduleNextEvent(); // Schedule the next event after the current one is emitted
			}, interval);
		}

		scheduleNextEvent(); // Start the event emission process
	}

	eventEmitter(); // Call the function to begin emitting events

}