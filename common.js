const rivers = [ 'River', 'Canal', 'Surface water transfer' ];
const lakes = [ 'Lake' ]; // not 'Groundwater Body' or 'Transitional Water'
const wbodies =  [ 'Lake', 'River', 'Canal', 'Surface water transfer' ]; // not 'Groundwater Body' or 'Transitional Water'
const all_wbodies = [ 'Lake', 'River', 'Canal', 'Surface water transfer', 'Groundwater Body', 'Transitional Water' ]

function isDigit(value) {
    return (/^\d+$/.test(''+value));
}

function isEmpty(value) {
    return value === undefined || value === null || value === '' ||
           (Array.isArray(value) && value.length === 0) || 
           (typeof value === 'object' && Object.keys(value).length === 0);
}

function trunc(text, max){
          return text.substr(0,max-1)+(text.length>max?'...':'');
      };

function simplifyPolys(features) {
    // takes a list of GEOJSON Feature Multi/Polygons and returns list of Feature Polygons with holes removed
    output = [];
    for (f of features) {
        if (f.geometry.type === 'MultiPolygon') {
            for (fgc of f.geometry.coordinates) { // for each Poly in the Multi
                var new_f = { "type": "Feature", "geometry": { "type": "Polygon" } };
                new_f.geometry['coordinates'] = [fgc[0]]; // ignore any holes
                output.push(new_f);
            }
        }
        else if (f.geometry.type === 'Polygon') {
            f.geometry.coordinates.length = 1; // truncate to ignore any holes
            output.push(f);
        }
    }
    return output;
}

function fixMultiPolys(features) {
    // takes a list of GEOJSON Feature MutiPolygons and turns any with a single Polygon (with pseudo holes) into a MultiPolygon (with no holes)
    output = [];
    for (f of features) {
        if (f.geometry.type === 'MultiPolygon') {
            if (f.geometry.coordinates.length == 1) { // a MultiPolygon with a single polygon - assume it is misconfigured
                var new_coords = [];
                for (poly of f.geometry.coordinates[0]) { // for each poly/hole in the list
                    new_coords.push( [ poly ] );
                }
                f.geometry.coordinates = new_coords;
            }
        }
        output.push(f);
    }
    return output;
}

function createCookie(name, value, days) {
    var expires;
    //console.log('create ' + value);
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toGMTString();
    } else {
        expires = "";
    }
    document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + expires + "; path=/";
}

function readCookie(name) {
    var nameEQ = encodeURIComponent(name) + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === ' ')
            c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            const value = decodeURIComponent(c.substring(nameEQ.length, c.length));
            //console.log('read ' + value);
            return value;
        }
    }
    return null;
}

function eraseCookie(name) {
    createCookie(name, "", -1);
}

module.exports = { fixMultiPolys, isEmpty, isDigit, trunc, rivers, lakes, wbodies, all_wbodies,
            createCookie, readCookie, eraseCookie }
