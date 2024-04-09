

const APP_VERSION = `2.2`;
/** @typedef {import('./types').ChromeStorage} ChromeStorage */

const TWEAKS = {
	"hundredX": { path: './src/tweaks/hundredX.js', code: "" },
	"catchFetch": { path: "./src/tweaks/catchFetch.js", code: "" },
	"featureFlag": { path: "./src/tweaks/featureFlag.js", code: "" },
	"hideBanners": { path: "./src/tweaks/hideBanners.js", code: "" },
	"renameTabs": { path: "./src/tweaks/renameTabs.js", code: "" }
};

/** @type {ChromeStorage} */
let STORAGE = {};

/** @type {ChromeStorage} */
const STORAGE_MODEL = {
	version: APP_VERSION,
	persistScripts: [],
	serviceAcct: { user: '', pass: '' },
	whoami: { name: '', email: '', token: '', orgId: '' },
	featureFlags: [],
	sessionReplay: { token: "", enabled: false },
	ezTrack: { token: "", enabled: false },
	verbose: true
};

function log(...args) {
	if (STORAGE.verbose) console.log(...args);
}

async function init() {
	// await loadScripts();
	// log("mp-tweaks: scripts loaded");

	STORAGE = await getStorage();
	if (!haveSameShape(STORAGE, STORAGE_MODEL) || STORAGE.version !== APP_VERSION) {
		log("mp-tweaks: reset");
		await resetStorageData();
	}

	if (!STORAGE?.whoami?.email) {
		log("mp-tweaks: getting user");
		const user = await getUser();
		if (user.email) STORAGE.whoami = user;
		await setStorage(STORAGE);
	}

	return STORAGE;
}

init().then(() => { log("mp-tweaks: worker initialized"); });


/*
----
HOOKS
----
*/

//install
chrome.runtime.onInstalled.addListener(() => { log('mp-tweaks: Extension Installed'); });

//page load
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
	if (changeInfo.status === 'complete') {
		// mixpanel tweaks
		if (tab.url.includes('mixpanel.com') && (tab.url.includes('project') || tab.url.includes('report'))) {
			log('mp-tweaks: Mixpanel page loaded');
			const scripts = STORAGE.persistScripts;
			for (const script of scripts) {
				if (TWEAKS[script]) {
					const { path } = TWEAKS[script];
					if (path) {
						log(`mp-tweaks: running ${script}`);
						chrome.scripting.executeScript({
							target: { tabId: tabId },
							files: [path]
						});
					}
				}
			}
		}

		// ezTrack
		if (tab.url.includes('http')) {
			if (STORAGE.ezTrack.enabled) {
				log('mp-tweaks: starting ezTrack');
				startEzTrack(STORAGE.ezTrack.token);

			}
		}

		// session replay
		//todo

	}
});

// messages from extension
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	log(`mp-tweaks: got ${request?.action} message`);

	handleRequest(request)
		.then((result) => {
			log(`mp-tweaks: completed ${request.action}`);
			if (result) sendResponse(result);
		})
		.catch(error => {
			console.error('Error handling request:', error);
			sendResponse({ error: error.message });
		});

	// Return true to keep the message channel open for the asynchronous response
	return true;
});

/*
----
ASYNC
----
*/


async function handleRequest(request) {
	if (!request.action) throw new Error('No action provided');
	let result = null;
	switch (request.action) {
		case 'refresh-storage':
			result = await refreshStorageData();
			break;
		case 'add-flag':
			result = await runScript(addFlag, [request.data.flag]);
			break;
		case 'remove-flags':
			result = await runScript(removeFlags);
			break;
		case 'analytics':
			result = await analytics();
			break;
		case 'make-project':
			result = await makeProject();
			break;
		case 'catch-fetch':
			result = await runScript("./src/tweaks/catchFetchWrapper.js");
			break;
		case 'caught-fetch':
			result = request.data;
			return;
		case 'draw-chart':
			await runScript(echo, [request.data], null, { world: 'MAIN' });
			result = await runScript("./src/tweaks/catchFetchWrapper.js");
			break;
		case 'start-eztrack':
			storage.ezTrack.enabled = true;
			if (request?.data?.token) {
				STORAGE.ezTrack.token = request.data.token;
				await setStorage(STORAGE);
			}
			const token = STORAGE.ezTrack.token;
			if (token) result = await startEzTrack(token);
			break;
		case 'stop-eztrack':
			storage.ezTrack.enabled = false;
			result = false;
			break;
		default:
			console.error("mp-tweaks: unknown action", request);
			result = "Unknown action";
	}
	return result;
}

