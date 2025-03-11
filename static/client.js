function sendPostRequest(url, data, callback) {
    var xhr = new XMLHttpRequest();
    url = "http://13.48.106.212:5000" + url;
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = function () {
        // 先解析 JSON 响应
        var responseData = JSON.parse(xhr.responseText);

        // 然后检查 responseData 是否为 null 或 undefined
        if (!responseData) {
            callback(new Error('Response data is null or undefined'), null);
            return;
        }

        // 检查 "success" 字段
        if (responseData.success) {
            // 请求成功
            callback(null, responseData); // 调用回调函数，传递 null 作为错误
        } else {
            // 请求失败，传递错误信息
            callback(new Error(responseData.message || 'Request failed'), null);
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
            feedbackArea.textContent = responseData.message;
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
            const token = result.data;

            sessionStorage.setItem('userToken', token);
            sessionStorage.setItem('userEmail', email);

            window.location.href = 'profileView.html';
        }
    });

}

//在现有的代码中添加建立websocket连接的函数
function connectWebSocket() {
    const token = sessionStorage.getItem('userToken');

    if (token) {
        const ws = new WebSocket(`ws://13.48.106.212:5000/ws?token=${token}`);

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
