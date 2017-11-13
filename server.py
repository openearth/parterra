#!/usr/bin/env python
"""Google Earth Engine python code for the ParTerra-GEE Tool"""

# This script handles the loading of the web application,
# as well as the complete Earth Engine code for all calculations.

import os
import json
import logging

import config
import ee
import jinja2
import webapp2

#import pdb

# ------------------------------------------------------------------------------------ #
# Initialization
# ------------------------------------------------------------------------------------ #

# Set up Jinja environment
JINJA2_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)),
    autoescape=True,
    extensions=['jinja2.ext.autoescape'])

# Initialize earth engine
ee.Initialize(config.EE_CREDENTIALS)

# ------------------------------------------------------------------------------------ #
# Web request handlers
# ------------------------------------------------------------------------------------ #

class MainPage(webapp2.RequestHandler):
    """
    Start up function that loads the html template.
    """
    def get(self):
        template        = JINJA2_ENVIRONMENT.get_template('index.html')
        template_values = {}
        self.response.out.write(template.render(template_values))


class getBaseLayer(webapp2.RequestHandler):
    """
    This function gets the SRTM base layer when the app is started up.
    """
    def get(self):
        # get legend min/max
        legend_min = float(self.request.params.get('legend_min'))
        legend_max = float(self.request.params.get('legend_max'))
        # get mapId
        SRTM_mapid = getDEMmapId(SRTM, legend_min, legend_max)
        content = {
            'eeMapId': SRTM_mapid['mapid'],
            'eeToken': SRTM_mapid['token']
        }
        # send data
        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(content))


class UpdateSRTM(webapp2.RequestHandler):
    """
    This function shows/updates the SRTM layer(s) on the map, based on the user-defined bounds and cell size.
    """
    def get(self):
        # get bounds and create Geometry
        xmin   = float(self.request.params.get('xmin'))
        xmax   = float(self.request.params.get('xmax'))
        ymin   = float(self.request.params.get('ymin'))
        ymax   = float(self.request.params.get('ymax'))
        bounds = ee.Geometry.Rectangle(ee.List([xmin,ymin,xmax,ymax]), 'EPSG:4326', None, None, False)
        # get cell size
        cellSize = float(self.request.params.get('cellSize'))
        # get legend min/max
        legend_min = float(self.request.params.get('legend_min'))
        legend_max = float(self.request.params.get('legend_max'))
        # clip SRTM to bounds and apply smoothing
        SRTM_bounds = SRTM.clip(bounds)
        SRTM_prep   = smoothDEM(SRTM_bounds, cellSize).clip(bounds)
        # get mapIds
        #SRTM_raw_mapid  = getDEMmapId(SRTM_bounds, legend_min, legend_max)
        SRTM_prep_mapid = getDEMmapId(SRTM_prep, legend_min, legend_max)
        # create dictionary for sending data back
        content = {
            #'eeMapId_raw': SRTM_raw_mapid['mapid'],
            #'eeToken_raw': SRTM_raw_mapid['token'],
            'eeMapId_prep': SRTM_prep_mapid['mapid'],
            'eeToken_prep': SRTM_prep_mapid['token']
        }
        # send data
        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(content))


class LoadFusionTablesOSM(webapp2.RequestHandler):
    """
    This function loads in OSM lines and polygons from Fusion Table id's.
    """
    def get(self):
        # get id's
        id_lines = self.request.params.get('osm_input_lines')
        id_polys = self.request.params.get('osm_input_polys')
        # create FeatureCollections
        osm_lines = ee.FeatureCollection('ft:'+id_lines)
        osm_polys = ee.FeatureCollection('ft:'+id_polys)
        # only use buildings in polygons dataset
        osm_polys = osm_polys.filterMetadata('building_isempty', 'equals', 0)
        # separate roads and waterways in lines dataset
        osm_roads = osm_lines.filterMetadata('highway', 'not_equals', None)
        osm_water = osm_lines.filterMetadata('waterway', 'not_equals', None)
        # get mapId's of features
        #lines_mapid = osm_lines.getMapId()
        #water_mapid = osm_water.getMapId()
        #roads_mapid = osm_roads.getMapId()
        water_mapid = ee.Image().toByte().paint(osm_water, 'color', 2).getMapId({'palette':'0000FF'})
        roads_mapid = ee.Image().toByte().paint(osm_roads, 'color', 2).getMapId({'palette':'FF0000'})
        polys_mapid = osm_polys.getMapId()
        # create dictionary for sending data back
        content = {
            #'eeMapId_lines': lines_mapid['mapid'],
            #'eeToken_lines': lines_mapid['token'],
            'eeMapId_water': water_mapid['mapid'],
            'eeToken_water': water_mapid['token'],
            'eeMapId_roads': roads_mapid['mapid'],
            'eeToken_roads': roads_mapid['token'],
            'eeMapId_polys': polys_mapid['mapid'],
            'eeToken_polys': polys_mapid['token']
        }
        # send data
        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(content))


