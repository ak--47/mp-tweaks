//@ts-nocheck
if (!window.mpEZTrack) {
	return;
	console.log('mp-tweaks: eztrack wrapper');
	var s = document.createElement('script');
	s.src = chrome.runtime.getURL('/src/lib/eztrack.min.js');
	s.onload = function () {
		this.remove();
	};
	(document.head || document.documentElement).appendChild(s);
}