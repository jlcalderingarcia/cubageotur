/**
 * Created with JetBrains PhpStorm.
 * User: Jorge
 * Date: 11/21/13
 * Time: 2:33 PM
 * To change this template use File | Settings | File Templates.
 */

//Global variables declaration
//Map related variables
var map;            //Map object
var layer;          //Map vectorial layer
var tiled;          //Map base layer
var bounds;         //Map bounds
var features = [];  //List of features
var popup = null;   //Popup to display the entties info

//Map controls
var touch_navigation = null;
var select = null;

//Layers controls
var clustering_strategy = null;

//Map UI and related functionality variables
var selected_layers = [];
var special_features = [];

var lang = 'ES';
//Database related variables
var db;             //Database object


//Openlayers library initialization
{
    // pink tile avoidance
    OpenLayers.IMAGE_RELOAD_ATTEMPTS = 5;
    // make OL compute scale according to WMS spec
    OpenLayers.DOTS_PER_INCH = 25.4 / 0.28;
}

//Step 2 Declare a callback for jquery to call when it loads
$(document).ready(function() {
    //Initialize the database
    db = openDatabase('test', '1.0', 'My Testing DB', 5 * 1024 * 1024);
    loadDatabase();

    //Catch the status of online or offline
    document.addEventListener("online", onOnline, false);
    document.addEventListener("offline", onOffline, false);

    //Gets the prefered language
    if(navigator.globalization)
        navigator.globalization.getLocaleName(
            function (locale) {
                if(locale && locale.value)
                    if(locale.value.startsWith('es'))
                        lang = "ES";
                    else if(locale.value.startsWith('en'))
                        lang = "UK";
                    else if(locale.value.startsWith('fr'))
                        lang = "FR";
                    else if(locale.value.startsWith('ru'))
                        lang = "RU";
                    else if(locale.value.startsWith('gm'))
                        lang = "GM";
            },
            function () {alert('Error getting locale\n');}
        );

    // Handle the online event
    //
    function onOnline() {
        //alert('online');
    }
    // Handle the offline event
    //
    function onOffline() {
        //alert('offline');
    }

    //Initialize the map
    init();

    //Initialize the ui components
    init_ui();
});

function init(){
    bounds = new OpenLayers.Bounds(
        -84.953077,  19.826373,
        -74.131305, 23.276492
    );
    bounds.transform(new OpenLayers.Projection("EPSG:4326"), new OpenLayers.Projection("EPSG:900913"));
    touch_navigation = new OpenLayers.Control.TouchNavigation({
        dragPanOptions: {
            enableKinetic: true
        }
    });
    var options = {
        controls: [
            touch_navigation
        ],
        maxExtent: bounds,
        maxResolution: 0.078125,
        projection: "EPSG:4326",
        units: 'degrees'
    };
    map = new OpenLayers.Map('map', options);

    // setup tiled layer
    tiled = new OpenLayers.Layer.OSM("New Layer", "tiles/mapnik/${z}_${x}_${y}.png", {numZoomLevels: 17});
    //new OpenLayers.Layer.OSM("New Layer", "proxy.php?z=${z}&x=${x}&y=${y}.png&r=mapnik", {numZoomLevels: 19});

    map.addLayers([tiled]);
    map.zoomToExtent(bounds);

    load_features();
}

