function sendPostRequest(url, token, data, callback) {//POST
    var xhr = new XMLHttpRequest();
    url = "http://13.48.106.212:5000" + url;
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', token); 
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = function() {
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

    xhr.onerror = function() {
      callback(new Error('Request error'), null); // 传递错误信息
    };

    xhr.send(JSON.stringify(data));
  }

function sendGetRequest(url, token, callback) {//GET
    var xhr = new XMLHttpRequest();
    // 拼接 URL 和参数
    let fullURL = "http://13.48.106.212:5000" + url;

    xhr.open('GET', fullURL, true);
    xhr.setRequestHeader('Authorization', token); 
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = function() {
        var responseData = JSON.parse(xhr.responseText);

        if (!responseData) {
            callback(new Error('Response data is null or undefined'), null);
            return;
        }

        if (responseData.success) {
            callback(null, responseData);
        } else {
            callback(new Error(responseData.message || 'Request failed'), null);
        }
    };

    xhr.onerror = function() {
        console.error('Request error');
        callback(new Error('Request error'), null);
    };

    xhr.send();
}

function sendPutRequest(url, token, data, callback) {//PUT
    var xhr = new XMLHttpRequest();
    url = "http://13.48.106.212:5000" + url;
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Authorization', token);  //注意是Authorization
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = function() {
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

    xhr.onerror = function() {
        callback(new Error('Request error'), null); // 传递错误信息
    };

    xhr.send(JSON.stringify(data));
}

function sendDeleteRequest(url, token, callback) { //DELETE
    var xhr = new XMLHttpRequest();
    url = "http://13.48.106.212:5000" + url;
    xhr.open('DELETE', url, true);
    xhr.setRequestHeader('Authorization', token);  //设置Authorization
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = function() {
        // 先解析 JSON 响应
        var responseData = JSON.parse(xhr.responseText);

        // 然后检查 responseData 是否为 null 或 undefined
        if (!responseData) {
            callback(new Error('Response data is null or undefined'), null);
            return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const result = JSON.parse(xhr.responseText); //在client端使用JSON.parse
                callback(null, result);
            } catch (error) {
                callback(error);
            }
        } else {
            callback(xhr.statusText); //传递错误信息
        }
    };

    xhr.onerror = function() {
        callback(new Error('Request error'), null); // 传递错误信息
    };

    xhr.send();
}

document.addEventListener('DOMContentLoaded', function() {
    let token = sessionStorage.getItem('userToken');
    let feedbackArea = document.getElementById('login-feedback2');
    let ws;
    if (token) {
        ws = new WebSocket(`ws://13.48.106.212:5000/ws?token=${token}`);

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
        sendGetRequest("/get_user_data_by_token", token, function(error, result) {
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
        const email =  sessionStorage.getItem('userEmail');
        let token = sessionStorage.getItem('userToken');
        const message = document.getElementById('newMessage').value;
        let content = {email: email, message : message}
        let feedbackArea = document.getElementById('send-message-feedback');
        sendPostRequest("/post_message", token, content, function(error,result) {
            if(error != null) {
                feedbackArea.textContent = error;
            }
            else {
                feedbackArea.textContent = result.message;
            }
        });
    }

    function displayAllMessages() {
        let feedbackArea = document.getElementById('messages');
        const token = sessionStorage.getItem('userToken'); 
        sendGetRequest("/get_user_messages_by_token", token, function(error, result) {
            if (error != null) {
                if (feedbackArea) {
                    feedbackArea.innerHTML = error.message; 
                }
            } else {
                if (result.success) {
                    const messages = result.message;
                    let html = "";
                    for (let i = 0; i < messages.length; i++) {
                        const messageData = messages[i];
                        const senderEmail = messageData[1];
                        const messageContent = messageData[3];
                        html += `<p>${senderEmail}: ${messageContent}</p>`;
                    }
                    feedbackArea.innerHTML = html;
                } else {
                    feedbackArea.innerHTML = "failed to get message";
                }
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
        let token = sessionStorage.getItem('userToken');
        if(email === "") {
            feedbackArea2.innerHTML = "Please enter a user email";
            return;
        }
        sendGetRequest("/get_user_data_by_email/" + email, token, function (profileError, profileResult) {
            if (profileError) {
                if (feedbackArea) {
                        feedbackArea.innerHTML = profileError;
                }
            } else {
                if (profileResult.success) {
                    displayUserProfile(profileResult.user, 'browseUserData');
                    document.getElementById('browseUserProfile').style.display = 'block';
    
                    loadUserMessages(email);
    
                } else {
                    feedbackArea.innerHTML = "User not found: " + profileResult.message;
                }
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
        let token = sessionStorage.getItem('userToken');
        sendGetRequest("/get_user_messages_by_email/" + email, token, function (messageError, messageResult) {
            let messageFeedbackArea = document.getElementById('load-message-feedback');
            if (messageError) {
                if (messageFeedbackArea) {
                    messageFeedbackArea.innerHTML = messageError;
                }
            } else {
                if (messageResult.success) {
                    displayMessages(messageResult.message, 'browseMessages');
                } else {
                    if (messageFeedbackArea) {
                        messageFeedbackArea.innerHTML = "Failed to load messages: " + messageResult.message;
                    }
                }
            }
        });
    }

    function sendMessageAtMessageWall() {//给自己发送消息
        const email =  sessionStorage.getItem('userEmail');
        let token = sessionStorage.getItem('userToken');
        const message = document.getElementById('browseNewMessage').value;
        let content = {email: email, message : message}
        let feedbackArea = document.getElementById('send-browse-message-feedback');
        sendPostRequest("/post_message", token, content, function(error,result) {
            if(error != null) {
                feedbackArea.textContent = error;
            }
            else {
                feedbackArea.textContent = result.message;
            }
        });
    }

    function refreshBrowseWallMessages(email) {
        let token = sessionStorage.getItem('userToken');
        sendGetRequest("/get_user_messages_by_email/" + email, token, function (messageError, messageResult) {
            let messageFeedbackArea = document.getElementById('load-message-feedback');
            if (messageError) {
                if (messageFeedbackArea) {
                    messageFeedbackArea.innerHTML = messageError;
                }
            } else {
                if (messageResult.success) {
                    displayMessages(messageResult.message, 'browseMessages');
                } else {
                    if (messageFeedbackArea) {
                        messageFeedbackArea.innerHTML = "Failed to load messages: " + messageResult.message;
                    }
                }
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
        let token = sessionStorage.getItem('userToken'); 
    
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
    
        sendPutRequest("/change_password", token, passwordData, function (error, result) {
            if (error) {
                feedbackArea.textContent = "Failed to change password: " + error.message;
            } else {
                if (result.success) {
                    successMessage.textContent = "Password changed successfully!";
                    document.getElementById('changePasswordForm').reset(); // 重置表单
                } else {
                    feedbackArea.textContent = "Failed to change password: " + result.message;
                }
            }
        });
    }



    function logOut() {
        let token = sessionStorage.getItem('userToken');
        let feedbackArea = document.getElementById('logout-feedback');
        sendDeleteRequest("/sign_out", token, function (error, result) {
            if (error) {
                if (feedbackArea) {
                    feedbackArea.textContent = "Log out failed: " + error.message;
                }
            } else {
                if (result.success) {
                    sessionStorage.removeItem('userToken');
                    window.location.href = "/"; 
                } else {
                    if (feedbackArea) {
                        feedbackArea.textContent = "Log out failed: " + result.message;
                    }
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
