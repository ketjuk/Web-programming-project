const messageMap2 = {
    "successfully_signed_out": "successfully signed out",
    "invalid_token": "token is invalid",
    "missing_required_authorization": "token or timestamp or received_hmac is missing",
    "wrong_password": "password is wrong",
    "new_password_too_short": "new password is too short",
    "password_changed": "password successfully changed",
    "user_not_found": "user is not found",
    "empty_email": "email is empty",
    "No_messages_found": "no messages are found",
    "missing_message_data": "data is missing",
    "sender_is_empty": "sender is missing",
    "receiver_is_empty": "receiver is missing",
    "missing_message": "message is missing",
    "invalid_receiver_email": "receiver email is invalid",
    "message_sent_successfully": "message successfully sent",
    "method_not_allowed": "method is not allowed",
    "missing_json_data": "missing data",
    "internal_server_error": "something wrong with the server",
    "timestamp_expired": "time is expired",
    "invalid_signature": "signature is invalid",
    "invalid_timestamp": "time is invalid"
};

function pemToArrayBuffer(pem) {
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const pemContents = pem
        .replace(pemHeader, '')
        .replace(pemFooter, '')
        .replace(/\n/g, '')
        .trim();

    // Base64 decode to ArrayBuffer
    return Uint8Array.from(atob(pemContents), c => c.charCodeAt(0)).buffer;
}

// ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

async function generateSimpleHMAC() {
    const privateKeyPem = sessionStorage.getItem('userSecretKey');
    if (!privateKeyPem) {
        console.error('Secret key not found');
        return null;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const data = `timestamp=${timestamp}`;

    const rsa = KEYUTIL.getKey(privateKeyPem); 
    const sig = new KJUR.crypto.Signature({ alg: 'SHA256withRSA' });
    sig.init(rsa);
    sig.updateString(data);
    const signatureHex = sig.sign();
    const signatureB64 = hextob64(signatureHex);

    return { signature: signatureB64, timestamp: timestamp };
}

async function sendSecureRequest(method, url, data, callback) {
    const token = sessionStorage.getItem('userToken');
    if (!token) {
        callback(new Error('User not logged in'), null);
        return;
    }

    // generate the signature (function's name remains to be Hmac)
    const signatureData = await generateSimpleHMAC();
    if (!signatureData) {
        callback(new Error('HMAC generation failed'), null);
        return;
    }

    const xhr = new XMLHttpRequest();
    let fullUrl = 'http://MyTwidder-env2.eba-gpcgmqze.eu-north-1.elasticbeanstalk.com' + url;
    //let fullUrl =  url;
    // GET 请求处理 URL 参数
    if (method === 'GET' && data) {
        const params = new URLSearchParams(data).toString();
        fullUrl += `?${params}`;
    }

    xhr.open(method, fullUrl, true);
    xhr.setRequestHeader('Authorization', token);
    xhr.setRequestHeader('Signature', signatureData.signature);
    xhr.setRequestHeader('Timestamp', signatureData.timestamp);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = function() {
        try {
            const responseData = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
                callback(null, responseData);
            } else {
                const errorMessage = messageMap2[responseData.message] || 'Request failed';
                callback(new Error(errorMessage), null);
            }
        } catch (e) {
            callback(new Error('Invalid JSON response'), null);
        }
    };

    xhr.onerror = function() {
        callback(new Error('Request error'), null);
    };

    // 发送数据（GET/DELETE 无 body）
    if (method === 'POST' || method === 'PUT') {
        xhr.send(JSON.stringify(data));
    } else {
        xhr.send();
    }
}

// 专用请求函数（调用通用函数）
function sendPostRequest(url, data, callback) {
    sendSecureRequest('POST', url, data, callback);
}

function sendGetRequest(url, data, callback) {
    sendSecureRequest('GET', url, data, callback);
}

function sendPutRequest(url, data, callback) {
    sendSecureRequest('PUT', url, data, callback);
}

function sendDeleteRequest(url, callback) {
    sendSecureRequest('DELETE', url, null, callback);
}

