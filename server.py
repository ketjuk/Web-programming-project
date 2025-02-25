from flask import Flask, request, jsonify, g
from database_handler import init_db
import database_handler as db
import uuid # 用于生成token

app = Flask(__name__)


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
def root():
    return 'hello students!'

@app.route('/contact', methods=['POST'])
def create_contact():
    try:
        data = request.get_json()
        if data is not None:
            if 'name' in data and 'number' in data and len(data['name'])<64 and len(data['number'])<64:
                db.creare_contact(data['name'],data['number'])
                return data, 201
            else:
                return "", 400
        else:
            return "", 400
    except:
        return "", 500


@app.route('/contact/<name>', methods=['GET'])
def read_contact(name):
    if len(name) < 64:
        # 从数据库中读取联系人信息
        contacts = db.read_contact(name)
        return jsonify(contacts), 200 # 返回联系人信息和status code 200
    else:
        return "", 400 # 如果name长度大于64，返回400错误


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
        token = str(uuid.uuid4()) # 生成唯一token
        """tokens[token] = username # 将token和email关联起来，并存储在tokens字典中"""
        db.insert_token(username,token)
        return jsonify({"success": True, "message": "Successfully signed in.", "data": token})
    else:
        return jsonify({"success": False, "message": "Wrong username or Wrong password."})
    


@app.route('/sign_up', methods=['POST']) 
def sign_up():
    data = request.get_json() # 从请求中获取JSON数据
    required_fields = ['email', 'password', 'firstname', 'familyname', 'gender', 'city', 'country']
    email = data.get('email')
    password = data.get('password')
    firstname = data.get('firstname')
    familyname = data.get('familyname')
    gender = data.get('gender')
    city = data.get('city')
    country = data.get('country')

    if email==None or firstname==None or familyname==None or gender==None or city==None or country==None or password==None:
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
        if len(data['password']) < 8: # 假设密码最小长度为8位
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
    token = request.headers.get('Authorization') # 从请求头中获取token
    
    # 验证token是否有效
    if db.verify_token(token):
        email = db.get_email_by_token(token)
        db.delete_token(email) # 删除内存中的token（使其失效），用户需要重新登录
        return jsonify({"success": True, "message": "Successfully signed out."})
    else:
        return jsonify({"success": False, "message": "Invalid token."})


@app.route('/change_password', methods=['PUT'])
# 在请求中使用Token 
# 客户端在后续请求中需要将Token包含在请求头中，如下面的更改密码：
def change_password():
    token = request.headers.get('Authorization') # 从请求头中获取token
    data = request.get_json() # 从请求中获取JSON数据
    print(token,data)

    if data['oldpassword']==None or data['newpassword']==None:
        return jsonify({"success": False, "message": "password is empty."})
    
    # 验证token是否有效
    if db.verify_token(token):
        email = db.get_email_by_token(token) # 获取与token关联的email
    else:
        return jsonify({"success": False, "message": "Invalid token."})
    
    user = db.get_user_by_email(email) # 从数据库中获取用户信息
    
    if user[1] != data['oldpassword']:
        return jsonify({"success": False, "message": "Wrong password."})
    
    if len(data['newpassword']) < 6:  # 假设密码最小长度为6
        return jsonify({"success": False, "message": "New password too short."})
    
    db.update_password(email, data['newpassword']) # 更新密码
    return jsonify({"success": True, "message": "Password changed."})    

@app.route('/get_user_data_by_token', methods=['GET'])
def get_user_data_by_token():
    token = request.headers.get('Authorization') # 从请求头中获取token
    if token == None:
        return jsonify({"success": False, "message": "No token is added."})
    if db.verify_token(token):
        email = db.get_email_by_token(token)
    else:
        return jsonify({"success": False, "message": "Invalid token."})
    user = db.get_user_by_email(email) # 从数据库中获取用户信息
    if(user):
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
    token = request.headers.get('Authorization') # 从请求头中获取token
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
    if(user):
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
    token = request.headers.get('Authorization') # 从请求头中获取token
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
    token = request.headers.get('Authorization') # 从请求头中获取token
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
    data = request.get_json() # 从请求中获取JSON数据
    message = data.get('message')
    email = data.get('email')
    if message == None :
        return jsonify({"success": False, "message": "Message is empty."})
    if email == None :
        return jsonify({"success": False, "message": "email is empty."})
    if token == None:
        return jsonify({"success": False, "message": "token is empty."})
    if not message:
        return jsonify({"success": False, "message": "Message is empty."})
    if db.verify_token(token):
        token_email = db.get_email_by_token(token)
    else:
        return jsonify({"success": False, "message": "Invalid token."})
    user = db.get_user_by_email(email)
    if not user:
        return jsonify({"success": False, "message": "invalid email."})
    db.insert_message(email,message)
    return jsonify({"success": True, "message": "Message is sent."})


# 检查文件是否被直接执行
if __name__ == '__main__':
    init_db()  # 初始化数据库
    app.debug = True  # 启用调试模式
    app.run(port=5001)  # 运行应用，监听5001端口