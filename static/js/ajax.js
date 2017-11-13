// all ajax calls go here

// add SRTM as default overlay on map
var getSRTM = function(addToMap=false) {
	var params = getLegendMinMax();
	$.ajax({
		url: '/get_SRTM',
		data: params,
		dataType: 'json',
		success: function(data) {
			SRTM_url = base_url + [data.eeMapId, '{z}', '{x}', '{y}'].join('/');
			SRTM_url += '?token=' + data.eeToken;
			addNewLayer(SRTM_url, {zIndex:maplayer_options_SRTM_raw.zIndex}, maplayer_options_SRTM_raw.name, true, addToMap);
		},
		error: function(data) {
			console.log(data.responseText);
		}
	});
};

// show/update (smoothed) SRTM on map
var updateSRTM = function(addToMap=false) {
	var bounds   = getBoundsObject();
	var cellSize = getCellsize();
	var legend   = getLegendMinMax();
	var params   = $.extend(bounds, {'cellSize': cellSize}, legend);
	$.ajax({
		url: '/update_SRTM',
		data: params,
		dataType: 'json',
		success: function(data) {
			// raw SRTM
			//SRTM_url = base_url + [data.eeMapId_raw, '{z}', '{x}', '{y}'].join('/');
			//SRTM_url += '?token=' + data.eeToken_raw;
			//addNewLayer(SRTM_url, {zIndex:maplayer_options_SRTM_raw.zIndex}, maplayer_options_SRTM_raw.name, true, addToMap);
			// smoothed SRTM
			SRTM_prep_url = base_url + [data.eeMapId_prep, '{z}', '{x}', '{y}'].join('/');
			SRTM_prep_url += '?token=' + data.eeToken_prep;
			addNewLayer(SRTM_prep_url, {zIndex:maplayer_options_SRTM_smooth.zIndex}, maplayer_options_SRTM_smooth.name, true, addToMap);
		},
		error: function(data) {
			console.log(data.responseText);
		}
	});
};

// load OSM fusion tables
var loadFusionTablesOSM = function(addToMap=false) {
	var params = getOSMFusionTables();
	if (params.osm_input_lines !== null && params.osm_input_polys !== null) {
		$.ajax({
			url: '/load_OSM_tables',
			data: params,
			dataType: 'json',
			success: function(data) {
				/*
				// lines
				osmlines_url = base_url + [data.eeMapId_lines, '{z}', '{x}', '{y}'].join('/');
				osmlines_url += '?token=' + data.eeToken_lines;
				loaded_fusion_tables.push(osmlines_url);
				addNewLayer(osmlines_url, {zIndex:maplayer_options_OSM_lines.zIndex}, maplayer_options_OSM_lines.name, true, addToMap);
				*/
				// OSM waterways
				osmwater_url = base_url + [data.eeMapId_water, '{z}', '{x}', '{y}'].join('/');
				osmwater_url += '?token=' + data.eeToken_water;
				addNewLayer(osmwater_url, {zIndex:maplayer_options_OSM_water.zIndex}, maplayer_options_OSM_water.name, true, addToMap);
				// OSM roads
				osmroads_url = base_url + [data.eeMapId_roads, '{z}', '{x}', '{y}'].join('/');
				osmroads_url += '?token=' + data.eeToken_roads;
				addNewLayer(osmroads_url, {zIndex:maplayer_options_OSM_roads.zIndex}, maplayer_options_OSM_roads.name, false, addToMap);
				// polygons
				osmpolys_url = base_url + [data.eeMapId_polys, '{z}', '{x}', '{y}'].join('/');
				osmpolys_url += '?token=' + data.eeToken_polys;
				loaded_fusion_tables.push(osmpolys_url);
				addNewLayer(osmpolys_url, {zIndex:maplayer_options_OSM_polys.zIndex}, maplayer_options_OSM_polys.name, false, addToMap);
			},
			error: function(data) {
				console.log(data.responseText);
				$.notify({
					title: '<strong>Could not load Fusion Tables!</strong>',
					message: 'Make sure the IDs are correct and the tables are publicly accessible.'
				}, {
					type: 'danger',
					placement: {
						align: 'left'
					}
				});
			}
		});
	}
};

