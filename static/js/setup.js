// code that only runs during setup

// The Google Map.
var map;

// The Drawing Manager for the Google Map.
var drawingManager;

// The Google Map feature for the currently drawn polygon, if any.
var currentPolygon;

// The Earth Engine image on the map.
var image;

// The scale to use for reduce regions.
var REDUCTION_SCALE = 200;

// The default max pixels for Earth Engine is 1e8
var MAX_PIXELS = 1e8;

// variables used in multiple functions
var base_url = 'https://earthengine.googleapis.com/map/';
var loaded_fusion_tables = [];

// map layer options
//var maplayer_options_OSM_lines   = {name: 'OSM lines', zIndex: 5};
var maplayer_options_OSM_water   = {name: 'OSM waterways', zIndex: 5};
var maplayer_options_OSM_roads   = {name: 'OSM roads', zIndex: 6};
//var maplayer_options_OSM_polys   = {name: 'OSM polygons', zIndex: 7};
var maplayer_options_OSM_polys   = {name: 'OSM buildings', zIndex: 7};
var maplayer_options_clicked     = {name: 'clicked area', zIndex: 8};
var maplayer_options_SRTM_raw    = {name: 'SRTM (raw)', zIndex: 1};
var maplayer_options_SRTM_smooth = {name: 'SRTM (smoothed)', zIndex: 2};
var maplayer_options_DTM         = {name: 'Digital Terrain Model', zIndex: 3};
var maplayer_options_DSM         = {name: 'Digital Surface Model', zIndex: 4};

// TODO ensure that these default settings match
var settings = {
	'type': 'FeatureCollection',
	'bbox': [39.245,-6.828,39.287,-6.792],
	'cellsize': 1.0,
	'osm_input_lines': '1lrYlfLqnV-dT_f6xBXP6qWWE_IJXxpJDcC1C9hKJ',
	'osm_input_polys': '1By1AvgR4sw12OlqNf3-EuYEgVSOEqbYbE6WbaUfI',
	'default_parameters': {
		'building': {
			'threshold': 0.2,
			'levels': 1,
			'level_height': 3
		},
		'highway': {
			'width': 2,
			'driveway_fraction': 1,
			'layer': 0,
			'layer_height': 4,
			'road_offset': 0,
			'sidewalk_offset': 0
		},
		'waterway': {
			'width': 2,
			'depth': 1
		}},
	'features': [{
		'type': 'Feature',
		'geometry': {
			'type': 'Polygon',
			'coordinates': [[[39.280006, -6.821273], [39.278440, -6.816969], [39.270780, -6.819632], [39.270527, -6.819771], [39.269632, -6.820207], [39.269599, -6.820783], [39.270029, -6.821912], [39.271852, -6.821230], [39.272700, -6.823978], [39.273617, -6.823861], [39.280006, -6.821273]]]
		},
		'properties': {
			'name': 'Buildings with location',
			'building': {
				'keys': ['commercial', 'industrial', 'commercial;residential'],
				'parameters': {
					'threshold': 0.2,
					'levels': 1,
					'level_height': 3
				}
			}
		}
	},
	{
		'type': 'Feature',
		'geometry': null,
		'properties': {
			'name': 'Building/Roads/Waterways 1',
			'building': {
				'keys': ['residential', 'house'],
				'parameters': {
					'threshold': 0,
					'levels': 1,
					'level_height': 3
				}
			},
			'highway': {
				'keys': ['primary'],
				'parameters': {
					'width': 8,
					'driveway_fraction': 0.75,
					'layer': 0,
					'layer_height': 5,
					'road_offset': 0.2,
					'sidewalk_offset': 0.4
				}
			},
			'waterway': {
				'keys': ['ditch', 'stream'],
				'parameters': {
					'width': 1,
					'depth': 1
				}
			}
		}
	},
	{
		'type': 'Feature',
		'geometry': { 'type': 'Polygon', 'coordinates': [[[39.261575, -6.795194], [39.25665, -6.799551], [39.260105, -6.802651], [39.262261, -6.802971], [39.264868, -6.796718], [39.261575, -6.795194 ]]]},
		'properties': {
			'name': 'Buildings',
			'building': {
				'keys': ['residential', 'house'],
				'parameters': {
					'threshold': 0,
					'levels': 1,
					'level_height': 3
				}
			},
			'highway': {
				'keys': ['primary'],
				'parameters': {
					'width': 8,
					'driveway_fraction': 0.75,
					'layer': 0,
					'layer_height': 5,
					'road_offset': 0.2,
					'sidewalk_offset': 0.4
				}
			},
			'waterway': {
				'keys': ['ditch', 'stream'],
				'parameters': {
					'width': 1,
					'depth': 1
				}
			}
		}
	}]
};

