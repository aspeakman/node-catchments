const { isEmpty, isDigit, trunc, fixMultiPolys, rivers, lakes, wbodies, all_wbodies, createCookie, readCookie } = require('./common.js');

// Initialize leaflet.js
var L = require('leaflet');

// Initialize jquery
var $ = require( "jquery" );

// Initialize the map
var map = L.map('map', {
  scrollWheelZoom: false
});

stored_bounds = readCookie('stored_bounds');
if (stored_bounds) 
    map.fitBounds(JSON.parse(stored_bounds));
else
    map.setView([51.505, -0.09], 10);

// Add a tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// A placeholder for GeoJSON data
var geojsonData = null;
var geojsonLayer = L.geoJson(geojsonData, {
  style: styleFeature,
  onEachFeature: popupFeature,
  }).addTo(map);

// Color function to style features based on their properties
function styleFeature(feature) {
    var styles = { weight: 2, opacity: 0.7 };
    if (!feature.properties || !all_wbodies.includes(feature.properties['water-body-type']['string'])) {
        styles['color'] = 'brown';
        styles['fillOpacity'] = 0.1;
        //if (feature.properties['water-body-type']['string'] === 'ManagementCatchment') 
        //    styles['color'] = 'black';
        //else if (feature.properties['water-body-type']['string'] === 'OperationalCatchment') 
        //    styles['color'] = 'cyan';
        return styles;
    }
    styles['color'] = 'blue';
    styles['fillOpacity'] = 0.2;
    if (rivers.includes(feature.properties['water-body-type']['string'])
            && feature.properties['geometry-type'].endsWith('Catchment')) 
       styles['color'] = 'green';
    return styles;
}
// Popup function with link based on properties
function popupFeature(feature, layer) {
    var name = feature.properties.name;
    var link;
    if (all_wbodies.includes(feature.properties['water-body-type']['string'])) {
        /*const url = 'https://environment.data.gov.uk/catchment-planning/WaterBody/' + feature.properties.id;
        //link = '<a href="' + url + '" target="_blank">' + name + '</a>';
        link = '<a href="#" class="wbody-link" id="link-' + feature.properties.id + '">' + name + '</a>' 
            + '<br/>ID: <a href="' + url + '" target="_blank">' + feature.properties.id + '</a>';*/
        const url = '/WaterBody?id=' + feature.properties.id; 
        link = '<a href="' + url + '">' + name + '</a>';
    } else {
        const url = '/' + feature.properties['water-body-type']['string'] + '?id=' + feature.properties.id; 
        link = '<a href="' + url + '">' + name + '</a>';
    }
    layer.bindPopup(link);
}

function setBounds(){
    const b = geojsonLayer.getBounds();
    //map.fitBounds(b);
    map.flyToBounds(b, { duration: 1.0, animate: true });
    const bounds = [ [b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()] ];
    createCookie('stored_bounds', JSON.stringify(bounds), 1);
    readCookie('stored_bounds');
}

function loadFeatures(apiCall) { 
    fetch('/api/child_bounds/' + apiCall)
    .then(response => response.json())
    .then(data => {
        geojsonData = data;
        geojsonData.features = fixMultiPolys(geojsonData.features)
        updateGeoJSONDisplay();
        setBounds();
    })
    .catch(error => console.error("Error loading features: ", error));
}

function loadBoundary(apiCall) {
    fetch('/api/boundary/' + apiCall)
    .then(response => response.json())
    .then(data => {
        geojsonLayer.clearLayers();
        geojsonLayer.addData(data);
        setBounds();
    })
    .catch(error => console.error("Error loading boundary data: ", error));
}

function loadChildBounds(apiCall) {
    fetch('/api/child_bounds/' + apiCall)
    .then(response => response.json())
    .then(data => {
        geojsonLayer.clearLayers();
        geojsonLayer.addData(data);
        setBounds();
    })
    .catch(error => console.error("Error loading boundary data: ", error));
}

