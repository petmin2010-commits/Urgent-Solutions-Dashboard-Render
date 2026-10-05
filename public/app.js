const state = {
  user: null,
  permissions: [],
  lookups: null,
  installPrompt: null,
  currentView: 'entry',
  editingId: null
};

const $ = (id) => document.getElementById(id);
const qa = (sel, root = document) => [...root.querySelectorAll(sel)];
const DRAFT_KEY = 'madinah-water-entry-draft-v1';

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toast(message, type = '') {
  const el = $('toast');
  el.textContent = message;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast'; }, 3000);
}

async function api(url, options = {}) {
  const opts = { credentials: 'same-origin', ...options };
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({ ok: false, error: 'استجابة غير صالحة من الخادم' }));
  if (!res.ok) {
    const err = new Error(data.error || (data.errors || []).join('، ') || 'تعذر تنفيذ العملية');
    err.data = data;
    err.status = res.status;
    if (res.status === 401) showLogin();
    throw err;
  }
  return data;
}

function toInputDateTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function showLogin() {
  $('loginView').classList.remove('hidden');
  $('appView').classList.add('hidden');
}

function showApp() {
  $('loginView').classList.add('hidden');
  $('appView').classList.remove('hidden');
}

function permission(code) {
  return state.permissions.includes(code);
}

function optionHtml(rows, placeholder) {
  return '<option value="">' + esc(placeholder) + '</option>' +
    (rows || []).map(x => '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>').join('');
}

function renderLookups() {
  const x = state.lookups || {};
  $('regionId').innerHTML = optionHtml(x.regions, 'اختر المنطقة');
  $('inspectorId').innerHTML = optionHtml(x.inspectors, 'اختر المراقب');
  $('contractorId').innerHTML = optionHtml(x.contractors, 'اختر المقاول');
  $('breakTypeId').innerHTML = optionHtml(x.breakTypes, 'اختر وصف الانكسار');
  $('repairStatusId').innerHTML = optionHtml(x.repairStatuses, 'اختر حالة الإصلاح');

  $('filterRegion').innerHTML = optionHtml(x.regions, 'كل المناطق');
  $('filterStatus').innerHTML = optionHtml(x.repairStatuses, 'كل الحالات');
}

function setUserUi() {
  const u = state.user;
  $('userName').textContent = u.employee_name || 'المستخدم';
  $('userRole').textContent = u.role_name_ar || '';
  $('userAvatar').textContent = (u.employee_name || 'م').trim().charAt(0);
  qa('.admin-only').forEach(el => el.classList.toggle('hidden', !permission('SETTINGS_MANAGE')));
  qa('.audit-only').forEach(el => el.classList.toggle('hidden', !permission('AUDIT_VIEW')));
}

const viewMeta = {
  entry: ['إدخال حالة جديدة', 'شاشة موحدة لجميع بيانات الحالة'],
  works: ['سجل الأعمال', 'البحث والمراجعة والتعديل'],
  dashboard: ['الرئيسية', 'مؤشرات تشغيلية مباشرة'],
  settings: ['إدارة القوائم', 'إدارة القيم المرجعية بدون تعديل الكود'],
  audit: ['سجل التدقيق', 'متابعة عمليات المستخدمين والتعديلات']
};

