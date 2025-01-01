# node-catchments

A [node.js](https://nodejs.org/api/) website to provide interactive display of English river catchments derived
from the [DEFRA Catchment Data Explorer](https://environment.data.gov.uk/catchment-planning/) 

1. The overarching boundaries are created by combining the lower level Water Body polygons which define source catchments (so there are some gaps in coverage)
2. Note the derived boundaries exclude tidal and ground water bodies (and catchments that extend into Wales and Scotland)

## Configuration

Create a `config/local_default.yaml` or `config/local_default.json` to override or adapt any of the settings you find in `config/default.yaml`

You may want to change the 'db_file' setting (name of your database in the `db` folder - default 'defra.sqlite') and the 'port' your website will run on (default 3001)

## Installation

The source SQLite database (approx 133MB in size) contains boundaries of River Basins, Management Catchments and Operational Catchments. 
These are derived from downloaded Water Bodies. 

To populate the database consult the file [INSTALL.txt](db/INSTALL.txt)

To install the node.js modules and build the source files

```
npm install 
npm run build
```

## Operation

```
npm start
```

# API Endpoints

The website exposes the following API Endpoint

> /api/**action**/**catchment**/**id**

where **action** is one of:
 - *ancestors* -> names and ids of all catchment areas enclosing this catchment (JSON dict)
 - *boundary* -> boundary of this catchment (GeoJSON Feature)
 - *detail* -> name and id of this catchment (JSON dict)
 - *child_bounds* -> boundaries of all catchment areas directly enclosed by this catchment (GeoJSON FeatureCollection)
 - *children* -> names and ids of all catchment areas directly enclosed by this catchment (JSON list of dicts)

where **catchment** is one of:
 - *RiverBasinDistrict*
 - *ManagementCatchment*
 - *OperationalCatchment*
 - *WaterBody*

and **id** is a unique identifier (a number, prefixed by 'GB' if a *WaterBody*)


