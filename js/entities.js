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
				"labelAlign" : "cb",
				"labelYOffset" : -23,
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
		var main = {
			"type":"FeatureCollection",
			"features": [],
			"crs":{
				"type":"EPSG",
				"properties":{"code":"4326"}
			},
			"bbox":[-84.951025,19.842878,-74.47057,23.204485]
		};
		for(var i in data){
			var id = data[i].i + '';
			var name = data[i].n.trim();
			var type = id.substr(0,id.indexOf('.'));
			var f = {
				"type":"Feature",
				"id": data[i].i,
				"properties" : {"type" : type, "name" : name},
				"geometry": {
					"type":"Point",
					"coordinates":[data[i].x,data[i].y]
				}
			};
			if(type == 4)
				main.features.push(f);
		};
		features = geojson_format.read(main);
		var epsg4326 = new OpenLayers.Projection("EPSG:4326");
		var baseProyection = map.getProjectionObject();
		for(var i in features)
                features[i].geometry.transform(epsg4326, baseProyection);
		layer.addFeatures(features);
		clusteringStrategy.activate();
		
		var select = new OpenLayers.Control.SelectFeature(
			layer, { "clickout" : true, "multiple" : false, "toggle" : true }
		);
		map.addControl(select);
		select.activate();
	});

};
