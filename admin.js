/* ================================================================
   BLACKFIT — Painel Admin · admin.js
   Stack: vanilla JS + Supabase JS
================================================================ */
'use strict';

// ============== SVG SPRITE ==============
document.body.insertAdjacentHTML('beforeend', `
<svg aria-hidden="sprite" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <symbol id="i-chart" viewBox="0 0 24 24"><path d="M3 3v18h18M7 14l3-3 3 3 5-5"/></symbol>
    <symbol id="i-post" viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8M8 17h5"/></symbol>
    <symbol id="i-text" viewBox="0 0 24 24"><path d="M5 5h14M9 5v14M5 12h14"/></symbol>
    <symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5-9 9"/></symbol>
    <symbol id="i-instagram" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".5" fill="currentColor"/></symbol>
    <symbol id="i-logout" viewBox="0 0 24 24"><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4M16 17l5-5-5-5M21 12H9"/></symbol>
    <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></symbol>
    <symbol id="i-db" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/></symbol>
    <symbol id="i-edit" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></symbol>
    <symbol id="i-trash" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
    <symbol id="i-up" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></symbol>
    <symbol id="i-eye" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></symbol>
    <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></symbol>
  </defs>
</svg>
`);

// ============== SUPABASE CLIENT ==============
const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'bf-admin-auth' }
});
window.sb = sb;

// ============== MULTI-BRAND ==============
// Detecta a marca pelo domínio do email do usuário logado.
// thiago@blackfit.com  → 'blackfit'
// joana@elegance.com   → 'elegance'
const BRAND_BY_DOMAIN = {
  'blackfit.com': { id: 'blackfit', name: 'BLACKFIT', tag: 'Suplementos', color: '#fff', accent: '#ffd700', site: '../site/' },
  'elegance.com': { id: 'elegance', name: 'ELEGANCE',  tag: 'Fitwear',     color: '#ffd1dc', accent: '#e6859f', site: '../site/elegance/' }
};
let currentBrand = { id: 'blackfit', name: 'BLACKFIT', tag: '', site: '../site/' };
function detectBrand(email) {
  const dom = (email || '').split('@')[1]?.toLowerCase();
  return BRAND_BY_DOMAIN[dom] || BRAND_BY_DOMAIN['blackfit.com'];
}

// ============== UTIL ==============
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtDate = d => new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
const fmtDay = d => new Date(d).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function toast(msg, kind = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.innerHTML = `<svg class="ic"><use href="#i-${kind === 'success' ? 'check' : kind === 'error' ? 'x' : 'eye'}"/></svg><span>${escapeHtml(msg)}</span>`;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3500);
}

