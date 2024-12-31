const turf = require("@turf/turf");
const express = require('express');
const router = express.Router();

process.env["NODE_CONFIG_DIR"] = "./config";
process.env.NODE_ENV = "local_default"; // uses any settings in "local_default" to override "default"
const config = require('config');

const sqlite = require('better-sqlite3');
const db = sqlite('db/' + config.get('db_file'), config.get('db_options'));

const rbd_all_bounds = db.prepare('SELECT id, name, boundary FROM rbds ORDER BY name');
const rbd_bounds = db.prepare('SELECT id, name, boundary FROM rbds WHERE id = ?'); 
var stmt = 'SELECT r.id as rbd_id, r.name as rbd_name, m.id as id, m.name as name, m.boundary as boundary \
FROM rbds r LEFT JOIN rbd_mancats rm ON r.id = rm.rbd_id LEFT JOIN mancats m ON m.id = rm.mancat_id \
WHERE r.id = ? and m.boundary is not null ORDER BY m.name';
const rbd_mancat_bounds = db.prepare(stmt); 
const mancat_bounds = db.prepare('SELECT id, name, boundary FROM mancats WHERE id = ?');
var stmt = 'SELECT m.id as mancat_id, m.name as mancat_name, o.id as id, o.name as name, o.boundary as boundary \
FROM mancats m LEFT JOIN mancat_opcats mo ON m.id = mo.mancat_id LEFT JOIN opcats o ON o.id = mo.opcat_id \
WHERE m.id = ? and o.boundary is not null ORDER BY o.name';
const mancat_opcat_bounds = db.prepare(stmt); 
const opcat_bounds = db.prepare('SELECT id, name, boundary FROM opcats WHERE id = ?');
// ancestor of a mancat
var stmt = 'SELECT m.name as name, r.id as rbd_id, r.name as rbd_name FROM mancats m JOIN rbds r ON r.id = m.rbd_id WHERE m.id = ?';
const mancat_rbd = db.prepare(stmt);
// ancestors of an opcat
var stmt = 'SELECT o.name as name, r.id as rbd_id, r.name as rbd_name, m.id as mancat_id, m.name as mancat_name \
FROM opcats o JOIN mancats m ON m.id = o.mancat_id JOIN rbds r ON r.id = m.rbd_id \
WHERE o.id = ?';
const opcat_mancat_rbd = db.prepare(stmt);
const opcat_features = db.prepare('SELECT id, name, boundary, features FROM opcats WHERE id = ?');
// parent features of a wbody
var stmt = 'SELECT o.id as id, o.name as name, o.features as features \
FROM opcats o JOIN wbody_opcat w ON o.id = w.opcat_id \
WHERE w.wbody_id = ?';
const wbody_opcat_features = db.prepare(stmt);
// ancestors of a wbody
var stmt = 'SELECT r.id as rbd_id, r.name as rbd_name, m.id as mancat_id, m.name as mancat_name, \
o.id as opcat_id, o.name as opcat_name \
FROM wbody_opcat w JOIN opcats o ON o.id = w.opcat_id JOIN \
mancats m ON m.id = o.mancat_id JOIN rbds r ON r.id = m.rbd_id \
WHERE w.wbody_id = ?';
const wbody_opcat_mancat_rbd = db.prepare(stmt);

const unions = [ 'RiverBasinDistrict', 'ManagementCatchment' ];
const mancat_aliases = [ 'ManagementCatchment', 'mancat' ];
const opcat_aliases = [ 'OperationalCatchment', 'opcat' ];
const rbd_aliases = [ 'RiverBasinDistrict', 'rbd' ];
const wbody_aliases = [ 'WaterBody', 'wbody' ];

const { isEmpty, rivers, lakes, wbodies, all_wbodies } = require('../common.js');

/* GET home page */
router.get('/', function(req, res) {
  var title = 'DEFRA Catchment RiverBasinDistrict';
  res.render('index', { title: title });
});

/* GET home page */
router.get('/:catch(RiverBasinDistrict|ManagementCatchment|OperationalCatchment|WaterBody)', function(req, res) {
  var title = 'DEFRA Catchment ' + req.params.catch;
  if (!isEmpty(req.query.id)) title += ' ' + req.query.id;
  res.render('index', { title: title });
});

// define the pass through OperationalCatchment API route
/*router.get('/api/OperationalCatchment/:object', async (req, res) => {
  try {
    var object = req.params.object;
    if (object.endsWith('.geojson')) object = object.substring(0, object.length-8); // remove suffix
    //var path = req.params.path;
    const uri = `https://environment.data.gov.uk/catchment-planning/OperationalCatchment/${object}`;
    console.log(uri);
    const response = await fetch(uri + '.geojson', {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' }
    })
    const data = await response.json();
    var polys = { 'type': "FeatureCollection", 'features': [] };
    for (f of data['features']) {
        if (f.geometry.type !== 'MultiLineString') polys['features'].push(f);
    }
    var union = polys;
    if (polys['features'].length > 1)
        union = turf.union(polys); // returns a feature = exterior boundary
    else {
        union = {}; Object.assign(union, polys.features[0]); // copy of single feature of collection
    }
    union.properties = {
        "name": object,
        "uri": uri,
        "water-body-type": {
          "string": 'OperationalCatchment',
          "lang": "en"
        },
        "geometry-type": "http://environment.data.gov.uk/catchment-planning/def/geometry/Catchment"
    }
    //if (unions.includes(path)) {
    //    result = { 'type': "FeatureCollection", 'features': [union] };
    //    return res.json(result);
    //}
    data['features'].unshift(union);
    return res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('server error');
  }
});

*/

