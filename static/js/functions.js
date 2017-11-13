// functions used also during setup

var getUTMzone = function(bbox) {
	//http://stackoverflow.com/questions/9186496/determining-utm-zone-to-convert-from-longitude-latitude
	//http://gis.stackexchange.com/questions/33219/how-to-convert-lat-long-to-utm-using-proj4j-similar-to-jscience-utm-latlongtou
	var temp_centroid   = bbox.getCenter();
	var temp_zone_x     = Math.floor( (temp_centroid.lng + 180) / 6 ) + 1;
	var temp_zone_y, temp_epsg, zoneinfo;
	if (temp_centroid.lat >= 0) {
		temp_zone_y   = 'north';
		temp_epsg     = 'EPSG:326' + temp_zone_x;
		zoneinfo = temp_zone_x + ' N';
	} else {
		temp_zone_y   = 'south';
		temp_epsg     = 'EPSG:327' + temp_zone_x;
		zoneinfo = temp_zone_x + ' S';
	}
	var temp_zone_string = '+proj=utm +zone=' + temp_zone_x + ' +' + temp_zone_y + ' +datum=WGS84 +units=m +no_defs';
	return [temp_epsg, temp_zone_string, zoneinfo];
};

var getLegendMinMax = function() {
	var min = $('#legend-min').val();
	var max = $('#legend-max').val();
	return {'legend_min': min, 'legend_max': max};
};

var restyleLegend = function() {
	// get new classes start values
	var min       = parseFloat($('#legend-min').val());
	var max       = parseFloat($('#legend-max').val());
	var entries   = 10;
	var step      = Math.floor((max-min)/entries);
	var remaining = (max-min) - (step*entries);
	var classes   = [min];
	var previous  = min;
	for (var i=0;i<entries;i++) {
		if (i > 0) {
			classes.push(previous+step);
			previous += step;
		} else {
			classes.push(previous+step+remaining);
			previous += remaining;
			previous += step;
		}
	}
	// update classes in legend
	legend_element_index = 1;
	legend_elements      = legend.getContainer().lastChild.childNodes;
	for (var j = 0; j < classes.length; j++) {
		from = classes[j];
		to   = classes[j+1];
		temp_label = from + (to ? ' - ' + to : '+');
		legend_elements[legend_element_index].data = temp_label;
		legend_element_index += 3;
	}
};

var legendUpdate = function() {
	// restyle legend
	restyleLegend();
	// check which elevation layers are loaded and update these
	controlMapLayers._layers.forEach(function(layer) {
		addToMap = false;
		if (layer.name == maplayer_options_SRTM_raw.name) {
			//console.log('Updating SRTM (raw) styling ...')
			if (map.hasLayer(layer.layer)) {
				addToMap = true;
			}
			getSRTM(addToMap);
		} else if (layer.name == maplayer_options_SRTM_smooth.name) {
			//console.log('Updating SRTM (smoothed) styling ...')
			if (map.hasLayer(layer.layer)) {
				addToMap = true;
			}
			updateSRTM(addToMap);
		} else if (layer.name == maplayer_options_DTM.name) {
			//console.log('Updating DTM/DSM styling ...')
			getOSMterrain();
		}
	});
};

var getOSMFusionTables = function() {
	return {
		'osm_input_lines': settings.osm_input_lines,
		'osm_input_polys': settings.osm_input_polys
	};
};

var getOSMLines = function() {
	return settings.osm_input_lines;
};

var getOSMPolys = function() {
	return settings.osm_input_polys;
};

var setOSMLines = function(OSM_linesID) {
	settings.osm_input_lines = OSM_linesID;
	$('#osm-input-lines').val(OSM_linesID);
};

var setOSMPolys = function(OSM_polysID) {
	settings.osm_input_polys = OSM_polysID;
	$('#osm-input-polys').val(OSM_polysID);
};

var onchangeOSMLines = function() {
	var OSM_linesID = $.trim($('#osm-input-lines').val());
	// if input fields don't have values, show a warning
	if (OSM_linesID == '') {
		$.notify({
			title: '<strong>Warning!</strong>',
			message: 'Please enter a Fusion Table ID in both input fields!'
		}, {
			type: 'danger',
			placement: {
				align: 'left'
			}
		});
	} else {
		setOSMLines(OSM_linesID);
	}
};