class GetClickedFeature(webapp2.RequestHandler):

    def get(self):

        # get OSM features and create FeatureCollections
        id_lines  = self.request.params.get('osm_input_lines')
        id_polys  = self.request.params.get('osm_input_polys')
        osm_lines = ee.FeatureCollection('ft:'+id_lines)
        osm_polys = ee.FeatureCollection('ft:'+id_polys)

        # get coordinates and apply small buffer
        lat   = ee.Number(float(self.request.params.get('lat')))
        lon   = ee.Number(float(self.request.params.get('lng')))

        buff_coords = 0.0001

        lat_min = lat.subtract(buff_coords)
        lat_max = lat.add(buff_coords)
        lon_min = lon.subtract(buff_coords)
        lon_max = lon.add(buff_coords)

        # create Geometry from buffered coordinates
        list_coords = ee.List([lon_min, lat_min, lon_max, lat_max])
        poly = ee.Geometry.Rectangle(list_coords)

        # get info of first features within Geometry, if any
        clicked_line_info = {}
        clicked_poly_info = {}
        clicked_line_info_raw = {}
        clicked_poly_info_raw = {}
        try:
            clicked_line          = ee.Feature(osm_lines.filterBounds(poly).first())
            clicked_line_info_raw = clicked_line.toDictionary().getInfo()
            if clicked_line_info_raw['highway'] != "":
                clicked_line_info['key']   = 'highway'
                clicked_line_info['value'] = clicked_line_info_raw['highway']
                if clicked_line_info_raw['width'] != -1:
                    clicked_line_info['width'] = clicked_line_info_raw['width']
                if clicked_line_info_raw['layer'] != -1:
                    clicked_line_info['layer'] = clicked_line_info_raw['layer']
                if clicked_line_info_raw['surface'] != "":
                    clicked_line_info['surface'] = clicked_line_info_raw['surface']
                if clicked_line_info_raw['Name'] != "":
                    clicked_line_info['name'] = clicked_line_info_raw['Name']
                #if clicked_line_info_raw['osm_id'] != "":
                #    clicked_line_info['osm_id'] = clicked_line_info_raw['osm_id']
            elif clicked_line_info_raw['waterway'] != "":
                clicked_line_info['key']   = 'waterway'
                clicked_line_info['value'] = clicked_line_info_raw['waterway']
                if clicked_line_info_raw['width'] != -1:
                    clicked_line_info['width'] = clicked_line_info_raw['width']
                if clicked_line_info_raw['depth'] != -1:
                    clicked_line_info['depth'] = clicked_line_info_raw['depth']
                if clicked_line_info_raw['Name'] != "":
                    clicked_line_info['name'] = clicked_line_info_raw['Name']
                #if clicked_line_info_raw['osm_id'] != "":
                #    clicked_line_info['osm_id'] = clicked_line_info_raw['osm_id']
        except:
            pass
        try:
            clicked_poly          = ee.Feature(osm_polys.filterBounds(poly).first())
            clicked_poly_info_raw = clicked_poly.toDictionary().getInfo()
            if clicked_poly_info_raw['building_isempty'] != 1:
                clicked_poly_info['key']   = 'building'
                clicked_poly_info['value'] = clicked_poly_info_raw['building']
                if clicked_poly_info_raw['building_levels_isempty'] != 1:
                    clicked_poly_info['building_levels'] = clicked_poly_info_raw['building_levels']
                if clicked_poly_info_raw['Name'] != "":
                    clicked_poly_info['name'] = clicked_poly_info_raw['Name']
                #if clicked_poly_info_raw['osm_way_id'] != "":
                #    clicked_poly_info['osm_way_id'] = clicked_poly_info_raw['osm_way_id']
        except:
            pass

        clicked_info = {'line': clicked_line_info, 'poly': clicked_poly_info}
        clicked_info['line_raw'] = clicked_line_info_raw
        clicked_info['poly_raw'] = clicked_poly_info_raw

        test_mapid = ee.FeatureCollection(ee.Feature(poly)).getMapId()
        content = {
            'eeMapId': test_mapid['mapid'],
            'eeToken': test_mapid['token'],
            'info': clicked_info
        }

        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(content))


