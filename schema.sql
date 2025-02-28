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
    sender TEXT,
    receiver TEXT,
    message TEXT,
    FOREIGN KEY (sender) REFERENCES users(email),
    FOREIGN KEY (receiver) REFERENCES users(email)
);

CREATE TABLE log_in_users (
    token TEXT PRIMARY KEY,
    email TEXT,
    FOREIGN KEY (email) REFERENCES users(email)
);