function echo(data) {
	log('mp-tweaks: echoing data...', data);
	window.ALTERED_MIXPANEL_DATA = data;
}

function ezTrackInit(token, opts = {}) {
	if (Object.keys(opts).length === 0) opts = { verbose: true };
	let attempts = 0;

	function tryInit() {
		if (window.mpEZTrack) {
			clearInterval(intervalId); // Clear the interval once mpEZTrack is found
			mpEZTrack.init(token, opts); // Initialize mpEZTrack
		} else {
			attempts++;
			log(`mp-tweaks: waiting for mpEZTrack ... attempt: ${attempts}`);
			if (attempts > 10) {
				clearInterval(intervalId);
				log('mp-tweaks: mpEZTrack not found');
			}

		}
	}

	const intervalId = setInterval(tryInit, 500);
}

async function startEzTrack(token) {
	const library = await runScript("./src/tweaks/ezTrackWrapper.js");
	const init = await runScript(ezTrackInit, [token], null, { world: 'MAIN' });
	return [library, init];
}

async function runScript(funcOrPath, args = [], target, opts) {
	if (!target) target = await getCurrentTab();
	if (typeof funcOrPath === 'function') {
		let payload = { target: { tabId: target.id }, func: funcOrPath };
		if (args) payload.args = args;
		if (opts) payload = { ...opts, ...payload };
		const result = chrome.scripting.executeScript(payload);
		return result;
	}
	else if (typeof funcOrPath === 'string') {
		const result = chrome.scripting.executeScript({
			target: { tabId: target.id },
			files: [funcOrPath]
		});
		return result;
	}
	else {
		throw new Error('Invalid function or path');
	}
}

async function fetchScriptContent(scriptPath) {
	const response = await fetch(chrome.runtime.getURL(scriptPath));
	const script = await response.text();
	return script;
}

async function loadScripts() {
	for (const tweak in TWEAKS) {
		const script = await fetchScriptContent(TWEAKS[tweak].path);
		TWEAKS[tweak].code = script;
	}
}

async function resetStorageData() {
	await clearStorageData();
	STORAGE = STORAGE_MODEL;
	await setStorage(STORAGE);
	return STORAGE_MODEL;
}

async function refreshStorageData() {
	STORAGE = await getStorage();
	return STORAGE;
}

async function getCurrentTab() {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError));
			} else if (tabs[0]) {
				resolve(tabs[0]);
			} else {
				reject(new Error('No active tab found'));
			}
		});
	});
}

async function analytics() {
	// MIXPANEL
	const MIXPANEL_CUSTOM_LIB_URL = "./lib/mixpanel.min.js";
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
				MIXPANEL_CUSTOM_LIB_URL : "file:" === c.location.protocol && "https://cdn4.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\/\//) ? "https://cdn4.mxpnl.com/libs/mixpanel-2-latest.min.js" : "https://cdn4.mxpnl.com/libs/mixpanel-2-latest.min.js"; d = c.getElementsByTagName("script")[0]; d.parentNode.insertBefore(b, d);
		}
	})(document, window.mixpanel || []);

	return mixpanel.init("3e97f649a88698acc335a5d64a28ec72", {
		persistence: 'localStorage',
		api_host: "https://api.mixpanel.com",
		window: {
			navigator: {
				doNotTrack: '0'
			}
		},
		loaded: function (mixpanel) {
			mixpanel.reset();
			var theUser = getUser().then((user) => {
				mixpanel.register({
					"version": APP_VERSION
				});
				if (user !== "anonymous") {
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

			}).catch((err) => { });
			return theUser;

		},
		inapp_protocol: 'https://',
		secure_cookie: true
	});
}