class GetOSMterrain(webapp2.RequestHandler):

    def get(self):
    
        # load JSON string with config info as actual JSON object
        config_settings = json.loads(self.request.params.get('config_string'))
    
        # get OSM features and create FeatureCollections
        id_lines  = config_settings['osm_input_lines']
        id_polys  = config_settings['osm_input_polys']
        osm_lines = ee.FeatureCollection('ft:'+id_lines)
        osm_polys = ee.FeatureCollection('ft:'+id_polys)
        
        # get bounds and create Geometry
        bbox   = config_settings['bbox']
        xmin   = float(bbox[0])
        xmax   = float(bbox[2])
        ymin   = float(bbox[1])
        ymax   = float(bbox[3])
        bounds = ee.Geometry.Rectangle(ee.List([xmin,ymin,xmax,ymax]), 'EPSG:4326', None, None, False)
        
        # get cell size
        cellSize = float(config_settings['cellsize'])
        
        # get default input values
        default_values              = config_settings['default_parameters']
        buildingsThreshDefault      = float(default_values['building']['threshold'])
        buildingsLevelDefault       = int(default_values['building']['levels'])
        buildingsLevelHeightDefault = float(default_values['building']['level_height'])
        roadsWidthDefault           = float(default_values['highway']['width'])
        roadsDrivewayFracDefault    = float(default_values['highway']['driveway_fraction'])
        roadsLayerDefault           = int(default_values['highway']['layer'])
        roadsLayerHeightDefault     = float(default_values['highway']['layer_height'])
        roadsOffsetDefault          = float(default_values['highway']['road_offset'])
        roadsSidewalkOffsetDefault  = float(default_values['highway']['sidewalk_offset'])
        waterWidthDefault           = float(default_values['waterway']['width'])
        waterDepthDefault           = float(default_values['waterway']['depth'])
        
        # get filter input values
        filters = config_settings['features']
        
        # loop over filters to create filter list per type, as required by the algorithm
        buildingFilters = []
        roadFilters     = []
        waterwayFilters = []
        
        buidingLevels_list   = []
        levelHeight_list     = []
        thresholdHeight_list = []
        
        roadwidth_list      = []
        driveFrac_list      = []
        layer_list          = []
        layerHeight_list    = []
        roadOffset_list     = []
        sidewalkOffset_list = []
        
        depth_list      = []
        waterwidth_list = []
        
        for filter in filters:
            if filter['geometry'] != None:
                temp_geom = ee.Geometry.Polygon(filter['geometry']['coordinates'])
            else:
                temp_geom = None
            for property in filter['properties'].keys():
                if property == 'building':
                    temp_keys   = filter['properties']['building']['keys']
                    buildingFilters.append([temp_keys, temp_geom])
                    temp_params = filter['properties']['building']['parameters']
                    for parameter in filter['properties']['building']['parameters'].keys():
                        if parameter == 'levels':
                            buidingLevels_list.append(filter['properties']['building']['parameters']['levels'])
                        if parameter == 'level_height':
                            levelHeight_list.append(filter['properties']['building']['parameters']['level_height'])
                        if parameter == 'threshold':
                            thresholdHeight_list.append(filter['properties']['building']['parameters']['threshold'])
                if property == 'highway':
                    temp_keys = filter['properties']['highway']['keys']
                    roadFilters.append([temp_keys, temp_geom])
                    for parameter in filter['properties']['highway']['parameters'].keys():
                        if parameter == 'width':
                            roadwidth_list.append(filter['properties']['highway']['parameters']['width'])
                        if parameter == 'driveway_fraction':
                            driveFrac_list.append(filter['properties']['highway']['parameters']['driveway_fraction'])
                        if parameter == 'layer':
                            layer_list.append(filter['properties']['highway']['parameters']['layer'])
                        if parameter == 'layer_height':
                            layerHeight_list.append(filter['properties']['highway']['parameters']['layer_height'])
                        if parameter == 'road_offset':
                            roadOffset_list.append(filter['properties']['highway']['parameters']['road_offset'])
                        if parameter == 'sidewalk_offset':
                            sidewalkOffset_list.append(filter['properties']['highway']['parameters']['sidewalk_offset'])
                if property == 'waterway':
                    temp_keys = filter['properties']['waterway']['keys']
                    waterwayFilters.append([temp_keys, temp_geom])
                    for parameter in filter['properties']['waterway']['parameters'].keys():
                        if parameter == 'width':
                            depth_list.append(filter['properties']['waterway']['parameters']['width'])
                        if parameter == 'depth':
                            waterwidth_list.append(filter['properties']['waterway']['parameters']['depth'])
        buidingLevels_list.append(buildingsLevelDefault)
        levelHeight_list.append(buildingsLevelHeightDefault)
        thresholdHeight_list.append(buildingsThreshDefault)
        roadwidth_list.append(roadsWidthDefault)
        driveFrac_list.append(roadsDrivewayFracDefault)
        layer_list.append(roadsLayerDefault)
        layerHeight_list.append(roadsLayerHeightDefault)
        roadOffset_list.append(roadsOffsetDefault)
        sidewalkOffset_list.append(roadsSidewalkOffsetDefault)
        depth_list.append(waterWidthDefault)
        waterwidth_list.append(waterDepthDefault)
        
        # get legend min/max
        legend_min = float(self.request.params.get('legend_min'))
        legend_max = float(self.request.params.get('legend_max'))
        
        # clip SRTM to bounds and apply smoothing
        SRTM_prep = smoothDEM(SRTM.clip(bounds), cellSize).clip(bounds)
        
        # STEP 1: filter OSM features into categories
        osm_buildings = filter_category(osm_polys, 'building')
        osm_roads     = filter_category(osm_lines, 'highway')
        osm_waterways = filter_category(osm_lines, 'waterway')

        # STEP 2: split according to filters and update properties
        
        #**BUILDINGS
        # the filter is defined as list< list<"values">, geometry<"bounds"> >
        # if geometry is None the geographical filter is applied
        #buildingFilters = [[['commercial','industrial','commercialresidential'], None], [['residential','house'], None], [['commercial','industrial','commercialresidential'], None], [['school','church','college','public'], None], [['apartments'], None]]
        # properties should have length of filters +1 ("other")
        #buidingLevels_list   = [2, 1, 3, 2, 6, buildingsLevelDefault]
        #levelHeight_list     = [4, 3, 4, 4, 4, buildingsLevelHeightDefault]
        #thresholdHeight_list = [1, 0, 0.4, 0.4, 0.4, buildingsThreshDefault]
        #color_list_buildings = ['98ff00', 'BB4400', '22DDFF', 'DDFF22', 'FFA500', 'FFA500']  # unused?
        buildings = update_AllBuildings(osm_buildings, buildingFilters, buidingLevels_list, levelHeight_list, thresholdHeight_list)

        #**ROADS
        #roadFilters = [[['primary'], None], [['secondary','tertiary'], None], [['residential','unclassified'], None]]
        #roadwidth_list          = [8, 5, 4, roadsWidthDefault]
        #driveFrac_list      = [0.75, 0.75, 1, roadsDrivewayFracDefault]               
        #layer_list          = [0, 0, 0, roadsLayerDefault]
        #layerHeight_list    = [5, 5, 4, roadsLayerHeightDefault]
        #roadOffset_list     = [0.2, 0.2, 0, roadsOffsetDefault]
        #sidewalkOffset_list = [0.4, 0.4, 0, roadsSidewalkOffsetDefault]
        #color_list_roads    = ['E5E500', 'FFFFB2', 'B7B799', 'A9A9A9']  # unused?
        roads = update_AllRoads(osm_roads, roadFilters, roadwidth_list, driveFrac_list, layer_list, layerHeight_list, roadOffset_list, sidewalkOffset_list)

        #**WATERWAYS
        #waterwayFilters = [[['ditch','stream'], None], [['canal','river'], None]]
        #depth_list = [1, 2, waterDepthDefault]
        #waterwidth_list = [1, 5, waterWidthDefault]
        #color_list_waterways = ['b2b2ff', '0000FF', 'D3D3D3']  # unused?
        waterways = update_AllWaterways(osm_waterways, waterwayFilters, depth_list, waterwidth_list)
                                                                                
        # STEP 3: polygonize lines
        
        #**ROADS
        roads_poly = line2poly_fc(roads, 'drive_width', cellSize)
        sidewalks  = sidewalks_fc(roads, cellSize)
        
        #**WATERWAYS
        waterways_poly = line2poly_fc(waterways, 'width', cellSize)

        # STEP 4: preprocess DEM
        
        # smooth SRTM
        info = SRTM.getInfo()['bands'][0]
        #srtm_pre = peronaMalikFilter(SRTM.convolve(ee.Kernel.gaussian(30, 15, 'meters')), 5, 5, 2).resample('bicubic').reproject(info['crs'],None,cellSize)
        srtm_pre = SRTM_prep
        
        # filter primary & secondary roads from updated dataset <COMMENTED OUT FOR NOW TO SAVE MEMORY>
        #roads_preprocess = filter_fc(roads, 'highway', ['primary','secondary','tertiary'], None)
        #srtm_pre = straighten_dem(srtm_pre, roads_preprocess)

        # STEP 5: rasterize
        osm_all = buildings.merge(roads_poly).merge(sidewalks).merge(waterways_poly) 
        osm_minheight = burn_map_min(osm_all, 'burn_height_min', cellSize, 0)
        dtm = srtm_pre.add(osm_minheight) 
        osm_maxheight = burn_map_max(osm_all, 'burn_height', cellSize, 0)
        dsm = srtm_pre.add(osm_maxheight)
        
        # get mapIds
        dtm_mapid  = getDEMmapId(dtm.clip(bounds), legend_min, legend_max)
        dsm_mapid  = getDEMmapId(dsm.clip(bounds), legend_min, legend_max)

        content = {
            'eeMapId_dtm': dtm_mapid['mapid'],
            'eeToken_dtm': dtm_mapid['token'],
            'eeMapId_dsm': dsm_mapid['mapid'],
            'eeToken_dsm': dsm_mapid['token']
        }

        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(content))


