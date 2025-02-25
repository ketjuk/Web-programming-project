/*CREATE TABLE CONTACT(NAEM VARCHAR(64), NUMBER(64), PRIMARY KEY(NUMBER));*/

CREATE TABLE users (
    email TEXT PRIMARY KEY,
    password TEXT,
    firstname TEXT,
    familyname TEXT,
    gender TEXT,
    city TEXT,
    country TEXT
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    message TEXT
);

CREATE TABLE log_in_users (
    email TEXT PRIMARY KEY,
    token TEXT
);

