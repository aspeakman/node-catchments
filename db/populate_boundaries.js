#!/usr/bin/env node
/* Populate the database with boundaries from the DEFRA Catchment Explorer API */

const { fixMultiPolys, wbodies } = require('../common.js');

process.env["NODE_CONFIG_DIR"] = "../config";
process.env.NODE_ENV = "local_default"; // uses any settings in "local_default" to override "default"
const config = require('config');

const sqlite = require('better-sqlite3');
const db = sqlite(config.get('db_file'), config.get('db_options'));

const turf = require("@turf/turf");

// function to set boundary properties
function setProps(id, name, ctype) {
    return {
        "name": name,
        "id": id,
        "uri": 'https://environment.data.gov.uk/catchment-planning/' + ctype + '/' + id,
        "water-body-type": {
          "string": ctype,
          "lang": "en"
        },
        "geometry-type": "http://environment.data.gov.uk/catchment-planning/def/geometry/Catchment"
    }
}

// fetch the Operational Catchments and derive boundaries
// also insert the WaterBodies within each Operational Catchment
var batch; var update_one; var insert_one; var clear_bounds;
clear_bounds = db.prepare("UPDATE opcats SET boundary = NULL").run();
batch = db.prepare('SELECT * FROM opcats').all(); 
update_one = db.prepare("UPDATE opcats SET boundary = ? where id = ?");
var clear_wbodies = db.prepare("DELETE FROM wbody_opcat").run();
insert_one = db.prepare("INSERT INTO wbody_opcat(wbody_id, opcat_id) VALUES (?, ?)");

for (const b of batch) {
    
    var ctype = 'OperationalCatchment'
    data = JSON.parse(b.features);
    var polys = []; var union; // selected features
    for (f of data['features']) {
        if ( // f.geometry.type !== 'MultiLineString' && 
            wbodies.includes(f.properties['water-body-type']['string'])
            && f.properties['geometry-type'].endsWith('Catchment')) {
                info = insert_one.run(f.properties.id, b.id);
                polys.push(f);
            }
    }
    if (polys.length == 0) continue;
    polys = fixMultiPolys(polys);
    if (polys.length == 1)
        union = polys[0];
    else
        union = turf.union(turf.featureCollection(polys));
    union.properties = setProps(b.id, b.name, ctype);
    console.log(b.id, b.name);
    info = update_one.run(JSON.stringify(union), b.id);

}

// derive the Management Catchment boundaries from the Operational Catchments
var boundaries; var stmt;
clear_bounds = db.prepare("UPDATE mancats SET boundary = NULL").run();
batch = db.prepare('SELECT * FROM mancats').all(); 
stmt = 'SELECT m.id as id, m.name as name, o.boundary as boundary, o.name as boundary_name \
FROM mancats m LEFT JOIN mancat_opcats mo ON m.id = mo.mancat_id LEFT JOIN opcats o ON o.id = mo.opcat_id \
WHERE m.id = ?';
boundaries = db.prepare(stmt);
update_one = db.prepare("UPDATE mancats SET boundary = ? where id = ?"); 

for (const b of batch) {
    
    var ctype = 'ManagementCatchment'
    var polys = []; var union; // selected features
    for (const c of boundaries.iterate(b.id)) {
        if (!c.boundary) continue;
        data = JSON.parse(c.boundary);
        //console.log(c.id, c.name, '->', c.boundary_name);
        polys.push(data);
    }
    if (polys.length == 0) continue;
    if (polys.length == 1)
        union = polys[0];
    else
        union = turf.union(turf.featureCollection(polys));
    union.properties = setProps(b.id, b.name, ctype);
    console.log(b.id, b.name);
    info = update_one.run(JSON.stringify(union), b.id);
}

// derive the River Basin boundaries from Management Catchments
clear_bounds = db.prepare("UPDATE rbds SET boundary = NULL").run();
batch = db.prepare('SELECT * FROM rbds').all(); 
stmt = 'SELECT r.id as id, r.name as name, m.boundary as boundary, m.name as boundary_name \
FROM rbds r LEFT JOIN rbd_mancats rm ON r.id = rm.rbd_id LEFT JOIN mancats m ON m.id = rm.mancat_id \
WHERE r.id = ?';
boundaries = db.prepare(stmt);
update_one = db.prepare("UPDATE rbds SET boundary = ? where id = ?"); 

for (const b of batch) {
    
    var ctype = 'RiverBasinDistrict'
    var polys = []; var union; // selected features
    for (const c of boundaries.iterate(b.id)) {
        if (!c.boundary) continue;
        data = JSON.parse(c.boundary);
        //console.log(c.id, c.name, '->', c.boundary_name);
        polys.push(data);
    }
    if (polys.length == 0) continue;
    if (polys.length == 1)
        union = polys[0];
    else
        union = turf.union(turf.featureCollection(polys));
    union.properties = setProps(b.id, b.name, ctype);
    console.log(b.id, b.name);
    info = update_one.run(JSON.stringify(union), b.id);
}