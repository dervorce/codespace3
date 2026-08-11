const form = document.getElementById('registerForm');
const errorEl = document.getElementById('errorMsg');
const submitBtn = document.getElementById('submitBtn');

if(getToken()) window.location.href = '/dashboard.html';

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  errorEl.style.display = 'none';

  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';
  try{
    const data = await api('/auth/register', { method: 'POST', body: { username, email, password } });
    setSession(data.token, data.user);
    window.location.href = '/dashboard.html';
  }catch(err){
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }finally{
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account';
  }
});