document.addEventListener('DOMContentLoaded', function() {
    let token = sessionStorage.getItem('userToken');
    let feedbackArea = document.getElementById('login-feedback2');
    let ws;
    if (token) {
        ws = new WebSocket(`ws://MyTwidder-env2.eba-gpcgmqze.eu-north-1.elasticbeanstalk.com/ws?token=${token}`);
        //ws = new WebSocket(`ws://127.0.0.1:5000/ws?token=${token}`);

        ws.onopen = () => {
            console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
            console.log(`Received: ${event.data}`);
            if (event.data === 'logout') {
                // 清除 sessionStorage
                sessionStorage.removeItem('userToken');
                sessionStorage.removeItem('userEmail');
                sessionStorage.removeItem('userSecretKey');
                // 重定向到欢迎页面
                window.location.href = '/client.html';
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
    
    function showUserProfile() {
        sendGetRequest("/get_user_data_by_token", null, function(error, result) {
            if(error != null) {
                if (feedbackArea) {
                    feedbackArea.innerHTML = error;
                }
            }
            else {
                let userInfo = result.user;
                document.getElementById('userData').innerHTML = `
                <p><strong>Email:</strong> ${userInfo.email}</p>
                <p><strong>First Name:</strong> ${userInfo.firstname}</p>
                <p><strong>Last Name:</strong> ${userInfo.familyname}</p>
                <p><strong>Gender:</strong> ${userInfo.gender}</p>
                <p><strong>City:</strong> ${userInfo.city}</p>
                <p><strong>Country:</strong> ${userInfo.country}</p>
            `;
            }
        });
    }

    function sendMessage() {//给自己发送消息
        const email = sessionStorage.getItem('userEmail');
        const message = document.getElementById('newMessage').value;
        const content = { email: email, message: message }; // 移除 token 参数
        let feedbackArea = document.getElementById('send-message-feedback');
        sendPostRequest("/post_message", content, function(error, result) {
            if(error != null) {
                feedbackArea.textContent = error;
            }
            else {
                feedbackArea.textContent = messageMap2[result.message];
            }
        });
    }

    function displayAllMessages() {
        let feedbackArea = document.getElementById('messages');
        sendGetRequest("/get_user_messages_by_token", null, function(error, result) {
            if (error != null) {
                if (feedbackArea) {
                    feedbackArea.innerHTML = error; 
                }
            } else {
                const messages = result.message;
                let html = "";
                for (let i = 0; i < messages.length; i++) {
                    const messageData = messages[i];
                    const senderEmail = messageData[1];
                    const messageContent = messageData[3];
                    html += `<p>${senderEmail}: ${messageContent}</p>`;
                }
                feedbackArea.innerHTML = html;
            }
        });
    }

    // 在页面加载完成后，为 browseRefreshButton 按钮注册事件监听器
    document.addEventListener('DOMContentLoaded', function() {
        const browseRefreshButton = document.getElementById('browseRefreshButton');
        if (browseRefreshButton) {
            browseRefreshButton.addEventListener('click', function() {
                const email = document.getElementById('userEmail').value;
                refreshBrowseWallMessages(email);
            });
        }
    });

    function searchUser() {
        let feedbackArea = document.getElementById('browseUserData');
        let feedbackArea2 = document.getElementById('search-user-feedback');
        const email = document.getElementById('userEmail').value;
        if(email === "") {
            feedbackArea2.innerHTML = "Please enter a user email";
            return;
        }
        sendGetRequest("/get_user_data_by_email/" + email, null, function(error, result) {
            if (error) {
                if (feedbackArea) {
                    feedbackArea.innerHTML = profileError;
                }
            } else {
                displayUserProfile(result.user, 'browseUserData');
                document.getElementById('browseUserProfile').style.display = 'block';
                loadUserMessages(email);
            }
        });
        
    }

    function displayUserProfile(user, elementId) {
        document.getElementById(elementId).innerHTML = `
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>First Name:</strong> ${user.firstname}</p>
            <p><strong>Last Name:</strong> ${user.familyname}</p>
            <p><strong>Gender:</strong> ${user.gender}</p>
            <p><strong>City:</strong> ${user.city}</p>
            <p><strong>Country:</strong> ${user.country}</p>
        `;
    }

    function displayMessages(messages, elementId) {
        let html = "";
        for (let i = 0; i < messages.length; i++) {
            const messageData = messages[i];
            const messageId = messageData[0];
            const senderEmail = messageData[1];
            const receiverEmail = messageData[2];
            const messageContent = messageData[3];
            const senderFirstName = messageData[4];
            const senderLastName = messageData[5];
            html += `<p><strong>${senderFirstName} ${senderLastName} (${senderEmail}):</strong> ${messageContent}</p>`;
        }
        document.getElementById(elementId).innerHTML = html;
    }

    function loadUserMessages(email) {
        sendGetRequest("/get_user_messages_by_email/" + email, null, function(error, result) {
            let messageFeedbackArea = document.getElementById('load-message-feedback');
            if (error) {
                if (messageFeedbackArea) {
                    messageFeedbackArea.innerHTML = error ;
                }
            } else {
                displayMessages(result.message, 'browseMessages');
            }
        });
    }

    function sendMessageAtMessageWall() {//给用户发送消息
        const email = document.getElementById('userEmail').value;
        const message = document.getElementById('browseNewMessage').value;
        let content = {email: email, message : message}
        let feedbackArea = document.getElementById('send-browse-message-feedback');
        sendPostRequest("/post_message", content, function(error, result) {
            if(error != null) {
                feedbackArea.textContent = error;
            }
            else {
                feedbackArea.textContent = messageMap2[result.message];
            }
        });
    }

    function refreshBrowseWallMessages(email) {
        let token = sessionStorage.getItem('userToken');
        let messageFeedbackArea = document.getElementById('load-message-feedback');
        sendGetRequest("/get_user_messages_by_email/" + email, null, function(error, result) {
            if (error) {
                if (messageFeedbackArea) {
                    messageFeedbackArea.textContent =  error;
                }
            } else {
                displayMessages(messageMap2[result.message], 'browseMessages');
            }
        });
    }

    function changePassword(event) {
        event.preventDefault(); // 阻止表单默认提交
    
        let oldPassword = document.getElementById('oldPassword').value;
        let rePassword = document.getElementById('rePassword').value;
        let newPassword = document.getElementById('newPassword').value;
        let successMessage = document.getElementById('password-change-success');
        let feedbackArea = document.getElementById('change-password-feedback');
    
        // 清空之前的消息
        successMessage.textContent = "";
        feedbackArea.textContent = "";
    
        // 检查两次密码是否相同
        if (rePassword !== oldPassword) {  
            feedbackArea.textContent = "Failed to change password: The passwords should be the same.";
            return;
        }
        const passwordData = {
            oldpassword: oldPassword,
            newpassword: newPassword
        };
    
        sendPutRequest("/change_password", passwordData, function(error, result) {
            if (error) {
                feedbackArea.textContent = "Failed to change password: " + error;
            } else {
                successMessage.textContent = "Password changed successfully!";
                document.getElementById('changePasswordForm').reset(); // 重置表单
            }
        });
    }



    function logOut() {
        let feedbackArea = document.getElementById('logout-feedback');
        sendDeleteRequest("/sign_out", function(error, result) {
            if (error) {
                if (feedbackArea) {
                    feedbackArea.textContent = "Log out failed: " + messageMap2[error];
                }
            } else {
                sessionStorage.removeItem('userToken');
                window.location.href = "/"; 
                
                if (feedbackArea) {
                    feedbackArea.textContent = messageMap2[result];
                }
            }
        });
    }

    // 初始化
    showUserProfile();
    displayAllMessages();


    // 事件监听器
    document.getElementById('logoutButton').addEventListener('click', logOut);
    document.querySelector('#account form').addEventListener('submit', changePassword);
    document.getElementById('sendButton').addEventListener('click', sendMessage);
    document.getElementById('refreshButton').addEventListener('click', displayAllMessages);
    //document.getElementById('browseRefreshButton').addEventListener('click', refreshBrowseWallMessages);
    document.getElementById('searchUser').addEventListener('click', searchUser);
    document.getElementById('browseSendButton').addEventListener('click', sendMessageAtMessageWall);
    document.getElementById('browseRefreshButton').addEventListener('click', () => {
        const email = document.getElementById('userEmail').value;
        loadUserMessages(email);
    });
});

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab, .panel').forEach(el => el.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.panel).classList.add('active');
    });
});