class DownloadOSMterrain(webapp2.RequestHandler):

    def get(self):
    
        # load JSON string with config info as actual JSON object
        config_settings = json.loads(self.request.params.get('config_string'))
    
        # get OSM features and create FeatureCollections
        id_lines  = config_settings['osm_input_lines']
        id_polys  = config_settings['osm_input_polys']
        osm_lines = ee.FeatureCollection('ft:'+id_lines)
        osm_polys = ee.FeatureCollection('ft:'+id_polys)
        
        # get bounds and create Geometry
        bbox   = config_settings['bbox']
        xmin   = float(bbox[0])
        xmax   = float(bbox[2])
        ymin   = float(bbox[1])
        ymax   = float(bbox[3])
        bounds = ee.Geometry.Rectangle(ee.List([xmin,ymin,xmax,ymax]), 'EPSG:4326', None, None, False)
        
        # get cell size
        cellSize = float(config_settings['cellsize'])
        
        # get default input values
        default_values              = config_settings['default_parameters']
        buildingsThreshDefault      = float(default_values['building']['threshold'])
        buildingsLevelDefault       = int(default_values['building']['levels'])
        buildingsLevelHeightDefault = float(default_values['building']['level_height'])
        roadsWidthDefault           = float(default_values['highway']['width'])
        roadsDrivewayFracDefault    = float(default_values['highway']['driveway_fraction'])
        roadsLayerDefault           = int(default_values['highway']['layer'])
        roadsLayerHeightDefault     = float(default_values['highway']['layer_height'])
        roadsOffsetDefault          = float(default_values['highway']['road_offset'])
        roadsSidewalkOffsetDefault  = float(default_values['highway']['sidewalk_offset'])
        waterWidthDefault           = float(default_values['waterway']['width'])
        waterDepthDefault           = float(default_values['waterway']['depth'])
        
        # get filter input values
        filters = config_settings['features']
        
        # loop over filters to create filter list per type, as required by the algorithm
        buildingFilters = []
        roadFilters     = []
        waterwayFilters = []
        
        buidingLevels_list   = []
        levelHeight_list     = []
        thresholdHeight_list = []
        
        roadwidth_list      = []
        driveFrac_list      = []
        layer_list          = []
        layerHeight_list    = []
        roadOffset_list     = []
        sidewalkOffset_list = []
        
        depth_list      = []
        waterwidth_list = []
        
        for filter in filters:
            if filter['geometry'] != None:
                temp_geom = ee.Geometry.Polygon(filter['geometry']['coordinates'])
            else:
                temp_geom = None
            for property in filter['properties'].keys():
                if property == 'building':
                    temp_keys   = filter['properties']['building']['keys']
                    buildingFilters.append([temp_keys, temp_geom])
                    temp_params = filter['properties']['building']['parameters']
                    for parameter in filter['properties']['building']['parameters'].keys():
                        if parameter == 'levels':
                            buidingLevels_list.append(filter['properties']['building']['parameters']['levels'])
                        if parameter == 'level_height':
                            levelHeight_list.append(filter['properties']['building']['parameters']['level_height'])
                        if parameter == 'threshold':
                            thresholdHeight_list.append(filter['properties']['building']['parameters']['threshold'])
                if property == 'highway':
                    temp_keys = filter['properties']['highway']['keys']
                    roadFilters.append([temp_keys, temp_geom])
                    for parameter in filter['properties']['highway']['parameters'].keys():
                        if parameter == 'width':
                            roadwidth_list.append(filter['properties']['highway']['parameters']['width'])
                        if parameter == 'driveway_fraction':
                            driveFrac_list.append(filter['properties']['highway']['parameters']['driveway_fraction'])
                        if parameter == 'layer':
                            layer_list.append(filter['properties']['highway']['parameters']['layer'])
                        if parameter == 'layer_height':
                            layerHeight_list.append(filter['properties']['highway']['parameters']['layer_height'])
                        if parameter == 'road_offset':
                            roadOffset_list.append(filter['properties']['highway']['parameters']['road_offset'])
                        if parameter == 'sidewalk_offset':
                            sidewalkOffset_list.append(filter['properties']['highway']['parameters']['sidewalk_offset'])
                if property == 'waterway':
                    temp_keys = filter['properties']['waterway']['keys']
                    waterwayFilters.append([temp_keys, temp_geom])
                    for parameter in filter['properties']['waterway']['parameters'].keys():
                        if parameter == 'width':
                            depth_list.append(filter['properties']['waterway']['parameters']['width'])
                        if parameter == 'depth':
                            waterwidth_list.append(filter['properties']['waterway']['parameters']['depth'])
        buidingLevels_list.append(buildingsLevelDefault)
        levelHeight_list.append(buildingsLevelHeightDefault)
        thresholdHeight_list.append(buildingsThreshDefault)
        roadwidth_list.append(roadsWidthDefault)
        driveFrac_list.append(roadsDrivewayFracDefault)
        layer_list.append(roadsLayerDefault)
        layerHeight_list.append(roadsLayerHeightDefault)
        roadOffset_list.append(roadsOffsetDefault)
        sidewalkOffset_list.append(roadsSidewalkOffsetDefault)
        depth_list.append(waterWidthDefault)
        waterwidth_list.append(waterDepthDefault)
        
        # clip SRTM to bounds and apply smoothing
        SRTM_prep = smoothDEM(SRTM.clip(bounds), cellSize).clip(bounds)
        
        # STEP 1: filter OSM features into categories
        osm_buildings = filter_category(osm_polys, 'building')
        osm_roads     = filter_category(osm_lines, 'highway')
        osm_waterways = filter_category(osm_lines, 'waterway')

        # STEP 2: split according to filters and update properties
        
        #**BUILDINGS
        # the filter is defined as list< list<"values">, geometry<"bounds"> >
        # if geometry is None the geographical filter is applied
        #buildingFilters = [[['commercial','industrial','commercialresidential'], None], [['residential','house'], None], [['commercial','industrial','commercialresidential'], None], [['school','church','college','public'], None], [['apartments'], None]]
        # properties should have length of filters +1 ("other")
        #buidingLevels_list   = [2, 1, 3, 2, 6, buildingsLevelDefault]
        #levelHeight_list     = [4, 3, 4, 4, 4, buildingsLevelHeightDefault]
        #thresholdHeight_list = [1, 0, 0.4, 0.4, 0.4, buildingsThreshDefault]
        #color_list_buildings = ['98ff00', 'BB4400', '22DDFF', 'DDFF22', 'FFA500', 'FFA500']  # unused?
        buildings = update_AllBuildings(osm_buildings, buildingFilters, buidingLevels_list, levelHeight_list, thresholdHeight_list)

        #**ROADS
        #roadFilters = [[['primary'], None], [['secondary','tertiary'], None], [['residential','unclassified'], None]]
        #roadwidth_list          = [8, 5, 4, roadsWidthDefault]
        #driveFrac_list      = [0.75, 0.75, 1, roadsDrivewayFracDefault]               
        #layer_list          = [0, 0, 0, roadsLayerDefault]
        #layerHeight_list    = [5, 5, 4, roadsLayerHeightDefault]
        #roadOffset_list     = [0.2, 0.2, 0, roadsOffsetDefault]
        #sidewalkOffset_list = [0.4, 0.4, 0, roadsSidewalkOffsetDefault]
        #color_list_roads    = ['E5E500', 'FFFFB2', 'B7B799', 'A9A9A9']  # unused?
        roads = update_AllRoads(osm_roads, roadFilters, roadwidth_list, driveFrac_list, layer_list, layerHeight_list, roadOffset_list, sidewalkOffset_list)

        #**WATERWAYS
        #waterwayFilters = [[['ditch','stream'], None], [['canal','river'], None]]
        #depth_list = [1, 2, waterDepthDefault]
        #waterwidth_list = [1, 5, waterWidthDefault]
        #color_list_waterways = ['b2b2ff', '0000FF', 'D3D3D3']  # unused?
        waterways = update_AllWaterways(osm_waterways, waterwayFilters, depth_list, waterwidth_list)
                                                                                
        # STEP 3: polygonize lines
        
        #**ROADS
        roads_poly = line2poly_fc(roads, 'drive_width', cellSize)
        sidewalks  = sidewalks_fc(roads, cellSize)
        
        #**WATERWAYS
        waterways_poly = line2poly_fc(waterways, 'width', cellSize)

        # STEP 4: preprocess DEM
        
        # smooth SRTM
        info = SRTM.getInfo()['bands'][0]
        #srtm_pre = peronaMalikFilter(SRTM.convolve(ee.Kernel.gaussian(30, 15, 'meters')), 5, 5, 2).resample('bicubic').reproject(info['crs'],None,cellSize)
        srtm_pre = SRTM_prep
        
        # filter primary & secondary roads from updated dataset <COMMENTED OUT FOR NOW TO SAVE MEMORY>
        #roads_preprocess = filter_fc(roads, 'highway', ['primary','secondary','tertiary'], None)
        #srtm_pre = straighten_dem(srtm_pre, roads_preprocess)

        # STEP 5: rasterize
        osm_all = buildings.merge(roads_poly).merge(sidewalks).merge(waterways_poly) 
        osm_minheight = burn_map_min(osm_all, 'burn_height_min', cellSize, 0)
        dtm = srtm_pre.add(osm_minheight) 
        osm_maxheight = burn_map_max(osm_all, 'burn_height', cellSize, 0)
        dsm = srtm_pre.add(osm_maxheight)
        
        # get filenames
        filename_DTM = self.request.params.get('filename_DTM')
        filename_DSM = self.request.params.get('filename_DSM')
        
        # get downloadURLs
        dtm_url = dtm.clip(bounds).getDownloadURL({'name':filename_DTM, 'scale':cellSize, 'crs':'EPSG:4326', 'region':bounds.coordinates().getInfo()})
        dsm_url = dsm.clip(bounds).getDownloadURL({'name':filename_DSM, 'scale':cellSize, 'crs':'EPSG:4326', 'region':bounds.coordinates().getInfo()})

        content = {
            'dtm_url': dtm_url,
            'dsm_url': dsm_url
        }

        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(content))


