from flask import g
import sqlite3

DATABASE_URI = "database.db"

def init_db():
    with sqlite3.connect('database.db') as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND (name='users' OR name='messages' OR name='log_in_users')")
        existing_tables = cursor.fetchall()
        
        if len(existing_tables) < 2:  # if users or messages of log_in_users tables are not exist
            # read and execute schema.sql
            with open('schema.sql', 'r') as f:
                conn.executescript(f.read())
            print("Database initialized with users and messages tables.")
        else:
            print("Tables already exist, skipping initialization.")

        conn.commit()


def disconnect():
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()
        g._database = None
        print("Database connection closed.")

#connect with database
def get_db(): 
    db = getattr(g, '_database', None) 
    if db is None: 
        db = g._database = sqlite3.connect(DATABASE_URI)
    return db

def query_db(query, args=(), one=False): 
    cur = get_db().execute(query, args) 
    rv = cur.fetchall() 
    cur.close() 
    return (rv[0] if rv else None) if one else rv 

def insert_user(email, password, firstname, familyname, gender, city, country):
    query_db('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)', 
             [email, password, firstname, familyname, gender, city, country])
    get_db().commit()

def get_user_by_email(email): 
    return query_db('SELECT * FROM users WHERE email = ?', [email], one=True)

#update new password
def update_password(email, new_password): 
    query_db('UPDATE users SET password = ? WHERE email = ?', [new_password, email]) 
    get_db().commit()

#insert a new message
def insert_message(sender, receiver, message):
    query_db('INSERT INTO messages (sender, receiver, message) VALUES (?, ?, ?)',
             [sender, receiver, message])
    get_db().commit()

#require all the messages (on their wall)
def get_user_messages(email):
    query = '''
        SELECT messages.*, users.firstname, users.familyname
        FROM messages
        JOIN users ON messages.sender = users.email
        WHERE messages.receiver = ?
        ORDER BY messages.id;
    '''
    return query_db(query, [email])

#get all message sent by user through email
def get_user_sent_messages(email):
    query = '''
        SELECT messages.*, users.firstname, users.familyname
        FROM messages
        JOIN users ON messages.receiver = users.email
        WHERE messages.sender = ?
        ORDER BY messages.id;
    '''
    return query_db(query, [email])

def get_session_by_token(token):
    query = 'SELECT email, secret_key FROM log_in_users WHERE token = ?'
    return query_db(query, [token], one=True)

def get_secret_key_by_token(token):
    session = get_session_by_token(token)
    return session[1] if session else None

def get_token_by_email(email): 
    return query_db('SELECT * FROM log_in_users WHERE email = ?', [email], one=True)

def get_email_by_token(token):
    query = 'SELECT email FROM log_in_users WHERE token = ?'
    result = query_db(query, [token], one=True)
    return result[0] if result else None

def verify_token(token):
    query = 'SELECT EXISTS(SELECT 1 FROM log_in_users WHERE token = ? LIMIT 1)'
    result = query_db(query, [token], one=True)
    return bool(result[0]) if result else False

def insert_token(email, token, secret_key):
    query = 'REPLACE INTO log_in_users (email, token, secret_key) VALUES (?, ?, ?)'
    query_db(query, [email, token, secret_key])
    get_db().commit()


def delete_token(email):
    query_db('DELETE FROM log_in_users WHERE email = ?', [email])
    get_db().commit()

def delete_all_tokens():
    query_db('DELETE FROM log_in_users')
    get_db().commit()
