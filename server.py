from flask import Flask, request, jsonify, abort, g, send_from_directory
from flask_sock import Sock
from flask_bcrypt import Bcrypt
from database_handler import init_db
from datetime import datetime, timezone
import database_handler as db
import uuid 
import hmac
import hashlib
import time
import secrets
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from cryptography.hazmat.backends import default_backend
import base64


app = Flask(__name__, static_folder='static')
sock = Sock(app)
bcrypt = Bcrypt(app)

#initialize the database
init_db()

#save WebSocket connections
sockets = {}


@app.teardown_request
def teardown(exception):
    db.disconnect()


@app.teardown_appcontext
def close_connection(exception):
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

#   a function specially for verify the authantication of user with timestamp and signature
def verify_request(request):
    token = request.headers.get("Authorization")
    timestamp = request.headers.get("Timestamp")
    signature_b64 = request.headers.get("Signature")

    if not all([token, timestamp, signature_b64]):
        return jsonify({"message": "missing_required_authorization"}), 400

    #the valid period for timestamp is 5 minutes
    if abs(time.time() - float(timestamp)) > 300:
        return jsonify({"message": "timestamp_expired"}), 401

    #require public key from database
    public_pem = db.get_secret_key_by_token(token)
    public_key = load_pem_public_key(public_pem.encode())

    data_to_verify = f"timestamp={timestamp}".encode()
    #verify the signature
    try:
        signature = base64.b64decode(signature_b64)
        public_key.verify(
            signature,
            data_to_verify,
            padding.PKCS1v15(),
            hashes.SHA256()
        )
    except Exception as e:
        return jsonify({"message": "invalid_signature"}), 401
    
    return None


# /sign_in by POST
#   authenticates the user name by the provided password
#   input   :   email (username), password
#   return  :   200 with token and private key
#               400 when request does not carry with data, or username and password are missing
#               401 when username and password are not match
#               405 when method is not allowed
#               500 when unknown error has been throw
@app.route('/sign_in', methods=['POST'])
def sign_in():
    if request.method != 'POST':
        return jsonify({"message": "method_not_allowed"}), 405
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "missing_json_data"}), 400
        
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"message": "missing_required_fields"}), 400
        user = db.get_user_by_email(username)

        if user and bcrypt.check_password_hash(user[1], password):
            logout_user(username)
            token = str(uuid.uuid4())  # generate an unique token
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
                backend=default_backend()
            )

            public_key = private_key.public_key()
            public_pem = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ).decode('utf-8')
            public_pem = public_key.public_bytes(encoding=serialization.Encoding.PEM, format=serialization.PublicFormat.SubjectPublicKeyInfo).decode("utf-8")
            #New: Remove any existing tokens for the user
            db.insert_token(email=username,token=token,secret_key=public_pem)
            
            private_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ).decode('utf-8')

            return jsonify({"message": "successfully_signed_in", "data": {"token": token,"secret_key": private_pem}}), 200
        else:
            return jsonify({"message": "wrong_username_or_password"}), 401
        
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"message": "internal_server_error"}), 500


# /reset_password by POST
#   send an email with randomly generated password to user
#   input   :   email
#   return  :   200 when successfully send the email
#               401 when email is missing of user is not found by email
#               405 when method is not allowed
#               500 when unknown error has been throw
@app.route('/reset_password', methods=['POST'])
def reset_password():
    if request.method != 'POST':
        return jsonify({"message": "method_not_allowed"}), 405

    userData = request.get_json()
    email = userData.get('email')
    if not email:
        return jsonify({"message": "email_missing"}), 401
    if not db.get_user_by_email(email):
        return jsonify({"message": "user_does_not_exist"}), 401

    new_password = secrets.token_urlsafe(8)
    hashed_password = bcrypt.generate_password_hash(new_password).decode('utf-8')
    db.update_password(email, hashed_password)
    SMTP_SERVER = "smtp.gmail.com"
    SMTP_PORT = 587
    SMTP_USERNAME = "suyiakdhfbeks@gmail.com"
    SMTP_PASSWORD = "advblwvqveqarwhj"

    try:
        #prepare the email content
        msg = MIMEText(f"Your new password is: {new_password}")
        msg["Subject"] = "Reset Password"
        msg["From"] = SMTP_USERNAME
        msg["To"] = email

        #send the email
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()  #set up TLS encryption
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(SMTP_USERNAME, email, msg.as_string())
        server.quit()

        return jsonify({"message": "password_reset_successful"}), 200
    except Exception as e:
        return jsonify({"message": "email_send_failed", "error": str(e)}), 500


