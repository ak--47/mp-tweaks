/** @typedef {import('./types').ChromeStorage} PersistentStorage */
/** @type {PersistentStorage} */
// @ts-ignore
let STORAGE;

const APP_VERSION = `2.54`;
// const FEATURE_FLAG_URI = `https://docs.google.com/spreadsheets/d/e/2PACX-1vTks7GMkQBfvqKgjIyzLkRYAGRhcN6yZhI46lutP8G8OokZlpBO6KxclQXGINgS63uOmhreG9ClnFpb/pub?gid=0&single=true&output=csv`;
// const DEMO_GROUPS_URI = `https://docs.google.com/spreadsheets/d/e/2PACX-1vQdxs7SWlOc3f_b2f2j4fBk2hwoU7GBABAmJhtutEdPvqIU4I9_QRG6m3KSWNDnw5CYB4pEeRAiSjN7/pub?gid=0&single=true&output=csv`;
// const TOOLS_URI = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRN5Eu0Lj2dfxM7OSZiR91rcN4JSTprUz07wk8jZZyxOhOHZvRnlgGHJKIOHb6DIb4sjQQma35dCzPZ/pub?gid=0&single=true&output=csv`;

const FEATURE_FLAG_URI = `https://docs.google.com/spreadsheets/d/1NPOk9MpGrvA8ruFVv2AToMnL_Yt_Mz8jN52vE89MQ1U/export?format=csv`;
const DEMO_GROUPS_URI = `https://docs.google.com/spreadsheets/d/1FSX3cNbBbTLh0piT7EQ3ceIO8coDAsNVA7O4hCEtoBk/export?format=csv`;
const TOOLS_URI = `https://docs.google.com/spreadsheets/d/1lR2Bu3_RLkE16xnlpB2SQJFc0DOtRaTU_TdJOX3NVGY/export?format=csv`;


const APP = {
	currentVersion: APP_VERSION,
	dataSources: [
		{ name: 'featureFlags', url: FEATURE_FLAG_URI },
		{ name: 'demoLinks', url: DEMO_GROUPS_URI },
		{ name: 'tools', url: TOOLS_URI }
	],
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
	initCollapsibleSections,
	setupCollapsibleSections,
	toggleSection,
	initDragAndDrop,
	setupDragAndDrop,
	applySectionOrder,
	saveSectionOrder,
	init: function (allowCache = true) {
		this.cacheDOM();
		this.getStorage().then(() => {
			this.bindListeners();
			this.loadInterface();
			this.listenForWorker();
			this.analytics();
			restoreAIJobState(); // Restore AI job state on popup open

			// fetch data from google sheets, then hide loader and build UI buttons
			const sources = this.dataSources;
			Promise.all(sources.map(source => this.fetchCSV(source.url, source.name, allowCache)))
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
					// Initialize collapsible sections and drag-and-drop after everything is loaded
					this.initCollapsibleSections();
					this.initDragAndDrop();
				});
		});
	},

};

APP.init();

async function getCurrentTab() {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message || 'Unknown error'));
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

// Cache helper functions
function isCacheFresh(cacheItem, maxAgeMs = 24 * 60 * 60 * 1000) {
	// Default: 24 hours cache
	if (!cacheItem || !cacheItem.timestamp) return false;
	const now = Date.now();
	return (now - cacheItem.timestamp) < maxAgeMs;
}

async function getCachedData(name) {
	try {
		const storage = await getStorage();
		const cacheItem = storage.externalDataCache?.[name];
		if (cacheItem && isCacheFresh(cacheItem)) {
			console.log(`mp-tweaks: using fresh cache for ${name}`);
			return cacheItem.data;
		}
		return null;
	} catch (e) {
		console.error(`mp-tweaks: error reading cache for ${name}:`, e);
		return null;
	}
}

async function setCachedData(name, data) {
	try {
		const storage = await getStorage();
		if (!storage.externalDataCache) {
			storage.externalDataCache = {
				featureFlags: { data: [], timestamp: 0 },
				demoLinks: { data: [], timestamp: 0 },
				tools: { data: [], timestamp: 0 }
			};
		}
		storage.externalDataCache[name] = {
			data: data,
			timestamp: Date.now()
		};
		await setStorage(storage);
		console.log(`mp-tweaks: cached data for ${name}`);
	} catch (e) {
		console.error(`mp-tweaks: error saving cache for ${name}:`, e);
	}
}

async function getStaleCache(name) {
	try {
		const storage = await getStorage();
		const cacheItem = storage.externalDataCache?.[name];
		if (cacheItem && cacheItem.data && cacheItem.data.length > 0) {
			console.log(`mp-tweaks: using stale cache fallback for ${name}`);
			return cacheItem.data;
		}
		return null;
	} catch (e) {
		console.error(`mp-tweaks: error reading stale cache for ${name}:`, e);
		return null;
	}
}

// AI Magic helper functions
let quotesCache = null;

async function loadQuotes() {
	if (quotesCache) return quotesCache;
	try {
		const response = await fetch(chrome.runtime.getURL('/src/assets/quotes.csv'));
		const text = await response.text();
		quotesCache = Papa.parse(text, { header: true }).data.filter(q => q.quote && q.author);
		return quotesCache;
	} catch (e) {
		console.error('mp-tweaks: error loading quotes:', e);
		return [{ quote: "Data is the new oil.", author: "Clive Humby" }];
	}
}

function getRandomQuote(quotes) {
	const quote = quotes[Math.floor(Math.random() * quotes.length)];
	return { quote: quote.quote, author: quote.author };
}

function extractProjectId(url) {
	if (!url || !url.includes('mixpanel.com')) return null;
	const match = url.match(/\/project\/(\d+)/);
	return match ? match[1] : null;
}

function extractRegion(url) {
	if (!url) return 'US';
	if (url.includes('eu.mixpanel.com')) return 'EU';
	if (url.includes('in.mixpanel.com')) return 'IN';
	return 'US';
}

function validateAIMacroFields(macroType) {
	const config = AI_MACRO_CONFIGS[macroType];
	if (!config) return true; // Unknown macro, let it pass

	// Check required fields for dataset and e2e (prompt field)
	if (macroType === 'dataset' || macroType === 'e2e') {
		const promptField = document.querySelector('#ai-prompt');
		// @ts-ignore
		if (!promptField || !promptField.value?.trim()) {
			return false;
		}
	}

	// Check required fields for behaviors-metrics (user_prompt field)
	if (macroType === 'behaviors-metrics') {
		const userPromptField = document.querySelector('#ai-user_prompt');
		// @ts-ignore
		if (!userPromptField || !userPromptField.value?.trim()) {
			return false;
		}
	}

	return true;
}

async function checkAIMagicEnabled() {
	try {
		const tab = await getCurrentTab();
		const projectId = extractProjectId(tab?.url);
		const region = extractRegion(tab?.url);

		if (APP.DOM.aiRegionLabel) APP.DOM.aiRegionLabel.textContent = region;

		// Check if another job is running
		const storage = await getStorage();
		const jobRunning = storage?.aiJob?.status === 'running';

		if (projectId && !jobRunning) {
			if (APP.DOM.aiProjectLabel) APP.DOM.aiProjectLabel.textContent = projectId;

			// Check field validation
			const macroType = APP.DOM.aiMacroSelect?.value || 'dataset';
			const fieldsValid = validateAIMacroFields(macroType);

			if (APP.DOM.aiGoButton) {
				if (fieldsValid) {
					APP.DOM.aiGoButton.disabled = false;
					APP.DOM.aiGoButton.textContent = 'Go!';
				} else {
					APP.DOM.aiGoButton.disabled = true;
					APP.DOM.aiGoButton.textContent = 'Go! (fill required fields)';
				}
			}
			return { projectId, region };
		} else if (jobRunning) {
			if (APP.DOM.aiProjectLabel) APP.DOM.aiProjectLabel.textContent = projectId || 'not detected';
			if (APP.DOM.aiGoButton) {
				APP.DOM.aiGoButton.disabled = true;
				APP.DOM.aiGoButton.textContent = 'Go! (job already running)';
			}
			return null;
		} else {
			if (APP.DOM.aiProjectLabel) APP.DOM.aiProjectLabel.textContent = 'not detected';
			if (APP.DOM.aiGoButton) {
				APP.DOM.aiGoButton.disabled = true;
				APP.DOM.aiGoButton.textContent = 'Go! (not inside a mixpanel project)';
			}
			return null;
		}
	} catch (e) {
		console.error('mp-tweaks: error checking AI Magic enabled:', e);
		// Ensure button is disabled on error
		if (APP.DOM.aiProjectLabel) APP.DOM.aiProjectLabel.textContent = 'not detected';
		if (APP.DOM.aiGoButton) {
			APP.DOM.aiGoButton.disabled = true;
			APP.DOM.aiGoButton.textContent = 'Go! (not inside a mixpanel project)';
		}
		return null;
	}
}

// AI Job State Management
const AI_JOB_TIMEOUT = 15 * 60 * 1000; // 15 minutes
let aiJobTimerInterval = null;
let aiJobQuoteInterval = null;
let aiJobPollInterval = null;

async function restoreAIJobState() {
	const storage = await getStorage();
	const job = storage.aiJob;

	if (!job || job.status === 'idle') return;

	// Check for timeout (job started > 15 min ago but still "running")
	if (job.status === 'running' && Date.now() - job.startTime > AI_JOB_TIMEOUT) {
		// Mark as timed out
		storage.aiJob.status = 'timeout';
		storage.aiJob.error = 'Job timed out';
		await setStorage(storage);
		showAIError('Job timed out');
		return;
	}

	if (job.status === 'running') {
		// Restore loading state with accurate timer + context
		showAILoader(job.startTime, job.macroType, job.params?.project_id);
		// Start polling for completion
		pollForAIJobCompletion();
	} else if (job.status === 'completed') {
		showAIResults(job.result);
	} else if (job.status === 'error' || job.status === 'timeout') {
		showAIError(job.error);
	}
}

