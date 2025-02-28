from flask import g
import sqlite3

DATABASE_URI = "database.db"

def init_db():
    with sqlite3.connect('database.db') as conn:
        cursor = conn.cursor()
        
        # 检查表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND (name='users' OR name='messages' OR name='log_in_users')")
        existing_tables = cursor.fetchall()
        
        if len(existing_tables) < 2:  # 如果users或messages表不存在
            # 从schema.sql文件读取并执行SQL语句
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

# 连接数据库，如果没有连接，则连接数据库
def get_db(): 
    db = getattr(g, '_database', None) 
    if db is None: 
        db = g._database = sqlite3.connect(DATABASE_URI)
    return db

# 执行数据库查询，并返回查询结果
def query_db(query, args=(), one=False): 
    cur = get_db().execute(query, args) 
    rv = cur.fetchall() # 获取所有查询结果
    cur.close() 
    return (rv[0] if rv else None) if one else rv # 返回查询结果

# 将新的用户插入到数据库中
def insert_user(email, password, firstname, familyname, gender, city, country): # 插入用户
    query_db('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)', 
             [email, password, firstname, familyname, gender, city, country])
    get_db().commit() # 提交事务

# 通过email获取用户
def get_user_by_email(email): 
    return query_db('SELECT * FROM users WHERE email = ?', [email], one=True)

# 更新密码
def update_password(email, new_password): 
    query_db('UPDATE users SET password = ? WHERE email = ?', [new_password, email]) 
    get_db().commit() # 提交事务

#存储新消息
def insert_message(sender, receiver, message): # 插入消息
    query_db('INSERT INTO messages (sender, receiver, message) VALUES (?, ?, ?)',
             [sender, receiver, message])
    get_db().commit()

# 获取用户收到的所有消息 (on their wall)
def get_user_messages(email):
    query = '''
        SELECT messages.*, users.firstname, users.familyname
        FROM messages
        JOIN users ON messages.sender = users.email
        WHERE messages.receiver = ?
        ORDER BY messages.id;
    '''
    return query_db(query, [email])

#通过email获取用户发送的所有消息
def get_user_sent_messages(email):
    query = '''
        SELECT messages.*, users.firstname, users.familyname
        FROM messages
        JOIN users ON messages.receiver = users.email
        WHERE messages.sender = ?
        ORDER BY messages.id;
    '''
    return query_db(query, [email])

def get_token_by_email(email): 
    return query_db('SELECT * FROM log_in_users WHERE email = ?', [email], one=True)

def get_email_by_token(token):
    query = 'SELECT email FROM log_in_users WHERE token = ?'
    result = query_db(query, [token], one=True)
    if result:
        return result[0]
    return None

def verify_token(token):
    query = 'SELECT EXISTS(SELECT 1 FROM log_in_users WHERE token = ? LIMIT 1)'
    result = query_db(query, [token], one=True)
    return bool(result[0]) if result else False


def insert_token(email, token):
    query_db('REPLACE INTO log_in_users (email, token) VALUES (?, ?)',
             [email, token])
    get_db().commit()


def delete_token(email):
    query_db('DELETE FROM log_in_users WHERE email = ?', [email])
    get_db().commit()