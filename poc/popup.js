document.getElementById('headerForm').addEventListener('submit', function(event) {
	event.preventDefault();
	const value = document.getElementById('headerValue').value;
  
	// Send a message to the background script to update the rule
	chrome.runtime.sendMessage({ action: "updateHeader", value: value });
  });
  