function showAILoader(startTime, macroType, projectId) {
	// Show loader UI
	APP.DOM.aiLoader?.classList.remove('hidden');
	APP.DOM.aiResults?.classList.add('hidden');
	if (APP.DOM.aiGoButton) APP.DOM.aiGoButton.disabled = true;

	// Set job context
	if (APP.DOM.aiJobType) {
		const macroNames = {
			'dataset': 'AI Dataset',
			'schema': 'AI Schema',
			'tags': 'AI Tags',
			'rename-reports': 'AI Rename Reports',
			'rename-entities': 'AI Rename Entities'
		};
		APP.DOM.aiJobType.textContent = macroNames[macroType] || macroType;
	}
	if (APP.DOM.aiJobProject) {
		APP.DOM.aiJobProject.textContent = projectId || 'unknown';
	}

	// Start timer from stored startTime
	clearInterval(aiJobTimerInterval);
	aiJobTimerInterval = setInterval(() => {
		const elapsed = Math.floor((Date.now() - startTime) / 1000);
		const minutes = Math.floor(elapsed / 60);
		const seconds = elapsed % 60;
		if (APP.DOM.aiTimer) {
			APP.DOM.aiTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
		}
	}, 1000);

	// Start quote rotation
	startQuoteRotation();
}

async function startQuoteRotation() {
	const quotes = await loadQuotes();
	const { quote: initialQuote, author: initialAuthor } = getRandomQuote(quotes);
	if (APP.DOM.aiQuote) APP.DOM.aiQuote.textContent = `"${initialQuote}"`;
	if (APP.DOM.aiQuoteAuthor) APP.DOM.aiQuoteAuthor.textContent = `- ${initialAuthor}`;

	clearInterval(aiJobQuoteInterval);
	aiJobQuoteInterval = setInterval(() => {
		// Fade out
		APP.DOM.aiQuote?.classList.add('fade-out');
		APP.DOM.aiQuoteAuthor?.classList.add('fade-out');

		// After fade out, change text and fade in
		setTimeout(() => {
			const { quote, author } = getRandomQuote(quotes);
			if (APP.DOM.aiQuote) APP.DOM.aiQuote.textContent = `"${quote}"`;
			if (APP.DOM.aiQuoteAuthor) APP.DOM.aiQuoteAuthor.textContent = `- ${author}`;
			APP.DOM.aiQuote?.classList.remove('fade-out');
			APP.DOM.aiQuoteAuthor?.classList.remove('fade-out');
		}, 500);
	}, 4000);
}

function stopAILoaderUI() {
	clearInterval(aiJobTimerInterval);
	clearInterval(aiJobQuoteInterval);
	clearInterval(aiJobPollInterval);
	aiJobTimerInterval = null;
	aiJobQuoteInterval = null;
	aiJobPollInterval = null;

	APP.DOM.aiLoader?.classList.add('hidden');
	if (APP.DOM.aiGoButton) APP.DOM.aiGoButton.disabled = false;
}

function showAIResults(result) {
	stopAILoaderUI();
	if (APP.DOM.aiResultsText) {
		APP.DOM.aiResultsText.value = JSON.stringify(result, null, 2);
	}
	APP.DOM.aiResults?.classList.remove('hidden');
}

function showAIError(errorMessage) {
	stopAILoaderUI();
	if (APP.DOM.aiResultsText) {
		APP.DOM.aiResultsText.value = `Error: ${errorMessage}`;
	}
	APP.DOM.aiResults?.classList.remove('hidden');
}

function pollForAIJobCompletion() {
	clearInterval(aiJobPollInterval);
	aiJobPollInterval = setInterval(async () => {
		const storage = await getStorage();
		const job = storage.aiJob;

		// Check for timeout
		if (job.status === 'running' && Date.now() - job.startTime > AI_JOB_TIMEOUT) {
			clearInterval(aiJobPollInterval);
			showAIError('Job timed out');
			return;
		}

		if (job.status !== 'running') {
			clearInterval(aiJobPollInterval);
			if (job.status === 'completed') {
				showAIResults(job.result);
			} else if (job.status === 'error' || job.status === 'timeout') {
				showAIError(job.error);
			}
		}
	}, 1000); // Poll every second
}

async function clearAIJobState() {
	const storage = await getStorage();
	storage.aiJob = {
		status: 'idle',
		macroType: null,
		params: null,
		startTime: null,
		result: null,
		error: null
	};
	await setStorage(storage);
}

async function runAIMacro(macroType, params) {
	// Clear previous job state (auto-clears results from previous job)
	await clearAIJobState();

	// Show loader with job context
	const startTime = Date.now();
	showAILoader(startTime, macroType, params.project_id);

	try {
		// Send request to worker (worker will persist state and handle timeout)
		const result = await messageWorker('ai-macro', { macroType, params });

		if (result?.error) {
			showAIError(result.error);
		} else {
			showAIResults(result);
		}

	} catch (e) {
		// Error handling - worker should have updated storage, but handle UI here too
		// @ts-ignore
		showAIError(e.message);
	}
}

const AI_MACRO_CONFIGS = {
	'e2e': {
		title: 'AI End-to-End',
		description: 'Generate demo data, create dashboards, enrich schema, and tag events in one step. Its <span class="highlight-white">MAGICAL</span>',
		fields: [
			{ id: 'prompt', type: 'textarea', label: 'Product Description', placeholder: 'Describe your app, its key features, and analytics use case. Or roll the dice.', showDice: true },
			{ id: 'num_users', type: 'number', label: 'Number of Users', default: 5000, min: 10, max: 10000 },
			{ id: 'num_events', type: 'number', label: 'Number of Events', default: 250000, min: 100, max: 500000 },
			{ id: 'num_days', type: 'number', label: 'Days of Data', default: 60, min: 1, max: 365 },
			{ id: 'num_dashboards', type: 'number', label: 'Number of Dashboards', default: 4, min: 1, max: 10 }
		]
	},
	'replay': {
		title: 'AI Replay Generator',
		description: 'Generate session replay recordings by simulating user behavior on a target website.',
		fields: [
			{ id: 'url', type: 'text', label: 'Target URL', placeholder: 'https://example.com/' },
			{ id: 'users', type: 'number', label: 'Number of Fake Users', default: 15, min: 1, max: 25 },
			{ id: 'masking', type: 'checkbox', label: 'Enable element masking' }
		]
	},
	'dataset': {
		title: 'AI Dataset Generator',
		description: 'Generate realistic <span class="highlight-white">DEMO DATA</span> for your project.',
		fields: [
			{ id: 'prompt', type: 'textarea', label: 'Dataset Description', placeholder: 'Describe your app, its key features, and analytics use case. Or roll the dice.', showDice: true },
			{ id: 'num_users', type: 'number', label: 'Number of Users', default: 500, min: 10, max: 10000 },
			{ id: 'num_events', type: 'number', label: 'Number of Events', default: 25000, min: 100, max: 500000 },
			{ id: 'num_days', type: 'number', label: 'Days of Data', default: 30, min: 1, max: 365 }
		],
		promo: 'Want more control? Try <a href="https://dm3.mixpanel.org/" target="_blank">dm3</a> or <a href="https://dm4-lmozz6xkha-uc.a.run.app/" target="_blank">dm4</a>'
	},
	'schema': {
		title: 'AI Schema Enrichment',
		description: 'Generate display names, descriptions, and example values for events and properties in Lexicon.',
		fields: [
			{ id: 'target', type: 'select', label: 'Target Entities', options: ['all', 'events', 'properties', 'users'] },
			{ id: 'casing', type: 'select', label: 'Casing Style', options: ['title', 'lower'] },
			{ id: 'skip_existing', type: 'checkbox', label: 'Skip entities with existing values', default: true },
			{ id: 'emoji', type: 'checkbox', label: 'Add emoji prefixes' },
			{ id: 'auto_hide', type: 'checkbox', label: 'Auto-hide unused events/properties', default: true }
		]
	},
	'dashboard': {
		title: 'AI Dashboard Generator',
		description: 'Generate dashboards with 5-10 reports each based on your project schema.',
		fields: [
			{ id: 'prompt', type: 'textarea', label: 'Dashboard Themes (optional)', placeholder: 'e.g., "User Acquisition and Retention dashboards focused on e-commerce metrics"' },
			{ id: 'num_dashboards', type: 'number', label: 'Number of Dashboards', default: 3, min: 1, max: 10 }
		]
	},
	'behaviors-metrics': {
		title: '🎯 AI Behaviors & Metrics',
		description: 'Generate behaviors, metrics, and formulas based on your project schema. Behaviors group events, metrics measure KPIs, and formulas calculate ratios.',
		fields: [
			{ id: 'user_prompt', type: 'textarea', label: 'Business Context', placeholder: 'Describe your business and key analytics goals. E.g., "E-commerce platform focusing on conversion optimization and customer retention"', showDice: true },
			{ id: 'count', type: 'number', label: 'Number of Entities', default: 6, min: 1, max: 20 }
		]
	},
	'tags': {
		title: 'AI Event Tagging',
		description: 'Generate tags that group similar events by feature, function, or intended use.',
		fields: [
			{ id: 'casing', type: 'select', label: 'Tag Casing', options: ['title', 'lower'] },
			{ id: 'existing_tags_mode', type: 'select', label: 'Existing Tags', options: ['replace', 'merge', 'skip'] }
		]
	},
	'rename-reports': {
		title: 'AI Rename Reports',
		description: 'Generate meaningful names and descriptions for reports.',
		fields: [
			{ id: 'dashboard_ids', type: 'text', label: 'Dashboard IDs (optional)', placeholder: 'Comma-separated IDs, or leave empty for all' },
			{ id: 'untitled_only', type: 'checkbox', label: 'Only rename "Untitled" reports' },
			{ id: 'overwrite', type: 'checkbox', label: 'Overwrite existing names', default: true },
			{ id: 'include_descriptions', type: 'checkbox', label: 'Generate descriptions', default: true },
			{ id: 'emoji', type: 'checkbox', label: 'Add emoji prefixes' }
		]
	},
	'rename-entities': {
		title: 'AI Rename Entities',
		description: 'Generate names and descriptions for cohorts, behaviors, metrics, and more.',
		fields: [
			{ id: 'entity_types', type: 'multiselect', label: 'Entity Types',
				options: ['cohorts', 'behaviors', 'metrics', 'custom_events', 'custom_props', 'dashboards'] },
			{ id: 'overwrite', type: 'checkbox', label: 'Overwrite existing names', default: true },
			{ id: 'include_descriptions', type: 'checkbox', label: 'Generate descriptions', default: true },
			{ id: 'emoji', type: 'checkbox', label: 'Add emoji prefixes' }
		]
	}
};

