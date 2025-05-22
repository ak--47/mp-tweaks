/** @typedef {import('./types').ChromeStorage} PersistentStorage */
/** @type {PersistentStorage} */
// @ts-ignore
let STORAGE;

const APP_VERSION = `2.35`;
const FEATURE_FLAG_URI = `https://docs.google.com/spreadsheets/d/e/2PACX-1vTks7GMkQBfvqKgjIyzLkRYAGRhcN6yZhI46lutP8G8OokZlpBO6KxclQXGINgS63uOmhreG9ClnFpb/pub?gid=0&single=true&output=csv`;
const DEMO_GROUPS_URI = `https://docs.google.com/spreadsheets/d/e/2PACX-1vQdxs7SWlOc3f_b2f2j4fBk2hwoU7GBABAmJhtutEdPvqIU4I9_QRG6m3KSWNDnw5CYB4pEeRAiSjN7/pub?gid=0&single=true&output=csv`;
const TOOLS_URI = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRN5Eu0Lj2dfxM7OSZiR91rcN4JSTprUz07wk8jZZyxOhOHZvRnlgGHJKIOHb6DIb4sjQQma35dCzPZ/pub?gid=0&single=true&output=csv`;

const APP = {
	currentVersion: APP_VERSION,
	dataSources: [
		{ name: 'featureFlags', url: FEATURE_FLAG_URI },
		{ name: 'demoLinks', url: DEMO_GROUPS_URI },
		{ name: 'tools', url: TOOLS_URI }
	],
	tools: {
		"dm3": "https://dm3.mixpanel.org",
		"dm lite": "https://dm3.mixpanel.org/lite",
		"fixpanel": "https://ak--47.github.io/fixpanel/",
		"power tools": "https://mixpanel-power-tools-gui-lmozz6xkha-uc.a.run.app/",
		"replay sim": "https://npc-mixpanel-lmozz6xkha-uc.a.run.app/",
		"bq perms": "https://us-central1-mixpanel-gtm-training.cloudfunctions.net/mp-bq-iam-demo"

	},
	DOM: {},
	cacheDOM,
	bindListeners,
	loadInterface,
	getCheckbox,
	setCheckbox,
	fetchCSV,
	buildFlagButtons,
	buildDemoButtons,
	buildToolsButtons,
	analytics,
	saveJSON,
	hideLoader,
	getStorage,
	setStorage,
	messageWorker,
	listenForWorker,
	dataEditorHandleCatch,
	queryBuilderHandleCatch,
	getHeaders,
	addQueryParams,
	storeBatchResponses,
	init: function () {
		this.cacheDOM();
		this.getStorage().then(() => {
			this.bindListeners();
			this.loadInterface();
			this.listenForWorker();
			this.analytics();

			// fetch data from google sheets, then hide loader and build UI buttons
			const sources = this.dataSources;
			Promise.all(sources.map(source => this.fetchCSV(source.url, source.name)))
				.then((data) => {
					const [flags, demoLinks, tools] = data;
					this.hideLoader();
					flags.forEach((button) => {
						this.buildFlagButtons(button);
					});
					const demos = groupBy(demoLinks);
					for (const demo in demos) {
						const data = demos[demo];
						this.buildDemoButtons(demo, data);
					}
					tools.forEach((button) => {
						this.buildToolsButtons(button);
					});


				})
				.catch((e) => {
					console.error('mp-tweaks: error fetching data', e);
					this.hideLoader();
				})
				.finally(() => {
					console.log('mp-tweaks: app is ready');
				});
		});
	},

};

APP.init();

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

function openNewTab(url, inBackground = false) {
	return new Promise((resolve, reject) => {
		try {
			chrome.tabs.create({ url: url, active: !inBackground }, function (tab) {
				resolve(tab);
			});
		} catch (e) {
			track('error: openNewTab', { error: e, url, inBackground });
			reject(e);
		}
	});
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}


async function fetchCSV(url, name) {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort('timeout'), 3000);

		const response = await fetch(url, { signal: controller.signal });
		const text = await response.text();
		clearTimeout(timeout);

		let parseData = Papa.parse(text, {
			header: true
		}).data;



		// this.buttonData = parseData;
		return parseData;
	} catch (e) {

		try {
			const storage = await getStorage();
			const cache = storage[name];
			if (cache) {
				return cache;
			}
			else {
				track('error: fetchCSV (cache fail)', { error: e });
				return [];
			}

		}
		catch (e) {
			// Handle fetch errors (including abort)
			track('error: fetchCSV', { error: e });
			// return [{ label: "QTS", flag: 'query_time_sampling' }];

			//serve from cache
			return [];
		}
	}
}

async function messageWorker(action, data) {
	if (!action) throw new Error('No action provided');

	const payload = { action };
	if (data) payload.data = data;

	try {
		const response = await sendMessageAsync(payload);
		console.log('Response from worker:', response);
		return response;
	} catch (error) {
		track('error: messageWorker', { action, error });
		console.error('Error:', error);
	}

}

async function getStorage(keys = null) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get(keys, (result) => {
			if (chrome.runtime.lastError) {
				if (STORAGE) {
					resolve(STORAGE); // use cached storage if available
				} else {
					track('error: getStorage (cache miss)', { error: chrome.runtime.lastError });
					reject(new Error(chrome.runtime.lastError.message || 'Unknown error'));
				}
			} else {
				STORAGE = result;
				resolve(result);
			}
		});
	});
}

async function setStorage(data) {
	data.last_updated = Date.now();

	return new Promise((resolve, reject) => {
		chrome.storage.local.get(null, (existing) => {
			if (chrome.runtime.lastError) {
				track('error: setStorage:get', { error: chrome.runtime.lastError });
				reject(new Error(chrome.runtime.lastError.message || 'Unknown error during get before set'));
				return;
			}

			const merged = { ...existing, ...data };

			chrome.storage.local.set(merged, () => {
				if (chrome.runtime.lastError) {
					track('error: setStorage:set', { error: chrome.runtime.lastError });
					reject(new Error(chrome.runtime.lastError.message || 'Unknown error during set'));
				} else {
					STORAGE = merged;
					messageWorker('refresh-storage'); // tell the worker to refresh
					resolve(merged);
				}
			});
		});
	});
}

// listen for messages from the worker
function listenForWorker() {
	// @ts-ignore
	chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
		console.log("mp-tweaks: received message", message);

		switch (message.action) {
			case "caught-response":
				var { api_url, request, response, ui_url } = message.data;
				APP.dataEditorHandleCatch(api_url, ui_url, request, response);
				break;
			case "caught-request":
				var { api_url, request } = message.data;
				//todo:
				APP.queryBuilderHandleCatch(request);
				break;
			case "refresh-storage":
				APP.getStorage().then(() => {
					APP.loadInterface();
				});
				break;
			case "reset-headers":
				break;
			case "mod-headers":
				break;
			case "make-project":
				break;
			case "nuke-cookies":
				alert(`Deleted ${message.data || "zero "} mixpanel.com cookies`);
				break;
			case "reload":
				break;
			default:
				track('error: listenForWorker', { message });
				console.log("mp-tweaks: unknown action", message.action);
				break;
		}

		// return true; // Keep the message channel open for sendResponse
	});
}

function sendMessageAsync(payload) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(payload, (response) => {
			if (chrome.runtime.lastError) {
				track('error: sendMessageAsync', { error: chrome.runtime.lastError });
				reject(new Error(chrome.runtime.lastError.message));
			} else {
				resolve(response);
			}
		});
	});
}

function dataEditorHandleCatch(api_url, ui_url, request, response) {
	this.DOM.queryMetadata.classList.remove('hidden');
	this.DOM.postChartData.classList.remove('hidden');
	this.DOM.resetDataEditor.classList.remove('hidden');
	this.DOM.rawDataWrapper.classList.remove('hidden');
	this.DOM.rawDataTextField.classList.remove('hidden');
	this.DOM.randomize.classList.remove('hidden');
	this.DOM.saveChartData.classList.remove('hidden');

	this.DOM.fetchChartData.classList.add('hidden');
	this.DOM.buildChartPayload.classList.add('hidden');

	this.DOM.rawDataTextField.value = JSON.stringify(response, null, 2);
	this.DOM.origResponse.setAttribute('data', JSON.stringify(response));
	this.DOM.apiUrl.textContent = api_url;
	this.DOM.apiUrl.href = api_url;
	this.DOM.uiUrl.textContent = ui_url;
	this.DOM.uiUrl.href = ui_url;
	const apiParams = extractBookmark(request);
	const pretty = JSON.stringify(apiParams, null, 2);
	this.DOM.apiPayload.setAttribute('data', JSON.stringify(apiParams));
	this.DOM.apiPayload.title = pretty;
	this.DOM.apiPayload.textContent = `{...}`;

}

function extractBookmark(request) {
	const { bookmark = {} } = request;
	const payload = { bookmark };
	return payload;
}

function queryBuilderHandleCatch(data) {
	this.DOM.lastChartLink.closest('p').classList.add('hidden');
	this.DOM.fetchChartData.classList.add('hidden');
	this.DOM.buildChartPayload.classList.add('hidden');
	this.DOM.postChartData.classList.add('hidden');
	this.DOM.resetDataEditor.classList.add('hidden');
	this.DOM.rawDataWrapper.classList.remove('hidden');
	this.DOM.rawDataTextField.classList.remove('hidden');
	this.DOM.randomize.classList.add('hidden');
	this.DOM.saveChartData.classList.remove('hidden');
	// @ts-ignore
	const region = data?.region || 'us'; //todo
	let reportName = data?.report_query_origin || data?.tracking_props?.report_name;
	if (reportName === 'flows') reportName = 'arb_funnels';
	const [projectId, workspaceId] = data?.tracking_props?.request_url?.split('/')?.filter(a => !isNaN(parseInt(a)));
	const { bookmark = {} } = data;
	const payload = { bookmark };
	const curlSnippet = String.raw`
	curl 'https://mixpanel.com/api/query/${reportName}?workspace_id=${workspaceId}&project_id=${projectId}' \
  -H 'accept: */*' \
  -H 'authorization: Bearer ${STORAGE.whoami.oauthToken}' \
  -H 'cache-control: no-cache' \
  -H 'content-type: application/json; charset=UTF-8' \
  -H 'user-agent: mp-tweaks' \
  --data-raw '${JSON.stringify(payload)}'
	`.trim();
	this.DOM.rawDataTextField.value = curlSnippet;
	console.log('mp-tweaks: query builder handled catch', data);
}

function hideLoader() {
	this.DOM.loader.classList.add('hidden');
	this.DOM.loader.style.display = 'none';
	this.DOM.main.classList.remove('hidden');
}

function setCheckbox(state) {
	for (let setting of state) {
		try {
			APP.DOM[setting].checked = true;
		} catch (e) {
			track('error: setCheckbox', { setting, error: e });
			console.error(`failed to toggle ${setting}`, e);
		}
	}
}

function getCheckbox() {
	const persistScript = [];
	this.DOM.toggles.forEach(function (checkbox) {
		if (checkbox.checked) persistScript.push(checkbox.id);
	});

	return persistScript;
}

function cacheDOM() {
	//main
	this.DOM.main = document.querySelector('#main');
	this.DOM.loader = document.getElementById('loader');

	//demo builds
	this.DOM.demoLinks = document.querySelector('#demoLinks');
	this.DOM.demoLinksWrapper = document.querySelector('#demoLinks > .buttons');

	//tools
	this.DOM.toolsWrapper = document.querySelector('#toolsWrapper');

	//feature flags
	this.DOM.perTab = document.querySelector('#perTab');
	this.DOM.buttonWrapper = document.querySelector('#perTab > .buttons');
	this.DOM.removeAll = document.querySelector('#removeAll');

	//persistent scripts	
	this.DOM.toggles = document.querySelectorAll('.toggle');
	this.DOM.persistentOptions = document.querySelector('#persistentOptions');
	this.DOM.hideBanners = document.querySelector('#hideBanners');
	this.DOM.hideBetas = document.querySelector('#hideBetas');
	this.DOM.renameTabs = document.querySelector('#renameTabs');
	this.DOM.hundredX = document.querySelector('#hundredX');

	//chart fetcher + api maker	
	this.DOM.fetchChartData = document.querySelector('#fetchChartData');
	this.DOM.buildChartPayload = document.querySelector('#buildChartPayload');
	this.DOM.postChartData = document.querySelector('#postChartData');
	this.DOM.resetDataEditor = document.querySelector('#resetDataEditor');
	this.DOM.rawDataWrapper = document.querySelector('#rawDataWrapper');
	this.DOM.rawDataTextField = document.querySelector('#rawData');
	this.DOM.randomize = document.querySelector('#randomize');
	this.DOM.saveChartData = document.querySelector('#saveChartData');
	this.DOM.contextError = document.querySelector('#contextError');
	this.DOM.jsonError = document.querySelector('#badJSON');
	this.DOM.queryMetadata = document.querySelector('#queryMetadata');
	this.DOM.apiUrl = document.querySelector('#apiUrl');
	this.DOM.uiUrl = document.querySelector('#uiUrl');
	this.DOM.apiPayload = document.querySelector('#apiPayload');
	this.DOM.origResponse = document.querySelector('#origResponse');

	//project creator
	this.DOM.makeProject = document.querySelector('#makeProject');
	this.DOM.resetUser = document.querySelector('#resetUser');
	this.DOM.projectDetails = document.querySelector('#projectDetails textarea');
	this.DOM.makeProjectSpinner = document.querySelector('#makeProjectSpinner');
	this.DOM.orgLabel = document.querySelector('#orgLabel');
	this.DOM.orgPlaceholder = document.querySelector('#orgLabel b');



	//session replay
	this.DOM.startReplay = document.querySelector('#startReplay');
	this.DOM.stopReplay = document.querySelector('#stopReplay');
	this.DOM.sessionReplayToken = document.querySelector('#sessionReplayToken');
	this.DOM.sessionReplayLabel = document.querySelector('#sessionReplayLabel');
	this.DOM.sessionReplayStatus = document.querySelector('#sessionReplayLabel b');

	//odds and ends
	this.DOM.nukeCookies = document.querySelector('#nukeCookies');
	this.DOM.embedSDK = document.querySelector('#embedSDK');

	this.DOM.versionLabel = document.querySelector('#versionLabel');

	//headers
	this.DOM.checkPairs = document.querySelectorAll('.checkPair');
	this.DOM.deletePairs = document.querySelectorAll('.deletePair');
	this.DOM.headerKeys = document.querySelectorAll('.headerKey');
	this.DOM.headerValues = document.querySelectorAll('.headerValue');
	this.DOM.saveHeaders = document.querySelector('#saveHeaders');
	this.DOM.clearHeaders = document.querySelector('#clearHeaders');
	this.DOM.modHeaderLabel = document.querySelector('#modHeaderLabel');
	this.DOM.modHeaderStatus = document.querySelector('#modHeaderLabel b');
	this.DOM.addHeader = document.querySelector('#addHeader');
	this.DOM.userHeaders = document.querySelector('#userHeaders');

}

function loadInterface() {
	try {
		const { persistScripts, whoami, sessionReplay, modHeaders } = STORAGE;

		//load toggle states
		APP.setCheckbox(persistScripts);

		//org label
		if (whoami.orgId) {
			this.DOM.orgLabel.classList.remove('hidden');
			this.DOM.orgPlaceholder.textContent = `${whoami.orgName} (${whoami.orgId})`;
			this.DOM.makeProject.disabled = false;
		}
		else {
			this.DOM.orgLabel.classList.add('hidden');
			this.DOM.makeProject.disabled = true;
		}


		//session replay labels + token
		if (sessionReplay.token) this.DOM.sessionReplayToken.value = sessionReplay.token;
		if (sessionReplay.enabled) this.DOM.sessionReplayStatus.textContent = `ENABLED (tab #${STORAGE?.sessionReplay?.tabId || ""})`;
		if (!sessionReplay.enabled) this.DOM.sessionReplayStatus.textContent = `DISABLED`;

		//mod header
		if (modHeaders.enabled) this.DOM.modHeaderStatus.textContent = `ENABLED`;
		else this.DOM.modHeaderStatus.textContent = `DISABLED`;

		//hack to deal with more than 3 headers...
		if (modHeaders.headers.length > 3) {
			const numClicks = modHeaders.headers.length - 3;
			for (let i = 0; i < numClicks; i++) {
				this.DOM.addHeader.click(); //yea i know...
				this.cacheDOM(); //re-cache the DOM
			}
		}

		//load headers
		modHeaders.headers.forEach((obj, index) => {
			const { enabled, ...header } = obj;
			this.DOM.checkPairs[index].checked = enabled;
			this.DOM.headerKeys[index].value = Object.keys(header)[0];
			this.DOM.headerValues[index].value = Object.values(header)[0];
		});

		//version
		this.DOM.versionLabel.textContent = `v${APP_VERSION}`;

		renderChartOverrides();

	}
	catch (e) {
		track('error: loadInterface', { error: e });
		console.error('mp-tweaks: error loading interface', e);
	}

}