function init_ui(){
    $("#zoom-in-control").click(function(event){
        map.zoomIn();
        event.stopPropagation();
        return false;
    });
    $("#zoom-home-control").click(function(event){
        map.zoomToExtent(bounds);
        //map.zoomToMaxExtent();
        event.stopPropagation();
        return false;
    });
    $("#zoom-out-control").click(function(event){
        map.zoomOut();
        event.stopPropagation();
        return false;
    });
    $("#zoom-gps-control").click(function(event){
        // onSuccess Geolocation
        //
        function onSuccess(position) {
            var lonlat = new OpenLayers.LonLat(position.coords.longitude,position.coords.latitude);
            lonlat.transform(new OpenLayers.Projection("EPSG:4326"), new OpenLayers.Projection("EPSG:900913"));
            map.panTo(lonlat);
            map.zoomTo(16);
        }

        // onError Callback receives a PositionError object
        //
        function onError(error) {
            console.log('code: '    + error.code    + '\n' + 'message: ' + error.message + '\n');
        }

        navigator.geolocation.getCurrentPosition(onSuccess, onError);

        event.stopPropagation();
        return false;
    });

    /* Medida */
    var sketchSymbolizers = {
        "Point": {
            pointRadius: 4,
            graphicName: "square",
            fillColor: "white",
            fillOpacity: 1,
            strokeWidth: 1,
            strokeOpacity: 1,
            strokeColor: "#333333"
        },
        "Line": {
            strokeWidth: 3,
            strokeOpacity: 1,
            strokeColor: "#666666",
            strokeDashstyle: "dash"
        },
        "Polygon": {
            strokeWidth: 2,
            strokeOpacity: 1,
            strokeColor: "#666666",
            fillColor: "white",
            fillOpacity: 0.3
        }
    };
    var style = new OpenLayers.Style();
    style.addRules([
        new OpenLayers.Rule({symbolizer: sketchSymbolizers})
    ]);
    var styleMap = new OpenLayers.StyleMap({"default": style});
    var measure = new OpenLayers.Control.Measure(
        OpenLayers.Handler.Path,
        {
            persist: true,
            //immediate: true,
            handlerOptions: {
                layerOptions: {styleMap: styleMap}
            }
        }
    );
    function handleMeasure(event){
        var ngeometry = event.geometry.clone();
        var epsg4326 = new OpenLayers.Projection("EPSG:4326");
        var baseProyection = map.getProjectionObject();
        ngeometry.transform(baseProyection, epsg4326);
        var vertices = ngeometry.getVertices();
        if(event.type == "measure")
            vertices.push(vertices[0]);
        var perimeter = 0;
        for(var i=0; i < vertices.length - 1; i++){
            var x = new OpenLayers.LonLat(vertices[i].x, vertices[i].y);
            var y = new OpenLayers.LonLat(vertices[i+1].x, vertices[i+1].y);
            perimeter += Math.abs(OpenLayers.Util.distVincenty(x,y));
        }

        //var area = (ngeometry.getGeodesicArea() / 1000000).toFixed(2) + ' km<sup>2</sup>';
        var perimeter = perimeter.toFixed(2) + ' km';
        $("#measurePopup .content").text('Distance: ' + perimeter);
        $('#measurePopup').popup( "open" );

        measure.deactivate();
    };
    measure.events.on({
        "measure": handleMeasure/*,
        "measurepartial": handleMeasure*/
    });
    map.addControl(measure);
    $("#measure-control").click(function(event){
        measure.activate();

        event.stopPropagation();
        return false;
    });

    $("#layer-select ul li a").click(function(event){
        var id = parseInt($(this).attr("element-id"));
        if(selected_layers.indexOf(id) >= 0)
            selected_layers[selected_layers.indexOf(id)] = null;
        else
            selected_layers.push(id);
        loadSelectedLayers();
    });
    $("#dialog-search-btn").click(function(){
        var ul = $("#search-results");
        ul.children().remove();
        $("#search").val("").focus();
    });
}

