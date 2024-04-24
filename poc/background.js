chrome.runtime.onInstalled.addListener(() => {
	chrome.declarativeNetRequest.updateDynamicRules({
		removeRuleIds: [1], // Remove old rules if needed
		addRules: [{
			id: 1,
			priority: 1,
			action: {
				type: "modifyHeaders",
				requestHeaders: [{
					header: "x-foo-bar",
					operation: "set",
					value: "custom-value"
				}]
			},
			condition: {
				urlFilter: "||testheaders.com",
				resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "script", "other"]
			}
		}]
	});
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "updateHeader") {
		console.log('RAN')
		chrome.declarativeNetRequest.updateDynamicRules({
			removeRuleIds: [1],
			addRules: [{
				id: 1,
				priority: 1,
				action: {
					type: "modifyHeaders",
					requestHeaders: [{
						header: "x-foo-bar",
						operation: "set",
						value: "DUDE" || message.value
					}]
				},
				condition: {
					urlFilter: "||testheaders.com",
					resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "script", "other"]
				}
			}]
		});
		sendResponse({ result: "Header updated" });
	}
});