// Debounce timer for saving field values
let aiFieldSaveTimer = null;

function renderAIMacroPanel(macroType) {
	const panel = APP.DOM.aiMacroPanel;
	if (!panel) return;

	const config = AI_MACRO_CONFIGS[macroType];
	if (!config) return;

	panel.innerHTML = `
		<h4>${config.title}</h4>
		<p class="small">${config.description}</p>
		<div class="ai-fields">
			${config.fields.map(f => renderAIField(f)).join('')}
		</div>
		${config.promo ? `<p class="ai-promo">${config.promo}</p>` : ''}
	`;

	// Hide product context for macros that have their own prompt field
	const contextSection = APP.DOM.aiProductContext?.closest('.ai-context-section');
	if (contextSection) {
		contextSection.classList.toggle('hidden', macroType === 'dataset' || macroType === 'e2e' || macroType === 'dashboard' || macroType === 'behaviors-metrics');
	}

	// Add event listeners to save field values on change (debounced)
	const saveOnChange = () => {
		clearTimeout(aiFieldSaveTimer);
		aiFieldSaveTimer = setTimeout(() => {
			saveAIMacroFieldValues(macroType);
			// Revalidate Go button state for field changes
			checkAIMagicEnabled();
		}, 300);
	};

	// Listen for input/change events on all fields in the panel
	panel.querySelectorAll('input, select, textarea').forEach(el => {
		el.addEventListener('input', saveOnChange);
		el.addEventListener('change', saveOnChange);
	});

	// Add dice button event listener for random prompt
	const diceButton = panel.querySelector('.dice-button');
	if (diceButton) {
		diceButton.addEventListener('click', (e) => {
			e.preventDefault();

			// Add spinning animation
			diceButton.classList.add('spinning');

			// Select random prompt
			const randomIndex = Math.floor(Math.random() * PROMPT_EXAMPLES.length);
			const randomPrompt = PROMPT_EXAMPLES[randomIndex];

			// Set the prompt field value (could be 'prompt' or 'user_prompt')
			const promptField = document.getElementById('ai-prompt') || document.getElementById('ai-user_prompt');
			if (promptField && promptField instanceof HTMLTextAreaElement) {
				promptField.value = randomPrompt;

				// Trigger save
				saveOnChange();

				// Track the action
				track('ai-dice-prompt', { macroType, promptIndex: randomIndex });
			}

			// Remove spinning class after animation
			setTimeout(() => {
				diceButton.classList.remove('spinning');
			}, 500);
		});
	}
}

function renderAIField(field) {
	switch (field.type) {
		case 'select':
			return `<div class="field-row">
				<label>${field.label}</label>
				<select id="ai-${field.id}">
					${field.options.map(o => `<option value="${o}">${o}</option>`).join('')}
				</select>
			</div>`;
		case 'checkbox':
			return `<div class="field-row">
				<label><input type="checkbox" id="ai-${field.id}" ${field.default ? 'checked' : ''}> ${field.label}</label>
			</div>`;
		case 'text':
			return `<div class="field-row">
				<label>${field.label}</label>
				<input type="text" id="ai-${field.id}" placeholder="${field.placeholder || ''}">
			</div>`;
		case 'textarea':
			// Only add dice for fields with showDice=true (prompt or user_prompt fields)
			const hasDice = field.showDice;
			return `<div class="field-row field-row-textarea">
				<label>
					${field.label}
					${hasDice ? '<button class="dice-button" title="Generate random prompt">🎲</button>' : ''}
				</label>
				<textarea id="ai-${field.id}" placeholder="${field.placeholder || ''}" rows="3"></textarea>
			</div>`;
		case 'number':
			return `<div class="field-row">
				<label>${field.label}</label>
				<input type="number" id="ai-${field.id}" value="${field.default || ''}" min="${field.min || ''}" max="${field.max || ''}">
			</div>`;
		case 'multiselect':
			return `<div class="field-row">
				<label>${field.label}</label>
				<div class="multiselect" id="ai-${field.id}">
					${field.options.map(o => `<label><input type="checkbox" value="${o}" checked> ${o}</label>`).join('')}
				</div>
			</div>`;
		default:
			return '';
	}
}

function gatherAIParams(macroType, projectId, region) {
	const params = {
		project_id: projectId,
		region: region
	};

	const config = AI_MACRO_CONFIGS[macroType];
	if (!config) return params;

	// Gather field values
	for (const field of config.fields) {
		const el = document.getElementById(`ai-${field.id}`);
		if (!el) continue;

		if (field.type === 'checkbox') {
			params[field.id] = /** @type {HTMLInputElement} */ (el).checked;
		} else if (field.type === 'select') {
			params[field.id] = /** @type {HTMLSelectElement} */ (el).value;
		} else if (field.type === 'text' || field.type === 'textarea') {
			const val = /** @type {HTMLInputElement|HTMLTextAreaElement} */ (el).value.trim();
			if (val) params[field.id] = val;
		} else if (field.type === 'number') {
			const val = /** @type {HTMLInputElement} */ (el).value;
			if (val) params[field.id] = parseInt(val, 10);
		} else if (field.type === 'multiselect') {
			const checked = Array.from(el.querySelectorAll('input:checked')).map(cb => /** @type {HTMLInputElement} */ (cb).value);
			if (checked.length > 0) params[field.id] = checked.join(',');
		}
	}

	// Product context
	const productContext = APP.DOM.aiProductContext?.value?.trim();
	if (productContext) params.product_context = productContext;

	// Auth override
	// @ts-ignore
	const authType = document.querySelector('input[name="authType"]:checked')?.value || 'oauth';
	params.authType = authType;

	if (authType === 'bearer') {
		params.customBearer = APP.DOM.aiCustomBearer?.value?.trim() || '';
	} else if (authType === 'service') {
		params.serviceUser = APP.DOM.aiServiceUser?.value?.trim() || '';
		params.serviceSecret = APP.DOM.aiServiceSecret?.value?.trim() || '';
	}

	return params;
}

// Save current macro field values to storage
async function saveAIMacroFieldValues(macroType) {
	const config = AI_MACRO_CONFIGS[macroType];
	if (!config) return;

	const fieldValues = {};
	for (const field of config.fields) {
		const el = document.getElementById(`ai-${field.id}`);
		if (!el) continue;

		if (field.type === 'checkbox') {
			fieldValues[field.id] = /** @type {HTMLInputElement} */ (el).checked;
		} else if (field.type === 'multiselect') {
			fieldValues[field.id] = Array.from(el.querySelectorAll('input:checked')).map(cb => /** @type {HTMLInputElement} */ (cb).value);
		} else {
			fieldValues[field.id] = /** @type {HTMLInputElement} */ (el).value;
		}
	}

	// Also save product context if visible
	const productContext = APP.DOM.aiProductContext?.value || '';

	const storage = await getStorage();
	if (!storage.aiMacroState) {
		storage.aiMacroState = { selectedMacro: macroType, fieldValues: {} };
	}
	storage.aiMacroState.selectedMacro = macroType;
	storage.aiMacroState.fieldValues[macroType] = fieldValues;
	storage.aiMacroState.productContext = productContext;
	await setStorage(storage);
}

// Restore field values after panel is rendered
function restoreAIMacroFieldValues(macroType, state) {
	if (!state?.fieldValues?.[macroType]) return;

	const savedValues = state.fieldValues[macroType];
	const config = AI_MACRO_CONFIGS[macroType];
	if (!config) return;

	for (const field of config.fields) {
		const el = document.getElementById(`ai-${field.id}`);
		if (!el || savedValues[field.id] === undefined) continue;

		if (field.type === 'checkbox') {
			/** @type {HTMLInputElement} */ (el).checked = savedValues[field.id];
		} else if (field.type === 'multiselect') {
			const checkboxes = el.querySelectorAll('input[type="checkbox"]');
			checkboxes.forEach(cb => {
				/** @type {HTMLInputElement} */ (cb).checked = savedValues[field.id]?.includes(/** @type {HTMLInputElement} */ (cb).value);
			});
		} else {
			/** @type {HTMLInputElement} */ (el).value = savedValues[field.id];
		}
	}

	// Restore product context if saved
	if (state.productContext && APP.DOM.aiProductContext) {
		APP.DOM.aiProductContext.value = state.productContext;
	}
}