function load_features(){
    //Global variables initialization
    layer = null;
    selected_layers = [];
    //Local variables initialization
    var features_data = null;

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

    //Initialize the vectorial layer, set its style and add it to the map
    clustering_strategy = new OpenLayers.Strategy.Cluster({"distance": 12, "threshold": 5});
    layer = new OpenLayers.Layer.Vector(
        "Entidades",
        {"strategies" : [clustering_strategy]}
    );
    setStyle(layer);
    map.addLayers([layer]);
    clustering_strategy.activate();

    //Load the data from the local database
    var geojson_format = new OpenLayers.Format.GeoJSON();
    loadEntitiesData(function(data){
        if(!data || data.length == 0)
            return;
        features_data = data;

        //CLear the selected layers
        selected_layers = [];
        loadSelectedLayers();

        select = new OpenLayers.Control.SelectFeature(
            layer, { "clickout" : true, "multiple" : false, "toggle" : true }
        );
        map.addControl(select);
        select.activate();
        layer.events.on({"featureselected": function(event){
            var position = event.feature.geometry;
            if(!event.feature.cluster){
                console.log(event.feature);
                var id = parseInt(event.feature.fid.split('.')[1]);
                getPOIData(id, function(data){
                    //create popup dom
                    var column_labels = {
                        direccion:'Dirección:',
                        telefono:'Teléfono:',
                        fax:'Fax:',
                        email:'Email:',
                        provincia:'Provincia:',
                        municipio:'Municipio:',
                        categoria:'Categoría:',
                        web:'Web:',
                        operador:'Operador:',
                        modalidad:'Modalidad:',
                        servicios:'Servicios:',
                        cadena:'Cadena:',
                        especialidad:'Especialidad:',
                        costa:'Costa:',
                        alojamiento:'Alojamiento:',
                        horario:'Horario:',
                        clasificacion:'Clasificación:',
                        religion:'Religión:',
                        puerto:'Puerto:',
                        comunicacion_vhf:'Comunicación vhf:',
                        comunicacion_hf:'Comunicación hf:',
                        ubicacion_n:'Ubicación N:',
                        ubicacion_w:'Ubicación W:',
                        atraques:'Atraques:',
                        profundidad:'Profundidad:'
                    };
                    function createColumn(name, value){
                        return "<div><b>"+column_labels[name]+"</b> "+value+"</div>";
                    }
                    var type_columns = {
                        aerolineas: ['direccion', 'telefono', 'fax', 'email', 'municipio', 'provincia'],
                        aeropuertos: ['direccion', 'telefono', 'categoria', 'municipio', 'provincia'],
                        agencia_viaje: ['direccion', 'telefono', 'fax', 'email', 'web', 'operador', 'municipio', 'provincia'],
                        alojamientos: ['direccion', 'telefono', 'fax', 'email', 'web', 'modalidad', 'categoria', 'servicios', 'municipio', 'provincia'],
                        bancos: ['direccion', 'municipio', 'provincia'],
                        bibliotecas: ['direccion', 'telefono', 'email', 'categoria', 'municipio', 'provincia'],
                        cadecas: ['direccion', 'telefono', 'municipio', 'provincia'],
                        cafeterias: ['direccion', 'cadena', 'especialidad', 'municipio', 'provincia'],
                        centros_buceo: ['direccion', 'telefono', 'email', 'web', 'costa', 'alojamiento', 'municipio', 'provincia'],
                        centros_deportivo: ['direccion', 'telefono', 'categoria', 'municipio', 'provincia'],
                        centros_nocturno: ['direccion', 'telefono', 'categoria', 'municipio', 'provincia'],
                        cines: ['direccion', 'telefono', 'municipio', 'provincia'],
                        embajas_consulados: ['direccion', 'telefono', 'municipio', 'provincia'],
                        farmacias: ['direccion', 'telefono', 'horario', 'municipio', 'provincia'],
                        galerias: ['direccion', 'telefono', 'municipio', 'provincia'],
                        gasolineras: ['direccion', 'telefono', 'cadena', 'municipio', 'provincia'],
                        hospital: ['direccion', 'telefono', 'fax', 'email', 'web', 'clasificacion', 'municipio', 'provincia'],
                        infotur: ['direccion', 'telefono', 'municipio', 'provincia'],
                        librerias: ['direccion', 'telefono', 'municipio', 'provincia'],
                        marinas: ['direccion', 'telefono', 'email', 'web', 'puerto', 'comunicacion_vhf', 'comunicacion_hf', 'ubicacion_n', 'ubicacion_w', 'atraques', 'profundidad', 'servicios', 'municipio', 'provincia'],
                        mensajeria_internacional: ['direccion', 'telefono', 'municipio', 'provincia'],
                        museo_monumento: ['direccion', 'telefono', 'municipio', 'provincia'],
                        opticas: ['direccion', 'telefono', 'email', 'web', 'horario', 'municipio', 'provincia'],
                        religion: ['direccion', 'telefono', 'religion', 'municipio', 'provincia'],
                        rentaautos: ['direccion', 'telefono', 'web', 'cadena', 'municipio', 'provincia'],
                        restaurantes: ['direccion', 'telefono', 'especialidad', 'municipio', 'provincia'],
                        teatros: ['direccion', 'telefono', 'municipio', 'provincia'],
                        terminal_viazul: ['direccion', 'telefono', 'municipio', 'provincia'],
                        tiendas: ['direccion', 'telefono', 'web', 'especialidad', 'categoria', 'cadena', 'municipio', 'provincia']
                    };
                    var popup_template ='<div class="popup-info"><div class="title"><div class="identification"><img alt="" src="images/icons/$type$.png" class="icon"/><div class="title-text"><div><b>$name$</b></div></div></div></div><hr/><div class="content"><div class="image"><img alt="" src="$image$" height="80" width="80"/></div><div class="data-content">$content$</div></div><div class="options"></div></div>';
                    var columns = type_columns[data.table_name];
                    var content = '';
                    for(var c in columns)
                        if(data[columns[c]])
                            content += createColumn(columns[c], data[columns[c]]);
                    var my_data = {
                        type: data.type,
                        name: data.name,
                        image: 'images/defaultPhoto.jpg',
                        content: content
                    };
                    var html = completeTemplate(popup_template, my_data);

                    if(popup)
                        map.removePopup(popup);
                    popup = new OpenLayers.Popup.FramedCloud(event.feature.fid,
                        new OpenLayers.LonLat(position.x,position.y),
                        new OpenLayers.Size(310,160),
                        "<div class='my-popup' style='width: 300px; height: 150px;'></div>",
                        null,
                        true
                    );

                    map.addPopup(popup);
                    var parent = $(popup.div).find(".title-text");
                    var child = $(popup.div).find(".title-text > div");
                    if(parent.height() < child.height())
                        child.wrap("<marquee behavior='alternate' scrollamount='2'></marquee>");

                    $(popup.div).find('.my-popup').append(
                        html
                    );

                    var selected = false;
                    var infodata = data;
                    $(popup.div).find('.my-popup .options').append(
                        $("<a href=''>Vecinos</a>").css({"float" : "right", "margin-right" : "5px"}).click(function(event){
                            if(!selected){
                                infodata = $(popup.div).find('.my-popup .popup-info > .content').children();
                                infodata.remove();
                                $(popup.div).find('.my-popup .popup-info > .content').append('<div class="form"><table style="width: 100%"><tr><td>Buscar:</td><td><select id="entityType"><option value="1">aerolineas</option><option value="2">aeropuertos</option><option value="3">agencia_viaje</option><option value="4">alojamientos</option><option value="5">bancos</option><option value="6">bibliotecas</option><option value="7">cadecas</option><option value="8">cafeterias</option><option value="9">centros_buceo</option><option value="10">centros_deportivo</option><option value="11">centros_nocturno</option><option value="12">cines</option><option value="13">embajas_consulados</option><option value="14">farmacias</option><option value="15">galerias</option><option value="16">gasolineras</option><option value="17">hospital</option><option value="18">infotur</option><option value="19">librerias</option><option value="20">marinas</option><option value="21">mensajeria_internacional</option><option value="22">museo_monumento</option><option value="23">opticas</option><option value="24">religion</option><option value="25">rentaautos</option><option value="26">restaurantes</option><option value="27">teatros</option><option value="28">terminal_viazul</option><option value="29">tiendas</option></select></td></tr><tr><td>Distancia:</td><td><input type="text" id="distance" value="1" size="10"/><select id="um"><option value="0.01">Km</option><option value="0.00001">m</option></select></td></tr><tr><td colspan="2" style="text-align: center"><input type="button" value="Buscar" id="doSearch"/></td></tr></table></div>');
                                $(popup.div).find('.my-popup .options > a').text('Datos');
                                $(popup.div).find('#doSearch').click(function(event){
                                    getNeighbors(id, $("#entityType").val(), parseFloat($("#distance").val()) * parseFloat($("#um").val()), function(n_data){
                                        special_features = [];
                                        for(var i in n_data){
                                            var my_id = n_data[i].type+'.'+n_data[i].id;
                                            for(var j in features)
                                                if(features[j].fid == my_id){
                                                    special_features.push(features[j]);
                                                    break;
                                                }
                                        }
                                        if(special_features.length > 0){
                                            var minx=Infinity, maxx=-Infinity, miny=Infinity, maxy = -Infinity;
                                            for(var i in special_features){
                                                if(special_features[i].geometry.x > maxx)
                                                    maxx = special_features[i].geometry.x;
                                                if(special_features[i].geometry.x < minx)
                                                    minx = special_features[i].geometry.x;
                                                if(special_features[i].geometry.y > maxy)
                                                    maxy = special_features[i].geometry.y;
                                                if(special_features[i].geometry.y < miny)
                                                    miny = special_features[i].geometry.y;
                                            }
                                            map.zoomToExtent(new OpenLayers.Bounds(
                                                minx, miny,
                                                maxx, maxy
                                            ));
                                        }
                                        loadSelectedLayers();
                                    });
                                    if(popup)
                                        map.removePopup(popup);
                                    event.stopPropagation();
                                    return false;
                                });
                                selected = true;
                            } else{
                                $(popup.div).find('.my-popup .popup-info > .content').children().remove();
                                $(popup.div).find('.my-popup .popup-info > .content').append(infodata);
                                $(popup.div).find('.my-popup .options > a').text('Vecinos');
                                selected = false;
                            }

                            event.stopPropagation();
                            return false;
                        })
                    );
                    console.log(data);
                });
            } else {
                if(popup)
                    map.removePopup(popup);
                popup = new OpenLayers.Popup.FramedCloud(event.feature.fid,
                    new OpenLayers.LonLat(position.x,position.y),
                    new OpenLayers.Size(300,170),
                    "<div class='my-popup' style='width: 300px; height: 140px;'><div class='popup-info'></div></div>",
                    null,
                    true
                );
                map.addPopup(popup);

                $(popup.div).find('.my-popup .popup-info').append(
                        $('<div class="title"></div>').append(
                            $('<div class="identification">Varios</div>').prepend(
                                $('<img alt="" src="images/icons/undefined.png" width="20" height="20"/>')
                            )
                        )
                    ).append(
                        $('<hr style="margin-bottom: 3px; margin-top: 3px;"/> ')
                    ).append(
                        $("<div class='places'></div>")
                    );
                for(var i in event.feature.cluster){
                    $(popup.div).find('.my-popup .places').append(
                        $('<a href="#"></a>').text(event.feature.cluster[i].attributes.name).prepend(
                                $('<img height="16" width="16" />').attr("src", "images/icons/"+event.feature.cluster[i].attributes.type+".png")
                            ).attr("identifier", i).click(function(newevent){
                                var index = $(this).attr("identifier");
                                var geom = event.feature.cluster[index].geometry;
                                var bounds = new OpenLayers.Bounds(
                                    geom.x, geom.y,
                                    geom.x, geom.y
                                );
                                map.zoomToExtent(bounds);
                                if(popup)
                                    map.removePopup(popup);
                                select.unselectAll();
                                select.select(event.feature.cluster[index]);
                                newevent.stopPropagation();
                                return false;
                            })
                    ).append($("<br/>"));
                }
            }
        }});

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
            var id = features_data[i].id;
            var name = features_data[i].name.trim();
            var type = features_data[i].type;
            var f = {
                "type":"Feature",
                "id": type + '.' + id,
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
}


/*
 *
 * FUNCTIONS AREA
 *
 */

/*
 *
 * Database related functions
 *
 */
//Executes a query and return the results to the callback. Null if error
function queryDB(query, params, callback){
    db.transaction(function(tx){
        tx.executeSql(
            query,
            params,
            function(tx, r){
                var result = [];
                for(var i=0; i < r.rows.length; i++){
                    var row = r.rows.item(i);
                    result.push(row);
                }
                if(callback && $.isFunction(callback))callback(result);
            },function(tx, err){
                if(callback && $.isFunction(callback))callback(null);
            }
        );
    });
}

//Update the navigator database
function updateDatabase(callback, url){
    dropAllTables(function(){
        loadDatabase(
            function(){
                if(callback && $.isFunction(callback))
                    callback();
            }, url);
    });
}

//Delete the navigator database
function dropAllTables(callback){
    $.getJSON(
        'data/db_data.js', {}, function(data){
            db.transaction(function(tx){
                tx.executeSql('DROP TABLE IF EXISTS types');
                tx.executeSql('DROP TABLE IF EXISTS entities');
                for(var i in data['index'])
                    tx.executeSql('DROP TABLE IF EXISTS ' + data['index'][i]['name']);
                if(callback && $.isFunction(callback))
                    callback();
            });
        });
}

//Load the database into the navigator engine
function loadDatabase(callback, url){
    if(!url)
        url = 'data/db_data.js';
    $.getJSON(
        url, {}, function(data){
            //Create the table indexes to store the type for each table
            db.transaction(function(tx){
                tx.executeSql('CREATE TABLE IF NOT EXISTS types (id int(11), name varchar(255))');
                tx.executeSql('SELECT COUNT(*) AS count FROM types', [], function(tx, r){
                    if(r.rows.item(0).count == 0){
                        //Insert the types data
                        for(var i in data['index'])
                            tx.executeSql(
                                'INSERT INTO types (id,name) VALUES (?,?)',
                                [data['index'][i]['id'], data['index'][i]['name']]
                            );

                        //Create and inserts the data of each table
                        for(var table in data)
                            if(table != 'index' && table != 'metadata'){
                                var metadata = data['metadata'][table];
                                var fields = "", meta_fields = '', insert_vars = '';
                                for(var i in metadata){
                                    if(i > 0){
                                        meta_fields += ',';
                                        fields += ',';
                                        insert_vars += ','
                                    }
                                    meta_fields += metadata[i]['name'] + ' ' + metadata[i]['type'];
                                    fields += metadata[i]['name'];
                                    insert_vars += '?';
                                }
                                tx.executeSql('CREATE TABLE ' + table + ' (' + meta_fields + ')', [], function(){}, function(tx, err){ console.log(table); console.log(err); });
                                for(var i in data[table])
                                    tx.executeSql('INSERT INTO ' + table + '(' + fields + ') VALUES (' + insert_vars + ')', extractObjectValues(data[table][i]), function(){}, function(tx, err){ console.log(err); });
                            }

                        if(callback && $.isFunction(callback))
                            callback();
                    }
                });
            });
        }
    );
}

function extractObjectValues(o){
    var res = [];
    for(var i in o)
        res.push(o[i]);
    return res;
}

//Search into the database
function db_search(text, callback){
    db.transaction(function(tx){
        tx.executeSql(
            "SELECT * FROM entities WHERE sufijo = ? AND name like ?",
            [lang, '%' + text + '%'],
            function(tx, r){
                var result = [];
                for(var i=0; i < r.rows.length; i++){
                    var row = r.rows.item(i);
                    result.push(row);
                }
                if(callback && $.isFunction(callback))callback(result);
            },function(tx, err){
                if(callback && $.isFunction(callback))callback([]);
            }
        );
    });
}

//Extract the pois basic data
function getPOI(id, callback){
    db.transaction(function(tx){
        tx.executeSql(
            "SELECT * FROM entities WHERE id = ?",
            [id],
            function(tx, r){
                if(callback && $.isFunction(callback))
                    if(r.rows.length == 0)
                        callback(null);
                    else
                        callback(r.rows.item(0));
            },
            function(tx, err){
                if(callback && $.isFunction(callback))callback(null);
            }
        );
    });
}

//Load all the entities information fro the DB
function loadEntitiesData(callback){
    db.transaction(function(tx){
        tx.executeSql("SELECT * FROM entities WHERE sufijo = ?", [lang], function(tx, r){
            var res = [];
            for(var i =0; i < r.rows.length; i++){
                res.push(r.rows.item(i));
            }
            if(callback && $.isFunction(callback)) callback(res);
        }, function(tx, err){
            if(callback && $.isFunction(callback)) callback([]);
        });
    });
}

//Extended POI data extraction
function getPOIData(id, callback){
    db.transaction(function(tx){
        tx.executeSql(
            "SELECT * FROM entities WHERE id = ?",
            [id],
            function(tx, r){
                if(r.rows.length == 0) {
                    if(callback && $.isFunction(callback)) callback(null);
                } else {
                    var item = r.rows.item(0);
                    tx.executeSql('SELECT * FROM types WHERE id = ?', [item.type], function(tx, r){
                        if(r.rows.length == 0){
                            if(callback && $.isFunction(callback)) callback(null);
                        } else
                            tx.executeSql('SELECT *, ? AS table_name FROM ' + r.rows.item(0).name + ', entities WHERE identidad = ? AND identidad = id', [r.rows.item(0).name, id], function(tx, r){
                                if(r.rows.length == 0) {
                                    if(callback && $.isFunction(callback)) callback(null);
                                } else {
                                    var res = r.rows.item(0);
                                    res.name = item.name;
                                    if(callback && $.isFunction(callback)) callback(res);
                                }
                            }, function(tx,err){if(callback && $.isFunction(callback)) callback(null);});
                    }, function(tx,err){
                        if(callback && $.isFunction(callback)) callback(null);
                    });
                }
            },
            function(tx, err){
                if(callback && $.isFunction(callback)) callback(null);
            }
        );
    });
}

//Select neighbors POIs
function getNeighbors(id, type, distance, callback){
    db.transaction(function(tx){
        tx.executeSql(
            "SELECT e.*, (e.x-p.x)*(e.x-p.x) + (e.y-p.y)*(e.y-p.y) AS distance2 FROM entities AS e, (SELECT * FROM entities WHERE id = ? LIMIT 1) AS p WHERE e.sufijo = ? AND e.type = ? AND e.id <> p.id AND e.x >= p.x - ? AND e.x <= p.x + ? AND e.y >= p.y - ? AND e.y <= p.y + ? AND (e.x-p.x)*(e.x-p.x) + (e.y-p.y)*(e.y-p.y) < ? * ?",
            [id, lang, type, distance, distance, distance, distance, distance, distance],
            function(tx, r){
                if(callback && $.isFunction(callback))
                    if(r.rows.length == 0)
                        callback(null);
                    else {
                        var res = [];
                        for(var i = 0; i < r.rows.length; i++)
                            res.push(r.rows.item(i));
                        callback(res);
                    }
            },
            function(tx, err){
                console.log(err);
                if(callback && $.isFunction(callback))callback(null);
            }
        );
    });
}


/*
 *
 * Map related functions
 *
 */
//Load the selected layer items into the map
function loadSelectedLayers(){
    var my_features = [];
    for(var i in features)
        if(selected_layers.indexOf(features[i].data.type) >= 0 || special_features.indexOf(features[i]) >= 0)
            my_features.push(features[i]);
    layer.removeAllFeatures();
    layer.addFeatures(my_features);
    layer.refresh();
}
//</script>

/*
 *
 *Search related functions
 *
 */
function search(searched_text){
    db_search(searched_text, function(res){
        var ul = $("#search-results");
        ul.children().remove();
        if(searched_text != "")
            $.each(res, function(){
                var feature = this;
                ul.append(
                    $("<li></li>").append(
                            $("<a href='' data-rel='back'></a>").text(this.name)
                                .prepend('<img src="images/icons/' + this.type +'.png" alt="" height="16" class="ui-li-icon ui-corner-none"/>')
                        ).click(function(){
                            var lonlat = new OpenLayers.LonLat(feature.x, feature.y);
                            lonlat.transform(new OpenLayers.Projection("EPSG:4326"), map.getProjectionObject());
                            map.setCenter(lonlat);
                            map.zoomTo(16);
                            if(!layer.getFeatureByFid(feature.type + '.' + feature.id)){
                                var fid = feature.type + '.' + feature.id;
                                for(var i in features)
                                    if(features[i].fid == fid){
                                        special_features = [features[i]];
                                        loadSelectedLayers();
                                        setTimeout('select.select(layer.getFeatureByFid("' + features[i].fid + '"));', 500);
                                        break;
                                    }
                            }
                        })
                );
            });

        ul.listview("refresh");
    });
}

/*
 *
 * UTILS
 *
 */
function completeTemplate(template, data){
    var res = template;
    for(var i in data){
        var tmp = res;
        do{
            res = tmp;
            tmp = tmp.replace('$' + i + '$', data[i]);
        }while (tmp != res);
    }
    return res;
}