function bindListeners() {
	try {
		//FEATURE FLAGS
		this.DOM.toggles.forEach(function (checkbox) {
			// @ts-ignore
			checkbox.addEventListener('click', function (event) {
				const data = APP.getCheckbox();
				setStorage({ 'persistScripts': data }).then(() => { });
			});
		});

		this.DOM.removeAll.addEventListener('click', async function () {
			messageWorker('remove-flags');

		});

		//CREATE PROJECT
		this.DOM.makeProject.addEventListener('click', async () => {
			this.DOM.projectDetails.classList.add('hidden');
			this.DOM.makeProjectSpinner.classList.remove('hidden');
			this.DOM.makeProject.disabled = true;

			try {
				const newProject = await messageWorker('make-project');
				const { api_secret = "", id = "", name = "", token = "", url = "" } = newProject;
				const display = `Project Name: ${name}\nProject ID: ${id}\nAPI Secret: ${api_secret}\nAPI Token: ${token}\nProject URL: ${url}`;
				this.DOM.projectDetails.value = display;
				this.saveJSON(newProject, `project-${name}`);
				// await sleep(5000)
				// openNewTab(url);
				track('make-project', { name, id, token, url });

			}
			catch (e) {
				track('error: make-project', { error: e });
				this.DOM.projectDetails.value = `Error!\n${e}`;
			}

			this.DOM.makeProjectSpinner.classList.add('hidden');
			this.DOM.projectDetails.classList.remove('hidden');
			this.DOM.makeProject.disabled = false;

		});

		//RESET USER
		this.DOM.resetUser.addEventListener('click', async () => {
			this.DOM.projectDetails.classList.add('hidden');
			this.DOM.makeProjectSpinner.classList.remove('hidden');
			this.DOM.makeProject.disabled = true;

			try {
				const newUser = await messageWorker('reset-user');
				const { orgId, orgName, name, id } = newUser;
				this.DOM.orgLabel.classList.remove('hidden');
				this.DOM.orgPlaceholder.textContent = `${orgName} (${orgId})`;
				track('reset-user', { name, id });

			}
			catch (e) {
				track('error: reset-user', { error: e });
				this.DOM.projectDetails.value = `Error!\n${e}`;
			}

			this.DOM.makeProjectSpinner.classList.add('hidden');
			this.DOM.projectDetails.classList.add('hidden');
			this.DOM.makeProject.disabled = false;

		});

		// QUERY API BUILDER
		this.DOM.buildChartPayload.addEventListener('click', () => {
			this.DOM.fetchChartData.classList.add('hidden');
			console.log('mp-tweaks: catch-request');
			const warningMessage = setTimeout(() => {
				if (!Array.from(this.DOM.fetchChartData.classList).includes('hidden')) {
					this.DOM.contextError.classList.remove('hidden');
				} else {
					this.DOM.contextError.classList.add('hidden');
				}
			}, 5000);
			messageWorker('catch-fetch', { target: "request" }).then((result) => {
				// result is an object with the data from the page
				clearTimeout(warningMessage);
				console.log('mp-tweaks: caught-request', result);
			}
			);
		});

		//GET CHART DATA
		this.DOM.fetchChartData.addEventListener('click', () => {
			this.DOM.buildChartPayload.classList.add('hidden');
			console.log('mp-tweaks: catch-fetch');
			const warningMessage = setTimeout(() => {
				if (!Array.from(this.DOM.fetchChartData.classList).includes('hidden')) {
					this.DOM.contextError.classList.remove('hidden');
				} else {
					this.DOM.contextError.classList.add('hidden');
				}
			}, 5000);
			messageWorker('catch-fetch', { target: "response" }).then((result) => {
				// result is an object with the data from the page
				clearTimeout(warningMessage);
				console.log('mp-tweaks: caught-fetch', result);
			});

		});

		this.DOM.apiPayload.addEventListener('click', (e) => {
			e.preventDefault(); // prevent jump-to-top behavior
			const json = this.DOM.apiPayload.getAttribute('data'); // stored as attribute
			if (!json) return;
			try {
				const prettyJSON = JSON.stringify(JSON.parse(json), null, 2);
				navigator.clipboard.writeText(prettyJSON).then(() => {
					console.log("mp-tweaks: payload copied to clipboard!");
					this.DOM.apiPayload.textContent = "Copied!";
					setTimeout(() => (this.DOM.apiPayload.textContent = `{...}`), 500);
				});
			} catch (err) {
				console.error("mp-tweaks: Failed to copy payload", err);
			}
		});


		//DRAW CHART DATA
		this.DOM.postChartData.addEventListener('click', () => {
			//validate we have JSON
			let isValidJSON = false;
			try {
				JSON.parse(this.DOM.rawDataTextField.value);
				this.DOM.jsonError.classList.add('hidden');
				isValidJSON = true;
			} catch (e) {
				this.DOM.jsonError.classList.remove('hidden');
			}

			if (isValidJSON) {
				const alteredData = JSON.parse(this.DOM.rawDataTextField.value);
				messageWorker('draw-chart', { ...alteredData, target: "response" });
			}
		});

		//RANDOMIZE
		this.DOM.randomize.addEventListener('click', () => {
			try {
				let currentData = JSON.parse(this.DOM.rawDataTextField.value);
				let mutatedData = flipIntegers(currentData);
				this.DOM.rawDataTextField.value = JSON.stringify(mutatedData, null, 2);
			}
			catch (e) {
				console.log('mp-tweaks: error randomizing', e);
			}

		});

		//RESET DATA EDITOR
		this.DOM.resetDataEditor.addEventListener('click', () => {
			this.DOM.postChartData.classList.add('hidden');
			this.DOM.rawDataWrapper.classList.add('hidden');
			this.DOM.randomize.classList.add('hidden');
			this.DOM.contextError.classList.add('hidden');
			this.DOM.jsonError.classList.add('hidden');
			this.DOM.saveChartData.classList.add('hidden');
			this.DOM.queryMetadata.classList.add('hidden');

			this.DOM.fetchChartData.classList.remove('hidden');
			this.DOM.buildChartPayload.classList.remove('hidden');
			this.DOM.resetDataEditor.classList.remove('hidden');

			messageWorker('clear-responses')
				.then(() => {
					console.log('mp-tweaks: cleared responses');
					renderChartOverrides();
				})
				.catch(error => {
					console.error('mp-tweaks: error clearing responses', error);
				});

		});

		//SAVE DATA
		this.DOM.saveChartData.addEventListener('click', () => {
			const data = {
				chartData: JSON.parse(this.DOM.rawDataTextField.value),
				chartUiUrl: this.DOM.uiUrl.textContent,
				chartApiUrl: this.DOM.apiUrl.textContent,
				chartParams: JSON.parse(this.DOM.apiPayload.getAttribute('data')),
				chartOrigData: JSON.parse(this.DOM.origResponse.getAttribute('data'))
			};
			messageWorker('save-response', { ...data })
				.then(response => {
					console.log('mp-tweaks: worker response saved', response);
					renderChartOverrides();
				})
				.catch(error => {
					console.error('mp-tweaks: worker response error', error);
				});
		});

		//SESSION REPLAY

		//autosave
		this.DOM.sessionReplayToken.addEventListener('input', () => {
			const token = this.DOM.sessionReplayToken.value;
			if (token !== STORAGE.sessionReplay.token) {
				setStorage({ sessionReplay: { token, enabled: false } });
			}
		});


		//start
		this.DOM.startReplay.addEventListener('click', async () => {
			const token = this.DOM.sessionReplayToken.value;
			if (!token) {
				alert('token required');
				return;
			}
			const tabId = await captureCurrentTabId();
			this.DOM.sessionReplayStatus.textContent = `ENABLED (tab #${tabId?.toString()})`;
			messageWorker('start-replay', { token, tabId });
		});

		//stop
		this.DOM.stopReplay.addEventListener('click', () => {
			this.DOM.sessionReplayStatus.textContent = `DISABLED`;
			messageWorker('stop-replay');
		});

		// MOD HEADER

		//refresh button
		this.DOM.saveHeaders.addEventListener('click', () => {
			const data = this.getHeaders();
			const active = data.filter(obj => obj.enabled);
			if (active.length === 0) {
				this.DOM.modHeaderStatus.textContent = `DISABLED`;
				messageWorker('reset-headers');
				setTimeout(() => { messageWorker('reload'); }, 250);
			}

			if (active.length > 0) {
				this.DOM.modHeaderStatus.textContent = `ENABLED`;
				messageWorker('mod-headers', { headers: data });
				setTimeout(() => { messageWorker('reload'); }, 250);

			}
		});

		// user input keys
		this.DOM.headerKeys.forEach(node => {
			node.addEventListener('input', () => {
				messageWorker('store-headers', { headers: this.getHeaders() });
			});
		});

		this.DOM.headerKeys.forEach(node => {
			node.addEventListener('blur', () => {
				const data = this.getHeaders();
				const active = data.filter(obj => obj.enabled);
				if (active.length === 0) this.DOM.modHeaderStatus.textContent = `DISABLED`;
				if (active.length > 0) this.DOM.modHeaderStatus.textContent = `ENABLED`;
				messageWorker('mod-headers', { headers: data });
			});
		});


		// user input values
		this.DOM.headerValues.forEach(node => {
			node.addEventListener('input', () => {
				messageWorker('store-headers', { headers: this.getHeaders() });
			});
		});

		this.DOM.headerValues.forEach(node => {
			node.addEventListener('blur', () => {
				const data = this.getHeaders();
				const active = data.filter(obj => obj.enabled);
				if (active.length === 0) this.DOM.modHeaderStatus.textContent = `DISABLED`;
				if (active.length > 0) this.DOM.modHeaderStatus.textContent = `ENABLED`;
				messageWorker('mod-headers', { headers: data });
			});
		});


		// changing checkbox
		this.DOM.checkPairs.forEach(node => {
			node.addEventListener('change', () => {
				const data = this.getHeaders();
				const active = data.filter(obj => obj.enabled);
				if (active.length === 0) this.DOM.modHeaderStatus.textContent = `DISABLED`;
				if (active.length > 0) this.DOM.modHeaderStatus.textContent = `ENABLED`;
				messageWorker('mod-headers', { headers: data });
			});
		});

		// REMOVE HEADER
		this.DOM.deletePairs.forEach((node, index) => {
			node.addEventListener('click', (clickEv) => {
				let row = clickEv.target.closest('.row');
				if (row) this.DOM.userHeaders.removeChild(row);
				const data = this.getHeaders();
				const active = data.filter(obj => obj.enabled);
				if (active.length === 0) this.DOM.modHeaderStatus.textContent = `DISABLED`;
				if (active.length > 0) this.DOM.modHeaderStatus.textContent = `ENABLED`;
				messageWorker('mod-headers', { headers: data });
				setTimeout(() => { messageWorker('reload'); }, 250);
			});
		});

		// ADD HEADER
		this.DOM.addHeader.addEventListener('click', () => {
			addHeaderRow.bind(this)();
		});

		// RESET
		this.DOM.clearHeaders.addEventListener('click', () => {
			this.DOM.headerKeys.forEach(node => node.value = node.getAttribute('placeholder') || "");
			this.DOM.headerValues.forEach(node => node.value = "");
			this.DOM.checkPairs.forEach(node => node.checked = false);
			this.DOM.modHeaderStatus.textContent = `DISABLED`;
			const additionalRows = Array.from(this.DOM.userHeaders).slice(3);
			additionalRows.forEach(row => row.remove());
			messageWorker('reset-headers');
		});

		this.DOM.nukeCookies.addEventListener('click', async () => {
			const numDeleted = await messageWorker('nuke-cookies');
			alert(`Deleted ${numDeleted} cookies`);
		});

		this.DOM.embedSDK.addEventListener('click', async () => {
			const tab = await getCurrentTab();
			await messageWorker('embed-sdk', { tab });
		});
	}
	catch (e) {
		track('error: bindListeners', { error: e });
		console.error('mp-tweaks: error binding listeners', e);

	}
}

