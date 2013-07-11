/**
 * Created with JetBrains PhpStorm.
 * User: Jorge
 * Date: 10/2/12
 * Time: 8:02 AM
 * To change this template use File | Settings | File Templates.
 */

function loadFeatures(){
    layer = null;
    clusteringStrategy = null;
    features = null;
	features_data = null;
	selected_layers = [31,32,33,34];
	
	//Touch Navigation
	var touch_navigation = new OpenLayers.Control.TouchNavigation();
	map.addControl(touch_navigation);
	touch_navigation.activate();

    setStyle = function(layer){

        var vector_style_map = new OpenLayers.StyleMap({
            "default" : new OpenLayers.Style({
                "pointRadius": "${radius}",
                //"graphicZIndex" : 1,
                "externalGraphic" : '${mygraphic}'
            }, {
                "context": {
                    "radius": function(feature) {
                        return (feature.cluster)? 10 : 8;
                    },
                    "mygraphic": function(feature) {
                        if(feature.cluster){
                            return 'images/icons/undefined.png';
                        } else
                            return 'images/icons/'+feature.attributes.type+'.png';
                    }
                }
            }),
            "select" :  new OpenLayers.Style({
                "cursor" : 'hand',
				"label" : '${mylabel}',
				"labelAlign" : "ct",
				"labelYOffset" : -20,
				"fontWeight" : "bold",
				"fontSize" : "10px",
                "pointRadius" : 16
            }, {
				"context" : {
                    "mylabel" : function(feature){
						if(feature.cluster)
                            return "Varios";
                        return feature.attributes.name;
                    }
                }
			})
        });

        layer.styleMap = vector_style_map;
    };


	clusteringStrategy = new OpenLayers.Strategy.Cluster({"distance": 12, "threshold": 3});

	layer = new OpenLayers.Layer.Vector(
		"Entidades",
		{"strategies" : [clusteringStrategy]}
	);

	setStyle(layer);

	map.addLayers([layer]);

	var geojson_format = new OpenLayers.Format.GeoJSON();

	$.get("data/ES.entities.cache.text", {}, function(text){
		var data;
		eval("data=" + text + ";");
		features_data = data;
		selected_layers = [31,32,33,34];
		
		loadSelectedLayers();
		
		clusteringStrategy.activate();
		
		var select = new OpenLayers.Control.SelectFeature(
			layer, { "clickout" : true, "multiple" : false, "toggle" : true }
		);
		map.addControl(select);
		select.activate();
	});
	
	$("#layer-select ul li a").click(function(event){
		var id = parseInt($(this).attr("element-id"));
		if(selected_layers.indexOf(id) >= 0)
			selected_layers[selected_layers.indexOf(id)] = null;
		else
			selected_layers.push(id);
		loadSelectedLayers();
	});
	
	function loadSelectedLayers(){
		var main = {
			"type":"FeatureCollection",
			"features": [],
			"crs":{
				"type":"EPSG",
				"properties":{"code":"4326"}
			},
			"bbox":[-84.951025,19.842878,-74.47057,23.204485]
		};
		for(var i in features_data){
			var id = features_data[i].i + '';
			var name = features_data[i].n.trim();
			var type = id.substr(0,id.indexOf('.'));
			var f = {
				"type":"Feature",
				"id": features_data[i].i,
				"properties" : {"type" : type, "name" : name},
				"geometry": {
					"type":"Point",
					"coordinates":[features_data[i].x,features_data[i].y]
				}
			};
			if(selected_layers.indexOf(parseInt(type)) >= 0)
				main.features.push(f);
		};
		features = geojson_format.read(main);
		var epsg4326 = new OpenLayers.Projection("EPSG:4326");
		var baseProyection = map.getProjectionObject();
		for(var i in features)
                features[i].geometry.transform(epsg4326, baseProyection);
		layer.removeAllFeatures();
		layer.addFeatures(features);
	}

};

// Wait for Cordova to load
//
document.addEventListener("deviceready", onDeviceReady, false);

// Cordova is ready
//
function onDeviceReady() {
	console.log("Entro en el device ready");
	navigator.geolocation.getCurrentPosition(onSuccess, onError);
}

// onSuccess Geolocation
//
function onSuccess(position) {
	var a = 'Latitude: '           + position.coords.latitude              + '<br />' +
						'Longitude: '          + position.coords.longitude             + '<br />' +
						'Altitude: '           + position.coords.altitude              + '<br />' +
						'Accuracy: '           + position.coords.accuracy              + '<br />' +
						'Altitude Accuracy: '  + position.coords.altitudeAccuracy      + '<br />' +
						'Heading: '            + position.coords.heading               + '<br />' +
						'Speed: '              + position.coords.speed                 + '<br />' +
						'Timestamp: '          +                                   position.timestamp          + '<br />';
	console.log(a);
}

// onError Callback receives a PositionError object
//
function onError(error) {
	alert('code: '    + error.code    + '\n' +
			'message: ' + error.message + '\n');
} 
