--
-- File generated with SQLiteStudio v3.3.3 on Tue Jul 19 16:53:24 2022
--
-- Text encoding used: System
--
PRAGMA foreign_keys = off;
BEGIN TRANSACTION;

-- Table: data
CREATE TABLE IF NOT EXISTS data (ip VARCHAR (255), country VARCHAR (65), city VARCHAR (128), region VARCHAR (128), route VARCHAR (255), page_title VARCHAR (255), user VARCHAR (255), date DATETIME, id INTEGER PRIMARY KEY AUTOINCREMENT, http_code INTEGER (3), user_agent STRING (255), refer STRING (255), is_bot BOOLEAN);
CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, version INTEGER, date DATE DEFAULT (CURRENT_TIMESTAMP));

COMMIT TRANSACTION;
PRAGMA foreign_keys = on;
