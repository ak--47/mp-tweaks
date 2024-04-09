//@ts-nocheck
if (!window.MIXPANEL_CATCH_FETCH_ACTIVE) {
	console.log('mp-tweaks: catch fetch wrapper');
	var s = document.createElement('script');
	s.src = chrome.runtime.getURL('/src/tweaks/catchFetch.js');
	s.onload = function () {
		this.remove();
	};
	(document.head || document.documentElement).appendChild(s);

	window.addEventListener("caught-fetch", function (event) {
		// Send data to service worker
		try {
			chrome.runtime.sendMessage({ action: "caught-fetch", data: event.detail });
		}
		catch (e) {
			if (!e.message.includes('Extension context invalidated')) {
				console.error('Error sending message:', e);
			}


		}
	});
}

