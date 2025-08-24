/** @typedef {import('./types').ChromeStorage} PersistentStorage */
/** @type {PersistentStorage} */
let STORAGE;
let cachedFlags = null;

let track = noop;

const APP_VERSION = `2.41`;
const SCRIPTS = {
	"hundredX": { path: './src/tweaks/hundredX.js', code: "" },
	"catchFetch": { path: "./src/tweaks/catchFetch.js", code: "" },
	"featureFlag": { path: "./src/tweaks/featureFlag.js", code: "" },
	"hideBanners": { path: "./src/tweaks/hideBanners.js", code: "" },
	"renameTabs": { path: "./src/tweaks/renameTabs.js", code: "" },
	"hideBetas": { path: "./src/tweaks/hideBetas.js", code: "" },
};

/** @type {PersistentStorage} */
const STORAGE_MODEL = {
	version: APP_VERSION,
	persistScripts: [],
	serviceAcct: { user: '', pass: '' },
	whoami: { name: '', email: '', oauthToken: '', orgId: '', orgName: '' },
	sessionReplay: { token: "", enabled: false, tabId: 0 },
	verbose: true,
	modHeaders: { headers: [], enabled: false, savedHeaders: [] },
	last_updated: Date.now(),
	responseOverrides: {},
	externalDataCache: {
		featureFlags: { data: [], timestamp: 0 },
		demoLinks: { data: [], timestamp: 0 },
		tools: { data: [], timestamp: 0 }
	},
};

/*
----
RUNTIME
----
*/

let storageInitialized = false;
async function init() {
	if (storageInitialized) return STORAGE;

	const raw = await getStorage();

	// Preserve user config before any reset
	const preserved = {
		persistScripts: raw.persistScripts || [],
		sessionReplay: raw.sessionReplay || { token: "", enabled: false, tabId: 0 },
		modHeaders: raw.modHeaders || { headers: [], enabled: false, savedHeaders: [] },
		responseOverrides: raw.responseOverrides || {},
		whoami: raw.whoami || { name: '', email: '', oauthToken: '', orgId: '', orgName: '' },
		externalDataCache: raw.externalDataCache || {
			featureFlags: { data: [], timestamp: 0 },
			demoLinks: { data: [], timestamp: 0 },
			tools: { data: [], timestamp: 0 }
		}
	};

	let needsReset = false;

	if (!haveSameShape(raw, STORAGE_MODEL)) {
		console.log("mp-tweaks: storage shape mismatch — resetting");
		needsReset = true;
	} else if (raw.version !== APP_VERSION) {
		console.log("mp-tweaks: version bump — resetting");
		needsReset = true;
	}

	if (needsReset) {
		const fresh = {
			...structuredClone(STORAGE_MODEL), // <- ensures deep clone of template
			...preserved,
			version: APP_VERSION,
			last_updated: Date.now()
		};
		await clearStorageData();
		await setStorage(fresh);
		STORAGE = fresh;
	} else {
		STORAGE = raw;
	}

	if (!STORAGE?.whoami?.email?.includes('@mixpanel.com')) {
		console.log("mp-tweaks: fetching user...");
		const user = await getUser();
		if (user?.email) {
			STORAGE.whoami = user;
			await setStorage(STORAGE);
		}
	}

	if (STORAGE?.whoami?.email) {
		track = analytics(STORAGE.whoami.email, {
			component: "worker",
			name: STORAGE.whoami.name,
			$email: STORAGE.whoami.email,
			version: APP_VERSION
		});
	}

	storageInitialized = true;
	return STORAGE;
}

init().then(() => {
	console.log("mp-tweaks: worker initialized");
	return true;
});



/*
----
HOOKS
----
*/

//install
chrome.runtime.onInstalled.addListener((details) => {
	console.log('mp-tweaks: Extension Installed');
	track('worker: install', details);
	return;
});

chrome.runtime.onStartup.addListener(async () => {
	await init();
});