//todo: make this better
function renderChartOverrides() {
	const overrides = STORAGE?.responseOverrides || {};
	const container = document.getElementById('overrideList');
	if (!container) {
		console.error('mp-tweaks: overrideList not found');
		return;
	}
	container.innerHTML = "";

	if (!Object.keys(overrides).length) {
		container.textContent = "No saved overrides.";
		return;
	}

	for (const projectId in overrides) {
		const projectDiv = document.createElement('div');
		projectDiv.className = "projectOverride";
		projectDiv.innerHTML = `<h4>Project ${projectId}</h4>`;

		for (const hash in overrides[projectId]) {
			const override = overrides[projectId][hash];

			const row = document.createElement('div');
			row.className = "overrideRow";

			const button = document.createElement('button');
			button.textContent = override?.chartUiUrl?.split("/app/")[1] || hash.slice(0, 8);
			button.onclick = () => {
				APP.dataEditorHandleCatch(override.chartApiUrl, override.chartUiUrl, override.chartParams, override.chartData);
			};

			const del = document.createElement('button');
			del.textContent = "✕";
			del.title = "Delete this override";
			del.style.marginLeft = "1em";
			del.onclick = async () => {
				// remove from array by index
				const overridesArray = STORAGE.responseOverrides[projectId];

				// find the index based on object identity (or a unique property like chartUiUrl)
				const index = overridesArray.findIndex(item => item === override);

				if (index !== -1) {
					delete overridesArray[index]; // leaves undefined
					STORAGE.responseOverrides[projectId] = overridesArray.filter(Boolean); // compact
				}

				// optionally remove empty project
				if (STORAGE.responseOverrides[projectId].length === 0) {
					delete STORAGE.responseOverrides[projectId];
				}

				await setStorage({ responseOverrides: STORAGE.responseOverrides });
				renderChartOverrides();
			};

			row.appendChild(button);
			row.appendChild(del);
			projectDiv.appendChild(row);
		}

		container.appendChild(projectDiv);
	}
}