function modal(html, opts = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal" style="position:relative">
    <button class="close-x" data-close>&times;</button>
    ${html}
  </div>`;
  root.classList.remove('hidden');
  const close = () => { root.classList.add('hidden'); root.innerHTML = ''; opts.onClose?.(); };
  root.querySelector('[data-close]').onclick = close;
  root.onclick = e => { if (e.target === root) close(); };
  return { root, close, el: root.querySelector('.modal') };
}

async function confirmDialog(msg, dangerLabel = 'Excluir') {
  return new Promise(res => {
    const m = modal(`
      <h3>Confirmar</h3>
      <div class="body"><p style="color:var(--soft);line-height:1.55">${escapeHtml(msg)}</p></div>
      <div class="foot">
        <button class="btn" data-no>Cancelar</button>
        <button class="btn danger" data-yes>${escapeHtml(dangerLabel)}</button>
      </div>
    `);
    m.el.querySelector('[data-no]').onclick = () => { m.close(); res(false); };
    m.el.querySelector('[data-yes]').onclick = () => { m.close(); res(true); };
  });
}

// ============== AUTH ==============
async function tryAutoLogin() {
  const { data } = await sb.auth.getSession();
  if (data?.session?.user) {
    currentBrand = detectBrand(data.session.user.email);
    showApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  $('#screen-login').classList.remove('hidden');
  $('#screen-app').classList.add('hidden');
}
async function showApp() {
  $('#screen-login').classList.add('hidden');
  $('#screen-app').classList.remove('hidden');
  applyBrandUI();
  goRoute('dashboard');
}
function applyBrandUI() {
  // Atualiza título, cores e link "ver site"
  document.title = `${currentBrand.name} — Painel Admin`;
  const brandEls = document.querySelectorAll('[data-brand-name]');
  brandEls.forEach(el => el.textContent = currentBrand.name);
  const tagEls = document.querySelectorAll('[data-brand-tag]');
  tagEls.forEach(el => el.textContent = currentBrand.tag);
  // Liga órgãos com .brand-accent ao tom da marca
  if (currentBrand.id === 'elegance') {
    document.documentElement.style.setProperty('--pri', '#ffd1dc');
    document.documentElement.style.setProperty('--pri-fg', '#1a1416');
  }
}

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const err = $('#login-err');
  err.textContent = '';
  btn.classList.add('loading'); btn.disabled = true;
  const user = $('#login-user').value.trim();
  const pass = $('#login-pass').value;
  // Resolve email pelo nome curto: thiago → thiago@blackfit.com, joana → joana@elegance.com
  let email = user;
  if (!user.includes('@')) {
    const u = user.toLowerCase();
    if (u === 'joana')  email = 'joana@elegance.com';
    else                 email = `${u}@blackfit.com`;
  }
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    currentBrand = detectBrand(data.user.email);
    showApp();
    toast(`Bem-vindo${currentBrand.id === 'elegance' ? ', Joana!' : ', Thiago!'}`, 'success');
  } catch (e) {
    err.textContent = 'Usuário ou senha incorretos.';
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
  }
});

$('#btn-logout').addEventListener('click', async () => {
  if (!await confirmDialog('Encerrar sessão?', 'Sair')) return;
  await sb.auth.signOut();
  $('#login-pass').value = '';
  showLogin();
});

// ============== ROUTER ==============
const ROUTES = ['dashboard','posts','content','media','insta'];
const TITLES = { dashboard:'Estatísticas', posts:'Blog & Notícias', content:'Textos do Site', media:'Galeria de Mídia', insta:'Instagram' };
const RENDERS = {};

async function goRoute(name) {
  if (!ROUTES.includes(name)) return;
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.route === name));
  $$('.route').forEach(r => r.classList.toggle('hidden', r.id !== `route-${name}`));
  $('#page-title').textContent = TITLES[name];
  $('#sidebar').classList.remove('open');
  $('#backdrop').classList.remove('show');
  await RENDERS[name]?.();
}

$$('.nav-item').forEach(a => a.addEventListener('click', () => goRoute(a.dataset.route)));
$('#ham-toggle').addEventListener('click', () => {
  $('#sidebar').classList.toggle('open');
  $('#backdrop').classList.toggle('show');
});
$('#backdrop').addEventListener('click', () => {
  $('#sidebar').classList.remove('open');
  $('#backdrop').classList.remove('show');
});

// ============== STORAGE HELPERS ==============
async function uploadToStorage(file, folder = 'uploads') {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${currentBrand.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from('media').getPublicUrl(path);
  return { url: data.publicUrl, path, mime: file.type, name: file.name, size: file.size };
}

async function deleteFromStoragePath(url) {
  if (!url) return;
  // extrai a parte após "/object/public/media/"
  const m = url.match(/\/object\/public\/media\/(.+)$/);
  if (!m) return;
  await sb.storage.from('media').remove([m[1]]);
}

// ============== ROUTE: DASHBOARD ==============
RENDERS.dashboard = async function () {
  const root = $('#route-dashboard');
  root.innerHTML = `
    <div class="grid-stats" id="dash-stats">
      <div class="stat-tile"><svg class="ic"><use href="#i-post"/></svg><span class="lbl">Posts</span><div class="val" id="s-posts">—</div></div>
      <div class="stat-tile"><svg class="ic"><use href="#i-eye"/></svg><span class="lbl">Visualizações Totais</span><div class="val" id="s-views">—</div></div>
      <div class="stat-tile"><svg class="ic"><use href="#i-chart"/></svg><span class="lbl">Hoje</span><div class="val" id="s-today">—</div></div>
      <div class="stat-tile"><svg class="ic"><use href="#i-instagram"/></svg><span class="lbl">Posts no Instagram</span><div class="val" id="s-insta">—</div></div>
    </div>
    <div class="card">
      <h3>Visualizações nos últimos 30 dias</h3>
      <div class="bars" id="bars"></div>
      <div style="height:30px"></div>
    </div>
    <div class="card">
      <h3>Posts mais vistos</h3>
      <div id="top-posts" class="list"></div>
    </div>
  `;

  // contadores
  const [{ count: postsC }, { count: instaC }] = await Promise.all([
    sb.from('posts').select('*', { count: 'exact', head: true }).eq('brand', currentBrand.id),
    sb.from('insta_posts').select('*', { count: 'exact', head: true }).eq('brand', currentBrand.id)
  ]);
  $('#s-posts').textContent = postsC ?? 0;
  $('#s-insta').textContent = instaC ?? 0;

  // views (filtradas por brand via RPC)
  const { data: daily } = await sb.rpc('post_views_daily', { days: 30, p_brand: currentBrand.id });
  const totalViews = (daily || []).reduce((a, r) => a + Number(r.views || 0), 0);
  $('#s-views').textContent = totalViews;
  const today = new Date().toISOString().slice(0,10);
  const tdy = (daily || []).find(r => r.day?.toString().startsWith(today));
  $('#s-today').textContent = tdy ? tdy.views : 0;

  // gráfico de barras (últimos 30 dias)
  const byDay = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0,10);
    byDay[key] = 0;
  }
  (daily || []).forEach(r => { const k = String(r.day).slice(0,10); if (k in byDay) byDay[k] = Number(r.views || 0); });
  const max = Math.max(1, ...Object.values(byDay));
  $('#bars').innerHTML = Object.entries(byDay).map(([d, v], i) => {
    const h = Math.max(2, (v / max) * 100);
    const showLbl = i % 5 === 0 || i === 29;
    return `<div class="bar" style="height:${h}%">
      <span class="tip">${v} views · ${fmtDay(d)}</span>
      ${showLbl ? `<small>${fmtDay(d)}</small>` : ''}
    </div>`;
  }).join('');

  // top posts (ordena por views desc)
  const { data: posts } = await sb.from('posts').select('id,title,views,created_at').eq('brand', currentBrand.id).order('views', { ascending: false }).limit(8);
  $('#top-posts').innerHTML = (posts || []).length
    ? posts.map(p => `
      <div class="list-row" style="grid-template-columns:1fr auto auto">
        <div class="info"><strong>${escapeHtml(p.title)}</strong><small>${fmtDate(p.created_at)}</small></div>
        <div class="num">${p.views || 0} views</div>
        <div class="actions"><a class="btn sm" target="_blank" href="${currentBrand.site}post.html?id=${p.id}"><svg class="ic"><use href="#i-eye"/></svg> Abrir</a></div>
      </div>
    `).join('')
    : `<div class="empty">Nenhum post ainda.</div>`;
};

// ============== ROUTE: POSTS ==============
RENDERS.posts = async function () {
  const root = $('#route-posts');
  root.innerHTML = `
    <div class="toolbar">
      <div class="left">
        <input class="search-input" id="posts-q" placeholder="Buscar por título…">
      </div>
      <div class="right">
        <button class="btn solid" id="btn-new-post"><svg class="ic"><use href="#i-plus"/></svg> Novo post</button>
      </div>
    </div>
    <div class="list" id="posts-list">
      <div class="list-row head row-posts">
        <div></div><div>Título</div><div>Views</div><div>Data</div><div></div>
      </div>
      <div class="empty"><svg><use href="#i-post"/></svg><p>Carregando…</p></div>
    </div>
  `;
  $('#btn-new-post').onclick = () => editPost();

  let allPosts = [];
  async function load() {
    const { data, error } = await sb.from('posts').select('*').eq('brand', currentBrand.id).order('created_at', { ascending: false });
    if (error) { toast('Erro ao carregar posts: ' + error.message, 'error'); return; }
    allPosts = data || [];
    render();
  }
  function render() {
    const q = $('#posts-q').value.toLowerCase().trim();
    const filtered = q ? allPosts.filter(p => p.title.toLowerCase().includes(q)) : allPosts;
    const list = $('#posts-list');
    if (!filtered.length) {
      list.innerHTML = `<div class="empty"><svg><use href="#i-post"/></svg><p>Nenhum post encontrado. Clique em "Novo post" para começar.</p></div>`;
      return;
    }
    list.innerHTML = `<div class="list-row head row-posts"><div></div><div>Título</div><div>Views</div><div>Data</div><div></div></div>` + filtered.map(p => `
      <div class="list-row row-posts" data-id="${p.id}">
        <div class="thumb" style="${p.cover_url ? `background-image:url('${p.cover_url}')` : ''}"></div>
        <div class="info"><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(p.excerpt || '')}</small></div>
        <div class="num">${p.views || 0}</div>
        <div class="num">${fmtDate(p.created_at)}</div>
        <div class="actions">
          <a class="btn sm" target="_blank" href="${currentBrand.site}post.html?id=${p.id}" title="Ver"><svg class="ic"><use href="#i-eye"/></svg></a>
          <button class="btn sm" data-edit><svg class="ic"><use href="#i-edit"/></svg></button>
          <button class="btn sm danger" data-del><svg class="ic"><use href="#i-trash"/></svg></button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editPost(b.closest('.list-row').dataset.id));
    list.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const id = b.closest('.list-row').dataset.id;
      const post = allPosts.find(p => p.id === id);
      if (!await confirmDialog(`Excluir o post "${post.title}"? Essa ação é irreversível.`)) return;
      const { error } = await sb.from('posts').delete().eq('id', id).eq('brand', currentBrand.id);
      if (error) return toast('Erro ao excluir: ' + error.message, 'error');
      if (post.cover_url) await deleteFromStoragePath(post.cover_url).catch(()=>{});
      toast('Post excluído', 'success');
      load();
    });
  }
  $('#posts-q').oninput = debounce(render, 200);
  await load();
};

