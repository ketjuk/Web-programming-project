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
    
    else{
        feedbackArea.textContent = 'Successfully signed up';
        return true;
    }

}

function submitSignup(){
    const email = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    const firstname = document.getElementById('First-name').value;
    const familyname = document.getElementById('Family-name').value;
    const gender = document.getElementById('signup-gender').value;
    const city = document.getElementById('signup-city').value;
    const country = document.getElementById('signup-country').value;

    if(validateSignupForm() === false) {
        return false;
    }

    const inputObject = {
        email, password, firstname, familyname, gender, city, country
    };

    const result = serverstub.signUp(inputObject);
    const feedbackArea = document.getElementById('signup-feedback');
    feedbackArea.textContent = result.message;

    return result.success;
}

function submitLogin(event) {
    event.preventDefault(); // 阻止表单默认提交行为

    const feedbackArea = document.getElementById('login-feedback');
    const email = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const result = serverstub.signIn(email, password);

    if (result.success) {
        const token = result.data;
        // Store email:token pair
        //const userTokens = JSON.parse(localStorage.getItem('userTokens') || '{}');
        // userTokens[email] = token;
        //localStorage.setItem('userTokens', JSON.stringify(userTokens));
        
        
        sessionStorage.setItem('userToken', token);
        sessionStorage.setItem('userEmail', email);

        window.location.href = 'profileView.html';
    }
    else {
        let feedbackArea = document.getElementById('login-feedback');
        if (feedbackArea) {
            feedbackArea.textContent = "Failed to log in: " + result.message;
        }
    }

}