//open tabs
chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
	if (changeInfo.status === 'complete') {
		// mixpanel tweaks
		if (tab.url && tab.url.includes('mixpanel.com')) {
			console.log('mp-tweaks: Mixpanel page loaded');

			// persist scripts
			if ((tab.url.includes('project') || tab.url.includes('report'))) {
				track('worker: mp page', { url: tab.url });
				console.log('mp-tweaks: project page loaded');
				const { persistScripts = [] } = await getStorage();
				for (const script of persistScripts) {
					if (SCRIPTS[script]) {
						const { path } = SCRIPTS[script];
						if (path) {
							console.log(`mp-tweaks: running ${script}`);
							chrome.scripting.executeScript({
								target: { tabId: tabId },
								files: [path]
							});
						}
					}
				}
			}

			// report overrides
			const { responseOverrides = {} } = await getStorage();
			const project_id_index = tab.url.split('/').indexOf('project') + 1;
			const project_id = tab.url.split('/')[project_id_index];
			const overrides = responseOverrides[project_id];
			if (overrides) {
				console.log('mp-tweaks: injecting overrides', overrides);
				runScript(injectOverride, [overrides], { world: 'MAIN' }, tab);
				const catchFetchUri = chrome.runtime.getURL('/src/tweaks/catchFetch.js');
				runScript(catchFetchWrapper, [{ target: 'override' }, catchFetchUri], { world: 'MAIN' }, tab);
			}
		}

		//big data project
		if (tab.url.includes('mixpanel.com') && tab.url.includes('/3317160/')) {
			console.log('mp-tweaks: Big Data Project');
			chrome.scripting.executeScript({
				target: { tabId: tabId },
				files: ['./src/tweaks/hundredX.js']
			});
		}

		// session replay
		if (STORAGE?.sessionReplay?.enabled && tabId === STORAGE.sessionReplay.tabId) {
			console.log('mp-tweaks: starting session replay in tab ' + tabId);
			startSessionReplay(STORAGE.sessionReplay.token, tabId);

		}

	}


});

// closed tabs
chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
	if (tabId === STORAGE?.sessionReplay?.tabId) {
		STORAGE.sessionReplay.enabled = false;
		setStorage(STORAGE);
	}
});

// messages from extension
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	console.log(`mp-tweaks: got ${request?.action} message`);

	handleRequest(request)
		.then((result) => {
			console.log(`mp-tweaks: completed ${request.action}`);
			sendResponse(result);
		})
		.catch(error => {
			const ignoreErrors = [
				"Cannot access a chrome://",
				"extensions gallery cannot be scripted",
				"Frame with ID 0",
				"Cannot access a chrome-extension://"
			];
			if (ignoreErrors.some(err => error.message.includes(err))) {
				sendResponse({});
			}
			else {
				console.error('Error handling request:', error);
				track('handleRequestError', { request, error: error.message });
				sendResponse({ error: error.message });
			}
		});

	// Return true to keep the message channel open for the asynchronous response
	return true;
});




/*
----
ROUTING
----
*/