function buildFlagButtons(object) {
	let name = object.label;
	let flag = object.flag;
	let buttonId = object.label.replace(/\s/g, '');
	let newButton = document.createElement('BUTTON');
	newButton.setAttribute('class', 'button fa');
	newButton.setAttribute('id', buttonId);
	newButton.appendChild(document.createTextNode(name.toUpperCase()));
	newButton.onclick = async () => {
		track('flag button', { flag });
		messageWorker('add-flag', { flag });
	};
	this.DOM.buttonWrapper.appendChild(newButton);
}

function buildToolsButtons(buttonData) {
	//tool buttons
	const { tool, url } = buttonData;
	if (!tool) {
		const err = new Error("missing tool in buttonData");
		// @ts-ignore
		err.data = buttonData;
		throw err;
	} if (!url) {
		const err = new Error("missing url in buttonData");
		// @ts-ignore
		err.data = buttonData;
		throw err;
	}

	const newButton = document.createElement('BUTTON');
	newButton.setAttribute('class', 'button fa');
	newButton.setAttribute('id', tool);
	newButton.appendChild(document.createTextNode(tool.toUpperCase()));
	newButton.onclick = async () => {
		track('tool button', { tool });
		await openNewTab(url, true);
	};
	this.DOM.toolsWrapper.appendChild(newButton);
}