// Function to set the dropdown options from API children
function loadDropdown(selector, apiCall, selected) {
    fetch('/api/children/' + apiCall)
    .then(response => response.json())
    .then(data => {
        $(selector).append($('<option>', {
                    value: 'all',
                    text: 'All'
                }));
        for (d of data) {
            $(selector).append($('<option>', {
                    value: d.id,
                    text: trunc(d.name,30),
                    selected: (''+d.id === ''+selected)
                }));
        }
    })
    .catch(error => console.error("Error loading dropdown: ", error));
}

// Function to get the ancestor(s) of an opcat, mancat or wbody - note returns a Promise!
function getAncestors(catchmentType, id) {
    return fetch('/api/ancestors/' + catchmentType + '/' + id)
      .then(response => response.json())
      .then(data => {
          return data; 
        })
      .catch(error => console.error("Error getting ancestors: ", error));
}

function insertPageDetail(catchmentType, id) {
    if (!id) return;
    const cm_spaces = catchmentType.replace(/([A-Z])/g, ' $1').trim(); // spaces before capital letter
    return fetch('/api/detail/' + catchmentType + '/' + id)
      .then(response => response.json())
      .then(data => {
          $('#source-title').append(cm_spaces + ': ' + data.name);
          $('#source-link').attr("href", function() { return $(this).attr("href") + catchmentType + '/' + id });
        })
      .catch(error => console.error("Error inserting page detail: ", error));
}

// Function to filter and display the GeoJSON features based on the selection
function updateGeoJSONDisplay() {
    var featureVal = $('#feature-select').val();
    var selected_wbodies = [];
    var geometryType = 'Catchment';
    if (featureVal === 'rivers') {
        selected_wbodies = rivers;
        geometryType = 'RiverLine';
    } else if (featureVal === 'lakes') {
        selected_wbodies = lakes;
    } else if (featureVal === 'catchments') {
        selected_wbodies = rivers;
    } 
    var wbody_id = $('#wbody-select').val();
    var any_wbody = (isEmpty(wbody_id) || !wbody_id.startsWith('GB')); 
    
    //console.log(wbody_id);
    //console.log(any_wbody);
    
    // Clear the existing layer
    geojsonLayer.clearLayers();
    
    // Filter features based on 2 selections
    var filteredData = { type: 'FeatureCollection', 'features': [] };
    if (selected_wbodies.length > 0)  // selected wbodies
        filteredData['features'] = geojsonData.features.filter(function (feature) {
            if (!feature.properties) return false;
            if (feature.properties['water-body-type']['string'] === 'OperationalCatchment') return true;
            return ((any_wbody || wbody_id === feature.properties.id) && 
                selected_wbodies.includes(feature.properties['water-body-type']['string']) 
                && feature.properties['geometry-type'].endsWith(geometryType));
            });
    else  // all wbodies
        filteredData['features'] =  geojsonData.features.filter(function (feature) {
            if (!feature.properties) return false;
            if (feature.properties['water-body-type']['string'] === 'OperationalCatchment') return true;
            return ((any_wbody || wbody_id === feature.properties.id) && 
                wbodies.includes(feature.properties['water-body-type']['string']));
            });        

    //console.log(filteredData);
    if (filteredData.features.length > 0) {
        geojsonLayer.addData(filteredData);
        setBounds();
    }
}