async function editPost(id = null) {
  let post = { title:'', excerpt:'', body:'', cover_url:'', media:[] };
  if (id) {
    const { data } = await sb.from('posts').select('*').eq('id', id).eq('brand', currentBrand.id).single();
    if (data) post = { ...post, ...data, media: data.media || [] };
  }
  const m = modal(`
    <h3>${id ? 'Editar' : 'Novo'} post</h3>
    <div class="body">
      <div class="fld">
        <label>Capa</label>
        <div class="drop" id="cover-drop">
          <input type="file" accept="image/*" id="cover-file">
          ${post.cover_url ? `<img src="${post.cover_url}" style="max-height:140px;border-radius:8px;margin:auto;display:block">` : `<svg viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2"><use href="#i-up"/></svg><div>Clique ou arraste a imagem de capa</div>`}
        </div>
        <span class="hint">Recomendado 1200×675px (proporção 16:9)</span>
      </div>
      <div class="fld">
        <label>Título *</label>
        <input type="text" id="p-title" maxlength="180" value="${escapeHtml(post.title)}" required>
      </div>
      <div class="fld">
        <label>Resumo</label>
        <textarea id="p-excerpt" maxlength="400">${escapeHtml(post.excerpt || '')}</textarea>
        <span class="hint">Aparece nos cards do blog. Máx. 400 caracteres.</span>
      </div>
      <div class="fld">
        <label>Conteúdo *</label>
        <textarea id="p-body" rows="10" required>${escapeHtml(post.body || '')}</textarea>
        <span class="hint">Pode usar quebras de linha. Linhas em branco viram parágrafos.</span>
      </div>
      <div class="fld">
        <label>Mídias da matéria</label>
        <div class="drop" id="media-drop">
          <input type="file" accept="image/*,video/*" multiple id="media-files">
          <svg viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2"><use href="#i-up"/></svg>
          <div>Clique ou arraste imagens e vídeos extras</div>
        </div>
        <div class="file-preview" id="media-preview"></div>
      </div>
    </div>
    <div class="foot">
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn solid" data-save><svg class="ic"><use href="#i-check"/></svg> ${id ? 'Salvar' : 'Publicar'}</button>
    </div>
  `);

  let coverFile = null;
  let mediaList = [...(post.media || [])];

  function renderPreview() {
    $('#media-preview').innerHTML = mediaList.map((m, i) => `
      <div class="item" data-i="${i}" style="${m.type === 'image' ? `background-image:url('${m.url}')` : ''}">
        ${m.type === 'video' ? `<video src="${m.url}" muted></video>` : ''}
        <button class="rm" data-rm="${i}">×</button>
      </div>
    `).join('');
    $('#media-preview').querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
      const i = +b.dataset.rm;
      const item = mediaList[i];
      if (item._existing) await deleteFromStoragePath(item.url).catch(()=>{});
      mediaList.splice(i, 1);
      renderPreview();
    });
  }
  // marca os já existentes
  mediaList.forEach(m => m._existing = true);
  renderPreview();

  $('#cover-file').onchange = e => {
    coverFile = e.target.files[0] || null;
    if (coverFile) {
      const url = URL.createObjectURL(coverFile);
      $('#cover-drop').innerHTML = `<input type="file" accept="image/*" id="cover-file">
        <img src="${url}" style="max-height:140px;border-radius:8px;margin:auto;display:block">`;
      $('#cover-file').onchange = arguments.callee;
    }
  };

  $('#media-files').onchange = async e => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      const isVid = f.type.startsWith('video');
      mediaList.push({ url: URL.createObjectURL(f), type: isVid ? 'video' : 'image', _file: f });
    }
    renderPreview();
  };

  m.el.querySelector('[data-cancel]').onclick = m.close;
  m.el.querySelector('[data-save]').onclick = async () => {
    const title = $('#p-title').value.trim();
    const body = $('#p-body').value.trim();
    if (!title || !body) return toast('Título e conteúdo são obrigatórios', 'error');
    const btn = m.el.querySelector('[data-save]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(0,0,0,.3);border-top-color:#000;border-radius:50%;animation:spin 1s linear infinite"></span> Salvando…';

    try {
      let cover_url = post.cover_url || '';
      if (coverFile) {
        if (post.cover_url) await deleteFromStoragePath(post.cover_url).catch(()=>{});
        const up = await uploadToStorage(coverFile, 'covers');
        cover_url = up.url;
      }
      // upload de novas mídias (com _file)
      const finalMedia = [];
      for (const m of mediaList) {
        if (m._file) {
          const up = await uploadToStorage(m._file, 'posts');
          finalMedia.push({ url: up.url, type: m.type, name: up.name });
        } else {
          finalMedia.push({ url: m.url, type: m.type, name: m.name || '' });
        }
      }
      const payload = {
        title, excerpt: $('#p-excerpt').value.trim(), body,
        cover_url, media: finalMedia
      };
      let res;
      if (id) {
        res = await sb.from('posts').update(payload).eq('id', id).eq('brand', currentBrand.id);
      } else {
        res = await sb.from('posts').insert({ ...payload, brand: currentBrand.id });
      }
      if (res.error) throw res.error;
      toast(id ? 'Post atualizado' : 'Post publicado', 'success');
      m.close();
      RENDERS.posts();
    } catch (e) {
      toast('Erro: ' + e.message, 'error');
      btn.disabled = false; btn.innerHTML = '<svg class="ic"><use href="#i-check"/></svg> ' + (id ? 'Salvar' : 'Publicar');
    }
  };
}

// ============== ROUTE: CONTENT BLOCKS ==============
RENDERS.content = async function () {
  const root = $('#route-content');
  root.innerHTML = `
    <div class="toolbar">
      <div class="left">
        <input class="search-input" id="cb-q" placeholder="Buscar texto…">
      </div>
      <div class="right">
        <button class="btn" id="btn-new-cb"><svg class="ic"><use href="#i-plus"/></svg> Novo bloco</button>
      </div>
    </div>
    <p class="muted" style="color:var(--muted);font-size:.88rem;margin-bottom:18px">
      Edite os textos do site público. As alterações ficam visíveis em tempo real para os visitantes.
    </p>
    <div id="cb-pages"></div>
  `;
  let allBlocks = [];
  async function load() {
    const { data, error } = await sb.from('content_blocks').select('*').eq('brand', currentBrand.id).order('page').order('key');
    if (error) return toast('Erro: ' + error.message, 'error');
    allBlocks = data || [];
    render();
  }
  function render() {
    const q = $('#cb-q').value.toLowerCase().trim();
    const blocks = q ? allBlocks.filter(b => b.key.toLowerCase().includes(q) || (b.value || '').toLowerCase().includes(q) || b.page.toLowerCase().includes(q)) : allBlocks;
    if (!blocks.length) {
      $('#cb-pages').innerHTML = `<div class="empty"><svg><use href="#i-text"/></svg><p>Nenhum bloco encontrado.</p></div>`;
      return;
    }
    const grouped = {};
    blocks.forEach(b => { (grouped[b.page] ||= []).push(b); });
    $('#cb-pages').innerHTML = Object.entries(grouped).map(([page, items]) => `
      <div class="card">
        <h3>📄 ${escapeHtml(page)} <span class="badge blue" style="font-size:.65rem;margin-left:6px">${items.length}</span></h3>
        <div class="list" style="background:transparent;border:0;border-top:1px solid var(--line)">
          ${items.map(b => `
            <div class="list-row row-content" data-id="${b.id}">
              <div class="info"><strong>${escapeHtml(b.key)}</strong><small style="color:var(--muted)">${escapeHtml(b.label || '')}</small></div>
              <div class="info"><small style="color:var(--soft);white-space:normal;line-height:1.4">${escapeHtml((b.value || '').slice(0, 120))}${(b.value||'').length>120?'…':''}</small></div>
              <div class="actions">
                <button class="btn sm" data-edit><svg class="ic"><use href="#i-edit"/></svg> Editar</button>
                <button class="btn sm danger" data-del title="Excluir bloco"><svg class="ic"><use href="#i-trash"/></svg></button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
    $('#cb-pages').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editBlock(b.closest('.list-row').dataset.id));
    $('#cb-pages').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const id = b.closest('.list-row').dataset.id;
      const blk = allBlocks.find(x => x.id === id);
      if (!await confirmDialog(`Excluir o bloco "${blk.key}"?`)) return;
      const { error } = await sb.from('content_blocks').delete().eq('id', id).eq('brand', currentBrand.id);
      if (error) return toast('Erro: ' + error.message, 'error');
      toast('Bloco excluído', 'success'); load();
    });
  }
  $('#cb-q').oninput = debounce(render, 200);
  $('#btn-new-cb').onclick = () => editBlock(null);

  async function editBlock(id) {
    const blk = id ? allBlocks.find(b => b.id === id) : { page:'global', key:'', value:'', label:'' };
    const isNew = !id;
    const m = modal(`
      <h3>${isNew ? 'Novo bloco' : 'Editar bloco'}</h3>
      <div class="body">
        <div class="fld">
          <label>Página *</label>
          <input type="text" id="b-page" value="${escapeHtml(blk.page)}" placeholder="ex: home, sobre, global" ${isNew ? '' : 'readonly'}>
        </div>
        <div class="fld">
          <label>Chave *</label>
          <input type="text" id="b-key" value="${escapeHtml(blk.key)}" placeholder="ex: hero_title" ${isNew ? '' : 'readonly'}>
          <span class="hint">Identificador único (sem espaços). Deve combinar com data-cb="page.key" no HTML.</span>
        </div>
        <div class="fld">
          <label>Rótulo (descrição)</label>
          <input type="text" id="b-label" value="${escapeHtml(blk.label || '')}" placeholder="ex: Título do hero">
        </div>
        <div class="fld">
          <label>Valor</label>
          <textarea id="b-value" rows="6">${escapeHtml(blk.value || '')}</textarea>
        </div>
      </div>
      <div class="foot">
        <button class="btn" data-cancel>Cancelar</button>
        <button class="btn solid" data-save><svg class="ic"><use href="#i-check"/></svg> Salvar</button>
      </div>
    `);
    m.el.querySelector('[data-cancel]').onclick = m.close;
    m.el.querySelector('[data-save]').onclick = async () => {
      const page = $('#b-page').value.trim().toLowerCase();
      const key = $('#b-key').value.trim();
      const value = $('#b-value').value;
      const label = $('#b-label').value.trim();
      if (!page || !key) return toast('Página e chave obrigatórios', 'error');
      let res;
      if (isNew) {
        res = await sb.from('content_blocks').insert({ brand: currentBrand.id, page, key, value, label });
      } else {
        res = await sb.from('content_blocks').update({ value, label }).eq('id', id).eq('brand', currentBrand.id);
      }
      if (res.error) return toast('Erro: ' + res.error.message, 'error');
      toast('Salvo', 'success'); m.close(); load();
    };
  }
  await load();
};

// ============== ROUTE: MEDIA ==============
RENDERS.media = async function () {
  const root = $('#route-media');
  root.innerHTML = `
    <div class="toolbar">
      <div class="left"><p class="muted" style="color:var(--muted);font-size:.86rem">Galeria global de mídia. Imagens e vídeos enviados aqui ficam disponíveis para reutilização.</p></div>
      <div class="right">
        <label class="btn solid" style="position:relative">
          <svg class="ic"><use href="#i-up"/></svg> Enviar arquivo
          <input type="file" accept="image/*,video/*" multiple id="lib-up" style="position:absolute;inset:0;opacity:0;cursor:pointer">
        </label>
      </div>
    </div>
    <div class="list" id="lib-list">
      <div class="empty"><svg><use href="#i-image"/></svg><p>Carregando…</p></div>
    </div>
  `;
  async function load() {
    const { data, error } = await sb.from('media_library').select('*').eq('brand', currentBrand.id).order('created_at', { ascending: false });
    if (error) return toast('Erro: ' + error.message, 'error');
    const list = $('#lib-list');
    if (!data?.length) { list.innerHTML = `<div class="empty"><svg><use href="#i-image"/></svg><p>Nenhuma mídia ainda. Envie a primeira!</p></div>`; return; }
    list.innerHTML = `<div class="list-row head row-media"><div></div><div>Arquivo</div><div>Tipo</div><div></div></div>` + data.map(m => `
      <div class="list-row row-media" data-id="${m.id}">
        <div class="thumb" style="${m.kind === 'image' ? `background-image:url('${m.url}')` : 'background:#1a1a1a'}">${m.kind === 'video' ? '🎬' : ''}</div>
        <div class="info"><strong>${escapeHtml(m.name || '(sem nome)')}</strong><small>${fmtDate(m.created_at)}</small></div>
        <div><span class="badge ${m.kind === 'video' ? 'amber' : 'blue'}">${m.kind}</span></div>
        <div class="actions">
          <button class="btn sm" data-copy><svg class="ic"><use href="#i-link"/></svg></button>
          <a class="btn sm" target="_blank" href="${m.url}"><svg class="ic"><use href="#i-eye"/></svg></a>
          <button class="btn sm danger" data-del><svg class="ic"><use href="#i-trash"/></svg></button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => {
      const id = b.closest('.list-row').dataset.id;
      const item = data.find(x => x.id === id);
      navigator.clipboard.writeText(item.url);
      toast('URL copiada!', 'success');
    });
    list.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const id = b.closest('.list-row').dataset.id;
      const item = data.find(x => x.id === id);
      if (!await confirmDialog(`Excluir "${item.name}"?`)) return;
      await deleteFromStoragePath(item.url).catch(()=>{});
      await sb.from('media_library').delete().eq('id', id).eq('brand', currentBrand.id);
      toast('Removido', 'success'); load();
    });
  }
  $('#lib-up').onchange = async e => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      try {
        const up = await uploadToStorage(f, 'library');
        const kind = f.type.startsWith('video') ? 'video' : 'image';
        await sb.from('media_library').insert({ url: up.url, name: f.name, kind, mime: f.type, size: f.size, brand: currentBrand.id });
        toast(`Enviado: ${f.name}`, 'success');
      } catch (err) {
        toast(`Erro em ${f.name}: ${err.message}`, 'error');
      }
    }
    load();
  };
  await load();
};