// get information about OSM features at clicked point
var getClickedFeature = function(clicked_point, addToMap=false) {
	var fusiontable_ids = getOSMFusionTables();
	var params          = $.extend(fusiontable_ids, clicked_point);
	$.ajax({
		url: '/get_clicked_feature',
		data: params,
		dataType: 'json',
		success: function(data) {
			clicked_area_url = base_url + [data.eeMapId, '{z}', '{x}', '{y}'].join('/');
			clicked_area_url += '?token=' + data.eeToken;
			//addNewLayer(clicked_area_url, {zIndex:maplayer_options_clicked.zIndex}, maplayer_options_clicked.name, false, addToMap);
			showClickedInfo(data.info);
		},
		error: function(data) {
			console.log(data.responseText);
		}
	});
};

// get OSM terrain
var getOSMterrain = function(addToMap=false) {
	// get all relevant input
	var config_string = JSON.stringify(settings);
	var config_dict   = {'config_string': config_string};
	var legend        = getLegendMinMax();
	// combine into single dictionary
	var params = $.extend(config_dict, legend);
	// execute ajax call
	$.ajax({
		url: '/get_osm_terrain',
		data: params,
		dataType: 'json',
		success: function(data) {
			console.log('OSM terrain update finished!');
			// DTM
			dtm_url = base_url + [data.eeMapId_dtm, '{z}', '{x}', '{y}'].join('/');
			dtm_url += '?token=' + data.eeToken_dtm;
			addNewLayer(dtm_url, {zIndex:maplayer_options_DTM.zIndex}, maplayer_options_DTM.name, true, addToMap);
			// DSM
			dsm_url = base_url + [data.eeMapId_dsm, '{z}', '{x}', '{y}'].join('/');
			dsm_url += '?token=' + data.eeToken_dsm;
			addNewLayer(dsm_url, {zIndex:maplayer_options_DSM.zIndex}, maplayer_options_DSM.name, false, addToMap);
		},
		error: function(data) {
			console.log(data.responseText);
		}
	});
};

// export OSM terrain
var exportOSMterrain = function() {
	// clear existing links
	clearDownloadLinks();
	// get all relevant input parameters
	var config_string = JSON.stringify(settings);
	var config_dict   = {'config_string': config_string};
	// get filenames
	var filename_DTM  = $('#export-DTM-filename').val()
	var filename_DSM  = $('#export-DSM-filename').val()
	var filename_meta = $('#export-metadata-filename').val()
	if (filename_DTM == "") {
		filename_DTM = 'PARTERRA_DTM';
	}
	if (filename_DSM == "") {
		filename_DSM = 'PARTERRA_DSM';
	}
	if (filename_meta == "") {
		filename_meta = 'PARTERRA_metadata';
	}
	var filenames     = {'filename_DTM': filename_DTM, 'filename_DSM': filename_DSM};
	// combine into single dictionary
	var params        = $.extend(config_dict, filenames);
	// show panel
	$('.download_panel').css('display', 'block');
	// show prep message
	$('#download_prep').css('display', 'block');
	// get download URLs
	$.ajax({
		url: "/download_osm_terrain",
		data: params,
		dataType: "json",
		success: function(data) {
			// hide prep message
			$('#download_prep').css('display', 'none');
			// show results
			//console.log(data.dtm_url);
			//console.log(data.dsm_url);
			//window.location.replace(data.dtm_url);
			//window.location.replace(data.dsm_url);
			$('#link_dtm').css('display', 'block');
			$('#link_dtm').attr('href', data.dtm_url);
			$('#link_dsm').css('display', 'block');
			$('#link_dsm').attr('href', data.dsm_url);
			// get metadata
			$('#link_metadata').css('display', 'block');
			$('#link_metadata').attr('download', filename_meta + '.json');
			$('#link_metadata').attr('href', "data:application/json;charset=utf-8" + ',' + encodeURIComponent(config_string));
			// set timer for clearing links (5 minutes)
			setTimeout(clearDownloadLinks, 300000)
		},
		error: function(data) {
			console.log(data.responseText);
		}
	});
};

// clear download links
var clearDownloadLinks = function() {
	// clear any existing download links
	$('#link_dtm').removeAttr('href');
	$('#link_dsm').removeAttr('href');
	$('#link_metadata').removeAttr('href');
	$('#link_metadata').removeAttr('download');
	// remove download links messages
	$('#link_dtm').css('display', 'none');
	$('#link_dsm').css('display', 'none');
	$('#link_metadata').css('display', 'none');
	// remove panel
	$('.download_panel').css('display', 'none');
};