# /sign_up by POST
#   registers a new user in the database
#   input   :   email, password, firstname, familyname, gender, city, country
#   return  :   201 when    successfully sign up
#               400 when    either of the inputs is missing
#                           there are spaces in email address
#                           email address is not a string
#                           @ or .com is not exist in email address
#                           email address is divided by @, and end by .com
#                           password is less than 8 digits
#               405 when    method is not allowed
#               409 when    user already exists
#               500 when    unknown error has been throw
@app.route('/sign_up', methods=['POST'])
def sign_up():
    if request.method != 'POST':
        return jsonify({"message": "method_not_allowed"}), 405
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "missing_json_data"}), 400
    
        required_fields = ['email', 'password', 'firstname', 'familyname', 'gender', 'city', 'country']
        email = data.get('email')
        password = data.get('password')
        firstname = data.get('firstname')
        familyname = data.get('familyname')
        gender = data.get('gender')
        city = data.get('city')
        country = data.get('country')

        if not all([email, password, firstname, familyname, gender, city, country]):
            return jsonify({"message": "illegal_email"}), 400

        if " " in email:
            return jsonify({"message": "illegal_email"}), 400
        if not isinstance(email, str):
            return jsonify({"message": "illegal_email"}), 400
        if '@' not in email or '.com' not in email:
            return jsonify({"message": "illegal_email"}), 400
        parts = email.split('@')
        if len(parts) != 2 or not parts[1].endswith('.com'):
            return jsonify({"message": "illegal_email"}), 400
        if not parts[1][:-4]:  # check if there are spaces between @ and .com
            return jsonify({"message": "illegal_email"}), 400

        if len(data['password']) < 8:  # password should not be less than 8 digits
            return jsonify({"message": "password_too_short"}), 400

        if db.get_user_by_email(data['email']):
            return jsonify({"message": "user_already_exists"}), 409
        
        password = bcrypt.generate_password_hash(password).decode('utf-8')
        data['password'] = password

        db.insert_user(**{field: data[field] for field in required_fields})
        return jsonify({"message": "successfully_signed_up"}), 201
    
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"message": "internal_server_error"}), 500


# /sign_out by DELETE
#   signs out a user from the system
#   input   :   token
#   return  :   200 when successfully sign out
#               405 when method is not allowed
#               500 when unknown error has been throw
@app.route('/sign_out', methods=['DELETE'])
def sign_out():
    if request.method != 'DELETE':
        return jsonify({"message": "method_not_allowed"}), 405
    
    try:
        error_response = verify_request(request)
        if error_response:
            return error_response
        
        token = request.headers.get('Authorization')
        email = db.get_email_by_token(token)
        db.delete_token(email)  # delete token in the database
        return jsonify({"message": "successfully_signed_out"}), 200
        
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"message": "internal_server_error"}), 500
    

# /change_password by PUT
#   changes the password of the current user to a new one
#   input   :   token
#               oldpassword (the old password of the current user)
#               newpassword (the new password)
#   return  :   200 when password successfully changed
#               400 when passwords are empty or new password is too short
#               401 when old password is wrong
#               405 when method is not allowed
#               500 when unknown error has been throw
@app.route('/change_password', methods=['PUT'])
def change_password():
    if request.method != 'PUT':
        return jsonify({"message": "method_not_allowed"}), 405
    
    try:
        error_response = verify_request(request)
        if error_response:
            return error_response
        
        token = request.headers.get('Authorization')
        data = request.get_json()
        print(token, data)

        if data['oldpassword'] == None or data['newpassword'] == None:
            return jsonify({"message": "password is empty"}), 400
        
        email = db.get_email_by_token(token)
        user = db.get_user_by_email(email)

        if not bcrypt.check_password_hash(user[1], data['oldpassword']):
            return jsonify({"message": "wrong_password"}), 401

        if len(data['newpassword']) < 6:  #new password should be no less than 6 digits
            return jsonify({"message": "new_password_too_short"}), 400
        
        encrypted_password = bcrypt.generate_password_hash(data['newpassword']).decode('utf-8')

        db.update_password(email, encrypted_password)
        return jsonify({"message": "password_changed"}), 200
    
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"message": "internal_server_error"}), 500


# /get_user_data_by_token by GET
#   retrieves the stored data for the user whom the passed token is issued for.
#   The currently signed in user can use this method to retrieve all its own information from the server.
#   input   :   token
#   return  :   200 with a json string contains email, firstname, familyname, gender, city, country
#               404 when user is not found
#               405 when method is not allowed
#               500 when unknown error has been throw
@app.route('/get_user_data_by_token', methods=['GET'])
def get_user_data_by_token():
    if request.method != 'GET':
        return jsonify({"message": "method_not_allowed"}), 405
    try:
        error_response = verify_request(request)
        if error_response:
            return error_response
        
        token = request.headers.get('Authorization')
        email = db.get_email_by_token(token)
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
            return jsonify({"user": user_json}), 200
        else:
            return jsonify({"message": "user_not_found"}), 404
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"message": "internal_server_error"}), 500