var onchangeOSMPolys = function() {
	var OSM_polysID = $.trim($('#osm-input-polys').val());
	// if input fields don't have values, show a warning
	if (OSM_polysID == '') {
		$.notify({
			title: '<strong>Warning!</strong>',
			message: 'Please enter a Fusion Table ID in both input fields!'
		}, {
			type: 'danger',
			placement: {
				align: 'left'
			}
		});
	} else {
		setOSMPolys(OSM_polysID);
	}
};

// the default parameters are all handled together to reduce code duplication
// that means if one value is changed, all are updated, but that is cheap
var getDefaults = function() {
	return settings.default_parameters;
};

var setDefaults = function(default_parameters) {
	settings.default_parameters = default_parameters;
	$('input[name=default-param-buildings-1]').val(default_parameters.building.threshold);
	$('input[name=default-param-buildings-2]').val(default_parameters.building.levels);
	$('input[name=default-param-buildings-3]').val(default_parameters.building.level_height);
	$('input[name=default-param-roads-1]').val(default_parameters.highway.width);
	$('input[name=default-param-roads-2]').val(default_parameters.highway.driveway_fraction);
	$('input[name=default-param-roads-3]').val(default_parameters.highway.layer);
	$('input[name=default-param-roads-4]').val(default_parameters.highway.layer_height);
	$('input[name=default-param-roads-5]').val(default_parameters.highway.road_offset);
	$('input[name=default-param-roads-6]').val(default_parameters.highway.sidewalk_offset);
	$('input[name=default-param-water-1]').val(default_parameters.waterway.width);
	$('input[name=default-param-water-2]').val(default_parameters.waterway.depth);
};

var onchangeDefaults = function() {
	var default_parameters = {
		'building': {
			'threshold': parseFloat($('input[name=default-param-buildings-1]').val()),
			'levels': parseFloat($('input[name=default-param-buildings-2]').val()),
			'level_height': parseFloat($('input[name=default-param-buildings-3]').val())
		},
		'highway': {
			'width': parseFloat($('input[name=default-param-roads-1]').val()),
			'driveway_fraction': parseFloat($('input[name=default-param-roads-2]').val()),
			'layer': parseFloat($('input[name=default-param-roads-3]').val()),
			'layer_height': parseFloat($('input[name=default-param-roads-4]').val()),
			'road_offset': parseFloat($('input[name=default-param-roads-5]').val()),
			'sidewalk_offset': parseFloat($('input[name=default-param-roads-6]').val())
		},
		'waterway': {
			'width': parseFloat($('input[name=default-param-water-1]').val()),
			'depth': parseFloat($('input[name=default-param-water-2]').val())
		}};
	setDefaults(default_parameters);
};

var getBounds = function() {
	return settings.bbox;
};

var getBoundsObject = function() {
	bounds = getBounds();
	return {
		'xmin': bounds[0],
		'ymin': bounds[1],
		'xmax': bounds[2],
		'ymax': bounds[3]
	};
};

// expects array of numbers [left, bottom, right, top]
var setBounds = function(val) {
	// if the bounding box is too large, do not set it and notify user
	var corner1 = L.latLng(val[1], val[0]),
		corner2 = L.latLng(val[3], val[2]),
		bbox = L.latLngBounds(corner1, corner2);
	var UTM_zone = getUTMzone(bbox);
	// define a named projection for this UTM zone
	proj4.defs(UTM_zone[0], UTM_zone[1]);
	// convert between lat/lon (EPSG:4326) and UTM (to be able to calculate in meters)
	var minUTM = proj4('EPSG:4326', UTM_zone[0], [bbox.getWest(), bbox.getSouth()]),
		maxUTM = proj4('EPSG:4326', UTM_zone[0], [bbox.getEast(), bbox.getNorth()]);
	var xminUTM = minUTM[0],
		yminUTM = minUTM[1],
		xmaxUTM = maxUTM[0],
		ymaxUTM = maxUTM[1];
	var area = (ymaxUTM - yminUTM) * (xmaxUTM - xminUTM);
	var cellarea = getCellsize(settings) * getCellsize(settings);
	var npixels = area / cellarea;
	if (npixels > MAX_PIXELS) {
		$.notify({
			title: '<strong>Area too large: </strong>',
			message: 'requesting ' + Math.floor(area/1e6) + ' km&#178;, max is ' + Math.floor(MAX_PIXELS * cellarea / 1e6) + ' km&#178; at current cell size'
		}, {
			type: 'danger',
			placement: {
				align: 'left'
			}
		});
		return; // so as not to actually set it
	}

	// set in settings
	settings.bbox = val;
	// set in form
	$('#bounding-box-input').val(val.toString());
	// set in map
	bboxFeatureGroup.clearLayers();
	var layer = L.rectangle(bbox, bboxOptions);
	bboxFeatureGroup.addLayer(layer);

	// set in project info
	updateProjectInfo(UTM_zone[2], area/1e6, npixels);

	// set in configuration tab (if active)
	rewriteConfig();
};