async function handleRequest(request) {
	if (!request.action) throw new Error('No action provided');
	let result = null;
	const catchFetchUri = chrome.runtime.getURL('/src/tweaks/catchFetch.js');
	const reqId = uid();
	track('worker start', { action: request.action, data: request.data, reqId });

	switch (request.action) {
		case 'refresh-storage':
			console.log('mp-tweaks: refreshing storage');
			result = await refreshStorageData();
			break;

		case 'add-flag':
			console.log('mp-tweaks: adding flag', request.data.flag);
			result = await runScript(addFlag, [request.data.flag]);
			break;

		case 'remove-flags':
			console.log('mp-tweaks: removing flags');
			result = await runScript(removeFlags);
			break;

		case 'analytics':
			// result = await analytics();
			break;

		case 'make-project':
			console.log('mp-tweaks: creating new project');
			result = await makeProject();
			if (result) {
				const { url = "" } = result;
				if (url) await openNewTab(url, true);
			}
			// need to do tab opening in popup
			// if (result?.url) await openNewTab(result.url, true);
			break;

		case 'reset-user':
			console.log('mp-tweaks: resetting user');
			await resetStorageData();
			result = (await init())?.whoami;
			break;

		case 'save-response':
			console.log('mp-tweaks: saving API response');
			let {
				chartData = {},
				chartUiUrl = "",
				chartApiUrl = "",
				chartParams = {},
				chartOrigData = {},
				projectId = "",
				workspaceId = "",
				oldData = null,
				newData = null
			} = request.data;
			let project_id;
			let workspace_id;
			// api url format = /api/query/insights?workspace_id=3782804&project_id=3276012
			// ui url format = /project/3276012/view/3782804/app/insights
			if (chartApiUrl) {
				const url = new URL(`https://www.mixpanel.com` + chartApiUrl);
				const params = new URLSearchParams(url.search);
				project_id = params.get('project_id');
				workspace_id = params.get('workspace_id');
			}

			else if (chartUiUrl) {
				const splitUrl = chartUiUrl.split('/');
				const projectIdIndex = splitUrl.indexOf('project') + 1;
				const workspaceIdIndex = splitUrl.indexOf('view') + 1;
				project_id = splitUrl[projectIdIndex];
				workspace_id = splitUrl[workspaceIdIndex];
			}

			if (projectId) project_id = projectId;
			if (workspaceId) workspace_id = workspaceId;
			if (oldData) chartOrigData = oldData;
			if (newData) chartData = newData;
			if (!STORAGE.responseOverrides[project_id]) STORAGE.responseOverrides[project_id] = [];

			const data = {
				chartData,
				chartParams,
				chartApiUrl,
				chartUiUrl,
				project_id,
				workspace_id,
				chartOrigData
			};

			STORAGE.responseOverrides[project_id].push(data);
			await setStorage(STORAGE);
			await refreshStorageData();
			result = STORAGE.responseOverrides;
			await updateIconToBeActive(true);
			break;

		case 'clear-responses':
			console.log('mp-tweaks: clearing API responses');
			STORAGE.responseOverrides = {};
			await setStorage(STORAGE);
			result = STORAGE.responseOverrides;
			await updateIconToBeActive(false);
			await runScript(reload);
			break;

		case 'catch-fetch':
			console.log('mp-tweaks: catching fetch');
			try {
				const [scriptOutput] = await runScript(catchFetchWrapper, [request.data, catchFetchUri]);
				const { target = null, data = null } = scriptOutput.result;
				if (target === 'response') await messageExtension('caught-response', data);
				if (target === 'request') await messageExtension('caught-request', data);
				result = data;
			}
			catch (e) {
				console.error('mp-tweaks: error catching fetch', e);
				track('catch fetch error', { request, error: e });
				result = {};
			}
			break;

		case 'draw-chart':
			console.log('mp-tweaks: drawing chart data');
			await runScript(echo, [request.data, "ALTERED_MIXPANEL_DATA"]);
			result = await runScript(catchFetchWrapper, [request.data, catchFetchUri]);
			break;

		case 'start-replay':
			console.log('mp-tweaks: starting session replay');
			await relaxCSP();
			STORAGE.sessionReplay.enabled = true;
			if (request?.data?.token && request?.data?.tabId) {
				STORAGE.sessionReplay.token = request.data.token;
				STORAGE.sessionReplay.tabId = request.data.tabId;
				await setStorage(STORAGE);
			}
			// var { token, tabId } = STORAGE.sessionReplay;
			// if (token && tabId) result = await startSessionReplay(token, tabId);
			await runScript(reload);
			await updateIconToBeActive(STORAGE.sessionReplay.enabled);
			break;

		case 'stop-replay':
			console.log('mp-tweaks: stopping session replay');
			await resetCSP();
			STORAGE.sessionReplay.enabled = false;
			result = false;
			await setStorage(STORAGE);
			await runScript(reload);
			await updateIconToBeActive(STORAGE.sessionReplay.enabled);
			break;

		//update headers and call updateHeaders
		case 'mod-headers':
			console.log('mp-tweaks: updating headers');
			const headers = request.data.headers;
			STORAGE.modHeaders.headers = headers;
			if (headers.length > 0 && headers.some(h => h.enabled)) STORAGE.modHeaders.enabled = true;
			else STORAGE.modHeaders.enabled = false;
			await updateIconToBeActive(STORAGE.modHeaders.enabled);
			await setStorage(STORAGE);
			result = await updateHeaders(headers);
			break;

		//update state of UI component but don't call updateHeaders
		case 'store-headers':
			console.log('mp-tweaks: storing headers');
			const newHeaders = request.data.headers;
			if (areEqual(newHeaders, STORAGE.modHeaders.headers)) {
				console.log('mp-tweaks: headers unchanged');
				result = null;
				break;
			}
			STORAGE.modHeaders.headers = newHeaders;
			if (newHeaders.some(h => h.enabled)) STORAGE.modHeaders.enabled = true;
			else STORAGE.modHeaders.enabled = false;
			result = await setStorage(STORAGE);
			break;

		case 'store-headers-text':
			console.log('mp-tweaks: storing saved headers for persistence');
			const savedHeaders = request.data.savedHeaders;
			if (areEqual(savedHeaders, STORAGE.modHeaders.savedHeaders)) {
				console.log('mp-tweaks: saved headers unchanged');
				result = null;
				break;
			}
			STORAGE.modHeaders.savedHeaders = savedHeaders;
			result = await setStorage(STORAGE);
			break;

		case 'reset-headers':
			console.log('mp-tweaks: resetting headers');
			STORAGE.modHeaders.headers = [];
			STORAGE.modHeaders.enabled = false;
			STORAGE.modHeaders.savedHeaders = [];
			await updateIconToBeActive(STORAGE.modHeaders.enabled);
			await setStorage(STORAGE);
			result = await removeHeaders();
			await runScript(reload);
			break;

		case 'embed-sdk':
			console.log('mp-tweaks: embedding mixpanel SDK');
			await injectMixpanelSDK(request?.data?.tab?.id || undefined);
			break;

		case 'nuke-cookies':
			console.log('mp-tweaks: nuking cookies');
			result = await nukeCookies();
			break;

		case 'reload':
			console.log('mp-tweaks: reloading page');
			await runScript(reload);
			result = true;
			break;

		case 'open-tab':
			console.log('mp-tweaks: opening new tab');
			result = await openNewTab(request.data.url, true);
			if (result.id && request.data) {
				await runScript(injectToolTip, [request.data], { world: 'MAIN' }, result);
			}
			break;

		default:
			console.error("mp-tweaks: unknown action", request);
			track('unknown-action', { request: request });
			result = "Unknown action";
	}
	track('worker end', { action: request.action, result: result, reqId });
	return result;
}