function buildDemoButtons(demo, data) {
	let newButton = document.createElement('BUTTON');
	newButton.setAttribute('class', 'button fa');
	newButton.setAttribute('id', demo);
	newButton.appendChild(document.createTextNode(demo.toUpperCase()));
	newButton.onclick = async () => {
		track('demo button', { demo });
		// do something with the data
		data.forEach(async (obj) => {

			const { URL } = obj;
			let meta;
			try {
				meta = JSON.parse(obj.META);
			}

			catch (e) {
				meta = {};
			}

			let url;
			if (STORAGE.whoami.email) url = addQueryParams(URL, { user: STORAGE.whoami.email });
			else url = URL;
			messageWorker('open-tab', { url, ...meta });
		});
	};
	this.DOM.demoLinksWrapper.appendChild(newButton);

}

function groupBy(objects, field = 'TITLE') {
	return objects.reduce((acc, obj) => {
		const key = obj[field];
		if (!acc[key]) {
			acc[key] = [];
		}
		acc[key].push(obj);
		return acc;
	}, {});
}

function addQueryParams(url, params) {
	if (url.includes('distinct_id=') && params.user && url.includes('3276012')) {
		return url.replace(/distinct_id=/, `distinct_id=${params.user}`);
	}

	let [baseUrl, hash] = url.split('#');
	let queryString = '';

	// Check if the baseUrl already has query parameters
	const hasQueryParams = baseUrl.includes('?');

	// Convert params object to query string
	for (let key in params) {
		if (params.hasOwnProperty(key)) {
			queryString += `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}&`;
		}
	}

	// Remove the trailing '&'
	queryString = queryString.slice(0, -1);

	// Concatenate baseUrl with new query string
	const updatedBaseUrl = hasQueryParams ? `${baseUrl}&${queryString}` : `${baseUrl}?${queryString}`;

	// Reattach the hash if it exists
	return hash ? `${updatedBaseUrl}#${hash}` : updatedBaseUrl;
}