def handle_404(request, response, exception):
    logging.exception(exception)
    response.write('Oops! I could swear this page was here!')
    response.set_status(404)


def handle_500(request, response, exception):
    logging.exception(exception)
    response.write('A server error occurred!')
    response.set_status(500)


app = webapp2.WSGIApplication([
    ('/', MainPage),
    ('/get_SRTM', getBaseLayer),
    ('/update_SRTM', UpdateSRTM),
    ('/load_OSM_tables', LoadFusionTablesOSM),
    ('/get_clicked_feature', GetClickedFeature),
    ('/get_osm_terrain', GetOSMterrain),
    ('/download_osm_terrain', DownloadOSMterrain)
], debug=True)

app.error_handlers[404] = handle_404
app.error_handlers[500] = handle_500

# ------------------------------------------------------------------------------------ #
# Variables and functions
# ------------------------------------------------------------------------------------ #

# Earth Engine SRTM image
SRTM = ee.Image("USGS/SRTMGL1_003")

# smooth DEM
def smoothDEM(dem, res):
    SRTM_smoothed = dem.convolve(ee.Kernel.gaussian(30, 15, 'meters'))
    SRTM_smoothed = peronaMalikFilter(SRTM_smoothed, 5, 5, 2).resample('bicubic').reproject('EPSG:4326', None, res)
    return SRTM_smoothed