var geojsonFeature = settings;

// Define a named projection for UTM37S
proj4.defs('EPSG:32737', '+proj=utm +zone=37 +south +datum=WGS84 +units=m +no_defs');

var bboxOptions = {
	color: '#ff7800',
	weight: 1,
	fill: false
};

// create a map in the "map" div, set the view to a given place and zoom
map = L.map('map', {}).setView([-6.7994, 39.2621], 13);
map.zoomControl.setPosition('topright');

// create a popup variable (to populate with OSM feature information on click)
var popup = L.popup();

// set base layers (Mapbox OpenStreetMap tile layer and Satellite tile layer)
var baseOSM = L.tileLayer('https://api.mapbox.com/styles/v1/visr/ciumocqb700e62jl8ub5jby3o/tiles/256/{z}/{x}/{y}?access_token=<TOKEN>', {
	zIndex: 0,
	maxZoom: 18,
	attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
		'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
		'Imagery © <a href="http://mapbox.com">Mapbox</a>',
	id: 'examples.map-i875mjb7'
});
baseOSM.addTo(map);
var baseSat = L.tileLayer('https://api.mapbox.com/styles/v1/visr/cizpkbwr000f32snuebfxryhl/tiles/256/{z}/{x}/{y}?access_token=<TOKEN>', {
	zIndex: 0,
	maxZoom: 18,
	attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
		'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
		'Imagery © <a href="http://mapbox.com">Mapbox</a>'
});
var baseLayers = {'OpenStreetMap': baseOSM, 'Mapbox Satellite': baseSat};

// Initialise the FeatureGroup to store editable layers
var drawnItems = new L.FeatureGroup();
// Separate FeatureGroup for the calculation bounding box
var bboxFeatureGroup = new L.FeatureGroup();

// add the hardcoded geojsonFeature as an initial polygon
// this creates a leaflet GeoJSON object (extends featuregroup)
var leafGeoJSON = L.geoJSON(geojsonFeature);
// hence we need to add the layers to the featuregroup one by one
// even though in this case always only one layer
leafGeoJSON.eachLayer(function(layer) {
	drawnItems.addLayer(layer);
});

// L.geoJSON(geojsonFeature)
// drawnItems.add
map.addLayer(drawnItems);
map.addLayer(bboxFeatureGroup);

// Initialise the draw control and pass it the FeatureGroup of editable layers
var drawControl = new L.Control.Draw({
	position: 'topright',
	draw: {
		polyline: false,
		polygon: false,  // set to false since polygon drawing is only required for filters, and that has its own buttons for this
		circle: false,
		rectangle: {
			shapeOptions: bboxOptions
		},
		marker: false
	},
	edit: {
		featureGroup: drawnItems,
		remove: true
	}
});
map.addControl(drawControl);

// create a slider for opacity control of map overlays
var opacity_slider = L.control({position: 'bottomright'});
opacity_slider.onAdd = function (map) {
	var div    = L.DomUtil.create('div', 'info slider');
	var title  = '<span>Overlay opacity control</span>';
	var slider = '<input type="range" name="opacity-slider" id="opacity-slider" min="0" max="1" step="0.1" value="1">';
	div.innerHTML = title + slider;
	return div;
};
opacity_slider.addTo(map);
// add event listeners to suppress dragging/clicking the map when moving the slider
// -> disable dragging/clicking when mouse hovers over slider element
opacity_slider.getContainer().addEventListener('mouseover', function () {
	map.dragging.disable();
	map.doubleClickZoom.disable();
	map.off('click', mapClickEvent);
});
// -> re enable dragging/clicking when mouse exits slider element
opacity_slider.getContainer().addEventListener('mouseout', function () {
	map.dragging.enable();
	map.doubleClickZoom.enable();
	map.on('click', mapClickEvent);
});
// add function that executes on slider change
$('#opacity-slider').on('change', function() {
	//console.log($('#opacity-slider').val());
	updateOpacity(parseFloat($('#opacity-slider').val()));
});

// create a control layers variable for data layers and add it to map
// http://leafletjs.com/reference.html#control-layers
var controlMapLayers = L.control.layers(baseLayers, {}, {autoZIndex: false});
controlMapLayers.addTo(map);