function flipIntegers(obj) {
	Object.keys(obj).forEach(key => {

		//recursion :(
		if (typeof obj[key] === 'object') {
			try {
				flipIntegers(obj[key]);
			} catch (e) { }
		}

		//ewww ... mutating the input
		else if (typeof obj[key] === 'number') {
			if (obj[key] !== 1) {
				//it's a number; change it (maybe)
				let currentNum = obj[key];

				if (currentNum > 1)
					obj[key] = Math.random() > .5 ? currentNum * 2 : Math.floor(currentNum / 2);

				else {
					obj[key] = Math.random() > .5 ? currentNum * 2 : currentNum / 2;
				}
			}

		}
	});

	return obj;
}

function getHeaders() {
	const data = [];
	//always live query the DOM

	/** @type {NodeListOf<HTMLInputElement>} */
	const headerKeys = document.querySelectorAll('.headerKey');
	/** @type {NodeListOf<HTMLInputElement>} */
	const headerValues = document.querySelectorAll('.headerValue');
	/** @type {NodeListOf<HTMLInputElement>} */
	const checkPairs = document.querySelectorAll('.checkPair');

	headerKeys.forEach((key, index) => {
		const value = headerValues[index].value.trim();
		if (key.value.trim() !== '' && value !== '') {
			const checked = checkPairs[index].checked;
			data.push({ [key.value]: value, enabled: checked });
		}
	});

	return data;
}