// define the API routes
router.get('/api/:action/', apiHandler);
router.get('/api/:action/:catchment/:id', apiHandler);
    
function apiHandler(req, res) {
    try {
        result = {};
        switch (req.params.action) {
            case 'ancestors':
                if (rbd_aliases.includes(req.params.catchment))
                    result = rbd.get(req.params.id);
                else if (mancat_aliases.includes(req.params.catchment))
                    result = mancat_rbd.get(req.params.id);
                else if (opcat_aliases.includes(req.params.catchment))
                    result = opcat_mancat_rbd.get(req.params.id);
                else if (wbody_aliases.includes(req.params.catchment))
                    result = wbody_opcat_mancat_rbd.get(req.params.id);
                break;
            case 'boundary':
            case 'detail':
                var b = null;
                if (rbd_aliases.includes(req.params.catchment))
                    b = rbd_bounds.get(req.params.id);
                else if (mancat_aliases.includes(req.params.catchment))
                    b = mancat_bounds.get(req.params.id);
                else if (opcat_aliases.includes(req.params.catchment))
                    b = opcat_bounds.get(req.params.id);
                else if (wbody_aliases.includes(req.params.catchment)) {
                    f = wbody_opcat_features.get(req.params.id);
                    if (f) {
                        geojsonData = JSON.parse(f.features);
                        for (const feature of geojsonData.features) {
                            if (feature.properties && feature.properties['id'] === req.params.id
                                && feature.properties['geometry-type'].endsWith('Catchment')) {
                                    if (req.params.action === 'detail')
                                        result = { 'id': feature.properties.id, 'name': feature.properties.name };
                                    else
                                        result = feature;
                                    break;
                            }
                        }
                    }
                }
                if (b) {
                    if (req.params.action === 'detail')
                        result = { 'id': b.id, 'name': b.name };
                    else
                        result = JSON.parse(b.boundary);
                }
                break;
            case 'child_bounds':
            case 'children':
                var features = [];
                var iterator = null;
                if (opcat_aliases.includes(req.params.catchment)) {
                    f = opcat_features.get(req.params.id); 
                    if (f) {
                        /*if (req.params.action === 'child_bounds') { // adds in the surounding catchment boundary
                            bounds = JSON.parse(f.boundary);
                            features.push( bounds );
                        }*/
                        geojsonData = JSON.parse(f.features);
                        iterator = geojsonData.features.filter(function (feature) {
                            if (!feature.properties) return false;
                            return wbodies.includes(feature.properties['water-body-type']['string']);
                            });
                        var ilist = [];
                        for (const b of iterator) {
                            if (req.params.action === 'child_bounds')
                                features.push( b );
                            else if ((req.params.action === 'children') && !ilist.includes(b.properties.id)) {
                                ilist.push(b.properties.id);
                                features.push( { 'id': b.properties.id, 'name': b.properties.name } );
                                }
                        }
                        if (req.params.action === 'children')
                            features.sort((a, b) =>  a['name'].localeCompare(b['name']));
                    }
                } else {
                    if (mancat_aliases.includes(req.params.catchment))
                        iterator = mancat_opcat_bounds.iterate(req.params.id);
                    else if (rbd_aliases.includes(req.params.catchment))
                        iterator = rbd_mancat_bounds.iterate(req.params.id);
                    else if (!req.params.catchment)
                        iterator = rbd_all_bounds.iterate();
                    if (iterator) {
                        for (const b of iterator) {
                            if (req.params.action === 'child_bounds')
                                features.push( JSON.parse(b.boundary) )
                            else if (req.params.action === 'children')
                                features.push( { 'id': b.id, 'name': b.name } )
                        }
                    }
                }
                if (req.params.action === 'child_bounds')
                    result = { 'type': "FeatureCollection", 'features': features };
                else if (req.params.action === 'children')
                    result = features;
                break;
            case 'ancestors':
                if (rbd_aliases.includes(req.params.catchment))
                    result = rbd.get(req.params.id);
                else if (mancat_aliases.includes(req.params.catchment))
                    result = mancat_rbd.get(req.params.id);
                else if (opcat_aliases.includes(req.params.catchment))
                    result = opcat_mancat_rbd.get(req.params.id);
                else if (wbody_aliases.includes(req.params.catchment))
                    result = wbody_opcat_mancat_rbd.get(req.params.id);
                break;
        }
        return res.json(result);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('server error');
    }
}

module.exports = router;
