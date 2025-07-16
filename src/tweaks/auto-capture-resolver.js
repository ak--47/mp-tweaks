(function attachDomClickInspector() {
	// Helper to get class list as array
	function getClassList(el) {
		return Array.from(el.classList || []);
	}
	// Helper to get nth-child and nth-of-type
	function getSiblingIndices(el) {
		let nthChild = 1, nthOfType = 1;
		let sib = el;
		while (sib = sib.previousElementSibling) {
			nthChild++;
			if (sib.tagName === el.tagName) nthOfType++;
		}
		return [nthChild, nthOfType];
	}
	// Main collector for one element
	function collectProps(el) {
		let props = {
			$classes: getClassList(el),
			$tag_name: el.tagName.toLowerCase()
		};
		if (el.id) props.$id = el.id;

		// Optionally add href for anchors
		if (el.tagName.toLowerCase() === "a" && el.hasAttribute("href")) {
			props["$attr-href"] = el.getAttribute("href");
		}
		// Add nth-child and nth-of-type
		let [nthChild, nthOfType] = getSiblingIndices(el);
		props.$nth_child = nthChild;
		props.$nth_of_type = nthOfType;
		return props;
	}

	// On click, build the ancestry list and alert JSON
	document.body.addEventListener('click', function (ev) {
		ev.preventDefault(); // comment this if you want clicks to go through
		let arr = [];
		let node = ev.target;
		while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== "html") {
			arr.push(collectProps(node));
			if (node.tagName.toLowerCase() === "body") break;
			node = node.parentElement;
		}
		console.log("Collected DOM path:", arr);
		navigator.clipboard.writeText(JSON.stringify(arr))
			.then(() => {
				// alert("Copied DOM path as JSON to clipboard!");
			})
			.catch(err => {
				// alert("Failed to copy: " + err);
			});
	}, true);


})();
