bespoke.from('article', {
	keys: true,
	fx: true,
	loop: true
});

bespoke.vertical.from('article', {
	fx: {
		direction: "vertical",
		transition: "cube",
		reverse: true	
	}
});