# /get_user_data_by_email/<email> by GET
#   retrieves the stored data for the user specified by the passed email address.
#   input   :   token, email
#   return  :   200 with a json string contains email, firstname, familyname, gender, city, country
#               400 when email is empty
#               404 when user is not found
#               405 when method is not allowed
#               500 when unknown error has been throw
@app.route('/get_user_data_by_email/<email>', methods=['GET'])
def get_user_data_by_email(email):
    if request.method != 'GET':
        return jsonify({"message": "method_not_allowed"}), 405
    
    try:
        error_response = verify_request(request)
        if error_response:
            return error_response
        
        if email == None:
            return jsonify({"message": "empty_email"}), 400
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
            return jsonify({"user": user_json}), 200
        else:
            return jsonify({"message": "user_not_found"}), 404
        
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"message": "internal_server_error"}), 500


# /get_user_messages_by_token by GET
#   retrieves the stored messagesfor the user whom the passed token is issued for.
#   The currently signed in user canuse this method to retrieve all its own messages from the server.
#   input   :   token
#   return  :   200 with return the message array
#               404 when no message is found
#               405 when method is not allowed
#               500 when unknown error has been throw
@app.route('/get_user_messages_by_token', methods=['GET'])
def get_user_messages_by_token():
    if request.method != 'GET':
        return jsonify({"message": "method_not_allowed"}), 405

    try:
        error_response = verify_request(request)
        if error_response:
            return error_response
        
        token = request.headers.get('Authorization')
        email = db.get_email_by_token(token)
        message = db.get_user_messages(email)
        if not message:
            return jsonify({"message": "No_messages_found"}), 404
        else:
            return jsonify({"message": message}), 200
        
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"message": "internal_server_error"}), 500



# /get_user_messages_by_email/<email> by GET
#   retrieves the stored messages for the user specified by the passed email address.
#   input   :   token, email
#   return  :   200 with return the message array
#               400 when email is empty
#               404 when no message is found
#               405 when method is not allowed
#               500 when unknown error has been throw
@app.route('/get_user_messages_by_email/<email>', methods=['GET'])
def get_user_messages_by_email(email):
    if request.method != 'GET':
        return jsonify({"message": "method_not_allowed"}), 405
    
    try:
        error_response = verify_request(request)
        if error_response:
            return error_response
        
        token = request.headers.get('Authorization')
        if email == None:
            return jsonify({"message": "empty_email"}), 400
        message = db.get_user_messages(email)
        if not message:
            return jsonify({"message": "No_messages_found"}), 404
        else:
            return jsonify({"message": message}), 200
        
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"message": "internal_server_error"}), 500
    

# /post_message by POST
#   tries to post a message to the wall of the user specified by the email address.
#   input   :    token, messgage, email
#   return  :    201 when message sent successfully
#                401 when sender or receiver is empty
#                400 when message is missing, or receiver is not exist
#                405 when method is not allowed
#                500 when unknown error has been throw
@app.route('/post_message', methods=['POST'])
def post_message():
    if request.method != 'POST':
        return jsonify({"message": "method_not_allowed"}), 405
    
    try:
        error_response = verify_request(request)
        if error_response:
            return error_response
        
        token = request.headers.get('Authorization')
        data = request.get_json() 
        if not data:
            return jsonify({"message": "missing_message_data"}), 400
        
        message = data.get('message')
        receiver = data.get('email')
        sender = db.get_email_by_token(token)
        if not sender:
            return jsonify({"message": "sender_is_empty"}), 401
        if receiver == None :
            return jsonify({"message": "receiver_is_empty"}), 401
        if not message:
            return jsonify({"message": "missing_message"}), 400
        user2 = db.get_user_by_email(receiver)
        if not user2:
            return jsonify({"message": "invalid_receiver_email"}), 400
        db.insert_message(sender,receiver,message)
        return jsonify({"message": "message_sent_successfully"}), 201
    
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"message": "internal_server_error"}), 500


@sock.route('/ws')
def echo(ws):
    token = request.args.get('token')
    if not token or not db.verify_token(token):
        return 'Invalid token'

    email = db.get_email_by_token(token)
    username = email

    #save new connect
    sockets[username] = ws
    try:
        while True:
            data = ws.receive()
            print(f"received {data}")
            ws.send(f"ECHO: {data}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        del sockets[username]
    finally:
        ws.close() #close the socket

def logout_user(username):
    db.delete_token(username) 
    if username in sockets: #when username is in sockets
        old_ws = sockets[username]
        try:
            old_ws.send('logout')  #send log out message
            old_ws.close()
        except Exception as e:
            print(f"Error during logout: {e}")
        finally:
            del sockets[username]


if __name__ == '__main__':
    #app.run(host='0.0.0.0', port=8080)
    app.run(debug=True)
