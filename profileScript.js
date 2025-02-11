document.addEventListener('DOMContentLoaded', function() {
    let token = sessionStorage.getItem('userToken');
    
    function showUserProfile() {
        let userData = serverstub.getUserDataByToken(token);
        if(userData.success) {
            document.getElementById('userData').innerHTML = `
                <p><strong>Email:</strong> ${userData.data.email}</p>
                <p><strong>First Name:</strong> ${userData.data.firstname}</p>
                <p><strong>Last Name:</strong> ${userData.data.familyname}</p>
                <p><strong>Gender:</strong> ${userData.data.gender}</p>
                <p><strong>City:</strong> ${userData.data.city}</p>
                <p><strong>Country:</strong> ${userData.data.country}</p>
            `;
        } 
        else {
            let feedbackArea = document.getElementById('login-feedback');
            if (feedbackArea) {
                feedbackArea.textContent = "Failed to retrieve user data: " + userData.message;
            }
        }
    }

    function storeMessage(email, content) {
        const messages = JSON.parse(localStorage.getItem('messages') || '[]');
        messages.push({ email, content, timestamp: Date.now() });
        localStorage.setItem('messages', JSON.stringify(messages));
    }

    function sendMessage() {
        const content = document.getElementById('newMessage').value;
        const token = sessionStorage.getItem('userToken');
        const result = serverstub.postMessage(token, content, null);
        if (result.success) {
            const userEmail = serverstub.getUserDataByToken(token).data.email;
            storeMessage(userEmail, content);
            displayAllMessages();
            document.getElementById('newMessage').value = '';
        } else {
            let feedbackArea = document.getElementById('send-message-feedback');
            if (feedbackArea) {
                feedbackArea.textContent = "Failed to send message"+ result.message;
            }
        }
    }

    function displayAllMessages() {
        const messages = JSON.parse(localStorage.getItem('messages') || '[]');
        messages.sort((a, b) => b.timestamp - a.timestamp);
        const messagesHtml = messages.map(msg => 
            `<p><strong>${msg.email}</strong>: ${msg.content}</p>`
        ).join('');
        document.getElementById('messages').innerHTML = messagesHtml || "<p>No messages to display.</p>";
    }

    function searchUser() {
        const email = document.getElementById('userEmail').value;
        const userData = serverstub.getUserDataByEmail(token, email);
        if (userData.success) {
            displayUserProfile(userData.data, 'browseUserData');
            document.getElementById('browseUserProfile').style.display = 'block';
            loadUserMessages(email);
        } else {
            let feedbackArea = document.getElementById('search-user-feedback');
            if (feedbackArea) {
                feedbackArea.textContent = "User not found: " + userData.message;
            }
        }
    }
    
    function displayUserProfile(userData, elementId) {
        document.getElementById(elementId).innerHTML = `
            <p><strong>Email:</strong> ${userData.email}</p>
            <p><strong>First Name:</strong> ${userData.firstname}</p>
            <p><strong>Last Name:</strong> ${userData.familyname}</p>
            <p><strong>Gender:</strong> ${userData.gender}</p>
            <p><strong>City:</strong> ${userData.city}</p>
            <p><strong>Country:</strong> ${userData.country}</p>
        `;
    }
    
    function loadUserMessages(email) {
        const messages = serverstub.getUserMessagesByEmail(token, email);
        if (messages.success) {
            displayMessages(messages.data, 'browseMessages');
        } else {
            let feedbackArea = document.getElementById('load-message-feedback');
            if (feedbackArea) {
                feedbackArea.textContent = "Failed to load messages"+ messages.message;
            }
        }
    }
    
    function sendBrowseMessage() {
        const email = document.getElementById('userEmail').value;
        const content = document.getElementById('browseNewMessage').value;
        const result = serverstub.postMessage(token, content, email);
        if (result.success) {
            document.getElementById('browseNewMessage').value = '';
            loadUserMessages(email);
        } else {
            let feedbackArea = document.getElementById('send-browse-message-feedback');
            if (feedbackArea) {
                feedbackArea.textContent = "Failed to send message"+ result.message;
            }
        }
    }

    document.getElementById('changePasswordForm').addEventListener('submit', changePassword);

    function changePassword(event) {
        event.preventDefault(); // 阻止表单默认提交

        let newPassword = document.getElementById('oldPassword').value;
        let rePassword = document.getElementById('rePassword').value;
        let successMessage = document.getElementById('password-change-success');
        let feedbackArea = document.getElementById('change-password-feedback');

        // 清空之前的消息
        successMessage.textContent = "";
        feedbackArea.textContent = "";

        // 检查两次密码是否相同
        if (newPassword !== rePassword) {
            feedbackArea.textContent = "Failed to change password: The passwords should be the same.";
            return;
        }

        // 发送修改密码请求
        let result = serverstub.changePassword(token, newPassword);

        if (result.success) {
            successMessage.textContent = "Password changed successfully!";
            document.getElementById('changePasswordForm').reset(); // 重置表单
        } else {
            feedbackArea.textContent = "Failed to change password: " + result.message;
        }
    }


    function logOut() {
        let response = serverstub.signOut(token);
        if(response.success) {
            sessionStorage.removeItem('userToken');
            window.location.href = "client.html";
        } else {
            alert("Log out failed: " + response.message);
            let feedbackArea = document.getElementById('logout-feedback');
            if (feedbackArea) {
                feedbackArea.textContent = "Failed to log out: " + response.message;
            }
        }
    }

    // 初始化
    showUserProfile();
    displayAllMessages();

    // 事件监听器
    document.getElementById('logoutButton').addEventListener('click', logOut);
    document.querySelector('#account form').addEventListener('submit', changePassword);
    document.getElementById('sendButton').addEventListener('click', sendMessage);
    document.getElementById('refreshButton').addEventListener('click', displayAllMessages);
    document.getElementById('searchUser').addEventListener('click', searchUser);
    document.getElementById('browseSendButton').addEventListener('click', sendBrowseMessage);
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