function addHeaderRow() {
	/** @type {HTMLDivElement} */
	const row = document.createElement('div');
	row.className = 'row';
	row.innerHTML = `
        <input class="checkPair" type="checkbox"/> 
        <input class="headerKey" type="text"/> : 
        <input class="headerValue" type="text"/> 
        <button class="deletePair">-</button>
        <br/>
    `;

	// Append to the container
	this.DOM.userHeaders.appendChild(row);

	// Add event listeners

	row?.querySelector('.headerKey')?.addEventListener('input', () => {
		messageWorker('store-headers', { headers: this.getHeaders() });
	});

	row?.querySelector('.headerValue')?.addEventListener('input', () => {
		messageWorker('store-headers', { headers: this.getHeaders() });
	});

	row?.querySelector('.headerKey')?.addEventListener('blur', () => {
		messageWorker('mod-headers', { headers: this.getHeaders() });
	});

	row?.querySelector('.headerValue')?.addEventListener('blur', () => {
		messageWorker('mod-headers', { headers: this.getHeaders() });
	});

	row?.querySelector('.checkPair')?.addEventListener('change', () => {
		const data = this.getHeaders();
		const active = data.filter(obj => obj.enabled);
		if (active.length === 0) this.DOM.modHeaderStatus.textContent = `DISABLED`;
		if (active.length > 0) this.DOM.modHeaderStatus.textContent = `ENABLED`;
		messageWorker('mod-headers', { headers: data });
	});

	row?.querySelector('.deletePair')?.addEventListener('click', () => {
		row.remove(); // Remove the row
		const data = this.getHeaders();
		const active = data.filter(obj => obj.enabled);
		if (active.length === 0) this.DOM.modHeaderStatus.textContent = `DISABLED`;
		if (active.length > 0) this.DOM.modHeaderStatus.textContent = `ENABLED`;
		messageWorker('mod-headers', { headers: data }).then(() => {
			messageWorker('reload');
		});
	});


}