function openView(name) {
  if (name === 'settings' && !permission('SETTINGS_MANAGE')) name = 'entry';
  if (name === 'audit' && !permission('AUDIT_VIEW')) name = 'entry';
  state.currentView = name;

  qa('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  qa('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  const meta = viewMeta[name] || viewMeta.entry;
  $('pageTitle').textContent = meta[0];
  $('pageSubtitle').textContent = meta[1];
  $('sidebar').classList.remove('open');

  if (name === 'works') loadWorks();
  if (name === 'dashboard') loadStats();
  if (name === 'audit') loadAudit();
}

function getFormPayload() {
  return {
    requestNo: $('requestNo').value,
    registeredAt: $('registeredAt').value,
    wfmNo: $('wfmNo').value,
    regionId: $('regionId').value,
    neighborhood: $('neighborhood').value,
    inspectorId: $('inspectorId').value,
    contractorId: $('contractorId').value,
    municipalityPermitNo: $('municipalityPermitNo').value,
    hasHsePermit: $('hasHsePermit').checked,
    locationText: $('locationText').value,
    latitude: $('latitude').value,
    longitude: $('longitude').value,
    startedAt: $('startedAt').value,
    finishedAt: $('finishedAt').value,
    depthM: $('depthM').value,
    breakTypeId: $('breakTypeId').value,
    repairStatusId: $('repairStatusId').value,
    notes: $('notes').value
  };
}

function setFormPayload(v = {}) {
  $('requestNo').value = v.requestNo || '';
  $('registeredAt').value = v.registeredAt ? toInputDateTime(v.registeredAt) : toInputDateTime();
  $('wfmNo').value = v.wfmNo || '';
  $('regionId').value = v.regionId || '';
  $('neighborhood').value = v.neighborhood || '';
  $('inspectorId').value = v.inspectorId || '';
  $('contractorId').value = v.contractorId || '';
  $('municipalityPermitNo').value = v.municipalityPermitNo || '';
  $('hasHsePermit').checked = !!v.hasHsePermit;
  $('locationText').value = v.locationText || '';
  $('latitude').value = v.latitude == null ? '' : v.latitude;
  $('longitude').value = v.longitude == null ? '' : v.longitude;
  $('startedAt').value = v.startedAt ? toInputDateTime(v.startedAt) : '';
  $('finishedAt').value = v.finishedAt ? toInputDateTime(v.finishedAt) : '';
  $('depthM').value = v.depthM == null ? '' : v.depthM;
  $('breakTypeId').value = v.breakTypeId || '';
  $('repairStatusId').value = v.repairStatusId || '';
  $('notes').value = v.notes || '';
}

function saveDraft() {
  if (state.editingId) return;
  const draft = getFormPayload();
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), data: draft }));
  $('draftChip').textContent = 'المسودة محفوظة تلقائيًا';
}

function restoreDraft() {
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!raw || !raw.data) return false;
    const meaningful = Object.entries(raw.data).some(([k, v]) => k !== 'registeredAt' && v !== '' && v !== false);
    if (!meaningful) return false;
    setFormPayload(raw.data);
    $('draftChip').textContent = 'تم استرجاع المسودة';
    return true;
  } catch {
    return false;
  }
}

function clearForm({ keepDraft = false } = {}) {
  state.editingId = null;
  $('workId').value = '';
  $('workForm').reset();
  $('registeredAt').value = toInputDateTime();
  $('entryTitle').textContent = 'تسجيل حالة جديدة';
  $('saveWorkBtn').textContent = 'حفظ الحالة';
  $('workErrors').textContent = '';
  $('mediaPreview').innerHTML = '';
  $('mediaFiles').value = '';
  if (!keepDraft) localStorage.removeItem(DRAFT_KEY);
  $('draftChip').textContent = 'لا توجد مسودة';
}

