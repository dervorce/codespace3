requireLogin();

const user = getUser();
document.getElementById('whoami').textContent = user ? user.username : '';
document.getElementById('logoutLink').addEventListener('click', (e) => {
  e.preventDefault();
  clearSession();
  window.location.href = '/login.html';
});

const params = new URLSearchParams(window.location.search);
const spaceId = params.get('id');
if(!spaceId){ window.location.href = '/dashboard.html'; }

const spaceNameEl = document.getElementById('spaceName');
const memberListEl = document.getElementById('memberList');
const entriesEl = document.getElementById('entries');
const countEl = document.getElementById('entryCount');
const errorEl = document.getElementById('errorMsg');
const successEl = document.getElementById('successMsg');
const uploadBtn = document.getElementById('uploadBtn');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const folderBtn = document.getElementById('folderBtn');
const fileNameEl = document.getElementById('fileName');
const notesInput = document.getElementById('notesInput');

let pendingFiles = []; // File objects queued for upload
let openId = null;     // currently-expanded file entry id
let openContent = {};  // fileId -> fetched content, cached after first open
let openFolders = new Set(); // paths of currently-expanded folders

function escapeHtml(str){
  return str.replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function formatTime(iso){
  return new Date(iso).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

/* ---- Load space details + members ---- */
async function loadSpace(){
  try{
    const { space } = await api(`/spaces/${spaceId}`);
    spaceNameEl.textContent = space.name;
    memberListEl.innerHTML = space.members
      .map(m => `<span class="member-chip">${escapeHtml(m.username)} (${escapeHtml(m.role)})</span>`)
      .join('');
  }catch(err){
    spaceNameEl.textContent = 'Repository';
    memberListEl.innerHTML = `<span class="error">Couldn't load members: ${escapeHtml(err.message)}</span>`;
  }
}

/* ---- Load / render the upload history ("latest updates") ---- */
async function loadFiles(){
  try{
    const { files } = await api(`/spaces/${spaceId}/files`);
    renderFiles(files);
  }catch(err){
    entriesEl.innerHTML = `<div class="empty">Couldn't load history: ${escapeHtml(err.message)}</div>`;
  }
}

let currentFiles = [];

/* Keep only the newest entry per path so folder browsing shows current
   state, while re-uploads still update what's shown (and still logged
   server-side - every upload still creates its own FileEntry). */
function dedupeByPath(files){
  const seen = new Set();
  const result = [];
  for(const f of files){ // files arrive newest-first from the API
    if(!seen.has(f.name)){
      seen.add(f.name);
      result.push(f);
    }
  }
  return result;
}

/* Turn a flat ["src/utils/a.js", "src/b.js", "readme.md", ...] list into
   a nested { folders: {name: node}, files: [...] } tree. */
function buildTree(files){
  const root = { folders: {}, files: [], path: '' };
  for(const f of files){
    const parts = f.name.split('/');
    if(parts.length === 1){
      root.files.push({ ...f, displayName: parts[0] });
      continue;
    }
    let cur = root;
    const acc = [];
    for(let i = 0; i < parts.length - 1; i++){
      const seg = parts[i];
      acc.push(seg);
      const key = acc.join('/');
      if(!cur.folders[seg]) cur.folders[seg] = { folders: {}, files: [], path: key };
      cur = cur.folders[seg];
    }
    cur.files.push({ ...f, displayName: parts[parts.length - 1] });
  }
  return root;
}

function renderFileEntry(f, depth){
  const isOpen = openId === f.id;
  const content = openContent[f.id];
  return `
    <div class="entry ${isOpen ? 'open' : ''}" data-id="${f.id}" style="margin-left:${depth * 16}px">
      <div class="entry-meta">
        <span class="chevron">${isOpen ? '▾' : '▸'}</span>
        <span class="who">${escapeHtml(f.uploadedBy)}</span>
        <span>${escapeHtml(f.displayName)}</span>
        <span class="lang-badge">${escapeHtml(f.language)}</span>
        <span>${formatTime(f.uploadedAt)}</span>
      </div>
      ${isOpen && f.notes ? `<div class="entry-note">${escapeHtml(f.notes)}</div>` : ''}
      ${isOpen ? `<pre>${content ? escapeHtml(content) : 'Loading...'}</pre>` : ''}
    </div>
  `;
}

function renderNode(node, depth){
  let html = '';
  const folderNames = Object.keys(node.folders).sort((a, b) => a.localeCompare(b));
  for(const name of folderNames){
    const child = node.folders[name];
    const isOpen = openFolders.has(child.path);
    html += `
      <div class="tree-folder" data-path="${escapeHtml(child.path)}">
        <div class="folder-row" style="padding-left:${depth * 16}px">
          <span class="chevron">${isOpen ? '▾' : '▸'}</span>
          <span class="folder-icon">📁</span>
          <span class="folder-name">${escapeHtml(name)}</span>
        </div>
        ${isOpen ? renderNode(child, depth + 1) : ''}
      </div>
    `;
  }
  const files = node.files.slice().sort((a, b) => a.displayName.localeCompare(b.displayName));
  for(const f of files){
    html += renderFileEntry(f, depth);
  }
  return html;
}

function renderFiles(files){
  currentFiles = files;
  countEl.textContent = files.length ? `${files.length} entr${files.length===1?'y':'ies'}` : '';
  if(!files.length){
    entriesEl.innerHTML = `<div class="empty">No uploads yet. Add the first file above.</div>`;
    return;
  }
  const tree = buildTree(dedupeByPath(files));
  entriesEl.innerHTML = renderNode(tree, 0);
}

/* Folders toggle open/closed. Files only fetch + show code when clicked. */
entriesEl.addEventListener('click', async (ev) => {
  const folderRow = ev.target.closest('.folder-row');
  if(folderRow){
    const path = folderRow.closest('.tree-folder').dataset.path;
    if(openFolders.has(path)) openFolders.delete(path);
    else openFolders.add(path);
    renderFiles(currentFiles);
    return;
  }

  const header = ev.target.closest('.entry-meta');
  if(!header) return;
  const entryEl = header.closest('.entry');
  const id = entryEl.dataset.id;

  if(openId === id){
    openId = null;
    renderFiles(currentFiles);
    return;
  }
  openId = id;
  renderFiles(currentFiles);

  if(!openContent[id]){
    try{
      const { file } = await api(`/spaces/${spaceId}/files/${id}`);
      openContent[id] = file.content;
    }catch(err){
      openContent[id] = `Could not load file content: ${err.message}`;
    }
    renderFiles(currentFiles);
  }
});

/* ---- File selection: click, drag/drop, folder button ---- */
['dragover','drop'].forEach(evt => window.addEventListener(evt, e => e.preventDefault()));

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', e => {
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); fileInput.click(); }
});
['dragover','dragenter'].forEach(evt =>
  dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('drag'); })
);
['dragleave','drop'].forEach(evt =>
  dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag'); })
);
dropZone.addEventListener('drop', e => {
  if(e.dataTransfer.files.length) queueFiles(Array.from(e.dataTransfer.files));
});