# hillshading variables/functions:
azimuth = 90
zenith  = 60

def radians(img):
    return img.toFloat().multiply(3.1415927).divide(180)

def hillshade(az, ze, slope, aspect):
    azimuth = radians(ee.Image(az))
    zenith  = radians(ee.Image(ze))
    return azimuth.subtract(aspect).cos().multiply(slope.sin()).multiply(zenith.sin()).add(zenith.cos().multiply(slope.cos()))

def hillshadeit(image, elevation, weight, height_multiplier):
    hsv       = image.unitScale(0, 255).rgbtohsv()
    terrain   = ee.call('Terrain', elevation.multiply(height_multiplier))
    slope     = radians(terrain.select(['slope']))
    aspect    = radians(terrain.select(['aspect']))
    hs        = hillshade(azimuth, zenith, slope, aspect)
    intensity = hs.multiply(weight).multiply(hsv.select('value'))
    huesat    = hsv.select('hue', 'saturation')
    return ee.Image.cat(huesat, intensity).hsvtorgb()

# functions to make sure all DEMs are loaded with the same settings
#def getDEMmapId(dem, min=0, max=50, colours='91cf60, ffffbf, fc8d59'):
#    return dem.getMapId({'min':min, 'max':max, 'palette':colours})
#dem_min     = -5
#dem_max     = 100
dem_colours = '006837, 1a9850, 66bd63, a6d96a, d9ef8b, ffffbf, fee08b, fdae61, f46d43, d73027, a50026, ffffff'
def getDEMmapId(dem, dem_min=-5, dem_max=100):
    im           = dem.rename(['elevation']).visualize('elevation', None, None, dem_min, dem_max, None, 1.0, dem_colours, None)
    hillshade_im = hillshadeit(im, dem, 2.0, 2.0)
    return hillshade_im.getMapId()

# --------------------------------------------
# SPLIT & FILTER
# --------------------------------------------

# filters feateres from fc that have a value for key string<category> (e.g. building)
def filter_category(fc, category):
    return ee.FeatureCollection(fc).filter(ee.Filter.inList(category, ee.List(['','None','-1'])).Not())

#function to split a fc based on values (e.g. residential) of key (e.g. building)
#within a geometry (e.g. boundaries of a neighborhood)
#the filter is defined as list< list<"values">, geometry<"bounds"> >
#if geometry is None the geographical filter is applied
#TODO: allow for None in values to filter all features in catogry within bounds
def split_wfilter(fc_in, key, filters):
    # function to loop over filters
    def split(i, list_in):
        fc      =  ee.FeatureCollection(ee.List(list_in).get(-1))
        fc_list = ee.List(list_in).slice(0, -1)
        filter  = ee.List(ee.List(filters).get(i))
        values  = filter.get(0)
        bounds  = ee.Geometry(filter.get(1))
        return ee.Algorithms.If(bounds, fc_list.add(fc.filter(ee.Filter.And(ee.Filter.inList(key, values),ee.Filter.geometry(bounds)))).add(fc.filter(ee.Filter.And(ee.Filter.inList(key, values),ee.Filter.geometry(bounds)).Not())), fc_list.add(fc.filter(ee.Filter.inList(key, values))).add(fc.filter(ee.Filter.inList(key, values).Not())))
    # make index
    index = ee.List.sequence(0,None,1, ee.List(filters).length())
    return ee.List(index.iterate(split, ee.List([fc_in])))

#function to filter a fc based on values (e.g. residential) of key (e.g. building)
#within a geometry (e.g. boundaries of a neighborhood)
#the filter is defined as list< list<"values">, geometry<"bounds"> >
#if geometry is None the geographical filter is applied
# input: FeatureCollection<>, string<key>, list<values>, geometry<boundary> or None (=bbox)
def filter_fc(fc, key, values, bounds):
    fc =  ee.FeatureCollection(fc)
    return ee.FeatureCollection(ee.Algorithms.If(bounds, fc.filter(ee.Filter.And(ee.Filter.inList(key, values),ee.Filter.geometry(bounds))), fc.filter(ee.Filter.inList(key, values))))

# --------------------------------------------
# update fc
# --------------------------------------------

# ***** BUILDINGS *****
def update_buildings(fc, buidingLevels, levelHeight, thresholdHeight, color):
    def temp_function(f):
        # set missing values <building_levels> with 'buidingLevels' value
        f = f.set('building_levels', ee.Algorithms.If(ee.Algorithms.IsEqual(f.get('building_levels_isempty'),1), buidingLevels, f.get('building_levels')))
        # fill <burn_height> property with either <height> property if available or <building_levels> * 'levelHeight'
        return f.set('burn_height', ee.Number(f.get('building_levels')).multiply(levelHeight)).set('burn_height_min', thresholdHeight).set('color', color)
    return fc.map(temp_function)

