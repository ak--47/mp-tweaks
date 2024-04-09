console.log('mp-tweaks: renaming tab!'); 
setTimeout(() => {
	var someArr = document.location.pathname.split('/').filter(function (el) {
		return el !== "";
	});
	var title = someArr[someArr.length - 1].toUpperCase().split('-')[0];
	document.title = title;
}, 1000);