async function messageExtension(action, data) {
	try {
		console.log('mp-tweaks: sending message to popup:', action);
		const sent = await chrome.runtime.sendMessage({ action, data });
		return sent;
	}
	catch (e) {
		console.error('mp-tweaks: error sending message:', e, "action:", action, "data", data);
		return e;
	}
}

/*
----
RUN IN WORKER
----
*/

async function updateHeaders(headers = [{ "foo": "bar", enabled: false }]) {
	// clear out any old rules
	await removeHeaders();

	// build the array of set-ops
	const setOps = headers
		.filter(h => h.enabled)
		.map(({ enabled, ...h }) => {
			const name = Object.keys(h)[0];
			return { header: name, operation: "set", value: h[name] };
		});

	if (setOps.length === 0) {
		// nothing to do
		return await removeHeaders();
	}

	// build the corresponding remove-ops for rule 2
	const removeOps = setOps.map(({ header }) => ({
		header,
		operation: "remove"
	}));

	const rules = [
		{
			id: 1,
			priority: 1,
			action: {
				type: "modifyHeaders",
				requestHeaders: setOps
			},
			condition: {
				urlFilter: "*",
				resourceTypes: [
					"main_frame",
					"sub_frame",
					"xmlhttprequest",
					"script",
					"other"
				]
			}
		},
		{
			id: 2,
			priority: 2,
			action: {
				type: "modifyHeaders",
				requestHeaders: removeOps
			},
			condition: {
				// use regexFilter with anchors so only the *exact* URLs match
				//regexFilter: "^(?:https://mixpanel\\.com/settings/account|https://mixpanel\\.com/oauth/access_token)$",
				regexFilter: "^(?:https://mixpanel\\.com/settings/account|)$",
				resourceTypes: [
					"main_frame",
					"sub_frame",
					"xmlhttprequest",
					"script",
					"other"
				]
			}
		}
	];

	return chrome.declarativeNetRequest.updateDynamicRules({
		removeRuleIds: [1, 2],
		addRules: rules
	});
}

