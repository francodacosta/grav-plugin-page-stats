PRAGMA foreign_keys = off;

BEGIN TRANSACTION;

CREATE TABLE events (
    id         INTEGER       PRIMARY KEY AUTOINCREMENT,
    date       DATETIME      DEFAULT (CURRENT_TIMESTAMP),
    session_id INTEGER       REFERENCES data (id),
    event      VARCHAR (255),
    value      VARCHAR (255)
);

COMMIT TRANSACTION;
PRAGMA foreign_keys = on;
