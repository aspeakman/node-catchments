#!/usr/bin/env node
const { isDigit  } = require('../common.js');

var args = process.argv.slice(2); // any arguments after program name and app name 

process.env["NODE_CONFIG_DIR"] = "../config";
process.env.NODE_ENV = "local_default"; // uses any settings in "local_default" to override "default"
const config = require('config');

/* Populate the database with 'batch_size' entries from the DEFRA API */
var batch_size = config.get('batch_size');
if (args.length > 0 && isDigit(args[0]))
    batch_size = parseInt(args[0]);
const interval = 1000; // interval in ms between API requests to avoid rate limiting

const sqlite = require('better-sqlite3');
const db = sqlite(config.get('db_file'), config.get('db_options'));
const batch = db.prepare('SELECT id FROM opcats ORDER BY last_updated ASC LIMIT ?').all(batch_size); // nulls and earliest dates first
var update_one = db.prepare("UPDATE opcats SET features = ?, last_updated = datetime('now', 'localtime') where id = ?"); 

var i = 0;
for (const b of batch) {
    i += interval;
    setTimeout(fetch_id, i, b.id);
}
    
function fetch_id(id) {
    fetch('https://environment.data.gov.uk/catchment-planning/OperationalCatchment/' + id + '.geojson')
        .then((res) => {
            if(res.ok) return res;
            else throw new Error(`Bad status: ${res.status} (${res.statusText})`);
        })
        .then((response) => response.text())
        .then((text) => {
            info = update_one.run(text, id);
            console.log('operational catchment id', id, 'changed', info.changes);
        })
        //.catch(error => console.error("Error getting the GeoJSON data: ", error));
        .catch(error => console.log('operational catchment id', id, 'changed', 0));
}


