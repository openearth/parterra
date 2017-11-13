// code to handle editor

// always update GeoJSON when switching to that tab
// it can be modified by filling in input fields on other tabs
$('body').on('shown.bs.tab', '#geojson-link', function() {
	flask.update(JSON.stringify(settings, null, '  '));
});

// function to rewrite configuration in editor for if the settings
// are changed in the map view
// only for if the configuration tab is open, otherwise the
// on('shown.bs.tab') will take care of it
var rewriteConfig = function() {
	if ($('#geojson-link').parent().hasClass('active')) {
		flask.update(JSON.stringify(settings, null, '  '));
	}
};

// alternative to button is flask.onUpdate()
// but this triggers directly whilst typing
// causing many validation errors and UI updates
var applyConfig = function() {
	var code = flask.textarea.value;
	errors = geojsonhint.hint(code);
	if (errors.length > 0) {
		errors.forEach(function(error) {
			$.notify({
				title: '<strong>Error parsing GeoJSON: </strong>',
				message: error.message
			}, {
				type: 'danger',
				placement: {
					align: 'left'
				}
			});
		});
	} else {
		console.log('GeoJSON is ok'); // TODO remove
		settings = JSON.parse(code);
		// at this point anything may have changed so the UI needs to be updated completely
		buildUI();
	}
};

var buildUI = function() {
	setCellsize(getCellsize());
	setBounds(getBounds());
	setOSMLines(getOSMLines());
	setOSMPolys(getOSMPolys());
	setDefaults(getDefaults());
};
