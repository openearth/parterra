/* eslint-disable */
// https://gist.github.com/davidguttman/1f61ab59349cb99d28a1

// Bootstrap wants jQuery global =(
window.jQuery = $ = require('jQuery');
require('bootstrap');
// require('bootstrap-validator');
// require('bootstrap-notify');

var L = require('leaflet');
L.Icon.Default.imagePath = 'node_modules/leaflet/dist/images/';
var leafletDraw = require('leaflet-draw');

proj4 = require('proj4');