function filterObj(hash, test_function, keysOrValues = "value") {
	let key, i;
	const iterator = Object.keys(hash);
	const filtered = {};

	for (i = 0; i < iterator.length; i++) {
		key = iterator[i];
		if (keysOrValues === 'value') {
			if (test_function(hash[key])) {
				filtered[key] = hash[key];
			}
		}
		if (keysOrValues === 'key') {
			if (test_function(key.toString())) {
				filtered[key] = hash[key];
			}
		}
	}

	return filtered;
};

function analytics() {
	mixpanel.init("99526f575a41223fcbadd9efdd280c7e", {
		persistence: 'localStorage',
		api_host: "https://api.mixpanel.com",
		cross_site_cookie: true,
		window: {
			navigator: {
				doNotTrack: '0'
			}
		},
		record_sessions_percent: 100,
		record_inline_images: true,
		record_collect_fonts: true,
		record_mask_text_selector: "nope",
		record_block_selector: "nope",
		record_block_class: "nope",
		ignore_dnt: true,
		loaded: function (mixpanel) {
			const current_distinct_id = mixpanel.get_distinct_id();
			if (!current_distinct_id.includes("@")) {
				const { whoami } = STORAGE;
				if (whoami?.email) {
					console.log(`mp-tweaks: setting distinct id to ${whoami.email}`);
					mixpanel.identify(whoami.email);
					mixpanel.register({
						"$email": whoami.email,
						"version": APP.currentVersion,
						"name": whoami.name,
						"component": "frontend"
					});
					mixpanel.people.set({ "$name": whoami.name, "$email": whoami.email });
					mixpanel.people.set_once({ "$created": new Date().toISOString() });
				}
			}
			mixpanel.track('open extension');
			mixpanel.people.increment('# of opens');

			// simplest possible UI button tracking
			const analyticsManifest = Object.keys(APP.DOM).map(key => ({
				key: key,
				value: APP.DOM[key]
			}));

			for (const node of analyticsManifest) {
				if (node?.value) {
					if (node?.value?.tagName) {
						if (node.value.tagName === 'BUTTON') {
							node.value.addEventListener('click', () => {
								mixpanel.track(node.key);
							});
						}
					}
				}
			}
		},
		secure_cookie: true
	});
}

function track(event, data = {}) {
	const blacklist = ['oauthToken'];
	let props = {};
	//serialize errors so they don't just become {};
	loopProps: for (const key in data) {
		if (data[key] instanceof Error) {
			props.error = {
				message: data[key]?.message || "",
				stack: data[key]?.stack || "",
				name: data[key]?.name || "",
				// file: data[key]?.fileName || "",
				// line: data[key]?.lineNumber || ""
			};
		}
		else if (blacklist.includes(key)) {
			continue loopProps;
		}

		else {
			props[key] = data[key];
		}
	}

	try {
		mixpanel.track(event, props);
	}
	catch (e) {
		console.error('mp-tweaks: failed to track', e);
	}
}

function saveJSON(chartData = {}, fileName = `no fileName`) {
	if (typeof chartData !== 'string') {
		chartData = JSON.stringify(chartData, null, 2);
	}

	// @ts-ignore
	const chartBlob = new Blob([chartData], {
		type: "text/plain;charset=utf-8"
	});

	saveAs(chartBlob, `${fileName}.json`);
	console.log('saved!');
}

async function captureCurrentTabId() {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			if (tabs.length && tabs[0].id) {
				resolve(tabs[0].id);
			} else {
				track('error: captureCurrentTabId', { tabs });
				reject(new Error('No active tab found'));
			}
		});
	});
}

async function storeBatchResponses(responses) {
	//responses should have a minimum of 3 keys: projectId, oldData, newData
	for (const response of responses) {
		const { projectId, oldData, newData } = response;
		if (!projectId || !oldData || !newData) {
			console.error('mp-tweaks: response missing data', response);
			continue;
		}
		const stored = await messageWorker('save-response', response);
		console.log('mp-tweaks: stored response', stored);
	}

	console.log(`mp-tweaks: stored ${responses.length} responses`, responses);
	return true;
}



try {
	if (window) {
		// @ts-ignore
		window.APP = APP;
	}
}

catch (e) {
	//noop
}