async function removeHeaders() {
	try {
		// 1. grab every dynamic rule you've ever added
		const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
		const existingRuleIds = existingRules.map(r => r.id);

		// 2. if there’s anything to remove, nuke it
		if (existingRuleIds.length > 0) {
			await chrome.declarativeNetRequest.updateDynamicRules({
				removeRuleIds: existingRuleIds,
				addRules: []   // explicitly add nothing
			});
		}
	}
	catch (e) {
		console.error('mp-tweaks: error clearing dynamic rules', e);
		throw e;
	}
}


async function relaxCSP() {
	await removeHeaders();
	try {
		const responseHeaders = [{
			header: "content-security-policy",
			operation: "remove"
		}];

		const update = await chrome.declarativeNetRequest.updateDynamicRules({
			removeRuleIds: [1],
			addRules: [{
				id: 1,
				priority: 1,
				action: {
					type: "modifyHeaders",
					responseHeaders
				},
				condition: {
					urlFilter: "*",
					resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "script"]
				}
			}]
		});

		return update;
	}
	catch (e) {
		console.error('mp-tweaks: error updating CSP headers:', e);
		return e;
	}
}

async function resetCSP() {
	try {
		// This removes all dynamic rules, effectively restoring original CSP behavior
		const update = await chrome.declarativeNetRequest.updateDynamicRules({
			removeRuleIds: [1],  // Remove our CSP modification rule
			addRules: []  // Don't add any new rules
		});
		return update;
	}
	catch (e) {
		console.error('mp-tweaks: error resetting CSP headers:', e);
		return e;
	}
}

/**
 * @param  {boolean} enabled
 */
async function updateIconToBeActive(enabled) {
	if (typeof enabled !== 'boolean') throw new Error(`update icon expected boolean, got ${typeof enabled}`);
	let iconPath = enabled ? "/icons/iconActive.png" : "icons/icon128.png";
	iconPath = chrome.runtime.getURL(iconPath);

	try {
		await chrome.action.setIcon({ path: iconPath });
		console.log('mp-tweaks updated icon:', iconPath);
	} catch (error) {
		console.error('mp-tweaks failed to update icon:', error, "icon:", iconPath);
	}
}