fileInput.addEventListener('change', () => {
  if(fileInput.files.length) queueFiles(Array.from(fileInput.files));
});

folderBtn.addEventListener('click', () => folderInput.click());
folderInput.addEventListener('change', () => {
  if(folderInput.files.length) queueFiles(Array.from(folderInput.files));
});

function queueFiles(files){
  pendingFiles = files;
  const label = files.length === 1 ? files[0].webkitRelativePath || files[0].name
    : `${files.length} files selected`;
  fileNameEl.textContent = label;
}

/* ---- Upload ---- */
uploadBtn.addEventListener('click', async () => {
  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  if(!pendingFiles.length){
    errorEl.textContent = 'Choose a file or folder to upload first.';
    errorEl.style.display = 'block';
    return;
  }

  const formData = new FormData();
  const paths = [];
  pendingFiles.forEach(f => {
    formData.append('files', f);
    paths.push(f.webkitRelativePath || f.name);
  });
  formData.append('pathsJson', JSON.stringify(paths));
  formData.append('notes', notesInput.value.trim());

  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Uploading...';
  try{
    await api(`/spaces/${spaceId}/upload`, { method: 'POST', body: formData, isFormData: true });
    successEl.textContent = `Uploaded ${pendingFiles.length} file${pendingFiles.length===1?'':'s'}.`;
    successEl.style.display = 'block';
    setTimeout(() => { successEl.style.display = 'none'; }, 4000);

    pendingFiles = [];
    fileInput.value = '';
    folderInput.value = '';
    fileNameEl.textContent = '';
    notesInput.value = '';
    openContent = {}; // force fresh fetch of any re-uploaded paths
    await loadFiles();
  }catch(err){
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }finally{
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload & commit';
  }
});

loadSpace();
loadFiles();