async function getUser() {
	const user = { name: '', email: '', oauthToken: '', orgId: '' };
	const url = `https://mixpanel.com/oauth/access_token`;
	const request = await fetch(url, { credentials: 'include' });
	const response = await request.text();
	try {
		const oauthToken = JSON.parse(response)?.token;
		if (oauthToken) {
			user.oauthToken = oauthToken;
			const info = await fetch(`https://mixpanel.com/api/app/me/?include_workspace_users=false`, { headers: { Authorization: `Bearer ${oauthToken}` } });
			const data = await info.json();
			if (data?.results) {
				const { user_name = "", user_email = "" } = data.results;
				if (user_name) user.name = user_name;
				if (user_email) user.email = user_email;
				const foundOrg = Object.values(data.results.organizations).filter(o => o.name.includes(user_name))?.pop();
				if (foundOrg) {
					user.orgId = foundOrg.id;
					user.orgName = foundOrg.name;
				}
				if (!foundOrg) {
					// the name is not in the orgs, so we need to find the org in which the user is the owner
					const ignoreProjects = [1673847, 1866253, 328203];
					const possibleOrg = Object.values(data.results.organizations)
						.filter(o => o.role === 'owner')
						.filter(o => !ignoreProjects.includes(o.id))?.pop();
					if (possibleOrg) {
						user.orgId = possibleOrg;
						user.orgName = possibleOrg.name;
					}
				}
			}
		}
	}
	catch (err) {
		log(err);
	}

	return user;
}

async function getStorage(keys = null) {
	return new Promise((resolve, reject) => {
		chrome.storage.sync.get(keys, (result) => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError));
			} else {
				resolve(result);
			}
		});
	});
}

async function setStorage(data) {
	return new Promise((resolve, reject) => {
		chrome.storage.sync.set(data, () => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError));
			} else {
				resolve();
			}
		});
	});
}

async function clearStorageData() {
	return new Promise((resolve, reject) => {
		chrome.storage.sync.clear(() => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
			} else {
				resolve();
			}
		});
	});
}

async function makeProject() {
	const excludedOrgs = [
		1, // Mixpanel
		328203, // Mixpanel Demo
		1673847, // SE Demo
		1866253 // Demo Projects
	];
	const { orgId = "", oauthToken = "" } = STORAGE.whoami;
	if (!orgId || !oauthToken) return;
	const url = `https://mixpanel.com/api/app/organizations/${orgId}/create-project`;
	const projectPayload = {
		"cluster_id": 1,
		"project_name": genName(),
		"timezone_id": 404
	};

	const payload = {
		method: 'POST',

		headers: {
			Authorization: `Bearer ${oauthToken}`,
		},
		body: JSON.stringify(projectPayload)

	};

	const projectsReq = await fetch(url, payload);

	const projectsRes = await projectsReq.json();

	const { api_secret, id, name, token } = projectsRes.results;

	const data = {
		api_secret,
		id,
		name,
		token,
		url: `https://mixpanel.com/project/${id}/app/settings#project/${id}`

	};
	return data;
}


/*
----
HELPERS
----
*/

function removeFlags() {
	var url = new URL(document.location);
	if (url.href.includes('mixpanel') && url.href.includes('project')) {
		url.searchParams.delete('feature-flags');
	}
	document.location = url;
}

function addFlag(flag) {
	var url = new URL(document.location);
	if (url.href.includes('mixpanel') && url.href.includes('project')) {
		//no query string
		if (!document.location.search.includes('feature-flags')) {
			url.searchParams.set('feature-flags', flag);
		}
		//has params
		else {
			let oldFlags = url.searchParams.get('feature-flags');
			url.searchParams.set('feature-flags', oldFlags + "," + flag);
		}
	}
	document.location = url;
}


function genName() {
	var adjs = [
		"autumn", "hidden", "bitter", "misty", "silent", "empty", "dry", "dark",
		"summer", "icy", "delicate", "quiet", "white", "cool", "spring", "winter",
		"patient", "twilight", "dawn", "crimson", "wispy", "weathered", "blue",
		"billowing", "broken", "cold", "damp", "falling", "frosty", "green",
		"long", "late", "lingering", "bold", "little", "morning", "muddy", "old",
		"red", "rough", "still", "small", "sparkling", "throbbing", "shy",
		"wandering", "withered", "wild", "black", "young", "holy", "solitary",
		"fragrant", "aged", "snowy", "proud", "floral", "restless", "divine",
		"polished", "ancient", "purple", "lively", "nameless"
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
		"frog", "smoke", "star"
	];


	var adj = adjs[Math.floor(Math.random() * adjs.length)]; // http://stackoverflow.com/a/17516862/103058
	var noun = nouns[Math.floor(Math.random() * nouns.length)];
	var MIN = 1000;
	var MAX = 9999;
	var num = Math.floor(Math.random() * ((MAX + 1) - MIN)) + MIN;

	return 'ephem-' + adj + '-' + noun + '-' + num;


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
