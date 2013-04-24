var FoundRule = new Class({
	
	Properties: ['exception', 'interesting', 'rule'],
	
	$exception: null,
	$interesting: null,
	$rule: null,
	
	initialize: function (rule) {
		this.$rule = rule;
	},
	
	getCSSID: function() {
		return 'found-rule-' + this.getRule().getTask().getId() + '-' + this.getRule().getId();
	},
	
	isException: function () {
		return (this.$exception !== null);
	},
	
	isInteresting: function () {
		return (this.$interesting !== null);
	}
});