drop table if exists rbds;
create table rbds (id INTEGER PRIMARY KEY, name TEXT, boundary TEXT, last_updated TEXT);
INSERT INTO rbds (id, name)
SELECT DISTINCT RBD_ID, RBD_NAME FROM cde_schema_d_catchment_relationship;

drop table if exists mancats;
create table mancats (id INTEGER PRIMARY KEY, rbd_id INTEGER, name TEXT, boundary TEXT, last_updated TEXT);
INSERT INTO mancats (id, rbd_id, name)
SELECT DISTINCT mancatid, RBD_ID, mancatname FROM cde_schema_d_catchment_relationship;

drop table if exists rbd_mancats;
create table rbd_mancats (rbd_id INTEGER, mancat_id INTEGER, PRIMARY KEY (rbd_id, mancat_id));
INSERT INTO rbd_mancats (rbd_id, mancat_id)
SELECT DISTINCT RBD_ID, mancatid FROM cde_schema_d_catchment_relationship;

drop table if exists opcats;
create table opcats (id INTEGER PRIMARY KEY, mancat_id INTEGER, name TEXT, features TEXT, boundary TEXT, last_updated TEXT);
INSERT INTO opcats (id, mancat_id, name)
SELECT DISTINCT OpCatID, mancatid, OpCatName FROM cde_schema_d_catchment_relationship;

drop table if exists mancat_opcats;
create table mancat_opcats (mancat_id INTEGER, opcat_id INTEGER, PRIMARY KEY (mancat_id, opcat_id));
INSERT INTO mancat_opcats (mancat_id, opcat_id)
SELECT DISTINCT mancatid, OpCatID FROM cde_schema_d_catchment_relationship;

drop table if exists wbody_opcat;
create table wbody_opcat (wbody_id text, opcat_id INTEGER, PRIMARY KEY (wbody_id));