async function makeProject() {
	const excludedOrgs = [
		1, // Mixpanel
		328203, // Mixpanel Demo
		1673847, // SE Demo
		1866253 // Demo Projects
	];
	const { orgId = "", oauthToken = "" } = STORAGE?.whoami;
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
RUN IN PAGE (using runScript())
----
*/


async function startSessionReplay(token, tabId) {
	const library = await injectMixpanelSDK(tabId);
	const proxy = 'https://express-proxy-lmozz6xkha-uc.a.run.app';
	const init = await runScript(sessionReplayInit, [token, { proxy }, STORAGE?.whoami], { world: "MAIN" }, { id: tabId });
	const caution = runScript('./src/tweaks/cautionIcon.js', [], {}, { id: tabId });
	return [library, init, caution];

}


async function injectToolTip(tooltip) {
	function waitForElement(selector, context = document, interval = 1000, timeout = 60000 * 60) {
		return new Promise((resolve, reject) => {
			const startTime = Date.now();

			const poller = setInterval(() => {
				const element = context.querySelector(selector);
				if (element) {
					clearInterval(poller);
					resolve(element);
				} else if (Date.now() - startTime >= timeout) {
					clearInterval(poller);
					reject(new Error(`mp-tweaks: element ${selector} not found within ${timeout}ms.`));
				}
			}, interval);
		});
	}

	if (typeof tooltip === 'string') tooltip = { primary: tooltip };
	if (typeof tooltip !== 'object') throw new Error('Invalid tooltip data');
	if (!tooltip.primary) tooltip.primary = "";
	if (!tooltip.secondary) tooltip.secondary = "";
	if (tooltip.text && !tooltip.secondary) tooltip.primary = tooltip.text;
	if (tooltip.tooltip && !tooltip.secondary && !tooltip.primary) tooltip.primary = tooltip.tooltip;
	if (!tooltip.primary && !tooltip.secondary) return; // no text to inject

	const html = `
    <div class="banner-copy info-theme">
        <header class="banner-header info-theme">${tooltip.primary}</header>
        <div class="banner-body info-theme">
            <div><span>${tooltip.secondary}</span></div>
        </div>
    </div>
`.trim();



	try {
		console.log('mp-tweaks: waiting for mp-report-message-banner; payload', tooltip);
		const reportBanner = await waitForElement("mp-report-message-banner");
		reportBanner.setAttribute('theme', "info");
		reportBanner.setAttribute('size', "medium");
		reportBanner.setAttribute('visible', "true");
		reportBanner.setAttribute('closeable', "true");
		const mpBanner = await waitForElement("mp-banner", reportBanner.shadowRoot);
		const mpBannerContent = mpBanner.shadowRoot.querySelector("div.banner-copy");
		// replace mpBannerContent with html
		mpBannerContent.innerHTML = html;
		console.log('mp-tweaks: tooltip injected');
	}
	catch (error) {
		console.error(error);
	}
}

async function injectMixpanelSDK(tabId) {
	console.log('mp-tweaks: injecting mixpanel SDK');
	// First, read the content of your mixpanel-snippet.js file
	const response = await fetch(chrome.runtime.getURL('/src/lib/mixpanel-snippet.js'));
	let code = await response.text();

	// Replace the URL in the code
	// const mixpanelUrl = chrome.runtime.getURL('/src/lib/mixpanel-ac-alpha.js');
	// const mixpanelUrl = chrome.runtime.getURL('/src/lib/mixpanel-dev-jakub.js');
	const mixpanelUrl = chrome.runtime.getURL('/src/lib/mixpanel-full.js');
	code = code.replace('chrome.runtime.getURL("/src/lib/mixpanel-full.js")', `"${mixpanelUrl}"`);

	// Inject the modified code
	const injection = await chrome.scripting.executeScript({
		target: { tabId },
		world: 'MAIN',
		func: (codeToInject) => {
			const script = document.createElement('script');
			script.textContent = codeToInject;
			document.documentElement.appendChild(script);
			script.remove();
		},
		args: [code]
	});

	console.log('mp-tweaks: mixpanel SDK injected');
	return injection;
}

async function nukeCookies(domain = "mixpanel.com") {
	const allCookies = await chrome.cookies.getAll({});
	const cookies = allCookies.filter(c => c.domain.includes(domain));
	if (cookies.length === 0) return "zero";
	for (const cookie of cookies) {
		await chrome.cookies.remove({ url: `https://${cookie.domain}${cookie.path}`, name: cookie.name });
	}
	return cookies.length;
}


async function runScript(funcOrPath, args = [], opts, target) {
	try {
		if (!target) target = await getCurrentTab();
		if (typeof funcOrPath === 'function') {
			let payload = { target: { tabId: target.id }, func: funcOrPath };
			if (args) payload.args = args;
			if (!opts) opts = { world: 'MAIN' };
			if (opts) payload = { ...opts, ...payload };

			const result = chrome.scripting.executeScript(payload);
			return result;
		}
		else if (typeof funcOrPath === 'string') {
			let payload = { target: { tabId: target.id }, files: [funcOrPath] };
			if (!opts) opts = { world: 'MAIN' };
			if (opts) payload = { ...opts, ...payload };
			const result = chrome.scripting.executeScript(payload);
			return result;
		}
		else {
			throw new Error('Invalid function or path');
		}
	}
	catch (e) {
		console.log('mp-tweaks: error running script:', "funcOrPath:", funcOrPath, "args:", args, "opts:", opts, "target:", target);
		console.error(e);
		return false;

	}
}

function catchFetchWrapper(data, url) {
	return new Promise((resolve, reject) => {
		if (!window.MIXPANEL_CATCH_FETCH_ACTIVE) {
			console.log('mp-tweaks: catch fetch wrapper');
			window.CATCH_FETCH_INTENT = data.target;
			var s = document.createElement('script');
			s.src = url;
			s.onload = function () {
				// @ts-ignore
				this.remove();
			};
			(document.head || document.documentElement).appendChild(s);

			window.addEventListener("caught-request", function (event) {
				// Send data to service worker
				// @ts-ignore
				resolve({ data: event.detail, target: data.target });
			});

			window.addEventListener("caught-response", function (event) {
				// Send data to service worker
				// @ts-ignore
				resolve({ data: event.detail, target: data.target });
			});
		}
	});

}

function injectOverride(mockData) {
	window.ALTERED_MIXPANEL_OVERRIDES = mockData || [];
	console.log('mp-tweaks: overrides injected:', window.ALTERED_MIXPANEL_OVERRIDES);
}


function echo(data, key) {
	console.log(`mp-tweaks: echoing data at key ${key}...`, data);
	window[key] = data;
}

function reload() {
	window.location.reload();
}

function openNewTab(url, inBackground = false) {
	return new Promise((resolve, reject) => {
		try {
			chrome.tabs.create({ url: url, active: !inBackground }, function (tab) {
				resolve(tab);
			});
		} catch (e) {
			reject(e);
		}
	});
}

function sessionReplayInit(token, opts = {}, user) {
	let attempts = 0;
	let intervalId;
	const proxy = opts.proxy || 'https://express-proxy-lmozz6xkha-uc.a.run.app';
	const addTracking = opts.addTracking || false;

	function tryInit() {
		// @ts-ignore
		if (window.mixpanel && !window.SESSION_REPLAY_ACTIVE) {
			console.log('mp-tweaks: turning on session replay');
			window.SESSION_REPLAY_ACTIVE = true;
			clearInterval(intervalId);

			mixpanel.init(token, {

				// autocapture
				autocapture: {
					pageview: "full-url",
					click: true,
					input: true,
					scroll: true,
					submit: true,
					capture_text_content: true
				},

				//session replay
				record_sessions_percent: 100,
				record_inline_images: true,
				record_collect_fonts: true,
				record_mask_text_selector: 'nothing',
				record_block_selector: "nothing",
				record_block_class: "nothing",
				record_canvas: true,
				record_heatmap_data: true,

				//normal mixpanel
				ignore_dnt: true,
				batch_flush_interval_ms: 0,
				api_host: proxy,
				loaded: function (mp) {
					console.log('mp-tweaks: session replay + autocapture loaded');
					// if (addTracking) {
					// 	setTimeout(() => {
					// 		mp.track('page view');
					// 	}, 100);
					// 	window.addEventListener('click', () => { mp.track('page click'); });
					// }
				},
				debug: true,
				api_transport: 'XHR',
				persistence: "localStorage",



			});
		} else {
			attempts++;
			console.log(`mp-tweaks: waiting for sessionReplay ... attempt: ${attempts}`);
			if (attempts > 15) {
				clearInterval(intervalId);
				console.log('mp-tweaks: session replay not found');
			}

		}
	}

	intervalId = setInterval(tryInit, 2500);

}

function removeFlags() {
	const url = new URL(document.location.href); // Use .href to get the string
	if (url.href.includes('mixpanel') && url.href.includes('project')) {
		url.searchParams.delete('feature-flags');
		document.location.href = url.toString(); // Assign a string to location.href
	}
}

function addFlag(flag) {
	const url = new URL(document.location.href); // Use .href to get the string
	if (url.href.includes('mixpanel') && url.href.includes('project')) {
		//no query string
		if (!url.search.includes('feature-flags')) {
			url.searchParams.set('feature-flags', flag);
		}
		//has params
		else {
			let oldFlags = url.searchParams.get('feature-flags');
			if (oldFlags) { // Check if oldFlags is not null
				url.searchParams.set('feature-flags', oldFlags + "," + flag);
			}
		}
		document.location.href = url.toString(); // Assign a string to location.href
	}
}


/*
----
HELPERS
----
*/



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

	// check if all those keys are the same
	if (!keys1.every(key => keys2.includes(key))) {
		return false;
	}


	// Check if all keys in obj1 are in obj2 and have the same shape
	// for (let key of keys1) {
	// 	if (!keys2.includes(key)) {
	// 		return false;
	// 	}
	// 	if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
	// 		if (!haveSameShape(obj1[key], obj2[key])) {
	// 			return false;
	// 		}
	// 	} else if (typeof obj1[key] !== typeof obj2[key]) {
	// 		// Check if the types of values are different
	// 		return false;
	// 	}
	// }

	return true;
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


// turn objects into strings and compare; this isn't perfect but it's good enough for our purposes
function areEqual(obj1, obj2) {
	return stableStringify(obj1) === stableStringify(obj2);
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function noop(...vary) { }

/*
----
STORAGE
----
*/

async function resetStorageData() {
	storageInitialized = false;
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

async function getStorage(keys = null, retries = 3, delay = 1000) {
	const attempt = (resolve, reject, remainingRetries) => {
		chrome.storage.local.get(keys, (result) => {
			if (chrome.runtime.lastError) {
				if (remainingRetries > 0) {
					setTimeout(() => attempt(resolve, reject, remainingRetries - 1), delay);
				} else {
					reject(new Error(chrome.runtime.lastError.message || JSON.stringify(chrome.runtime.lastError)));
				}
			} else {
				resolve(result);
			}
		});
	};

	return new Promise((resolve, reject) => attempt(resolve, reject, retries));
}

async function setStorage(data) {
	data.last_updated = Date.now();
	return new Promise((resolve, reject) => {
		chrome.storage.local.get(null, (existing) => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError));
				return;
			}

			const merged = { ...existing, ...data };

			chrome.storage.local.set(merged, () => {
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError));
				} else {
					STORAGE = merged;
					resolve(merged);
				}
			});
		});
	});
}

