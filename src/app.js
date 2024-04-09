/** @typedef {import('./types').ChromeStorage} PersistentStorage */

const APP_VERSION = `2.2`;
let STORAGE = null;
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
	handleCaughtData,
	init: function () {
		this.cacheDOM();
		this.getStorage().then(() => {
			this.loadInterface();
			this.bindListeners();
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

async function fetchCSV(url) {
	let response = await fetch(url);
	let text = await response.text();

	let parseData = Papa.parse(text, {
		header: true
	}).data;


	this.buttonData = parseData;
	return parseData;

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
		console.error('Error:', error);
	}

}

async function getStorage(keys = null) {
	return new Promise((resolve, reject) => {
		chrome.storage.sync.get(keys, (result) => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError));
			} else {
				STORAGE = result;
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
				messageWorker('refresh-storage'); // tell the worker to refresh
				STORAGE = data;
				resolve(data);
			}
		});
	});
}


// listen for messages from the worker
function listenForWorker() {
	chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
		console.log("mp-tweaks: received message", message);

		switch (message.action) {
			case "caught-fetch":
				// Do something for 'caught-fetch'
				const { data } = message;
				APP.handleCaughtData(data);
				break;
			default:
				console.log("mp-tweaks: unknown action", message.action);
				break;
		}

	});
}

function sendMessageAsync(payload) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(payload, (response) => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
			} else {
				resolve(response);
			}
		});
	});
}

function handleCaughtData(data) {
	this.DOM.fetchChartData.classList.add('hidden');
	this.DOM.postChartData.classList.remove('hidden');
	this.DOM.resetDataEditor.classList.remove('hidden');
	this.DOM.rawDataWrapper.classList.remove('hidden');
	this.DOM.rawDataTextField.classList.remove('hidden');
	this.DOM.randomize.classList.remove('hidden');
	this.DOM.saveChartData.classList.remove('hidden');
	this.DOM.rawDataTextField.value = JSON.stringify(data, null, 2);
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
			console.error(`failed to toggle ${setting}`, e);
		}
	}
}

function getCheckbox() {
	const persistScript = [];
	this.DOM.checkboxes.forEach(function (checkbox) {
		if (checkbox.checked) persistScript.push(checkbox.id);
	});

	return persistScript;
}

function cacheDOM() {
	//main
	this.DOM.main = document.querySelector('#main');
	this.DOM.perTab = document.querySelector('#perTab');
	this.DOM.checkboxes = document.querySelectorAll('.toggle');
	this.DOM.loader = document.getElementById('loader');

	//toggles
	this.DOM.persistentOptions = document.querySelector('#persistentOptions');
	this.DOM.hideBanners = document.querySelector('#hideBanners');
	this.DOM.renameTabs = document.querySelector('#renameTabs');
	this.DOM.hundredX = document.querySelector('#hundredX');

	//buttons
	this.DOM.buttonWrapper = document.querySelector('#buttons');
	this.DOM.fetchChartData = document.querySelector('#fetchChartData');
	this.DOM.postChartData = document.querySelector('#postChartData');
	this.DOM.resetDataEditor = document.querySelector('#resetDataEditor');
	this.DOM.rawDataWrapper = document.querySelector('#rawDataWrapper');
	this.DOM.rawDataTextField = document.querySelector('#rawData');
	this.DOM.randomize = document.querySelector('#randomize');
	this.DOM.saveChartData = document.querySelector('#saveChartData');
	this.DOM.makeProject = document.querySelector('#makeProject');
	this.DOM.projectDetails = document.querySelector('#projectDetails textarea');
	this.DOM.makeProjectSpinner = document.querySelector('#makeProjectSpinner');
	this.DOM.removeAll = document.querySelector('#removeAll');
	this.DOM.startEZTrack = document.querySelector('#startEZTrack');
	this.DOM.stopEZTrack = document.querySelector('#stopEZTrack');

	//inputs
	this.DOM.EZTrackToken = document.querySelector('#EZTrackToken');

	//error messages
	this.DOM.contextError = document.querySelector('#contextError');
	this.DOM.jsonError = document.querySelector('#badJSON');

	//labels
	this.DOM.orgLabel = document.querySelector('#orgLabel');
	this.DOM.orgPlaceholder = document.querySelector('#orgLabel b');
	this.DOM.EZTrackLabel = document.querySelector('#EZTrackLabel');
	this.DOM.EZTrackStatus = document.querySelector('#EZTrackLabel b');

}