// create alert containers
// http://leafletjs.com/reference.html#domutil
var loading_alert    = L.control({position: 'topleft'});
loading_alert.onAdd = function (map) {
	var div   = L.DomUtil.create('div', 'map-alert');
	var label = '<p>Loading tiles...</p>';
	div.innerHTML = label;
	return div;
};

// store info on loading layers (used for control of 'loading' message)
var loading_layers = {};

// add event listeners to the map, that check if a layer is (de)selected (used for control of 'loading' message)
map.addEventListener('overlayadd', function(e) {
	// check name of selected layer (only proceed if it's not a filter layer)
	var selected_name = e.name;
	if (e.name.indexOf('filter') == -1) {
		// include layer name in info variable and set it to 1
		loading_layers[selected_name] = 1;
		// add initial alert to map
		loading_alert.addTo(map);
		// add event listeners to the layer, to check whether tiles are loading
		var selected_layer = e.layer;
		selected_layer.addEventListener('loading', function(event) {
			// set info variable to 1 for this layer and add alert to map
			loading_layers[selected_name] = 1;
			loading_alert.addTo(map);
		});
		selected_layer.addEventListener('load', function(event) {
			// set info variable to 0 for this layer
			loading_layers[selected_name] = 0;
			// check if all entries in info variable are zero, and if so, remove alert
			var remove_alert = true;
			for (var i in loading_layers) {
				if (loading_layers[i] == 1) {
					remove_alert = false;
					break;
				}
			}
			if (remove_alert) {
				loading_alert.remove();
			}
		});
	}
});
map.addEventListener('overlayremove', function(e) {
	var selected_name = e.name;
	if (e.name.indexOf('filter') == -1) {
		var deselected_layer = e.layer;
		deselected_layer.removeEventListener('loading');
		deselected_layer.removeEventListener('load');
		// set info variable to 0 for this layer
		loading_layers[selected_name] = 0;
		// check if all entries in info variable are zero, and if so, remove alert
		var remove_alert = true;
		for (var i in loading_layers) {
			if (loading_layers[i] == 1) {
				remove_alert = false;
				break;
			}
		}
		if (remove_alert) {
			loading_alert.remove();
		}
	}
});

// create a control layers variable for filter polygons (don't add to map yet, no filter polygons yet)
var controlFilterLayers = L.control.layers();

// create a legend
// (http://leafletjs.com/examples/choropleth/)
var legend = L.control({position: 'bottomleft'});
function getColor(d) {
	return d > 100 ? '#ffffff' :
		d > 90  ? '#a50026' :
		d > 80  ? '#d73027' :
		d > 70  ? '#f46d43' :
		d > 60  ? '#fdae61' :
		d > 50  ? '#fee08b' :
		d > 40  ? '#ffffbf' :
		d > 30  ? '#d9ef8b' :
		d > 20  ? '#a6d96a' :
		d > 10  ? '#66bd63' :
		d > -5  ? '#1a9850' : '#006837';
}
legend.onAdd = function (map) {
	var div = L.DomUtil.create('div', 'info legend'),
		title  = '<p><strong> Elevation [m] </strong><p>',
		min    = '<span>min:</span><input type="number" class="legend-value" id="legend-min" min="-999" max="9999" step="1" value="-5">',
		max    = '<span>max:</span><input type="number" class="legend-value" id="legend-max" min="-999" max="9999" step="1" value="100">',
		button = '<button onclick="legendUpdate()" style="float:right">update</button>',
		grades = [-5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
		labels = [],
		from, to;

	for (var i = 0; i < grades.length; i++) {
		from = grades [i];
		to   = grades[i+1];
		labels.push(
			'<i style="background:' + getColor(from + 1) + '"></i> ' +
			from + (to ? ' - ' + to : '+'));
	}
	div.innerHTML = title + labels.join('<br>') + '<br>' + min + '<br>' + max + '<br>' + button;
	return div;
};
legend.addTo(map);
// add event listeners to suppress zoom clicking the map when mouse is within legend box
// -> disable map clicking when mouse hovers over legend element
legend.getContainer().addEventListener('mouseover', function () {
	map.doubleClickZoom.disable();
	map.off('click', mapClickEvent);
});
// -> re enable map clicking when mouse exits legend element
legend.getContainer().addEventListener('mouseout', function () {
	map.doubleClickZoom.enable();
	map.on('click', mapClickEvent);
});

// set up editor with initial GeoJSON
var flask = new CodeFlask();
flask.run('#my-code-wrapper', {
	language: 'json'
});
flask.update(JSON.stringify(settings, null, '  '));

// add SRTM layer(s) to the map
//updateSRTM();
getSRTM();
