const form = document.getElementById('loginForm');
const errorEl = document.getElementById('errorMsg');
const submitBtn = document.getElementById('submitBtn');

if(getToken()) window.location.href = '/dashboard.html';

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  errorEl.style.display = 'none';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';
  try{
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setSession(data.token, data.user);
    window.location.href = '/dashboard.html';
  }catch(err){
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }finally{
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log in';
  }
});
