const messageMap = {
    "wrong_username_or_password": "Wrong username or password.",
    "user_information_is_blank.": "User information is blank.",
    "illegal_email": "Illegal email",
    "password_too_short": "Password too short",
    "user_already_exists": "User already exists",
    "successfully_signed_in": "Successfully signed in",
    "missing_required_fields": "please enter both username and password",
    "successfully_signed_up": "Successfully signed up",
    "method_not_allowed": "method is not allowed",
    "missing_json_data": "missing data",
    "internal_server_error": "something wrong with the server",
    "email_missing": "please input the email address",
    "email_send_failed": "failed to send email",
    "user_does_not_exist": "user does not exist"
  };

function sendPostRequest(url, data, callback) {
    var xhr = new XMLHttpRequest();
    url = "http://MyTwidder-env2.eba-gpcgmqze.eu-north-1.elasticbeanstalk.com" + url;
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = function () {
        var responseData;
        try {
            responseData = JSON.parse(xhr.responseText);
        } catch (e) {
            callback(new Error('Invalid JSON response'), null);
            return;
        }

        // 检查 "success" 字段
        if (xhr.status >= 200 && xhr.status < 300) {
            // 请求成功
            responseData = JSON.parse(xhr.responseText);
            callback(null, responseData); // 调用回调函数，传递 null 作为错误
        } else {
            // 请求失败，传递错误信息
            const errorMessage = messageMap[responseData.message] || 'Request failed';
            callback(new Error(errorMessage), null);
        }
    };

    xhr.onerror = function () {
        callback(new Error('Request error'), null); // 传递错误信息
    };

    xhr.send(JSON.stringify(data));
}



function validateSignupForm() {
    const password = document.getElementById('signup-password').value;
    const repeatPassword = document.getElementById('repeat-password').value;
    const minLength = 8;

    const feedbackArea = document.getElementById('signup-feedback');

    if (password.length < minLength) {
        feedbackArea.textContent = `You have to set the password more than ${minLength} digits`;
        return false;
    }

    if (password !== repeatPassword) {
        feedbackArea.textContent = 'The password do not match';
        return false;
    }

    else {
        feedbackArea.textContent = 'Successfully signed up';
        return true;
    }

}

function submitSignup(event) {
    event.preventDefault(); // 阻止表单默认提交行为
    const feedbackArea = document.getElementById('signup-feedback');
    const email = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    const firstname = document.getElementById('First-name').value;
    const familyname = document.getElementById('Family-name').value;
    const gender = document.getElementById('signup-gender').value;
    const city = document.getElementById('signup-city').value;
    const country = document.getElementById('signup-country').value;

    if (validateSignupForm() === false) {
        return false;
    }

    const inputObject = {
        email: email, password: password, firstname: firstname, familyname: familyname, gender: gender, city: city, country: country
    };

    //const result = serverstub.signUp(inputObject);
    sendPostRequest("/sign_up", inputObject, function (error, responseData) {
        if (error != null) {
            feedbackArea.textContent = error;
        }
        else {
            feedbackArea.textContent = messageMap[responseData.message];
        }
    });

    //return responseData.success;
}

function submitLogin(event) {
    event.preventDefault(); // 阻止表单默认提交行为

    const feedbackArea = document.getElementById('login-feedback');
    const email = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    let data = { username: email, password: password };

    sendPostRequest("/sign_in", data, function (error, result) {
        if (error != null) {
            let feedbackArea = document.getElementById('login-feedback');
            if (feedbackArea) {
                feedbackArea.textContent = error;
            }
        }
        else {
            const token = result.data.token;
            const secretKey = result.data.secret_key;

            sessionStorage.setItem('userToken', token);
            sessionStorage.setItem('userSecretKey', secretKey);
            sessionStorage.setItem('userEmail', email);

            window.location.href = 'profileView.html';
        }
    });

}

function handleForgotPassword(event) {
    const emailInput = document.getElementById('login-username');
    const email = emailInput.value.trim();
    
    if (!emailInput) {
        const feedback = document.getElementById('login-feedback');
        feedback.textContent = 'Please enter email address first';
        return;
    }
    
    let data = { email: email};

    sendPostRequest('/reset_password', data, function (error, result) {
        const feedback = document.getElementById('login-feedback');
        if (error) {
            feedback.textContent = error;
        } else {
            feedback.textContent = 'Password reset email sent';
        }
    });
}

//在现有的代码中添加建立websocket连接的函数
function connectWebSocket() {
    const token = sessionStorage.getItem('userToken');

    if (token) {
        const ws = new WebSocket(`ws://MyTwidder-env2.eba-gpcgmqze.eu-north-1.elasticbeanstalk.com/ws?token=${token}`);
        //const ws = new WebSocket(`ws://127.0.0.1:5000/ws?token=${token}`);

        ws.onopen = () => {
            console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
            console.log(`Received: ${event.data}`);
            if (event.data === 'logout') {
                // 清除 sessionStorage
                sessionStorage.removeItem('userToken');
                sessionStorage.removeItem('userEmail');
                // 重定向到欢迎页面
                window.location.href = 'client.html';
            }
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
        };

        ws.onerror = (error) => {
            console.error(`WebSocket error: ${error}`);
        };
    } else {
        // 如果没有 token，重定向到登录页面
        console.log("No token found, redirecting to login page");
        window.location.href = 'client.html';
    }
}

//window.onload = connectWebSocket;