// ============== ROUTE: INSTAGRAM ==============
RENDERS.insta = async function () {
  const root = $('#route-insta');
  root.innerHTML = `
    <div class="toolbar">
      <div class="left"><p class="muted" style="color:var(--muted);font-size:.86rem">Posts e reels do Instagram que aparecem na página do Blog.</p></div>
      <div class="right"><button class="btn solid" id="btn-new-insta"><svg class="ic"><use href="#i-plus"/></svg> Adicionar URL</button></div>
    </div>
    <div class="list" id="insta-list"><div class="empty">Carregando…</div></div>
  `;
  async function load() {
    const { data, error } = await sb.from('insta_posts').select('*').eq('brand', currentBrand.id).order('position', { ascending: true });
    if (error) return toast('Erro: ' + error.message, 'error');
    const list = $('#insta-list');
    if (!data?.length) { list.innerHTML = `<div class="empty"><svg><use href="#i-instagram"/></svg><p>Nenhum post adicionado ainda.</p></div>`; return; }
    list.innerHTML = `<div class="list-row head row-insta"><div>URL</div><div>Posição</div><div></div></div>` + data.map(i => `
      <div class="list-row row-insta" data-id="${i.id}">
        <div class="info"><strong style="font-size:.85rem">${escapeHtml(i.url)}</strong><small>${fmtDate(i.created_at)}</small></div>
        <div class="num">#${i.position}</div>
        <div class="actions">
          <a class="btn sm" target="_blank" href="${i.url}"><svg class="ic"><use href="#i-eye"/></svg></a>
          <button class="btn sm danger" data-del><svg class="ic"><use href="#i-trash"/></svg></button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const id = b.closest('.list-row').dataset.id;
      if (!await confirmDialog('Remover este post do Instagram?')) return;
      await sb.from('insta_posts').delete().eq('id', id).eq('brand', currentBrand.id);
      toast('Removido', 'success'); load();
    });
  }
  $('#btn-new-insta').onclick = () => {
    const m = modal(`
      <h3>Adicionar post do Instagram</h3>
      <div class="body">
        <div class="fld">
          <label>URL do post ou reel *</label>
          <input type="url" id="ig-url" placeholder="https://www.instagram.com/p/Cxxxxxxx/">
          <span class="hint">Cole a URL completa de um post (/p/) ou reel (/reel/) público.</span>
        </div>
        <div class="fld">
          <label>Posição</label>
          <input type="number" id="ig-pos" min="0" value="0">
          <span class="hint">Ordem no carrossel (menor aparece primeiro).</span>
        </div>
      </div>
      <div class="foot">
        <button class="btn" data-cancel>Cancelar</button>
        <button class="btn solid" data-save>Adicionar</button>
      </div>
    `);
    m.el.querySelector('[data-cancel]').onclick = m.close;
    m.el.querySelector('[data-save]').onclick = async () => {
      const url = $('#ig-url').value.trim();
      const position = parseInt($('#ig-pos').value || '0', 10);
      if (!/^https?:\/\/(www\.)?instagram\.com\//i.test(url)) return toast('URL inválida', 'error');
      const { error } = await sb.from('insta_posts').insert({ url, position, brand: currentBrand.id });
      if (error) return toast('Erro: ' + error.message, 'error');
      toast('Adicionado', 'success'); m.close(); load();
    };
  };
  await load();
};

// ============== START ==============
tryAutoLogin();
