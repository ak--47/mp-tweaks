const cautionEmoji = String.raw`PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDx0ZXh0IHk9IjMyIiBmb250LXNpemU9IjMyIj7imqDvuI88L3RleHQ+Cjwvc3ZnPg==`;
setTimeout(()=>{
	[...document.querySelectorAll("link[rel~='icon']")].forEach(( node )=> {node.remove()});
	var link = document.createElement('link');
	link.rel = 'icon';
	link.href = `data:image/svg+xml;base64,${cautionEmoji}`;
	document.getElementsByTagName('head')[0].appendChild(link);													
}, 500);
document.title = "!!! TRACKED !!!"