var onchangeBounds = function() {
	setBounds($('#bounding-box-input').val().split(',').map(Number));
};

var getCellsize = function() {
	return settings.cellsize;
};

var setCellsize = function(val) {
	settings.cellsize = val;
	$('#cellsize-input').val(val);
};

// sets the input field again but that is no problem
var onchangeCellsize = function() {
	setCellsize(parseFloat($('#cellsize-input').val()));
};

var updateProjectInfo = function(utm, area, npixels) {
	$('#project-info-utm').text(utm);
	$('#project-info-size').text(parseFloat(area).toFixed(2));
	$('#project-info-pixels').text(parseInt(npixels).toLocaleString());
};

var loadExample = function() {

	// clear map filters layers (TO-DO: put filter layers in Leaflet LayerGroup for easier removal?)
	var temp_filter_layer_names = [];
	controlFilterLayers._layers.forEach(function(layer) {
		temp_filter_layer_names.push(layer.name);
	});
	for (var i=0; i<temp_filter_layer_names.length; i++) {
		removeOldFilterLayer(temp_filter_layer_names[i]);
	}

	// clear map data layers
	//removeOldLayer(maplayer_options_OSM_lines.name);
	removeOldLayer(maplayer_options_OSM_water.name);
	removeOldLayer(maplayer_options_OSM_roads.name);
	removeOldLayer(maplayer_options_OSM_polys.name);
	removeOldLayer(maplayer_options_clicked.name);
	//removeOldLayer(maplayer_options_SRTM_raw.name);
	removeOldLayer(maplayer_options_SRTM_smooth.name);
	removeOldLayer(maplayer_options_DTM.name);
	removeOldLayer(maplayer_options_DSM.name);

	controlMapLayers.addTo(map);

	// clear current filters (length > 2 because first child is text element, second child is filter0)
	var filter_parent = document.getElementById('accordion-filters');
	while (filter_parent.childNodes.length > 2) {
		filter_parent.removeChild(filter_parent.lastChild);
	}

	// add filters
	addFilter();
	addFilter();
	addFilter();
	addFilter();
	addFilter();

	// Update filters:

	// filter 1
	$('#panel-title-edit-filter1').text('Buildings with location');
	var filter1_polygon_json = {
		'type': 'Polygon',
		'coordinates': [[[39.280006885528564, -6.82127310282852], [39.27844046428595, -6.816969300723082],
      [39.270780086517334, -6.819632554688664], [39.270527959381525, -6.8197710429662335],
      [39.26963210139297, -6.82020781242384], [39.26959991455078, -6.820783069557039],
      [39.270029067993164, -6.821912275907481], [39.27185297012329, -6.821230491259609],
      [39.272700547992144, -6.823978946527501], [39.27361787379493, -6.823861768532918]]]
	};
	var filter1_polygon_layer = L.geoJSON(filter1_polygon_json);
	controlFilterLayers.addTo(map);
	controlFilterLayers.addOverlay(filter1_polygon_layer, 'filter1');
	controlFilterLayers._expand();
	drawnItems.addLayer(filter1_polygon_layer);
	$('input[name=filter1-buildings-value1]').val('commercial');
	addFilterValue('filter1', 'buildings');
	$('input[name=filter1-buildings-value2]').val('industrial');
	addFilterValue('filter1', 'buildings');
	$('input[name=filter1-buildings-value3]').val('commercialresidential');
	$('input[name=filter1-buildings-param1]').val(1);
	$('input[name=filter1-buildings-param2]').val(2);
	$('input[name=filter1-buildings-param3]').val(4);
	// filter 2
	$('#panel-title-edit-filter2').text('Buildings/Roads/Waterways 1');
	$('input[name=filter2-buildings-value1]').val('residential');
	addFilterValue('filter2', 'buildings');
	$('input[name=filter2-buildings-value2]').val('house');
	$('input[name=filter2-buildings-param1]').val(0);
	$('input[name=filter2-buildings-param2]').val(1);
	$('input[name=filter2-buildings-param3]').val(3);
	$('input[name=filter2-roads-value1]').val('primary');
	$('input[name=filter2-roads-param1]').val(8);
	$('input[name=filter2-roads-param2]').val(0.75);
	$('input[name=filter2-roads-param3]').val(0);
	$('input[name=filter2-roads-param4]').val(5);
	$('input[name=filter2-roads-param5]').val(0.2);
	$('input[name=filter2-roads-param6]').val(0.4);
	$('input[name=filter2-water-value1]').val('ditch');
	addFilterValue('filter2', 'water');
	$('input[name=filter2-water-value2]').val('stream');
	$('input[name=filter2-water-param1]').val(1);
	$('input[name=filter2-water-param2]').val(1);
	// filter 3
	$('#panel-title-edit-filter3').text('Buildings/Roads/Waterways 2');
	$('input[name=filter3-buildings-value1]').val('commercial');
	addFilterValue('filter3', 'buildings');
	$('input[name=filter3-buildings-value2]').val('industrial');
	addFilterValue('filter3', 'buildings');
	$('input[name=filter3-buildings-value3]').val('commercialresidential');
	$('input[name=filter3-buildings-param1]').val(0.4);
	$('input[name=filter3-buildings-param2]').val(3);
	$('input[name=filter3-buildings-param3]').val(4);
	$('input[name=filter3-roads-value1]').val('secondary');
	addFilterValue('filter3', 'roads');
	$('input[name=filter3-roads-value2]').val('tertiary');
	$('input[name=filter3-roads-param1]').val(5);
	$('input[name=filter3-roads-param2]').val(0.75);
	$('input[name=filter3-roads-param3]').val(0);
	$('input[name=filter3-roads-param4]').val(5);
	$('input[name=filter3-roads-param5]').val(0.2);
	$('input[name=filter3-roads-param6]').val(0.4);
	$('input[name=filter3-water-value1]').val('canal');
	addFilterValue('filter3', 'water');
	$('input[name=filter3-water-value2]').val('river');
	$('input[name=filter3-water-param1]').val(5);
	$('input[name=filter3-water-param2]').val(2);
	// filter 4
	$('#panel-title-edit-filter4').text('Buildings/Roads');
	$('input[name=filter4-buildings-value1]').val('school');
	addFilterValue('filter4', 'buildings');
	$('input[name=filter4-buildings-value2]').val('church');
	addFilterValue('filter4', 'buildings');
	$('input[name=filter4-buildings-value3]').val('college');
	addFilterValue('filter4', 'buildings');
	$('input[name=filter4-buildings-value4]').val('public');
	$('input[name=filter4-buildings-param1]').val(0.4);
	$('input[name=filter4-buildings-param2]').val(2);
	$('input[name=filter4-buildings-param3]').val(4);
	$('input[name=filter4-roads-value1]').val('residential');
	addFilterValue('filter4', 'roads');
	$('input[name=filter4-roads-value2]').val('unclassified');
	$('input[name=filter4-roads-param1]').val(4);
	$('input[name=filter4-roads-param2]').val(1);
	$('input[name=filter4-roads-param3]').val(0);
	$('input[name=filter4-roads-param4]').val(4);
	$('input[name=filter4-roads-param5]').val(0);
	$('input[name=filter4-roads-param6]').val(0);
	// filter 5
	$('#panel-title-edit-filter5').text('Buildings');
	$('input[name=filter5-buildings-value1]').val('apartments');
	$('input[name=filter5-buildings-param1]').val(0.4);
	$('input[name=filter5-buildings-param2]').val(6);
	$('input[name=filter5-buildings-param3]').val(4);

	// set map view
	map.setView([-6.81, 39.264], 14);

	// update map data
	updateSRTM();
	loadFusionTablesOSM();
};