// page has been loaded
$(document).ready(function() {
    
    $('#rbd-select').on('change', function(event) {
        var id = $('#rbd-select').val();
        if (!isDigit(id)) // not a number
            $('#rbd-select').val(''); 
        $('#rbd-form').submit(); 
    });
    $('#mancat-select').on('change', function(event) {
        var id = $('#mancat-select').val();
        if (isDigit(id)) // a number
            $('#mancat-form').submit(); 
        else
            $('#rbd-form').submit(); // submit parent form
    });
    $('#opcat-select').on('change', function(event) {
        var id = $('#opcat-select').val();
        if (isDigit(id)) // a number
            $('#opcat-form').submit(); 
        else
            $('#mancat-form').submit(); // submit parent form
    });
    $('#wbody-select').on('change', function(event) {
        var id = $('#wbody-select').val();
        if (isDigit(id.slice(2))) // 2 characters followed by a number
            $('#wbody-form').submit(); 
        else
            $('#opcat-form').submit(); // submit parent form
    });
    /*$('#wbody-select').on('change', function(event) {
    //    updateGeoJSONDisplay();
    });*/
    $('#feature-select').on('change', function(event) {
        updateGeoJSONDisplay();
    });
    //the .on() here is part of leaflet
   /* map.on('popupopen', function() {  
      $('a.wbody-link').click(function(event){
        event.preventDefault(); 
        const wbody_id = $(this).attr('id').replace('link-', '');
        $('#wbody-select').val(wbody_id).change();
      });
    });*/
        
    const path = $("head title").text();
    const parts = path.split(" ");
    var catchm = parts[2]; 
    var id = '';
    //if (parts.length >= 4 && isDigit(parts[3])) id = parts[3]; // only if a number
    if (parts.length >= 4) id = parts[3];
    else catchm = 'RiverBasinDistrict'; // top level if no id
    insertPageDetail(catchm, id);
    if (catchm == 'RiverBasinDistrict') {
        $("#river-basins").show();
        loadDropdown('#rbd-select', '', id);
        if (id) {
            $("#management-catchments").show();
            loadDropdown('#mancat-select', 'RiverBasinDistrict/'+id, '');
            //loadBoundary('RiverBasinDistrict/'+id);
            loadChildBounds('RiverBasinDistrict/'+id); 
        } else {
            loadChildBounds('');
        }
    } 
    else if (catchm == 'ManagementCatchment') {
        $("#river-basins").show();
        $("#management-catchments").show();
        if (id) {
            $("#operational-catchments").show();
            loadDropdown('#opcat-select', 'ManagementCatchment/'+id, '');
            //loadBoundary('ManagementCatchment/'+id);
            loadChildBounds('ManagementCatchment/'+id); 
        } 
        getAncestors(catchm, id).then((data) => {
            const ancestors = data;
            //console.log(ancestors);
            loadDropdown('#rbd-select', '', ancestors.rbd_id);
            loadDropdown('#mancat-select', 'RiverBasinDistrict/'+ancestors.rbd_id, id); 
            if (!id) {
                loadChildBounds('RiverBasinDistrict/'+ancestors.rbd_id);
            }
        });
    } 
    else if (catchm == 'OperationalCatchment') {
        $("#river-basins").show();
        $("#management-catchments").show();
        $("#operational-catchments").show();
        if (id) {
            $("#water-bodies").show();
            $("#features").show();
            loadDropdown('#wbody-select', 'OperationalCatchment/'+id, '');
            loadFeatures('OperationalCatchment/'+id); // triggers updateGeoJSONDisplay()
        }
        getAncestors(catchm, id).then((data) => {
            const ancestors = data;
            //console.log(ancestors);
            loadDropdown('#rbd-select', '', ancestors.rbd_id); 
            loadDropdown('#mancat-select', 'RiverBasinDistrict/'+ancestors.rbd_id, ancestors.mancat_id);
            loadDropdown('#opcat-select', 'ManagementCatchment/'+ancestors.mancat_id, id);
            if (!id) {
                loadChildBounds('ManagementCatchment/'+ancestors.mancat_id);
            }
        });            
    } else if (catchm == 'WaterBody') {
        $("#river-basins").show();
        $("#management-catchments").show();
        $("#operational-catchments").show();
        $("#water-bodies").show();
        $("#features").show();
        getAncestors(catchm, id).then((data) => {
            const ancestors = data;
            //console.log(ancestors);
            loadDropdown('#rbd-select', '', ancestors.rbd_id); 
            loadDropdown('#mancat-select', 'RiverBasinDistrict/'+ancestors.rbd_id, ancestors.mancat_id);
            loadDropdown('#opcat-select', 'ManagementCatchment/'+ancestors.mancat_id, ancestors.opcat_id);
            loadDropdown('#wbody-select', 'OperationalCatchment/'+ancestors.opcat_id, id);
            loadFeatures('OperationalCatchment/'+ancestors.opcat_id); // triggers updateGeoJSONDisplay()
        }); 
    }
});