// Initialize AI macro panel from storage
async function initAIMacroFromStorage() {
	const storage = await getStorage();
	const state = storage?.aiMacroState;
	const savedMacro = state?.selectedMacro || 'dataset';

	if (APP.DOM.aiMacroSelect) {
		APP.DOM.aiMacroSelect.value = savedMacro;
	}

	renderAIMacroPanel(savedMacro);
	restoreAIMacroFieldValues(savedMacro, state);

	// Revalidate button state after restoring field values
	checkAIMagicEnabled();
}

async function fetchCSV(url, name, allowCache = true) {
	// First, check if we have fresh cached data
	if (allowCache) {
		const cachedData = await getCachedData(name);
		if (cachedData) {
			return cachedData;
		}
	}

	// No fresh cache, try to fetch from network
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort('timeout'), 3000);

		const response = await fetch(url, { signal: controller.signal });
		const text = await response.text();
		clearTimeout(timeout);

		let parseData = Papa.parse(text, {
			header: true
		}).data;

		// Cache the fresh data
		await setCachedData(name, parseData);

		return parseData;
	} catch (e) {
		// Network failed, try to use stale cache as fallback
		const staleData = await getStaleCache(name);
		if (staleData) {
			return staleData;
		}

		// No cache available, return empty array
		track('error: fetchCSV (no cache fallback)', { error: e });
		return [];
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
				// @ts-ignore - Storage type mismatch is expected
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
	this.DOM.demoLinksWrapper = document.querySelector('#demoLinks .section-content .buttons');

	//tools
	this.DOM.toolsWrapper = document.querySelector('#toolsWrapper');

	//feature flags
	this.DOM.perTab = document.querySelector('#perTab');
	this.DOM.buttonWrapper = document.querySelector('#perTab .section-content .buttons');
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

	// Header Auth Component
	this.DOM.headerAuth = document.getElementById('headerAuth');
	this.DOM.headerAuthEmail = document.getElementById('headerAuthEmail');
	this.DOM.headerOrgDropdown = document.getElementById('headerOrgDropdown');
	this.DOM.headerReauth = document.getElementById('headerReauth');
	this.DOM.headerReauthSpinner = document.getElementById('headerReauthSpinner');
	this.DOM.headerToggleAll = document.getElementById('headerToggleAll');

	//project creator
	this.DOM.makeProject = document.querySelector('#makeProject');
	this.DOM.projectReauth = document.querySelector('#projectReauth');
	this.DOM.projectDetails = document.querySelector('#projectDetails textarea');
	this.DOM.makeProjectSpinner = document.querySelector('#makeProjectSpinner');
	this.DOM.projectOrgName = document.getElementById('projectOrgName');
	this.DOM.projectAuthEmail = document.getElementById('projectAuthEmail');
	this.DOM.authUserDisplay = document.querySelector('#authUserDisplay');



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

	//logo
	this.DOM.logoLink = document.querySelector('#logoLink');

	//refresh cache
	this.DOM.refreshCache = document.querySelector('#refreshCache');

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

	//ai magic
	this.DOM.aiMagic = document.querySelector('#aiMagic');
	this.DOM.aiProjectLabel = document.querySelector('#aiProjectLabel b');
	this.DOM.aiRegionLabel = document.querySelector('#aiRegionLabel b');
	this.DOM.aiMacroSelect = document.querySelector('#aiMacroSelect');
	this.DOM.aiMacroPanel = document.querySelector('#aiMacroPanel');
	this.DOM.aiProductContext = document.querySelector('#aiProductContext');
	this.DOM.aiGoButton = document.querySelector('#aiGoButton');
	this.DOM.aiLoader = document.querySelector('#aiLoader');
	this.DOM.aiQuote = document.querySelector('#aiQuote');
	this.DOM.aiQuoteAuthor = document.querySelector('#aiQuoteAuthor');
	this.DOM.aiTimer = document.querySelector('#aiTimer');
	this.DOM.aiResults = document.querySelector('#aiResults');
	this.DOM.aiResultsText = document.querySelector('#aiResultsText');
	this.DOM.aiCustomBearer = document.querySelector('#aiCustomBearer');
	this.DOM.aiServiceUser = document.querySelector('#aiServiceUser');
	this.DOM.aiServiceSecret = document.querySelector('#aiServiceSecret');
	this.DOM.aiJobContext = document.querySelector('#aiJobContext');
	this.DOM.aiJobType = document.querySelector('#aiJobType');
	this.DOM.aiJobProject = document.querySelector('#aiJobProject');
	this.DOM.aiSaveResults = document.querySelector('#aiSaveResults');
	this.DOM.aiClearResults = document.querySelector('#aiClearResults');
	this.DOM.aiAuthEmail = document.querySelector('#aiAuthEmail');
	this.DOM.aiReauth = document.querySelector('#aiReauth');
	this.DOM.aiReauthSpinner = document.querySelector('#aiReauthSpinner');

}

async function initAuth() {
	const storage = await getStorage();
	const whoami = storage?.whoami;

	if (whoami?.email) {
		// Show header auth
		if (APP.DOM.headerAuth) {
			APP.DOM.headerAuth.classList.remove('hidden');
		}

		// Update header auth display
		if (APP.DOM.headerAuthEmail) {
			APP.DOM.headerAuthEmail.textContent = whoami.email;
		}

		// Populate header org dropdown with IDs
		if (APP.DOM.headerOrgDropdown && whoami.ownedOrgs?.length > 0) {
			APP.DOM.headerOrgDropdown.innerHTML = whoami.ownedOrgs.map(org =>
				`<option value="${org.id}" ${org.id === whoami.orgId ? 'selected' : ''}>${org.name} (${org.id})</option>`
			).join('');
		}

		// Update Project Creator display
		if (APP.DOM.projectOrgName) {
			APP.DOM.projectOrgName.textContent = whoami.orgName || '--';
		}
		if (APP.DOM.projectAuthEmail) {
			APP.DOM.projectAuthEmail.textContent = whoami.email;
		}
		if (APP.DOM.authUserDisplay) {
			APP.DOM.authUserDisplay.classList.remove('hidden');
		}

		// Update AI Magic display (no org needed)
		if (APP.DOM.aiAuthEmail) {
			APP.DOM.aiAuthEmail.textContent = whoami.email;
		}

		// Show/hide buttons based on auth state
		if (APP.DOM.makeProject) {
			APP.DOM.makeProject.disabled = false;
			APP.DOM.makeProject.textContent = 'Make Project';
		}
	} else {
		// Hide header auth when not authenticated
		if (APP.DOM.headerAuth) {
			APP.DOM.headerAuth.classList.add('hidden');
		}

		// Show unauthenticated state
		if (APP.DOM.projectAuthEmail) {
			APP.DOM.projectAuthEmail.textContent = 'not authenticated';
		}
		if (APP.DOM.aiAuthEmail) {
			APP.DOM.aiAuthEmail.textContent = '--';
		}

		if (APP.DOM.makeProject) {
			APP.DOM.makeProject.disabled = true;
			APP.DOM.makeProject.textContent = 'Make Project (authenticate first)';
		}
	}
}

