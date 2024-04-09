if (!window.MIXPANEL_MULTIPLIER_ACTIVE) {
	console.log('mp-tweaks: 100x wrapper'); 
	var s = document.createElement('script');
	s.src = chrome.runtime.getURL('/src/tweaks/100x.js');
	s.onload = function () {
		this.remove();
	};
	(document.head || document.documentElement).appendChild(s);
}