async function clearStorageData() {
	return new Promise((resolve, reject) => {
		chrome.storage.local.clear(() => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
			} else {
				resolve({});
			}
		});
	});
}

async function getUser() {
	const user = { name: '', email: '', oauthToken: '', orgId: '', orgName: '' };
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
				if (!user_email.includes('@mixpanel.com')) throw new Error(`${user_email} not a mixpanel employee`);
				const foundOrg = Object.values(data.results.organizations).filter(o => o.name.includes(user_name))?.pop();
				if (foundOrg) {
					user.orgId = foundOrg.id?.toString();
					user.orgName = foundOrg.name;
				}
				if (!foundOrg) {
					// the name is not in the orgs, so we need to find the org in which the user is the owner
					const ignoreProjects = [1673847, 1866253, 328203];
					const possibleOrg = Object.values(data.results.organizations)
						.filter(o => o.role === 'owner')
						.filter(o => !ignoreProjects.includes(o.id))?.pop();
					if (possibleOrg) {
						user.orgId = possibleOrg?.id?.toString();
						user.orgName = possibleOrg.name;
					}
				}
			}
		}
	}
	catch (err) {
		// @ts-ignore
		if (err?.message?.includes('JSON')) {
			console.log('mp-tweaks: user is not logged in');
		}
		else {
			console.error('mp-tweaks: get user err', err);
		}
	}

	return user;
}