# ***** ROADS *****
def update_roads(fc, width, driveFrac, layer, layerHeight, roadOffset, sidewalkOffset, color):
    def temp_function(f):
        # set <width> missing values with 'width' value, set <layer> missing values with 'layer' value
        f = f.set('width', ee.Algorithms.If(ee.Algorithms.IsEqual(f.get('width_isempty'),1), width, f.get('width'))).set('layer', ee.Algorithms.If(ee.Algorithms.IsEqual(f.get('layer_isempty'),1), layer, f.get('layer')))
        # set <drive_width> property with multiply of <width> and 'driveFrac', set <burn_height> property with multiply of <layer> and 'layerHeight' and add offset
        f = f.set('drive_width', ee.Number(f.get('width')).multiply(ee.Number(driveFrac))).set('burn_height', ee.Number(ee.Number(f.get('layer')).multiply(layerHeight)).add(roadOffset))
        # set <burn_height> property with multiply of <layer> and 'layerHeight' and add offset, set <burn_height_sidewalks> property with offset from <burn_height>, set property <has_sidewalk> to filter roads with sidewalk, set index to <color> property to identify color code in paint function
        return f.set('burn_height_min', f.get('burn_height')).set('burn_height_sidewalks', ee.Number(f.get('burn_height')).add(sidewalkOffset)).set('has_sidewalk', ee.Number(1).subtract(ee.Number(driveFrac).eq(1))).set('color', color)
    return fc.map(temp_function)

# ***** WATERWAYS *****
def update_waterway(fc, width, depth, color):
    def temp_function(f):
        # set <width> missing values with 'width' value, set <depth> missing values with 'depth' value
        f = f.set('width', ee.Algorithms.If(ee.Algorithms.IsEqual(f.get('width_isempty'),1), width, f.get('width'))).set('depth', ee.Algorithms.If(ee.Algorithms.IsEqual(f.get('depth_isempty'),1), ee.Number(depth).multiply(-1), ee.Number(f.get('depth')).multiply(-1)))
        # set burn_height properties for, set index to <color> property to identify color code in paint function
        return f.set('burn_height', f.get('depth')).set('burn_height_min', f.get('depth')).set('color', color)
    return fc.map(temp_function)

# --------------------------------------------
# apply split and update of fc
# --------------------------------------------

# ***** BUILDINGS *****
def update_AllBuildings(fc, filters, buidingLevels_list, levelHeight_list, thresholdHeight_list):
    # nested function get lists from mother function
    def update_buildings_list(i, fc_in):
        # input is an index value
        # get the inputs for build_buildings with index
        fc              = ee.FeatureCollection(ee.List(fc_list).get(i))
        buidingLevels   = ee.List(buidingLevels_list).get(i)
        levelHeight     = ee.List(levelHeight_list).get(i)
        thresholdHeight = ee.List(thresholdHeight_list).get(i)
        color           = i
        fc = update_buildings(fc, buidingLevels, levelHeight, thresholdHeight, color)
        # return list with updated properties
        # return ee.List(list_in).add(fc)
        return ee.FeatureCollection(fc_in).merge(fc)

    # split fc
    fc_list = split_wfilter(fc, 'building', filters)
    # iterate over list and return enriched merged fc start with empty fc
    index = ee.List.sequence(0,None,1, ee.List(buidingLevels_list).length())
    return ee.FeatureCollection(index.iterate(update_buildings_list, ee.FeatureCollection([])))

# ***** ROADS *****
def update_AllRoads(fc, filters, width_list, driveFrac_list, layer_list, layerHeight_list, roadOffset_list, sidewalkOffset_list):

    def update_roads_list(i, fc_in):
        fc             = ee.FeatureCollection(ee.List(fc_list).get(i))
        width          = ee.List(width_list).get(i)  # default width of roads (in case prop_width=NULL)
        driveFrac      = ee.List(driveFrac_list).get(i)  # fraction of street width containing driveway
        layer          = ee.List(layer_list).get(i)   # default vertical layer (in case prop_layer=NULL)
        layerHeight    = ee.List(layerHeight_list).get(i)  # multiplier to convert layer to height (relative to ground)
        roadOffset     = ee.List(roadOffset_list).get(i)
        sidewalkOffset = ee.List(sidewalkOffset_list).get(i)
        # update road lines and get polygon back
        fc = update_roads(fc, width, driveFrac, layer, layerHeight, roadOffset, sidewalkOffset, i)
        # return fc with updated properties
        return ee.FeatureCollection(fc_in).merge(fc)

    # split fc
    fc_list = split_wfilter(fc, 'highway', filters) # , boundaries)
    # iterate over list and return enriched merged fc start with empty fc
    index = ee.List.sequence(0,None,1, ee.List(width_list).length())
    return ee.FeatureCollection(index.iterate(update_roads_list, ee.FeatureCollection([])))

# ***** WATERWAYS *****
def update_AllWaterways(fc, filters, depth_list, width_list):

    def update_waterways_list(i, fc_in):
        fc    = ee.FeatureCollection(ee.List(fc_list).get(i))
        width = ee.Number(ee.List(width_list).get(i))
        depth = ee.Number(ee.List(depth_list).get(i))
        # update road lines and get polygon back
        fc = update_waterway(fc, width, depth, i)
        # return fc with updated properties
        return ee.FeatureCollection(fc_in).merge(fc)

    # split fc
    fc_list = split_wfilter(fc, 'waterway', filters) # , boundaries)
    # iterate over list and return enriched merged fc start with empty fc
    index = ee.List.sequence(0,None,1, ee.List(width_list).length())
    return ee.FeatureCollection(index.iterate(update_waterways_list, ee.FeatureCollection([])))

# --------------------------------------------
# line2polygons for ROADS and WATERWAYS
# --------------------------------------------

def line2poly_fc(fc, property, errorMargin):
    def line2poly(f):
        return f.buffer(ee.Number(f.get(property)), errorMargin)
    return fc.map(line2poly)

def sidewalks_fc(fc, errorMargin):

    def get_sidewalk(f):
        # extend the line a little bit on both sides (make sure extension is much longer than width of a typical road)
        long_f = extend_ft(f, 0.002)
        # get a polygon (with total width) from the street
        f_buf = f.buffer(ee.Number(f.get('width')), errorMargin)
        # get a polygon (with driveway width) from the street
        driveway = long_f.buffer(ee.Number(f.get('drive_width')), errorMargin )
        # find the difference (=sidewalk) and return (set burn_height properties)
        return f_buf.difference(driveway.geometry()).set('burn_height', f.get('burn_height_sidewalks')).set('burn_height_min', f.get('burn_height_sidewalks'))

    return fc.filterMetadata('has_sidewalk','equals',1).map(get_sidewalk)

