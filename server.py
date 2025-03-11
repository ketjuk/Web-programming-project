from flask import Flask, request, jsonify, g, send_from_directory
from flask_sock import Sock
from database_handler import init_db
import database_handler as db
import uuid  # 用于生成token

app = Flask(__name__, static_folder='static')
sock = Sock(app)

# 初始化数据库
init_db()

# 存储 WebSocket 连接
sockets = {}


@app.teardown_request
def teardown(exception):
    db.disconnect()


@app.teardown_appcontext
def close_connection(exception):
    # 应用上下文结束后断开数据库连接
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


@app.route('/', methods=['GET'])
def send_welcome_page():
    return send_from_directory('static', 'client.html')


@app.route('/client.html', methods=['GET'])
def send_client_html():
    return send_from_directory('static', 'client.html')


@app.route('/client.css', methods=['GET'])
def send_client_css():
    return send_from_directory('static', 'client.css')


@app.route('/client.js', methods=['GET'])
def send_client_js():
    return send_from_directory('static', 'client.js')


@app.route('/WechatIMG475.jpg', methods=['GET'])
def send_WechatIMG475_jpg():
    return send_from_directory('static', 'WechatIMG475.jpg')


@app.route('/profileView.html', methods=['GET'])
def send_profileView_html():
    return send_from_directory('static', 'profileView.html')


@app.route('/favicon.ico', methods=['GET'])
def send_favicon_ico():
    return send_from_directory('static', 'favicon.ico')


@app.route('/stylesForCertainView.css', methods=['GET'])
def send_stylesForCertainView_css():
    return send_from_directory('static', 'stylesForCertainView.css')


@app.route('/profileScript.js', methods=['GET'])
def send_profileScript_js():
    return send_from_directory('static', 'profileScript.js')


@app.route('/sign_in', methods=['POST'])
# 登录获取Token
# 客户端首先需要通过登录接口获取Token，登录成功后，服务器会返回一个包含Token的响应
def sign_in():
    # 从请求中获取email和password
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # 从数据库中查找用户
    user = db.get_user_by_email(username)

    if user and user[1] == password:
        logout_user(username)
        token = str(uuid.uuid4())  # 生成唯一token
        #New: Remove any existing tokens for the user
        #db.delete_token(username)
        """tokens[token] = username # 将token和email关联起来，并存储在tokens字典中"""
        db.insert_token(username, token)
        # 存储新的 WebSocket 连接
        # sockets[username] = ws  # 无法在此处访问 ws 对象

        return jsonify({"success": True, "message": "Successfully signed in.", "data": token})
    else:
        return jsonify({"success": False, "message": "Wrong username or Wrong password."})



@app.route('/sign_up', methods=['POST'])
def sign_up():
    data = request.get_json()  # 从请求中获取JSON数据
    required_fields = ['email', 'password', 'firstname', 'familyname', 'gender', 'city', 'country']
    email = data.get('email')
    password = data.get('password')
    firstname = data.get('firstname')
    familyname = data.get('familyname')
    gender = data.get('gender')
    city = data.get('city')
    country = data.get('country')

    if email == None or firstname == None or familyname == None or gender == None or city == None or country == None or password == None:
        return jsonify({"success": False, "message": "user information is blank."})

    if " " in email:
        return jsonify({"success": False, "message": "illegal email."})
    if not isinstance(email, str):
        return jsonify({"success": False, "message": "illegal email."})
    if '@' not in email or '.com' not in email:
        return jsonify({"success": False, "message": "illegal email."})
    parts = email.split('@')
    if len(parts) != 2 or not parts[1].endswith('.com'):
        return jsonify({"success": False, "message": "illegal email."})
    if not parts[1][:-4]:  # 检查 @ 和 .com 之间是否有内容
        return jsonify({"success": False, "message": "illegal email."})

    if all(field in data for field in required_fields):
        if len(data['password']) < 8:  # 假设密码最小长度为8位
            return jsonify({"success": False, "message": "Password too short."})

        if db.get_user_by_email(data['email']):
            return jsonify({"success": False, "message": "User already exists."})

        db.insert_user(**{field: data[field] for field in required_fields})
        return jsonify({"success": True, "message": "Successfully signed up."})
    else:
        return jsonify({"success": False, "message": "Missing required fields."})


@app.route('/sign_out', methods=['DELETE'])
def sign_out():
    # 客户端需要在后续的请求中将这个Token包含在请求头中，以证明自己的身份
    token = request.headers.get('Authorization')  # 从请求头中获取token

    # 验证token是否有效
    if db.verify_token(token):
        email = db.get_email_by_token(token)
        db.delete_token(email)  # 删除内存中的token（使其失效），用户需要重新登录
        return jsonify({"success": True, "message": "Successfully signed out."})
    else:
        return jsonify({"success": False, "message": "Invalid token."})


@app.route('/change_password', methods=['PUT'])
# 在请求中使用Token
# 客户端在后续请求中需要将Token包含在请求头中，如下面的更改密码：
def change_password():
    token = request.headers.get('Authorization')  # 从请求头中获取token
    data = request.get_json()  # 从请求中获取JSON数据
    print(token, data)

    if data['oldpassword'] == None or data['newpassword'] == None:
        return jsonify({"success": False, "message": "password is empty."})

    # 验证token是否有效
    if db.verify_token(token):
        email = db.get_email_by_token(token)  # 获取与token关联的email
    else:
        return jsonify({"success": False, "message": "Invalid token."})

    user = db.get_user_by_email(email)  # 从数据库中获取用户信息

    if user[1] != data['oldpassword']:
        return jsonify({"success": False, "message": "Wrong password."})

    if len(data['newpassword']) < 6:  # 假设密码最小长度为6
        return jsonify({"success": False, "message": "New password too short."})

    db.update_password(email, data['newpassword'])  # 更新密码
    return jsonify({"success": True, "message": "Password changed."})


