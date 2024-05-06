/** @typedef {import('./types').ChromeStorage} PersistentStorage */
/** @type {PersistentStorage} */
// @ts-ignore
let STORAGE;

const APP_VERSION = `2.21`;
const FEATURE_FLAG_URI = `https://docs.google.com/spreadsheets/d/e/2PACX-1vTks7GMkQBfvqKgjIyzLkRYAGRhcN6yZhI46lutP8G8OokZlpBO6KxclQXGINgS63uOmhreG9ClnFpb/pub?gid=0&single=true&output=csv`;

const APP = {
	currentVersion: APP_VERSION,
	dataSource: FEATURE_FLAG_URI,
	DOM: {},
	cacheDOM,
	bindListeners,
	loadInterface,
	getCheckbox,
	setCheckbox,
	fetchCSV,
	buildButtons,
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
	init: function () {
		this.cacheDOM();
		this.getStorage().then(() => {
			this.bindListeners();
			this.loadInterface();			
			this.listenForWorker();
			this.analytics();

			// build buttons
			this.fetchCSV(this.dataSource)
				.then((data) => {
					this.hideLoader();
					data.forEach((button) => {
						this.buildButtons(button);
					});
				}).finally(() => {
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


async function fetchCSV(url) {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 3000);

		const response = await fetch(url, { signal: controller.signal });
		const text = await response.text();
		clearTimeout(timeout);

		let parseData = Papa.parse(text, {
			header: true
		}).data;

		this.buttonData = parseData;
		return parseData;
	} catch (e) {
		// Handle fetch errors (including abort)
		track('error: fetchCSV', { error: e });
		return [{ label: "QTS", flag: 'query_time_sampling' }];
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
		track('error: messageWorker', { error });
		console.error('Error:', error);
	}

}

async function getStorage(keys = null) {
	return new Promise((resolve, reject) => {
		chrome.storage.sync.get(keys, (result) => {
			if (chrome.runtime.lastError) {
				track('error: getStorage', { error: chrome.runtime.lastError });
				reject(new Error(chrome.runtime.lastError));
			} else {
				/** @type {PersistentStorage} */
				STORAGE = result;
				resolve(result);
			}
		});
	});
}

async function setStorage(data) {
	data.last_updated = Date.now();
	return new Promise((resolve, reject) => {
		chrome.storage.sync.set(data, () => {
			if (chrome.runtime.lastError) {
				track('error: setStorage', { error: chrome.runtime.lastError });
				reject(new Error(chrome.runtime.lastError));
			} else {
				messageWorker('refresh-storage'); // tell the worker to refresh
				STORAGE = data;
				resolve(data);
			}
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
				const { data: response } = message;
				APP.dataEditorHandleCatch(response);
				break;
			case "caught-request":
				const { data: request } = message;
				APP.queryBuilderHandleCatch(request);
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
			default:
				track('error: listenForWorker', { message });
				console.log("mp-tweaks: unknown action", message.action);
				break;
		}

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

function dataEditorHandleCatch(data) {
	this.DOM.fetchChartData.classList.add('hidden');
	this.DOM.buildChartPayload.classList.add('hidden');
	this.DOM.postChartData.classList.remove('hidden');
	this.DOM.resetDataEditor.classList.remove('hidden');
	this.DOM.rawDataWrapper.classList.remove('hidden');
	this.DOM.rawDataTextField.classList.remove('hidden');
	this.DOM.randomize.classList.remove('hidden');
	this.DOM.saveChartData.classList.remove('hidden');
	this.DOM.rawDataTextField.value = JSON.stringify(data, null, 2);
}

function queryBuilderHandleCatch(data) {
	this.DOM.fetchChartData.classList.add('hidden');
	this.DOM.buildChartPayload.classList.add('hidden');
	this.DOM.postChartData.classList.add('hidden');
	this.DOM.resetDataEditor.classList.remove('hidden');
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

	//feature flags
	this.DOM.perTab = document.querySelector('#perTab');
	this.DOM.buttonWrapper = document.querySelector('#buttons');
	this.DOM.removeAll = document.querySelector('#removeAll');

	//persistent scripts	
	this.DOM.toggles = document.querySelectorAll('.toggle');
	this.DOM.persistentOptions = document.querySelector('#persistentOptions');
	this.DOM.hideBanners = document.querySelector('#hideBanners');
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

	//project creator
	this.DOM.makeProject = document.querySelector('#makeProject');
	this.DOM.projectDetails = document.querySelector('#projectDetails textarea');
	this.DOM.makeProjectSpinner = document.querySelector('#makeProjectSpinner');
	this.DOM.orgLabel = document.querySelector('#orgLabel');
	this.DOM.orgPlaceholder = document.querySelector('#orgLabel b');

	//EZTrack
	this.DOM.startEZTrack = document.querySelector('#startEZTrack');
	this.DOM.stopEZTrack = document.querySelector('#stopEZTrack');
	this.DOM.EZTrackToken = document.querySelector('#EZTrackToken');
	this.DOM.EZTrackLabel = document.querySelector('#EZTrackLabel');
	this.DOM.EZTrackStatus = document.querySelector('#EZTrackLabel b');

	//session replay
	this.DOM.startReplay = document.querySelector('#startReplay');
	this.DOM.stopReplay = document.querySelector('#stopReplay');
	this.DOM.sessionReplayToken = document.querySelector('#sessionReplayToken');
	this.DOM.sessionReplayLabel = document.querySelector('#sessionReplayLabel');
	this.DOM.sessionReplayStatus = document.querySelector('#sessionReplayLabel b');

	//odds and ends
	this.DOM.nukeCookies = document.querySelector('#nukeCookies');

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
		const { persistScripts, whoami, EZTrack, sessionReplay, modHeaders } = STORAGE;

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

		//EZTrack labels + token
		if (EZTrack.token) this.DOM.EZTrackToken.value = EZTrack.token;
		if (EZTrack.enabled) this.DOM.EZTrackStatus.textContent = `ENABLED (tab #${STORAGE?.EZTrack?.tabId || ""})`;
		if (!EZTrack.enabled) this.DOM.EZTrackStatus.textContent = `DISABLED`;

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
				openNewTab(url);

			}
			catch (e) {
				track('error: make-project', { error: e });
				this.DOM.projectDetails.value = `Error!\n${e}`;
			}

			this.DOM.makeProjectSpinner.classList.add('hidden');
			this.DOM.projectDetails.classList.remove('hidden');
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
			this.DOM.fetchChartData.classList.remove('hidden');
			this.DOM.buildChartPayload.classList.remove('hidden');
			this.DOM.postChartData.classList.add('hidden');
			this.DOM.resetDataEditor.classList.add('hidden');
			this.DOM.rawDataWrapper.classList.add('hidden');
			this.DOM.randomize.classList.add('hidden');
			this.DOM.contextError.classList.add('hidden');
			this.DOM.jsonError.classList.add('hidden');
			this.DOM.saveChartData.classList.add('hidden');
		});

		//SAVE DATA
		this.DOM.saveChartData.addEventListener('click', () => {
			const chartData = JSON.parse(this.DOM.rawDataTextField.value);
			this.saveJSON(chartData, `data-${chartData?.computed_at}` || "data");
		});

		//EZTRACK
		this.DOM.startEZTrack.addEventListener('click', async () => {
			const token = this.DOM.EZTrackToken.value;
			if (!token) {
				alert('token required');
				return;
			}
			const tabId = await captureCurrentTabId();
			this.DOM.EZTrackStatus.textContent = `ENABLED (tab #${tabId?.toString()})`;
			messageWorker('start-eztrack', { token, tabId });
		});

		this.DOM.stopEZTrack.addEventListener('click', () => {
			this.DOM.EZTrackStatus.textContent = `DISABLED`;
			messageWorker('stop-eztrack');
		});

		this.DOM.EZTrackToken.addEventListener('input', () => {
			const token = this.DOM.EZTrackToken.value;
			if (token !== STORAGE.EZTrack.token) {
				setStorage({ EZTrack: { token, enabled: false } });
			}
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
				messageWorker('mod-headers', { headers: this.getHeaders() });
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
				messageWorker('mod-headers', { headers: this.getHeaders() });
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
		// @ts-ignore
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
	}
	catch (e) {
		track('error: bindListeners', { error: e });
		console.error('mp-tweaks: error binding listeners', e);

	}
}

function buildButtons(object) {
	let name = object.label;
	let flag = object.flag;
	let buttonId = object.label.replace(/\s/g, '');
	let newButton = document.createElement('BUTTON');
	newButton.setAttribute('class', 'button fa');
	newButton.setAttribute('id', buttonId);
	newButton.appendChild(document.createTextNode(name.toUpperCase()));
	newButton.onclick = async () => {
		messageWorker('add-flag', { flag });
	};
	this.DOM.buttonWrapper.appendChild(newButton);


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
	const headerKeys = document.querySelectorAll('.headerKey');
	const headerValues = document.querySelectorAll('.headerValue');
	const checkPairs = document.querySelectorAll('.checkPair');
	headerKeys.forEach((key, index) => {
		// @ts-ignore
		const value = headerValues[index].value.trim();
		// @ts-ignore
		if (key.value.trim() !== '' && value !== '') {
			// @ts-ignore
			const checked = checkPairs[index].checked;
			// @ts-ignore
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
				if (node.value.tagName === 'BUTTON') {
					node.value.addEventListener('click', () => {
						mixpanel.track(node.key);
					});
				}
			}
		},
		inapp_protocol: 'https://',
		secure_cookie: true
	});
}

function track(event, data = {}) {
	try {
		mixpanel.track(event, data);
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

	saveFile(chartBlob, `${fileName}.json`);
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