function analytics(user_id, superProps = {}, token = "99526f575a41223fcbadd9efdd280c7e", url = "https://api.mixpanel.com/track?verbose=1") {
	const blacklist = ['oauthToken'];
	return function (eventName = "ping", props = {}, callback = (res) => { }) {
		try {
			for (const key in props) {
				if (blacklist.includes(key)) {
					delete props[key];
				}
			}
		}

		catch (err) {
			console.error('mp-tweaks: analytics error; event:', eventName, 'props:', props, 'error', err);
			callback({});
		}
		try {
			const headers = {
				"Content-Type": "application/json",
				"Accept": "text/plain",
			};
			const payload = JSON.stringify([
				{
					event: eventName,
					properties: {
						token: token,
						$user_id: user_id,
						...superProps,
						...props,
					}
				}
			]);

			fetch(url, {
				method: 'POST',
				headers: headers,
				body: payload
			})
				.then(response => response.text())  // Assuming the response is text (plain or JSON)
				.then(text => {
					try {
						// Attempt to parse it as JSON
						const jsonData = JSON.parse(text);
						callback(jsonData);  // Passing back as an array for consistency with your original function
					} catch (error) {
						// If it's not JSON, pass the raw response
						callback(text);
					}
				})
				.catch(error => {
					console.error('mp-tweaks: analytics error; event:', eventName, 'props:', props, 'error', error);
					callback({});  // Invoke the callback with empty array to indicate failure
				});
		}
		catch (err) {
			console.error('mp-tweaks: analytics error; event:', eventName, 'props:', props, 'error', err);
			callback({});
		}
	};
}

function uid(length = 32) {
	//https://stackoverflow.com/a/1349426/4808195
	var result = [];
	var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var charactersLength = characters.length;
	for (var i = 0; i < length; i++) {
		result.push(characters.charAt(Math.floor(Math.random() *
			charactersLength)));
	}
	return result.join('');
};

// hack for typescript
let module = {};
module.exports = {};