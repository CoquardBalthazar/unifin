-- Runs once, only when the postgres_data volume is initialised empty.
-- On an existing volume this file is a no-op; create the DB by hand instead.
CREATE DATABASE "db-unifin-test" OWNER "u-unifin";