async function loadInterface() {
	try {
		const { persistScripts, sessionReplay, modHeaders } = STORAGE;

		//load toggle states
		APP.setCheckbox(persistScripts);

		// Initialize auth display
		await initAuth();

		//session replay labels + token
		if (sessionReplay.token) this.DOM.sessionReplayToken.value = sessionReplay.token;
		if (sessionReplay.enabled) this.DOM.sessionReplayStatus.textContent = `ENABLED (tab #${STORAGE?.sessionReplay?.tabId || ""})`;
		if (!sessionReplay.enabled) this.DOM.sessionReplayStatus.textContent = `DISABLED`;

		//mod header
		if (modHeaders.enabled) this.DOM.modHeaderStatus.textContent = `ENABLED`;
		else this.DOM.modHeaderStatus.textContent = `DISABLED`;

		//load saved headers or use defaults
		// @ts-ignore
		const savedHeaders = modHeaders.savedHeaders || [];
		const hasValidSavedHeaders = savedHeaders.length > 0 && savedHeaders.some(h => h.key && h.key.trim() !== '');
		
		const headersToLoad = hasValidSavedHeaders ? savedHeaders : [];

		//hack to deal with more than 3 headers...
		if (headersToLoad.length > 3) {
			const numClicks = headersToLoad.length - 3;
			for (let i = 0; i < numClicks; i++) {
				this.DOM.addHeader.click(); //yea i know...
				this.cacheDOM(); //re-cache the DOM
			}
		}

		//load headers from savedHeaders (preferred) or fall back to active headers
		if (hasValidSavedHeaders) {
			headersToLoad.forEach((obj, index) => {
				if (this.DOM.checkPairs[index] && this.DOM.headerKeys[index] && this.DOM.headerValues[index]) {
					this.DOM.checkPairs[index].checked = obj.enabled || false;
					this.DOM.headerKeys[index].value = obj.key || '';
					this.DOM.headerValues[index].value = obj.value || '';
				}
			});
		} else if (modHeaders.headers && modHeaders.headers.length > 0) {
			// Backwards compatibility: load from active headers if no savedHeaders
			modHeaders.headers.forEach((obj, index) => {
				if (this.DOM.checkPairs[index] && this.DOM.headerKeys[index] && this.DOM.headerValues[index]) {
					const { enabled, ...header } = obj;
					this.DOM.checkPairs[index].checked = enabled;
					this.DOM.headerKeys[index].value = Object.keys(header)[0] || '';
					this.DOM.headerValues[index].value = Object.values(header)[0] || '';
				}
			});
		}
		// If no saved or active headers, let HTML defaults show (x-imp, x-profile, x-assets-commit)

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

		//RESET USER - shared handler for all reauth buttons
		const handleReauth = async (source) => {
			// Disable all reauth buttons
			const buttons = [
				APP.DOM.headerReauth,
				APP.DOM.projectReauth,
				APP.DOM.aiReauth
			].filter(Boolean);

			buttons.forEach(btn => btn.disabled = true);

			// Show loading state for all auth displays
			if (APP.DOM.headerAuthEmail) {
				APP.DOM.headerAuthEmail.textContent = '---';
			}
			if (APP.DOM.projectAuthEmail) {
				APP.DOM.projectAuthEmail.textContent = '---';
			}
			if (APP.DOM.aiAuthEmail) {
				APP.DOM.aiAuthEmail.textContent = '---';
			}

			// Clear org dropdown to show it's refreshing
			if (APP.DOM.headerOrgDropdown) {
				APP.DOM.headerOrgDropdown.innerHTML = '<option>---</option>';
			}
			if (APP.DOM.projectOrgName) {
				APP.DOM.projectOrgName.textContent = '---';
			}

			// Show appropriate spinner based on source
			if (source === 'header' && APP.DOM.headerReauthSpinner) {
				APP.DOM.headerReauthSpinner.classList.remove('hidden');
			}
			if (source === 'project') {
				if (APP.DOM.makeProjectSpinner) {
					APP.DOM.makeProjectSpinner.classList.remove('hidden');
				}
				if (this.DOM.projectDetails) {
					this.DOM.projectDetails.classList.add('hidden');
				}
				this.DOM.makeProject.disabled = true;
			}
			if (source === 'ai' && APP.DOM.aiReauthSpinner) {
				APP.DOM.aiReauthSpinner.classList.remove('hidden');
			}

			try {
				await messageWorker('reset-user');

				// Update storage with new auth data
				await initAuth();  // Refresh all auth displays

				track(`reauth-${source}`, { source });
			} catch (error) {
				console.error('mp-tweaks: reauth error:', error);
				const errorMessage = error instanceof Error ? error.message : String(error);
				track('reauth-error', { source, error: errorMessage });
				if (this.DOM.projectDetails) {
					this.DOM.projectDetails.value = `Error!\n${errorMessage}`;
				}
			} finally {
				// Re-enable buttons and hide spinners
				buttons.forEach(btn => btn.disabled = false);

				if (APP.DOM.headerReauthSpinner) {
					APP.DOM.headerReauthSpinner.classList.add('hidden');
				}
				if (APP.DOM.makeProjectSpinner) {
					APP.DOM.makeProjectSpinner.classList.add('hidden');
				}
				if (APP.DOM.aiReauthSpinner) {
					APP.DOM.aiReauthSpinner.classList.add('hidden');
				}
				if (this.DOM.projectDetails) {
					this.DOM.projectDetails.classList.add('hidden');
				}
				this.DOM.makeProject.disabled = false;
			}
		};

		// Header reauth button
		if (this.DOM.headerReauth) {
			this.DOM.headerReauth.addEventListener('click', () => handleReauth('header'));
		}

		// Toggle All button
		if (this.DOM.headerToggleAll) {
			this.DOM.headerToggleAll.addEventListener('click', () => {
				const isExpanded = !this.DOM.headerToggleAll.classList.contains('collapsed');
				const sections = document.querySelectorAll('.section');

				sections.forEach(section => {
					const toggle = section.querySelector('.collapse-toggle');
					const isCurrentlyCollapsed = section.classList.contains('collapsed');

					if (isExpanded && !isCurrentlyCollapsed) {
						// We're collapsing all, and this section is expanded - collapse it
						section.classList.add('collapsed');
						if (toggle) toggle.textContent = '←';
						// Update worker state
						const h2 = section.querySelector('h2');
						const sectionName = h2?.getAttribute('data-section');
						if (sectionName) {
							messageWorker('collapse-section', { section: sectionName, collapsed: true });
						}
					} else if (!isExpanded && isCurrentlyCollapsed) {
						// We're expanding all, and this section is collapsed - expand it
						section.classList.remove('collapsed');
						if (toggle) toggle.textContent = '↓';
						// Update worker state
						const h2 = section.querySelector('h2');
						const sectionName = h2?.getAttribute('data-section');
						if (sectionName) {
							messageWorker('collapse-section', { section: sectionName, collapsed: false });
						}
					}
				});

				// Toggle the button state
				this.DOM.headerToggleAll.classList.toggle('collapsed');

				// Track the action
				track('toggle-all', { expand: !isExpanded });
			});
		}

		// Project Creator reauth (now just calls handler with 'project' source)
		if (this.DOM.projectReauth) {
			this.DOM.projectReauth.addEventListener('click', () => handleReauth('project'));
		}

		// Header org dropdown change
		if (this.DOM.headerOrgDropdown) {
			this.DOM.headerOrgDropdown.addEventListener('change', async (e) => {
				const selectedOrgId = e.target.value;
				const storage = await getStorage();
				const selectedOrg = storage?.whoami?.ownedOrgs?.find(o => o.id === selectedOrgId);

				if (selectedOrg) {
					// Update storage
					storage.whoami.orgId = selectedOrg.id;
					storage.whoami.orgName = selectedOrg.name;
					await setStorage(storage);

					// Update Project Creator display
					if (this.DOM.projectOrgName) {
						this.DOM.projectOrgName.textContent = selectedOrg.name;
					}

					track('header-org-changed', {
						orgId: selectedOrg.id,
						orgName: selectedOrg.name
					});
				}
			});
		}

		// AI REAUTH BUTTON - uses shared handler
		if (this.DOM.aiReauth) {
			this.DOM.aiReauth.addEventListener('click', () => handleReauth('ai'));
		}

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
				// Just disable headers without clearing savedHeaders
				messageWorker('mod-headers', { headers: [] });
				setTimeout(() => { messageWorker('reload'); }, 250);
			}

			if (active.length > 0) {
				this.DOM.modHeaderStatus.textContent = `ENABLED`;
				messageWorker('mod-headers', { headers: data });
				setTimeout(() => { messageWorker('reload'); }, 250);

			}
			// Always save current state for persistence
			messageWorker('store-headers-text', { savedHeaders: getAllHeaders() });
		});

		// user input keys
		this.DOM.headerKeys.forEach(node => {
			node.addEventListener('input', () => {
				messageWorker('store-headers', { headers: this.getHeaders() });
				// Also save all headers text for persistence
				messageWorker('store-headers-text', { savedHeaders: getAllHeaders() });
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
				// Also save all headers text for persistence
				messageWorker('store-headers-text', { savedHeaders: getAllHeaders() });
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
				// Also save all headers text for persistence
				messageWorker('store-headers-text', { savedHeaders: getAllHeaders() });
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
			// Remove all additional rows first (keep only the first 3)
			const additionalRows = Array.from(this.DOM.userHeaders.children).slice(3);
			additionalRows.forEach(row => row.remove());

			// Reset the first 3 rows to default state
			const defaultHeaders = ['x-imp', 'x-profile', 'x-assets-commit'];
			this.DOM.headerKeys.forEach((node, index) => {
				if (index < 3) {
					node.value = defaultHeaders[index] || '';
				}
			});
			this.DOM.headerValues.forEach(node => node.value = "");
			this.DOM.checkPairs.forEach(node => node.checked = false);

			// Update status
			this.DOM.modHeaderStatus.textContent = `DISABLED`;

			// Clear all storage and turn off headers
			messageWorker('reset-headers');
			// Clear saved headers to show defaults next time
			messageWorker('store-headers-text', { savedHeaders: [] });
		});

		this.DOM.nukeCookies.addEventListener('click', async () => {
			const numDeleted = await messageWorker('nuke-cookies');
			alert(`Deleted ${numDeleted} cookies`);
		});

		this.DOM.embedSDK.addEventListener('click', async () => {
			const tab = await getCurrentTab();
			await messageWorker('embed-sdk', { tab });
		});

		//logo tweak animation
		this.DOM.logoLink.addEventListener('click', () => {
			this.DOM.logoLink.classList.add('tweaking');
			setTimeout(() => {
				this.DOM.logoLink.classList.remove('tweaking');
			}, 600);
		});

		//refresh cache
		this.DOM.refreshCache.addEventListener('click', async (e) => {
			e.preventDefault();
			track('refresh cache');
			// Invalidate cache timestamps, then reload the page
			const storage = await getStorage();
			if (storage.externalDataCache) {
				for (const key in storage.externalDataCache) {
					storage.externalDataCache[key].timestamp = 0;
				}
				await setStorage(storage);
			}
			location.reload();
		});

		// AI MAGIC
		if (this.DOM.aiMacroSelect) {
			this.DOM.aiMacroSelect.addEventListener('change', async () => {
				// Save current macro's field values before switching
				// @ts-ignore
				const currentMacro = STORAGE?.aiMacroState?.selectedMacro || 'dataset';
				await saveAIMacroFieldValues(currentMacro);

				// Get fresh storage and render new panel
				const storage = await getStorage();
				const newMacro = this.DOM.aiMacroSelect.value;
				renderAIMacroPanel(newMacro);
				restoreAIMacroFieldValues(newMacro, storage?.aiMacroState);

				// Update selected macro in storage
				if (storage.aiMacroState) {
					storage.aiMacroState.selectedMacro = newMacro;
					await setStorage(storage);
				}

				// Revalidate Go button state
				checkAIMagicEnabled();
			});
		}

		if (this.DOM.aiGoButton) {
			this.DOM.aiGoButton.addEventListener('click', async () => {
				// Check if another job is already running
				const storage = await getStorage();
				if (storage?.aiJob?.status === 'running') {
					console.log('mp-tweaks: Another AI job is already running');
					return; // Don't start a new job
				}

				const context = await checkAIMagicEnabled();
				if (!context) return;

				const macroType = this.DOM.aiMacroSelect.value;
				// Save field values before running
				await saveAIMacroFieldValues(macroType);

				const params = gatherAIParams(macroType, context.projectId, context.region);
				track('ai-magic', { macroType, ...params });
				await runAIMacro(macroType, params);
			});
		}

		// Save product context on input (debounced)
		if (this.DOM.aiProductContext) {
			let productContextTimer = null;
			const saveProductContext = () => {
				clearTimeout(productContextTimer);
				productContextTimer = setTimeout(async () => {
					const macroType = this.DOM.aiMacroSelect?.value || 'dataset';
					await saveAIMacroFieldValues(macroType);
				}, 300);
			};
			this.DOM.aiProductContext.addEventListener('input', saveProductContext);
		}

		// AI Results actions
		if (this.DOM.aiClearResults) {
			this.DOM.aiClearResults.addEventListener('click', async () => {
				await clearAIJobState();
				if (this.DOM.aiResultsText) this.DOM.aiResultsText.value = '';
				this.DOM.aiResults?.classList.add('hidden');
				track('ai-clear-results');
			});
		}

		if (this.DOM.aiSaveResults) {
			this.DOM.aiSaveResults.addEventListener('click', () => {
				const content = this.DOM.aiResultsText?.value || '';
				if (!content) return;

				const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
				const filename = `ai-results-${timestamp}.json`;

				// Use the existing saveJSON helper if available, otherwise create blob
				try {
					const blob = new Blob([content], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = filename;
					a.click();
					URL.revokeObjectURL(url);
					track('ai-save-results');
				} catch (e) {
					console.error('mp-tweaks: error saving results:', e);
				}
			});
		}

		// Auth type switching
		document.querySelectorAll('input[name="authType"]').forEach(radio => {
			radio.addEventListener('change', (e) => {
				// @ts-ignore
				const value = e.target.value;
				if (this.DOM.aiCustomBearer) {
					this.DOM.aiCustomBearer.classList.toggle('hidden', value !== 'bearer');
				}
				const serviceAcct = document.getElementById('aiServiceAcct');
				if (serviceAcct) {
					serviceAcct.classList.toggle('hidden', value !== 'service');
				}
			});
		});

		// Initialize AI Magic
		checkAIMagicEnabled();
		initAIMacroFromStorage();

		// Clean up AI job polling when popup closes
		window.addEventListener('unload', () => {
			if (aiJobPollInterval) {
				clearInterval(aiJobPollInterval);
				aiJobPollInterval = null;
			}
			if (aiJobTimerInterval) {
				clearInterval(aiJobTimerInterval);
				aiJobTimerInterval = null;
			}
			if (aiJobQuoteInterval) {
				clearInterval(aiJobQuoteInterval);
				aiJobQuoteInterval = null;
			}
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
			// @ts-ignore
			button.textContent = override?.chartUiUrl?.split("/app/")[1] || hash.slice(0, 8);
			button.onclick = () => {
				// @ts-ignore
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
	newButton.setAttribute('class', 'button fa featureFlagButtons');
	newButton.setAttribute('id', buttonId);
	newButton.appendChild(document.createTextNode(name.toLowerCase()));
	newButton.onclick = async () => {
		track('flag button', { flag });
		messageWorker('add-flag', { flag });
	};
	if (this.DOM.buttonWrapper) {
		this.DOM.buttonWrapper.appendChild(newButton);
	} else {
		console.warn('mp-tweaks: buttonWrapper not found for feature flags');
	}
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
	newButton.setAttribute('class', 'button fa toolButton');
	newButton.setAttribute('id', tool);
	newButton.appendChild(document.createTextNode(tool.toUpperCase()));
	newButton.onclick = async () => {
		track('tool button', { tool });
		await openNewTab(url, true);
	};
	if (this.DOM.toolsWrapper) {
		this.DOM.toolsWrapper.appendChild(newButton);
	} else {
		console.warn('mp-tweaks: toolsWrapper not found');
	}
}

function buildDemoButtons(demo, data) {
	let newButton = document.createElement('BUTTON');
	newButton.setAttribute('class', 'button fa demoSeqButton');
	newButton.setAttribute('id', demo);
	newButton.appendChild(document.createTextNode(demo.toUpperCase()));
	newButton.onclick = async () => {
		track('demo button', { demo });
		// do something with the data
		data.forEach(async (obj) => {

			const { URL } = obj;
			let meta = {};
			if (obj.META) {
				try {
					meta = JSON.parse(obj.META);
				}

				catch (e) {
					meta = {};
				}
			}

			// let url;
			// if (STORAGE.whoami.email) url = addQueryParams(URL, { user: STORAGE.whoami.email });
			// else url = URL;
			messageWorker('open-tab', { url: URL, ...meta });
		});
	};
	if (this.DOM.demoLinksWrapper) {
		this.DOM.demoLinksWrapper.appendChild(newButton);
	} else {
		console.warn('mp-tweaks: demoLinksWrapper not found');
	}

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

function getAllHeaders() {
	const data = [];
	//always live query the DOM - capture ALL headers including empty ones for persistence

	/** @type {NodeListOf<HTMLInputElement>} */
	const headerKeys = document.querySelectorAll('.headerKey');
	/** @type {NodeListOf<HTMLInputElement>} */
	const headerValues = document.querySelectorAll('.headerValue');
	/** @type {NodeListOf<HTMLInputElement>} */
	const checkPairs = document.querySelectorAll('.checkPair');

	headerKeys.forEach((keyInput, index) => {
		const key = keyInput.value.trim();
		const value = headerValues[index] ? headerValues[index].value.trim() : '';
		const enabled = checkPairs[index] ? checkPairs[index].checked : false;

		// Capture all headers, even empty ones for persistence
		data.push({
			key: key,
			value: value,
			enabled: enabled
		});
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
		messageWorker('store-headers-text', { savedHeaders: getAllHeaders() });
	});

	row?.querySelector('.headerValue')?.addEventListener('input', () => {
		messageWorker('store-headers', { headers: this.getHeaders() });
		messageWorker('store-headers-text', { savedHeaders: getAllHeaders() });
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
		messageWorker('store-headers-text', { savedHeaders: getAllHeaders() });
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
		messageWorker('store-headers-text', { savedHeaders: getAllHeaders() });
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



// Collapsible sections functionality
function initCollapsibleSections() {
	// Wait for DOM to be ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			APP.setupCollapsibleSections();
		});
	} else {
		APP.setupCollapsibleSections();
	}
}

function setupCollapsibleSections() {
	// Get current storage from APP
	APP.getStorage().then(storage => {
		let collapsedCount = 0;
		let expandedCount = 0;

		// Set initial states for all sections based on saved preferences
		// Do NOT initialize defaults here - the worker handles that
		document.querySelectorAll('.section[id]').forEach(section => {
			const sectionName = section.id;
			const toggle = section.querySelector('.collapse-toggle');
			const savedState = storage?.sectionStates?.[sectionName];

			if (savedState && !savedState.expanded) {
				// Collapsed state
				section.classList.add('collapsed');
				if (toggle) toggle.textContent = '←';
				collapsedCount++;
			} else {
				// Expanded state (default)
				section.classList.remove('collapsed');
				if (toggle) toggle.textContent = '↓';
				expandedCount++;
			}
		});

		// Set initial state of toggle all button based on majority state
		if (APP.DOM.headerToggleAll && collapsedCount > expandedCount) {
			APP.DOM.headerToggleAll.classList.add('collapsed');
		}
	});

	// Add click listeners to all section headers
	document.querySelectorAll('.section h2[data-section]').forEach(header => {
		header.addEventListener('click', () => {
			const sectionName = header.getAttribute('data-section');
			APP.toggleSection(sectionName);
		});
	});
}

function toggleSection(sectionName) {
	const section = document.getElementById(sectionName);
	if (!section) return;

	const isCurrentlyCollapsed = section.classList.contains('collapsed');
	const toggle = section.querySelector('.collapse-toggle');

	// Toggle the visual state
	if (isCurrentlyCollapsed) {
		section.classList.remove('collapsed');
		if (toggle) toggle.textContent = '↓'; // Open state
	} else {
		section.classList.add('collapsed');
		if (toggle) toggle.textContent = '←'; // Closed state
	}

	// Update storage
	APP.getStorage().then(storage => {
		// Ensure sectionStates exists (should always exist from worker init)
		if (!storage.sectionStates) {
			console.warn('mp-tweaks: sectionStates missing, creating minimal entry');
			storage.sectionStates = {};
		}

		storage.sectionStates[sectionName] = { expanded: isCurrentlyCollapsed };
		APP.setStorage(storage);
	});
}

// Drag and drop functionality
let draggedElement = null;

function initDragAndDrop() {
	try {
		// Wait for DOM to be ready
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', () => {
				APP.setupDragAndDrop();
			});
		} else {
			APP.setupDragAndDrop();
		}
	} catch (error) {
		console.error('mp-tweaks: failed to initialize drag and drop', error);
	}
}

function setupDragAndDrop() {
	try {
		const sections = document.querySelectorAll('.section[id]');

		sections.forEach(section => {
			// Make section draggable
			section.setAttribute('draggable', 'true');

			// Add grip handle to header
			const header = section.querySelector('.section-header');
			if (header) {
				// Create grip icon (six dots)
				const grip = document.createElement('span');
				grip.className = 'drag-handle';
				grip.innerHTML = '⋮⋮';
				grip.title = 'Drag to reorder';

				// Insert grip at the beginning of header
				header.insertBefore(grip, header.firstChild);
			}

			// Drag event listeners
			section.addEventListener('dragstart', handleDragStart);
			section.addEventListener('dragend', handleDragEnd);
			section.addEventListener('dragover', handleDragOver);
			section.addEventListener('drop', handleDrop);
			section.addEventListener('dragleave', handleDragLeave);
		});

		// Apply saved order
		APP.applySectionOrder();

	} catch (error) {
		console.error('mp-tweaks: failed to setup drag and drop', error);
	}
}

function handleDragStart(e) {
	try {
		draggedElement = this;
		this.classList.add('dragging');
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/html', this.innerHTML);
	} catch (error) {
		console.error('mp-tweaks: drag start error', error);
	}
}

// @ts-ignore
function handleDragEnd(e) {
	try {
		this.classList.remove('dragging');

		// Remove all drag-over classes
		document.querySelectorAll('.section').forEach(section => {
			section.classList.remove('drag-over', 'drag-over-bottom');
		});

		draggedElement = null;
	} catch (error) {
		console.error('mp-tweaks: drag end error', error);
	}
}

function handleDragOver(e) {
	try {
		if (e.preventDefault) {
			e.preventDefault();
		}

		e.dataTransfer.dropEffect = 'move';

		if (this === draggedElement) {
			return;
		}

		// Remove previous drag-over classes
		document.querySelectorAll('.section').forEach(section => {
			section.classList.remove('drag-over', 'drag-over-bottom');
		});

		// Determine if we should show indicator on top or bottom
		const rect = this.getBoundingClientRect();
		const midpoint = rect.top + (rect.height / 2);

		if (e.clientY < midpoint) {
			this.classList.add('drag-over');
		} else {
			this.classList.add('drag-over-bottom');
		}

		return false;
	} catch (error) {
		console.error('mp-tweaks: drag over error', error);
		return false;
	}
}

function handleDrop(e) {
	try {
		if (e.stopPropagation) {
			e.stopPropagation();
		}

		if (draggedElement !== this) {
			// Determine drop position
			const rect = this.getBoundingClientRect();
			const midpoint = rect.top + (rect.height / 2);
			const container = this.parentNode;

			if (e.clientY < midpoint) {
				// Insert before this element
				container.insertBefore(draggedElement, this);
			} else {
				// Insert after this element
				container.insertBefore(draggedElement, this.nextSibling);
			}

			// Save new order
			APP.saveSectionOrder();
		}

		return false;
	} catch (error) {
		console.error('mp-tweaks: drop error', error);
		return false;
	}
}

// @ts-ignore
function handleDragLeave(e) {
	try {
		this.classList.remove('drag-over', 'drag-over-bottom');
	} catch (error) {
		console.error('mp-tweaks: drag leave error', error);
	}
}

function saveSectionOrder() {
	try {
		const sections = document.querySelectorAll('.section[id]');
		const order = Array.from(sections).map(section => section.id).filter(id => id);

		APP.getStorage().then(storage => {
			if (!storage.sectionOrder) {
				storage.sectionOrder = [];
			}

			storage.sectionOrder = order;
			APP.setStorage(storage);
			console.log('mp-tweaks: saved section order', order);
		}).catch(error => {
			console.error('mp-tweaks: failed to save section order', error);
		});
	} catch (error) {
		console.error('mp-tweaks: save section order error', error);
	}
}

function applySectionOrder() {
	try {
		APP.getStorage().then(storage => {
			const savedOrder = storage?.sectionOrder;

			if (!savedOrder || !Array.isArray(savedOrder) || savedOrder.length === 0) {
				console.log('mp-tweaks: no saved section order, using default');
				return;
			}

			// Get all sections
			const sections = Array.from(document.querySelectorAll('.section[id]'));
			if (sections.length === 0) {
				console.warn('mp-tweaks: no sections found for reordering');
				return;
			}

			const sectionMap = {};
			sections.forEach(section => {
				if (section.id) {
					sectionMap[section.id] = section;
				}
			});

			// Find a reference point (first section's parent and the footer)
			const firstSection = sections[0];
			const container = firstSection.parentNode;
			const footer = document.querySelector('#footer');

			if (!container) {
				console.warn('mp-tweaks: no container found for section reordering');
				return;
			}

			// Reorder based on saved order by inserting before footer
			savedOrder.forEach(sectionId => {
				const section = sectionMap[sectionId];
				if (section && section.parentNode === container) {
					// Insert before footer to maintain footer at bottom
					if (footer) {
						container.insertBefore(section, footer);
					} else {
						container.appendChild(section);
					}
				}
			});

			console.log('mp-tweaks: applied section order', savedOrder);

		}).catch(error => {
			console.error('mp-tweaks: failed to apply section order', error);
		});
	} catch (error) {
		console.error('mp-tweaks: apply section order error', error);
	}
}

try {
	if (window) {
		// @ts-ignore
		window.APP = APP;
		// @ts-ignore
		window.RELOAD = function rebuildApp() {
			try {
				console.log('mp-tweaks: reloading...');
				// @ts-ignore
				window.APP.init(false);
			} catch (error) {
				console.error('mp-tweaks: failed to reload', error);
			}
		};
	}
}

catch (e) {
	//noop
}

const PROMPT_EXAMPLES =
["The Social App is an IMAGINARY social media platform that allows users to connect, share, and communicate with friends and family. It includes features such as friend requests, messaging, and content sharing. They need to understand how effective their user acquisition and engagement strategies are, as well as how users interact with the platform. Specifically, they want to analyze the 'viral loop' of their product—tracking how often a new user sends a friend request within the first hour of signup and how that correlates to long-term retention. They are also introducing a new 'Stories' feature and need to compare engagement metrics between their legacy newsfeed and this new ephemeral content to decide where to place their ad inventory.",

"The SaaS App is an IMAGINARY software-as-a-service platform that provides tools for businesses to manage their documents, contacts, and other business papers that need to be signed. Similar to DocuSign, SaaS app allows for real-time collaboration, document sharing, and version control. They need to understand how different users at different companies collaborate with different documents. So they are using group analytics to build event streams for users, companies, and documents. Their Customer Success team is desperate to identify 'at-risk' accounts where document creation has dropped by 20% month-over-month, while the Product team wants to see if the new 'Auto-Sign' feature reduces the average time-to-completion for contracts.",

"The Media App is an IMAGINARY video sharing platform that allows users to upload, share, and view videos. Similar to YouTube, Media App provides features like video recommendations, subscriptions, and comments. They need to understand how different users interact with different types of videos, and a specifically interested in understand engagement and retention metrics around video watch time and completeness. They are struggling to differentiate between 'casual viewers' who watch via external links and 'community members' who comment and subscribe. They want to set up a specific funnel that tracks the journey from watching a video -> clicking the creator's profile -> subscribing, to determine which content categories drive the highest subscriber conversion.",

"The Health App is an IMAGINARY healthcare solution for hospitals and patients to manage health records, appointments, and telemedicine services. It includes features like appointment scheduling, health record management, and telehealth consultations. They have strict security and privacy requirements around patient data, but are trying to improve the doctor and admin experience in an effort to increase patient engagement and satisfaction. They specifically want to analyze the 'No-Show' rate for appointments. They hypothesize that patients who receive in-app push notifications confirm appointments at a higher rate than those who receive emails. They also want to track the 'Doctor's Dashboard' usage to see if a new streamlined UI is actually reducing the time it takes for physicians to enter post-visit notes.",

"The Finance App is an IMAGINARY company similar to mint.com that allows users to connect their bank accounts from various financial institutions to track their spending, income, and investments. The app has a web and mobile version, and users can set budgets, track expenses, and get financial advice. The app also has a premium subscription for advanced features. They need to understand the differences between web and mobile engagement, as well as the health of various data sharing partnerships they have with the banks and financial institutions. They are particularly worried about 'sync errors' causing churn. They want a report that correlates specific bank connection failures (e.g., 'Chase Bank Sync Fail') with users canceling their premium subscriptions within 7 days.",

"The Crypto App is an IMAGINARY company that allows users to buy, sell, and trade cryptocurrencies. The app has a web and mobile version, and users can set up wallets, track prices, and get market insights. The app also has a premium subscription for advanced features. They need to deeply understand the different customer segments, like traders, investors, and casual users, and how they interact with the app. In particular, they care about what type of cryptocurrency users are most interested in, and how that affects their engagement and retention. They also want to quantify some gaming-styled metrics like average revenue per paying user (ARPPU). They want to identify 'Whales' (users with >$10k trade volume) and analyze their specific paths through the app compared to 'Minnows,' specifically seeing if the 'News Feed' feature drives more trades for high-volume users.",

"The Classroom App is an IMAGINARY app that helps students and teachers manage their classroom activities. It includes features for scheduling classes, tracking assignments, and communicating with students and parents. The app is available on web, iOS, and Android platforms. The marketing team is focused on increasing user engagement and retention through targeted campaigns and personalized content. They are trying to understand which types of landing pages and campaigns are most effective for driving app downloads and user sign-ups. Furthermore, they want to track the 'Homework Submission' funnel to see where students are dropping off—is it at the upload stage or the final submit stage? They also need to segment teacher usage by school district to identify potential enterprise-level upsell opportunities.",

"The Shopping App is an IMAGINARY app that helps users discover and purchase products from various online retailers. It includes features for product recommendations, price comparisons, and user reviews. The app is available on web, iOS, and Android platforms. The design team is interesting in which pages users interact with, spend time on, and how they scroll. They also want to quantify things like customer satisfaction score, and understand products their customers are searching for. Their most important metric is around their checkout flow, which they are trying to optimizing by understanding fall-off points in their funnel. They specifically want to A/B test a 'One-Click Checkout' versus a standard 'Add to Cart' flow and need to see the revenue impact per user (ARPPU) for each variant.",

"The HR Platform is an IMAGINARY applicant tracking system (ATS) used by recruiters and hiring managers to source, interview, and hire candidates. They are essentially a B2B workflow tool. They are currently facing a churn issue with their SMB (Small/Medium Business) clients. They want to understand the 'Time to Hire' metric across their customer base. They hypothesize that clients who use their 'Auto-Scheduler' feature hire candidates faster and retain their subscriptions longer. They need to track the entire candidate pipeline—from 'Resume Review' to 'Offer Letter Sent'—and want to use Group Analytics to see which companies are 'power users' of the integration features (like LinkedIn or Slack integrations) versus companies that only use the basic database features.",

"The CyberSecurity Tool is an IMAGINARY B2B SaaS platform that helps IT teams monitor network traffic for threats. They operate on a freemium model where basic monitoring is free, but automated threat resolution is paid. They have very low-volume but high-value event data. They want to understand the conversion trigger: what specific 'Alert' types lead a free user to upgrade to a paid plan? They want to analyze the path from 'View Alert Details' to 'Click Upgrade,' and segment this by the size of the IT team using the product. They also need to track false positives; if a user manually dismisses an alert as 'Safe,' they want to track how often that happens to improve their algorithm.",

"The Project Manager is an IMAGINARY productivity tool similar to Trello or Asana, organized by boards, lists, and cards. They are trying to move upmarket from individual users to Enterprise Site Licenses. They need to distinguish between 'Creator' behavior (making cards, assigning tasks) and 'Consumer' behavior (just moving cards or checking boxes). They want to identify 'Champion Users' within a specific company domain—users who invite the most colleagues—so their sales team can reach out to those specific individuals for enterprise sales conversations. They also want to track the adoption of their new 'Timeline View' feature to see if it correlates with higher retention rates in large teams.",

"The Logistics Hub is an IMAGINARY fleet management software used by trucking companies to track vehicles, fuel usage, and driver compliance. They have a hardware component (GPS trackers) and a software dashboard. They need to merge hardware events (Engine On, Speeding Alert, Fuel Level) with software events (report generation, route optimization). Their primary goal is to reduce 'Idling Time' for their clients. They want to provide their clients with a dashboard showing which drivers have the best safety scores, so they need to aggregate individual driver behavior into a 'Fleet Score' and track how often fleet managers view this specific report.",

"The DevPlatform is an IMAGINARY developer tool similar to GitHub or GitLab. They allow code hosting, CI/CD pipelines, and issue tracking. They are concerned that their new 'AI Code Assistant' is not being adopted by senior engineers. They want to segment their users by 'Account Age' and 'Commit Volume' to see if the AI features are primarily being used by junior developers (new accounts, lower complexity) or senior developers. They also want to track the 'Pull Request' lifecycle to see if using the AI Assistant reduces the time it takes for a Pull Request to get merged.",

"The RideShare App is an IMAGINARY two-sided marketplace connecting drivers with passengers, similar to Uber or Lyft. They are launching a new service tier called 'Comfort Plus.' They need to balance supply and demand. On the supply side (drivers), they want to know what incentives cause a driver to switch from 'Offline' to 'Online' during surge pricing hours. On the demand side (riders), they want to analyze the price elasticity of the new 'Comfort Plus' tier—specifically, how many users view the price, compare it to the standard tier, and then choose the upgrade. They also need to track the 'Ride Cancelled' event deeply to understand if cancellations are due to long wait times or driver location.",

"The Dating App is an IMAGINARY mobile application focused on 'meaningful connections' rather than hookups, using a swiping mechanic. They monetize through 'Super Likes' and a monthly 'Gold' subscription. They have a problem with user fatigue; users swipe a lot but stop messaging. They want to measure the 'Match-to-Conversation' ratio. Specifically, they want to track the funnel from Match -> First Message Sent -> Reply Received. They want to segment this by gender and age to refine their matching algorithm. They also want to know if users who purchase 'Boosts' (paying to be seen by more people) actually end up with higher quality conversations, or just more empty matches.",

"The Fitness Bike is an IMAGINARY company that sells connected stationary bikes and a monthly subscription for live classes, similar to Peloton. They have a unique challenge of merging physical hardware data with digital app interaction. They want to know the correlation between 'Miles Cycled' and 'Subscription Renewal.' They are trying to identify the 'churn danger zone'—for example, if a user hasn't completed a ride in 14 days, are they 90% likely to cancel? They also want to analyze the popularity of 'Live' classes versus 'On-Demand' classes to optimize their studio filming schedule.",

"The Property App is an IMAGINARY real estate marketplace similar to Zillow or Redfin. They generate revenue by selling leads to real estate agents. They want to qualify these leads better. They want to track 'High Intent' behaviors, such as saving a home, using the mortgage calculator, or sharing a listing via SMS. They want to create a composite score for users based on these events and only pass 'Hot Leads' to agents. They also want to understand the 'Map Search' behavior—do users find homes faster by drawing custom boundaries on the map or by using filter lists?",

"The Music Streamer is an IMAGINARY audio streaming service similar to Spotify. They are betting big on Podcasts this year. They want to understand the crossover behavior between Music listeners and Podcast listeners. Do users who listen to True Crime podcasts listen to specific genres of music? They need to track 'Completion Rate' for podcast episodes to guide their original content investment. They also want to analyze the 'Playlist Creation' flow to see if users who build their own playlists have a higher Lifetime Value (LTV) than users who only listen to algorithmic 'Daily Mix' playlists.",

"The MMO Game is an IMAGINARY Massively Multiplayer Online Role-Playing Game. The studio is transitioning the game to a Free-to-Play model with microtransactions for cosmetics. They are desperate to balance the game economy. They need to track the 'faucet and sink' of their in-game currency (Gold). They want to know exactly which quests generate the most gold and which store items drain the most gold. They also want to analyze the 'New Player Experience' (FTUE) tutorial to see where players are getting stuck and quitting before reaching Level 5. They are specifically looking for 'Rage Quits'—players who fail a mission 3 times and then close the application.",

"The Betting App is an IMAGINARY sports betting platform allowed in regulated states. They have high spikes in traffic during major events like the Super Bowl. They are focused on 'Cross-Selling'—trying to get users who bet on NFL games to also try their Online Casino games (Blackjack/Slots). They want to build a funnel that tracks a user placing a sports bet, winning, and then immediately using those winnings to play a hand of Blackjack. They also need strict tracking on 'Deposit Failures' as that is their biggest leakage point in the revenue funnel.",

"The Meditation App is an IMAGINARY wellness app focusing on sleep stories and guided meditation. They function on a subscription model. They have noticed that users who utilize the 'Sleep Timer' feature retain longer. They want to verify this with data by comparing the retention curves of 'Sleep Timer Users' vs 'Daytime Mediators.' They also want to track the effectiveness of their push notifications sent at 9 PM local time—do these notifications lead to a 'Session Start' event, or are they being disabled by users?",

"The Recipe Hub is an IMAGINARY cooking app and website that allows users to save recipes, generate shopping lists, and order groceries. They earn affiliate revenue from grocery partnerships. They want to understand the 'Cook Mode' feature—a screen that keeps the phone awake while cooking. They want to know if users who use 'Cook Mode' are more likely to click the affiliate 'Buy Ingredients' links compared to users who just browse and screenshot recipes. They also want to segment users by 'Dietary Preference' (Vegan, Keto, Paleo) to serve better ad targeting.",

"The Language Learner is an IMAGINARY education app like Duolingo. They use gamification (streaks, badges) to keep users learning. They want to optimize their 'Heart System' (users lose hearts when they make mistakes). They want to find the 'frustration point'—how many mistakes does a user make in a row before they quit the app for the day? They also want to A/B test the difficulty of their 'End of Unit Boss Battles' to see if making them harder increases the purchase of 'Power-Ups' (monetization) or just causes user churn.",

"The Neobank is an IMAGINARY digital-only bank that offers checking accounts and debit cards to teenagers, managed by their parents. They have two distinct user interfaces: the Parent View and the Teen View. They want to understand the 'Allowance Flow.' They want to track how fast a Teen spends money after a 'Transfer In' event from a parent. They also want to track the adoption of their 'Savings Goals' feature—do teens who set a specific goal (e.g., 'AirPods') save more money than those who don't? They need to be able to cohort these users based on the parent's subscription tier.",

"The InsurTech App is an IMAGINARY car insurance provider that uses telematics (driving data) to set rates. They have an app that users must run while driving. They are struggling with app permissions—users turning off location services. They want to track the funnel of the 'Permissions Request' flow during onboarding to see which explanation text yields the highest opt-in rate. They also want to correlate 'Hard Braking Events' (collected via the app) with actual 'Claims Filed' to validate their risk models.",

"The NFT Marketplace is an IMAGINARY platform for trading digital art on the blockchain. They are currently experiencing a downturn in volume. They want to identify 'Collectors' vs 'Flippers.' They want to define a 'Flipper' as someone who buys and sells an asset within 48 hours. They want to analyze the behavior of Flippers to see which collections they are targeting. They also need to track 'Wallet Connect' failures, as users often try to connect incompatible wallets, leading to a failed session.",

"The EV Charging Network is an IMAGINARY app that helps Electric Vehicle owners find charging stations and pay for charging. They are dealing with 'Range Anxiety.' They want to understand how users plan trips. They want to track the 'Route Planner' usage—specifically, how many users look up a route but then don't start the charge session (indicating they might have chosen a competitor). They also want to analyze 'Charging Curves' —how long do users stay plugged in? Do they unplug at 80% or wait for 100%? This data helps them optimize pricing for idle fees.",

"The Gig-Economy Cleaning App is an IMAGINARY on-demand home cleaning service. They match homeowners with cleaners. They are trying to solve the problem of 'Platform Leakage'—where the cleaner and homeowner cut a side deal and leave the app. They want to track communication patterns in their in-app chat. They are looking for specific keywords or behavior patterns (like exchanging phone numbers) that precede a user account going dormant. They also want to track the 'Re-booking Rate'—if a user rates a cleaner 5 stars, what is the probability they book that specific cleaner again within 30 days?"
]