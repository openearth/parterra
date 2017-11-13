// leaflet map drawing code

map.on('draw:created', function(e) {
	var type = e.layerType,
		layer = e.layer;

	// rectangle always means setting the bbox
	if (type === 'rectangle') {
		var bbox = layer.getBounds(); // returns L.LatLngBounds object
		var bboxArrray = [bbox.getWest(), bbox.getSouth(), bbox.getEast(), bbox.getNorth()];
		setBounds(bboxArrray);
	}
});

// polygon drawer handler for filters
var polygonDrawer = new L.Draw.Polygon(map);

// map drawing when filter draw button is clicked by user
var drawFilterPolygon = function(filter_id) {
	// suppress map on click event
	//map.off('click', mapOnClick);
	// enable polygon drawer
	polygonDrawer.enable();
	// event handler for when draw is finished
	map.on('draw:created', function addFilterPolygonToMap(e) {
		var layer    = e.layer;
		removeOldFilterLayer(filter_id);
		if (controlFilterLayers._layers.length == 0) {
			controlFilterLayers.addTo(map);
		}
		controlFilterLayers.addOverlay(layer, filter_id);
		controlFilterLayers._expand();                  // open control to show layer is added
		drawnItems.addLayer(layer);
		map.off('draw:created', addFilterPolygonToMap); // remove again to prevent multiple of these event handlers from become active
		//map.on('click', mapOnClick);                    // restore map on click event
	});
};

// delete filter polygon
var deleteFilterPolygon = function(filter_id) {
	removeOldFilterLayer(filter_id);
	if (controlFilterLayers._layers.length == 0) {
		controlFilterLayers.remove();
	}
};

// TODO handle editing
// TODO handle removal (but not for the bbox)

// TODO hook up or delete, now detached
document.getElementById('export').onclick = function(e) {
	// Extract GeoJSON from featureGroup
	var data = drawnItems.toGeoJSON();
	settings.geojson = data;
	// Stringify the JSON
	var convertedData = 'text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(settings));
	// Create export
	document.getElementById('export').setAttribute('href', 'data:' + convertedData);
	document.getElementById('export').setAttribute('download', 'osm-terrain.json');
};

// map on click event for OSM feature inspection
map.on('click', mapClickEvent);
function mapClickEvent(e) {
	clicked_point = {'lat': e.latlng.lat, 'lng': e.latlng.lng};
	var popup_content   = L.DomUtil.create('div', 'popup_content'),
			popup_title     = "<i>Obtaining clicked features...</i>";
	popup_content.innerHTML = popup_title;
  popup.setLatLng(clicked_point)
			 .setContent(popup_content)
			 .openOn(map);
	getClickedFeature(clicked_point);
};

// show obtained info on clicked feature
var showClickedInfo = function(info) {
  //console.log(info);
	var popup_content   = L.DomUtil.create('div', 'popup_content'),
	    popup_title     = "<b>Clicked feature(s)</b>",
	    popup_subtitle1 = "<u>Line</u>: ",
	    popup_subtitle2 = "<u>Polygon</u>: ";
	if (jQuery.isEmptyObject(info.line) === false) {
		var popup_content_1 = "<br>" + "  - " + info.line.key + ": " + info.line.value;
		if (jQuery.isEmptyObject(info.line.name) === false) {
		  popup_content_1 += "<br>" + " - name: " + info.line.name;
		}
		if (jQuery.isEmptyObject(info.line.width) === false) {
		  popup_content_1 += "<br>" + " - width: " + info.line.width;
		}
		if (jQuery.isEmptyObject(info.line.depth) === false) {
		  popup_content_1 += "<br>" + " - depth: " + info.line.depth;
		}
		if (jQuery.isEmptyObject(info.line.layer) === false) {
		  popup_content_1 += "<br>" + " - layer: " + info.line.layer;
		}
		//if (jQuery.isEmptyObject(info.line.surface) === false) {
		//  popup_content_1 += "<br>" + " - surface: " + info.line.surface;
		//}
	}
	else {var popup_content_1 = "none"};
	if (jQuery.isEmptyObject(info.poly) === false) {
		var popup_content_2 = "<br>" + "  - " + info.poly.key + ": " + info.poly.value;
		if (jQuery.isEmptyObject(info.poly.name) === false) {
		  popup_content_2 += "<br>" + " - name: " + info.poly.name;
		}
		if (jQuery.isEmptyObject(info.poly.building_levels) === false) {
		  popup_content_2 += "<br>" + " - levels: " + info.poly.building_levels;
		}
	}
	else {var popup_content_2 = "none"};
	popup_content.innerHTML = popup_title + '<br>' + popup_subtitle1 + popup_content_1 + '<br>' + popup_subtitle2 + popup_content_2;
	popup.setContent(popup_content)
       .openOn(map);
};

// add new layer (http://leafletjs.com/reference.html#tilelayer)
var addNewLayer = function(tileUrl, options, name, expand, addToMap=false) {
	// remove old layer
	removeOldLayer(name);
	// add opacity from current state of opacity slider to options
	options['opacity'] = parseFloat($('#opacity-slider').val());
	// create a new tile layer from the url
	var new_overlay = L.tileLayer(tileUrl, options);
	// add the new overlay to layers control
	//if (controlMapLayers._layers.length == 0 && controlMapLayers._map == undefined) {
	//	controlMapLayers.addTo(map);
	//}
	controlMapLayers.addOverlay(new_overlay, name);
	if (expand === true) {
		// open control to show layer is added
		controlMapLayers._expand();
	}
	if (addToMap) {
		new_overlay.addTo(map);
	}
};

// remove data layer
var removeOldLayer = function(name) {
	controlMapLayers._layers.forEach(function(layer) {
		if (layer.name == name) {
			var layer_instance = layer.layer;
			// check if layer is currently active on map and if so, remove it
			if (map.hasLayer(layer_instance)) {
				map.removeLayer(layer_instance);
			}
			// remove the layer from the layer control
			controlMapLayers.removeLayer(layer_instance);
			//if (controlMapLayers._layers.length == 0) {
			//	controlMapLayers.remove();
			//}
		}
	});
};

// remove filter layer
var removeOldFilterLayer = function(name) {
	controlFilterLayers._layers.forEach(function(layer) {
		if (layer.name == name) {
			var layer_instance = layer.layer;
			// check if layer is currently active on map and if so, remove it
			if (map.hasLayer(layer_instance)) {
				map.removeLayer(layer_instance);
			}
			// check if layer is included in drawnItems and if so, remove it
			if (drawnItems.hasLayer(layer_instance)) {
				drawnItems.removeLayer(layer_instance);
			}
			// remove the layer from layers control
			controlFilterLayers.removeLayer(layer_instance);
		}
	});
};

// control layer opacity
var updateOpacity = function(value) {
	controlMapLayers._layers.forEach(function(layer) {
		if (layer.name !== 'OpenStreetMap' && layer.name !== 'Mapbox Satellite') {
			layer.layer.setOpacity(value);
		}
	});
};