# extend line elements based on local direction on both sides
def extend_ft(ft, extend):
    coords        = ft.geometry().coordinates()
    coord_end_1   = ee.List(coords.get(-1))
    coord_end_2   = ee.List(coords.get(-2))
    coord_end_0   = extend_coord(coord_end_1, coord_end_2, extend)

    coord_start_1 = ee.List(coords.get(0))
    coord_start_2 = ee.List(coords.get(1))
    coord_start_0 = extend_coord(coord_start_1, coord_start_2, extend)

    newCoords = coords.insert(0, coord_start_0).insert(-1, coord_end_0).swap(-1, -2)

    return ee.Feature(ee.Geometry.MultiLineString([newCoords]))

# function creates a new coordinate that is an extention of a straight line
# consisting of coord1 and coord2. The new coordinate can be used to extend
# for instance a line feature
def extend_coord(coord1, coord2, extend):
    # TODO: perform on a projected grid, instead of lat lon
    x1        = ee.Number(coord1.get(0))
    y1        = ee.Number(coord1.get(1))
    x2        = ee.Number(coord2.get(0))
    y2        = ee.Number(coord2.get(1))
    len_x     = x1.subtract(x2).pow(2)
    len_y     = y1.subtract(y2).pow(2)
    len       = len_x.add(len_y).pow(0.5)
    sin       = x2.subtract(x1).divide(len)
    cos       = y2.subtract(y1).divide(len)
    len_scale = len.add(extend).divide(len)
    x0        = x2.add(x1.subtract(x2).multiply(len_scale))
    y0        = y2.add(y1.subtract(y2).multiply(len_scale))
    return ee.List([x0, y0])

# ----------------------------------- #
# DEM preprocessing
# ----------------------------------- #

# Perona malik filter
# I(n+1, i, j) = I(n, i, j) + Lambda * (cN * dN(I) + cS * dS(I) + cE * dE(I), cW * dW(I))
def peronaMalikFilter(I, iter, K, method):
    dxW = ee.Kernel.fixed(3, 3, [[ 0,  0,  0], [ 1, -1,  0], [ 0,  0,  0]])
    dxE = ee.Kernel.fixed(3, 3, [[ 0,  0,  0], [ 0, -1,  1], [ 0,  0,  0]])
    dyN = ee.Kernel.fixed(3, 3, [[ 0,  1,  0], [ 0, -1,  0], [ 0,  0,  0]])
    dyS = ee.Kernel.fixed(3, 3, [[ 0,  0,  0], [ 0, -1,  0], [ 0,  1,  0]])

    Lambda = 0.2

    k1 = ee.Image(-1.0/K)
    k2 = ee.Image(K).multiply(ee.Image(K))

    for i in range(0, iter):
        dI_W = I.convolve(dxW)
        dI_E = I.convolve(dxE)
        dI_N = I.convolve(dyN)
        dI_S = I.convolve(dyS)

        if method == 1:
            cW = dI_W.multiply(dI_W).multiply(k1).exp()
            cE = dI_E.multiply(dI_E).multiply(k1).exp()
            cN = dI_N.multiply(dI_N).multiply(k1).exp()
            cS = dI_S.multiply(dI_S).multiply(k1).exp()
        elif method == 2:
            cW = ee.Image(1.0).divide(ee.Image(1.0).add(dI_W.multiply(dI_W).divide(k2)))
            cE = ee.Image(1.0).divide(ee.Image(1.0).add(dI_E.multiply(dI_E).divide(k2)))
            cN = ee.Image(1.0).divide(ee.Image(1.0).add(dI_N.multiply(dI_N).divide(k2)))
            cS = ee.Image(1.0).divide(ee.Image(1.0).add(dI_S.multiply(dI_S).divide(k2)))
        I = I.add(ee.Image(Lambda).multiply(cN.multiply(dI_N).add(cS.multiply(dI_S)).add(cE.multiply(dI_E)).add(cW.multiply(dI_W))))

    return I

# DEM straightening: make it horizontal in perpendicular direction for all lines (features in fc)
def straighten_dem(dem, fc, erorMargin):
    info = dem.getInfo()['bands'][0]
    # function creates dem clip image with straight elev for one line
    # and adds to image collection
    def straighten_single_road(f, ic):
        width      = ee.Number(f.get('width'))
        roadBuffer = ee.Feature(f).buffer(width, erorMargin)
        roadImage  = dem.clip(roadBuffer).reduceNeighborhood(ee.Reducer.mean(), ee.Kernel.circle(ee.Number(width).multiply(2),'meters'))

        # weird bug in GEE requires extra mask statement, as otherwise the edge of the kernel is not written correctly
        return ee.ImageCollection(ic).merge(ee.ImageCollection(roadImage.mask(roadImage).reproject(info['crs'], info['crs_transform'])))

    # get image collection with clips for for roads and reduce to single image
    roads_elev = ee.ImageCollection(fc.iterate(straighten_single_road,ee.ImageCollection([]))).reduce(ee.Reducer.min())

    # fill missings with original dem
    return roads_elev.unmask(ee.Image(dem), False).reproject(info['crs'], info['crs_transform'])

# ----------------------------------- #
# burn functions
# ----------------------------------- #

# burn property value of feature collection to map
# fill value is zero if multiple features take the max property value
# inputs: feature collection with buildings, burn property, resolution
def burn_map_max(fc, prop, resolution, fill_val):
    # reduce fc to image using max
    fc_burn = fc.reduceToImage([prop], ee.Reducer.max())
    return fc_burn.unmask(fill_val).reproject('EPSG:4326', None, resolution)

def burn_map_min(fc, prop, resolution, fill_val):
    fc_burn = fc.reduceToImage([prop], ee.Reducer.min())
    return fc_burn.unmask(fill_val).reproject('EPSG:4326', None, resolution)

# ----------------------------------- #
# main functions
# ----------------------------------- #

def main():
    app.run()

if __name__ == '__main__':
    main()
