requireLogin();

const user = getUser();
document.getElementById('whoami').textContent = user ? user.username : '';
document.getElementById('logoutLink').addEventListener('click', (e) => {
  e.preventDefault();
  clearSession();
  window.location.href = '/login.html';
});

const spaceListEl = document.getElementById('spaceList');

function escapeHtml(str){
  return str.replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function formatTime(iso){
  return new Date(iso).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
}

async function loadSpaces(){
  try{
    const { spaces } = await api('/spaces');
    if(!spaces.length){
      spaceListEl.innerHTML = `<div class="empty">You're not in any repositories yet. Create or join one above.</div>`;
      return;
    }
    spaceListEl.innerHTML = spaces.map(s => `
      <div class="space-list-item">
        <div>
          <div class="name">${escapeHtml(s.name)}</div>
          <div class="meta">${escapeHtml(s.role)} access &middot; created ${formatTime(s.createdAt)} ${s.isOwner ? '&middot; you own this' : ''}</div>
        </div>
        <a class="btn" href="space.html?id=${s.id}">Open</a>
      </div>
    `).join('');
  }catch(err){
    spaceListEl.innerHTML = `<div class="empty">Couldn't load your spaces: ${escapeHtml(err.message)}</div>`;
  }
}

/* Create space */
const createForm = document.getElementById('createForm');
const createError = document.getElementById('createError');
const createBtn = document.getElementById('createBtn');

createForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  createError.style.display = 'none';
  const name = document.getElementById('createName').value.trim();
  const password = document.getElementById('createPassword').value;

  createBtn.disabled = true;
  try{
    const { space } = await api('/spaces', { method: 'POST', body: { name, password } });
    window.location.href = `space.html?id=${space.id}`;
  }catch(err){
    createError.textContent = err.message;
    createError.style.display = 'block';
  }finally{
    createBtn.disabled = false;
  }
});

/* Join space */
const joinForm = document.getElementById('joinForm');
const joinError = document.getElementById('joinError');
const joinBtn = document.getElementById('joinBtn');

joinForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  joinError.style.display = 'none';
  const name = document.getElementById('joinName').value.trim();
  const password = document.getElementById('joinPassword').value;
  const owner = document.getElementById('joinOwner').value.trim();

  joinBtn.disabled = true;
  try{
    const { space } = await api('/spaces/join', { method: 'POST', body: { owner, name, password } });
    window.location.href = `space.html?id=${space.id}`;
  }catch(err){
    joinError.textContent = err.message;
    joinError.style.display = 'block';
  }finally{
    joinBtn.disabled = false;
  }
});

loadSpaces();