async function loadWorkForEdit(id) {
  try {
    const data = await api('/api/works/' + encodeURIComponent(id));
    state.editingId = id;
    $('workId').value = id;
    setFormPayload(data.work);
    $('entryTitle').textContent = 'تعديل ' + data.work.caseCode;
    $('saveWorkBtn').textContent = 'حفظ التعديلات';
    $('draftChip').textContent = 'وضع التعديل';
    $('mediaPreview').innerHTML = (data.media || []).map(m =>
      '<a class="media-pill" href="' + esc(m.url) + '" target="_blank" rel="noopener">' + esc(m.originalName) + '</a>'
    ).join('');
    openView('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function uploadMedia(workId) {
  const files = [...$('mediaFiles').files];
  if (!files.length) return;
  const fd = new FormData();
  files.forEach(file => fd.append('files', file));
  await api('/api/works/' + encodeURIComponent(workId) + '/media', { method: 'POST', body: fd });
}

async function submitWork(event) {
  event.preventDefault();
  $('workErrors').textContent = '';
  const btn = $('saveWorkBtn');
  btn.disabled = true;
  btn.textContent = 'جارٍ الحفظ...';
  try {
    const payload = getFormPayload();
    const url = state.editingId ? '/api/works/' + encodeURIComponent(state.editingId) : '/api/works';
    const method = state.editingId ? 'PUT' : 'POST';
    const data = await api(url, { method, body: payload });
    await uploadMedia(data.work.id);
    localStorage.removeItem(DRAFT_KEY);
    toast(state.editingId ? 'تم حفظ التعديلات' : 'تم تسجيل الحالة بنجاح: ' + data.work.caseCode);
    clearForm();
    await loadStats();
  } catch (e) {
    const errors = e.data && e.data.errors ? e.data.errors : [e.message];
    $('workErrors').innerHTML = errors.map(x => '• ' + esc(x)).join('<br>');
    toast('راجع بيانات الحالة', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = state.editingId ? 'حفظ التعديلات' : 'حفظ الحالة';
  }
}

async function loadWorks() {
  const q = new URLSearchParams({
    pageSize: '100',
    search: $('workSearch').value.trim(),
    regionId: $('filterRegion').value,
    repairStatusId: $('filterStatus').value
  });
  try {
    const data = await api('/api/works?' + q.toString());
    $('worksCount').textContent = data.total + ' سجل';
    $('worksBody').innerHTML = data.rows.length ? data.rows.map(w => {
      const dt = w.registeredAt ? new Date(w.registeredAt).toLocaleString('ar-SA') : '';
      const closed = (state.lookups.repairStatuses.find(x => x.id === w.repairStatusId) || {}).isClosed;
      return '<tr>' +
        '<td><strong>' + esc(w.caseCode) + '</strong></td>' +
        '<td>' + esc(w.wfmNo) + '</td>' +
        '<td>' + esc(dt) + '</td>' +
        '<td>' + esc(w.region) + '</td>' +
        '<td>' + esc(w.neighborhood) + '</td>' +
        '<td>' + esc(w.inspector) + '</td>' +
        '<td>' + esc(w.contractor) + '</td>' +
        '<td><span class="status-text ' + (closed ? 'closed' : '') + '">' + esc(w.repairStatus) + '</span></td>' +
        '<td><button class="table-action" data-edit-work="' + esc(w.id) + '">فتح</button></td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="9" class="muted">لا توجد حالات مسجلة حتى الآن.</td></tr>';
  } catch (e) {
    toast(e.message, 'error');
  }
}

function statCard(label, value, suffix = '') {
  return '<article class="stat-card"><small>' + esc(label) + '</small><strong>' + esc(value) + suffix + '</strong></article>';
}

async function loadStats() {
  try {
    const data = await api('/api/stats');
    const s = data.stats;
    $('statsGrid').innerHTML =
      statCard('إجمالي الحالات', s.total) +
      statCard('حالات اليوم', s.today) +
      statCard('مغلقة / تم الإصلاح', s.closed) +
      statCard('مفتوحة', s.open) +
      statCard('بتصريح أمن وسلامة', s.hsePermit) +
      statCard('نسبة الإغلاق', s.completionRate, '%');
  } catch (e) {
    if (e.status !== 401) toast(e.message, 'error');
  }
}

async function loadAudit() {
  if (!permission('AUDIT_VIEW')) return;
  try {
    const data = await api('/api/audit');
    $('auditBody').innerHTML = data.rows.length ? data.rows.map(r =>
      '<tr><td>' + esc(new Date(r.created_at).toLocaleString('ar-SA')) + '</td>' +
      '<td>' + esc(r.employee_name || '-') + '</td>' +
      '<td>' + esc(r.action) + '</td>' +
      '<td>' + esc(r.entity_type) + '</td>' +
      '<td>' + esc(r.entity_id || '-') + '</td></tr>'
    ).join('') : '<tr><td colspan="5">لا توجد عمليات مسجلة.</td></tr>';
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function addLookup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const type = form.dataset.lookup;
  const fd = new FormData(form);
  const body = {
    name: String(fd.get('name') || '').trim(),
    isClosed: fd.get('isClosed') === 'on'
  };
  try {
    const data = await api('/api/lookups/' + type, { method: 'POST', body });
    state.lookups = data.lookups;
    renderLookups();
    form.reset();
    toast('تمت إضافة القيمة');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function bootstrap() {
  try {
    const data = await api('/api/bootstrap');
    if (!data.authenticated) {
      showLogin();
      return;
    }
    state.user = data.user;
    state.permissions = data.user.permissions || [];
    state.lookups = data.lookups;
    renderLookups();
    setUserUi();
    showApp();
    clearForm({ keepDraft: true });
    restoreDraft();
    await loadStats();
  } catch (e) {
    showLogin();
  }
}

function updateConnection() {
  const online = navigator.onLine;
  $('connectionBadge').textContent = online ? 'متصل' : 'بدون اتصال';
  $('connectionBadge').classList.toggle('online', online);
  $('connectionBadge').classList.toggle('offline', !online);
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('loginError').textContent = '';
  try {
    await api('/api/auth/login', {
      method: 'POST',
      body: { email: $('loginEmail').value, password: $('loginPassword').value }
    });
    await bootstrap();
  } catch (err) {
    $('loginError').textContent = err.message;
  }
});

$('logoutBtn').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  state.user = null;
  state.permissions = [];
  showLogin();
});

qa('[data-view]').forEach(btn => btn.addEventListener('click', () => openView(btn.dataset.view)));
qa('[data-open-entry]').forEach(btn => btn.addEventListener('click', () => { clearForm(); openView('entry'); }));
$('menuBtn').addEventListener('click', () => $('sidebar').classList.toggle('open'));
$('workForm').addEventListener('submit', submitWork);
$('workForm').addEventListener('input', () => {
  clearTimeout(saveDraft._t);
  saveDraft._t = setTimeout(saveDraft, 500);
});
$('newWorkBtn').addEventListener('click', () => clearForm());
$('refreshWorks').addEventListener('click', loadWorks);
$('refreshStats').addEventListener('click', loadStats);
$('refreshAudit').addEventListener('click', loadAudit);
$('workSearch').addEventListener('input', () => {
  clearTimeout(loadWorks._t);
  loadWorks._t = setTimeout(loadWorks, 350);
});
$('filterRegion').addEventListener('change', loadWorks);
$('filterStatus').addEventListener('change', loadWorks);
qa('.lookup-card').forEach(form => form.addEventListener('submit', addLookup));

$('worksBody').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-edit-work]');
  if (btn) loadWorkForEdit(btn.dataset.editWork);
});

$('mediaFiles').addEventListener('change', () => {
  $('mediaPreview').innerHTML = [...$('mediaFiles').files].map(f =>
    '<span class="media-pill">' + esc(f.name) + ' · ' + Math.round(f.size / 1024) + ' KB</span>'
  ).join('');
});

$('gpsBtn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    $('gpsStatus').textContent = 'المتصفح لا يدعم تحديد الموقع';
    return;
  }
  $('gpsStatus').textContent = 'جارٍ تحديد الموقع...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      $('latitude').value = pos.coords.latitude.toFixed(7);
      $('longitude').value = pos.coords.longitude.toFixed(7);
      $('gpsStatus').textContent = 'تم التقاط الموقع بدقة ±' + Math.round(pos.coords.accuracy) + ' م';
      saveDraft();
    },
    err => { $('gpsStatus').textContent = 'تعذر تحديد الموقع: ' + err.message; },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 }
  );
});

window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
updateConnection();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.installPrompt = e;
  $('installBtn').classList.remove('hidden');
});
$('installBtn').addEventListener('click', async () => {
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  $('installBtn').classList.add('hidden');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

bootstrap();