function loadInterface() {
	const { persistScripts = [], whoami = {}, EZTrack = {} } = STORAGE;

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
	this.DOM.EZTrackLabel.classList.remove('hidden');
	if (EZTrack.enabled) this.DOM.EZTrackStatus.textContent = `ENABLED`;
	if (!EZTrack.enabled) this.DOM.EZTrackStatus.textContent = `DISABLED`;
	
}

function bindListeners() {
	//TOGGLES
	this.DOM.checkboxes.forEach(function (checkbox) {
		checkbox.addEventListener('click', function (event) {
			const data = APP.getCheckbox();
			setStorage({ 'persistScripts': data }).then(() => { });
		});
	});

	this.DOM.removeAll.addEventListener('click', async function () {
		messageWorker('remove-flags');
		mixpanel.track('Remove All Flags');
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
			this.saveJSON(newProject, `project-${name}`);
			this.DOM.projectDetails.value = display;

		}
		catch (e) {
			this.DOM.projectDetails.value = `Error!\n${e}`;
		}

		this.DOM.makeProjectSpinner.classList.add('hidden');
		this.DOM.projectDetails.classList.remove('hidden');
		this.DOM.makeProject.disabled = false;

	});



	//GET CHART DATA
	this.DOM.fetchChartData.addEventListener('click', () => {
		console.log('mp-tweaks: catch-fetch');
		const warningMessage = setTimeout(() => {
			if (!Array.from(this.DOM.fetchChartData.classList).includes('hidden')) {
				this.DOM.contextError.classList.remove('hidden');
			} else {
				this.DOM.contextError.classList.add('hidden');
			}
		}, 5000);
		messageWorker('catch-fetch').then((result) => {
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
			messageWorker('draw-chart', { ...alteredData });
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

	this.DOM.startEZTrack.addEventListener('click', () => {
		const token = this.DOM.EZTrackToken.value;
		if (!token) alert('token required');
		this.DOM.EZTrackStatus.textContent = `ENABLED`;
		messageWorker('start-eztrack', { token });		
	})

	this.DOM.stopEZTrack.addEventListener('click', () => {
		this.DOM.EZTrackStatus.textContent = `DISABLED`;
		messageWorker('stop-eztrack');		
	})
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
		mixpanel.track(`${name}`);
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
	mixpanel.init("3e97f649a88698acc335a5d64a28ec72", {
		persistence: 'localStorage',
		api_host: "https://api.mixpanel.com",
		window: {
			navigator: {
				doNotTrack: '0'
			}
		},
		loaded: function (mixpanel) {
			const current_distinct_id = mixpanel.get_distinct_id();
			if (!current_distinct_id.includes("@")) {
				const { whoami = {} } = STORAGE;
				if (whoami?.email) {
					console.log(`mp-tweaks: setting distinct id to ${whoami.email}`);
					mixpanel.identify(whoami.email);
					mixpanel.register({
						"$email": whoami.email,
						"version": APP.currentVersion,
						"name": whoami.name
					});
					mixpanel.people.set({ "$name": whoami.name, "$email": whoami.email });
					mixpanel.people.set_once({ "$created": new Date().toISOString() });
				}
			}
			mixpanel.track('open extension');
			mixpanel.people.increment('# of opens');
		},
		inapp_protocol: 'https://',
		secure_cookie: true
	});
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