@app.route('/get_user_data_by_token', methods=['GET'])
def get_user_data_by_token():
    token = request.headers.get('Authorization')  # 从请求头中获取token
    if token == None:
        return jsonify({"success": False, "message": "No token is added."})
    if db.verify_token(token):
        email = db.get_email_by_token(token)
    else:
        return jsonify({"success": False, "message": "Invalid token."})
    user = db.get_user_by_email(email)  # 从数据库中获取用户信息
    if (user):
        user_json = {
            "email": user[0],
            "firstname": user[2],
            "familyname": user[3],
            "gender": user[4],
            "city": user[5],
            "country": user[6],
        }
        return jsonify({"success": True, "user": user_json})
    else:
        return jsonify({"success": False, "message": "User not found."})


@app.route('/get_user_data_by_email/<email>', methods=['GET'])
def get_user_data_by_email(email):
    token = request.headers.get('Authorization')  # 从请求头中获取token
    if db.verify_token(token):
        token_email = db.get_email_by_token(token)
    else:
        return jsonify({"success": False, "message": "Invalid token."})
    """if(token_email == email):
        user = db.get_user_by_email(email) # 从数据库中获取用户信息
    else:
        return jsonify({"success": False, "message": "email does not match."})"""
    if email == None or token == None:
        return jsonify({"success": False, "message": "email or token is empty."})
    user = db.get_user_by_email(email)
    if (user):
        user_json = {
            "email": user[0],
            "firstname": user[2],
            "familyname": user[3],
            "gender": user[4],
            "city": user[5],
            "country": user[6],
        }
        return jsonify({"success": True, "user": user_json})
    else:
        return jsonify({"success": False, "message": "User not found."})


@app.route('/get_user_messages_by_token', methods=['GET'])
def get_user_messages_by_token():
    token = request.headers.get('Authorization')  # 从请求头中获取token
    if db.verify_token(token):
        email = db.get_email_by_token(token)
    else:
        return jsonify({"success": False, "message": "Invalid token."})
    message = db.get_user_messages(email)
    if not message:
        return jsonify({"success": False, "message": "Message is empty."})
    else:
        return jsonify({"success": True, "message": message})


@app.route('/get_user_messages_by_email/<email>', methods=['GET'])
def get_user_messages_by_email(email):
    token = request.headers.get('Authorization')  # 从请求头中获取token
    if email == None:
        return jsonify({"success": False, "message": "email is empty."})
    if token == None:
        return jsonify({"success": False, "message": "token is empty."})
    if db.verify_token(token):
        email_token = db.get_email_by_token(token)
    else:
        return jsonify({"success": False, "message": "Invalid token."})
    message = db.get_user_messages(email)
    if not message:
        return jsonify({"success": False, "message": "Message is empty."})
    else:
        return jsonify({"success": True, "message": message})
    
@app.route('/post_message', methods=['POST'])
def post_message():
    token = request.headers.get('Authorization') # 从请求头中获取token
    if db.verify_token(token):
        token_email = db.get_email_by_token(token)
    else:
        return jsonify({"success": False, "message": "Invalid token."})
    data = request.get_json() # 从请求中获取JSON数据
    message = data.get('message')
    receiver = data.get('email')
    sender = db.get_email_by_token(token)
    if not sender:
        return jsonify({"success": False, "message": "sender is invalid."})
    if message == None :
        return jsonify({"success": False, "message": "Message is empty."})
    if receiver == None :
        return jsonify({"success": False, "message": "receiver is empty."})
    if token == None:
        return jsonify({"success": False, "message": "token is empty."})
    if not message:
        return jsonify({"success": False, "message": "Message is empty."})
    user2 = db.get_user_by_email(receiver)
    if not user2:
        return jsonify({"success": False, "message": "invalid email of receiver."})
    db.insert_message(sender,receiver,message)
    return jsonify({"success": True, "message": "Message is sent."})


@sock.route('/ws')
def echo(ws):
    # 获取 token
    token = request.args.get('token')
    if not token or not db.verify_token(token):
        return 'Invalid token'

    email = db.get_email_by_token(token)
    username = email

    # 存储新的连接
    sockets[username] = ws
    try:
        while True:
            data = ws.receive()
            print(f"received {data}")
            ws.send(f"ECHO: {data}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        #db.delete_token(email)  # 移除此行，不在此处删除 token
        del sockets[username]
    finally:
        ws.close() #确保socket关闭

def logout_user(username):
    db.delete_token(username) # 移除token的操作放至websocket连接之前
    if username in sockets: #只有当username存在于sockets的时候才执行后续
        old_ws = sockets[username]
        try:
            old_ws.send('logout')  # 发送注销消息
            old_ws.close()
        except Exception as e:
            print(f"Error during logout: {e}")
        finally:
            del sockets[username]


if __name__ == '__main__':
    app.run(debug=True)
