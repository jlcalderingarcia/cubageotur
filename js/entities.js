/**
 * Created with JetBrains PhpStorm.
 * User: Jorge
 * Date: 10/2/12
 * Time: 8:02 AM
 * To change this template use File | Settings | File Templates.
 */

var features = [];
function loadFeatures(){
    layer = null;
    clusteringStrategy = null;
	features_data = null;
	selected_layers = [];
	
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
		selected_layers = [];
		
		loadSelectedLayers();
		
		clusteringStrategy.activate();
		
		select = new OpenLayers.Control.SelectFeature(
			layer, { "clickout" : true, "multiple" : false, "toggle" : true }
		);
		map.addControl(select);
		select.activate();

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
            var type = parseInt(id.substr(0,id.indexOf('.')));
            var f = {
                "type":"Feature",
                "id": features_data[i].i,
                "properties" : {"type" : type, "name" : name},
                "geometry": {
                    "type":"Point",
                    "coordinates":[features_data[i].x,features_data[i].y]
                }
            };
            main.features.push(f);
        };
        features = geojson_format.read(main);
        var epsg4326 = new OpenLayers.Projection("EPSG:4326");
        var baseProyection = map.getProjectionObject();
        for(var i in features)
            features[i].geometry.transform(epsg4326, baseProyection);
	});
	
	$("#layer-select ul li a").click(function(event){
		var id = parseInt($(this).attr("element-id"));
		if(selected_layers.indexOf(id) >= 0)
			selected_layers[selected_layers.indexOf(id)] = null;
		else
			selected_layers.push(id);
		loadSelectedLayers();
	});

    loadSelectedLayers = function(){
		var my_features = [];
        for(var i in features)
            if(selected_layers.indexOf(features[i].data.type) >= 0)
            my_features.push(features[i]);
		layer.removeAllFeatures();
		layer.addFeatures(my_features);
	}

};

function search(searched_text){
    var ul = $("#search-results");
    ul.children().remove();
    if(searched_text != "")
    $.each(features, function(){
        if(this.data.name.toLowerCase().indexOf(searched_text) >= 0){
            var feature = this;
            ul.append(
                $("<li></li>").append(
                        $("<a href='' data-rel='back'></a>").text(this.data.name)
                            .prepend('<img src="images/icons/' + this.data.type +'.png" alt="" height="16" class="ui-li-icon ui-corner-none"/>')
                    ).click(function(){
                        var lonlat = new OpenLayers.LonLat(feature.geometry.x, feature.geometry.y);
                        map.setCenter(lonlat);
                        map.zoomTo(16);
                        if(!layer.getFeatureByFid(feature.fid)){
                            loadSelectedLayers();
                            //layer.removeAllFeatures();
                            layer.addFeatures([feature]);
                        }
                    })
            );
        }
    });

    ul.listview("refresh");
}
