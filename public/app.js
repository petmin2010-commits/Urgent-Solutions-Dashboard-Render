const state = {
  user: null,
  permissions: [],
  lookups: null,
  roles: [],
  users: [],
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
  $('filterInspector').innerHTML = optionHtml(x.inspectors, 'كل المراقبين');
  $('filterContractor').innerHTML = optionHtml(x.contractors, 'كل المقاولين');
  $('userScopeValue').innerHTML = optionHtml(x.regions, 'اختر المنطقة');
}

function setUserUi() {
  const u = state.user;
  $('userName').textContent = u.employee_name || 'المستخدم';
  $('userRole').textContent = u.role_name_ar || '';
  $('userAvatar').textContent = (u.employee_name || 'م').trim().charAt(0);
  qa('.users-only').forEach(el => el.classList.toggle('hidden', !permission('USER_VIEW')));
  qa('.user-admin-only').forEach(el => el.classList.toggle('hidden', !(permission('USER_CREATE') || permission('USER_EDIT'))));
  qa('.admin-only').forEach(el => el.classList.toggle('hidden', !permission('SETTINGS_MANAGE')));
  qa('.audit-only').forEach(el => el.classList.toggle('hidden', !permission('AUDIT_VIEW')));
}

const viewMeta = {
  entry: ['إدخال حالة جديدة', 'شاشة موحدة لجميع بيانات الحالة'],
  works: ['سجل الأعمال', 'البحث والمراجعة والتعديل'],
  dashboard: ['الرئيسية', 'مؤشرات تشغيلية مباشرة'],
  users: ['المستخدمون', 'إدارة الحسابات والأدوار'],
  settings: ['إدارة القوائم', 'إدارة القيم المرجعية بدون تعديل الكود'],
  audit: ['سجل التدقيق', 'متابعة عمليات المستخدمين والتعديلات']
};

function openView(name) {
  if (name === 'users' && !permission('USER_VIEW')) name = 'entry';
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
  if (name === 'users') loadUsers();
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
  $('cameraFile').value = '';
  $('workHistoryList').innerHTML = '';
  $('workHistoryPanel').classList.add('hidden');
  $('wfmHint').textContent = '';
  $('wfmHint').className = 'field-hint';
  if (!keepDraft) localStorage.removeItem(DRAFT_KEY);
  $('draftChip').textContent = 'لا توجد مسودة';
}

function historyActionLabel(action) {
  return ({
    CREATE: 'إنشاء الحالة',
    UPDATE: 'تعديل بيانات الحالة',
    MEDIA_ADD: 'إضافة مرفقات',
    DELETE: 'حذف الحالة'
  })[action] || action;
}

function renderWorkHistory(rows) {
  $('workHistoryPanel').classList.remove('hidden');
  $('workHistoryList').innerHTML = (rows || []).length ? rows.map(r =>
    '<div class="history-item">' +
      '<span class="history-dot"></span>' +
      '<div><strong>' + esc(historyActionLabel(r.action)) + '</strong>' +
      '<small>' + esc(r.userName || 'النظام') + ' · ' + esc(new Date(r.createdAt).toLocaleString('ar-SA')) + '</small></div>' +
    '</div>'
  ).join('') : '<div class="muted">لا يوجد سجل تغييرات.</div>';
}

async function loadWorkForEdit(id) {
  try {
    const [data, history] = await Promise.all([
      api('/api/works/' + encodeURIComponent(id)),
      api('/api/works/' + encodeURIComponent(id) + '/history')
    ]);
    state.editingId = id;
    $('workId').value = id;
    setFormPayload(data.work);
    syncClosureRule();
    $('entryTitle').textContent = 'تعديل ' + data.work.caseCode;
    $('saveWorkBtn').textContent = 'حفظ التعديلات';
    $('draftChip').textContent = 'وضع التعديل';
    $('mediaPreview').innerHTML = (data.media || []).map(m =>
      '<a class="media-pill" href="' + esc(m.url) + '" target="_blank" rel="noopener">' + esc(m.originalName) + '</a>'
    ).join('');
    renderWorkHistory(history.rows || []);
    openView('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    toast(e.message, 'error');
  }
}

function selectedMediaFiles() {
  return [...$('mediaFiles').files, ...$('cameraFile').files];
}

async function uploadMedia(workId) {
  const files = selectedMediaFiles();
  if (!files.length) return;
  const fd = new FormData();
  files.forEach(file => fd.append('files', file));
  await api('/api/works/' + encodeURIComponent(workId) + '/media', { method: 'POST', body: fd });
}

async function checkWfmDuplicate() {
  const wfm = $('wfmNo').value.trim();
  if (!wfm) {
    $('wfmHint').textContent = '';
    $('wfmHint').className = 'field-hint';
    return false;
  }
  try {
    const q = new URLSearchParams({ wfm });
    if (state.editingId) q.set('excludeId', state.editingId);
    const data = await api('/api/works/check-wfm?' + q.toString());
    if (data.duplicate) {
      const first = data.matches[0];
      $('wfmHint').textContent = first
        ? 'تنبيه: رقم WFM مسجل سابقًا في ' + first.caseCode + (first.region ? ' — ' + first.region : '')
        : 'تنبيه: رقم WFM مسجل سابقًا في النظام';
      $('wfmHint').className = 'field-hint warn';
      return true;
    }
    $('wfmHint').textContent = 'لم يتم العثور على تسجيل سابق لهذا الرقم';
    $('wfmHint').className = 'field-hint ok';
    return false;
  } catch (e) {
    $('wfmHint').textContent = '';
    return false;
  }
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

function currentWorkQuery() {
  return new URLSearchParams({
    pageSize: '100',
    search: $('workSearch').value.trim(),
    regionId: $('filterRegion').value,
    repairStatusId: $('filterStatus').value,
    inspectorId: $('filterInspector').value,
    contractorId: $('filterContractor').value,
    dateFrom: $('filterDateFrom').value,
    dateTo: $('filterDateTo').value
  });
}

function exportWorks() {
  const q = currentWorkQuery();
  q.delete('pageSize');
  const a = document.createElement('a');
  a.href = '/api/works/export.csv?' + q.toString();
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function loadWorks() {
  const q = currentWorkQuery();
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

function renderMiniBars(targetId, rows, closedAware = false) {
  const target = $(targetId);
  const max = Math.max(1, ...(rows || []).map(x => Number(x.value || 0)));
  target.innerHTML = (rows || []).length ? rows.map(x => {
    const width = Math.max(4, Math.round((Number(x.value || 0) / max) * 100));
    return '<div class="mini-bar-row">' +
      '<div class="mini-bar-label"><span>' + esc(x.label) + '</span><strong>' + esc(x.value) + '</strong></div>' +
      '<div class="mini-bar-track"><i style="width:' + width + '%" class="' + (closedAware && x.isClosed ? 'closed' : '') + '"></i></div>' +
      '</div>';
  }).join('') : '<div class="muted">لا توجد بيانات بعد.</div>';
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
      statCard('نسبة الإغلاق', s.completionRate, '%') +
      statCard('بيانات موقع GPS', s.locationRate, '%') +
      statCard('حالات بمرفقات', s.mediaRate, '%') +
      statCard('بتصريح أمن وسلامة', s.hsePermit);
    renderMiniBars('regionBars', s.topRegions || []);
    renderMiniBars('statusBars', s.byStatus || [], true);
  } catch (e) {
    if (e.status !== 401) toast(e.message, 'error');
  }
}

function syncUserScopeUi() {
  const isRegion = $('userScopeType').value === 'REGION';
  $('userScopeRegionWrap').classList.toggle('hidden', !isRegion);
  $('userScopeValue').required = isRegion;
  if (!isRegion) $('userScopeValue').value = '';
}

function resetUserForm() {
  $('userId').value = '';
  $('userForm').reset();
  $('userCanLogin').checked = true;
  $('userActive').checked = true;
  $('userScopeType').value = 'ALL';
  $('userScopeValue').value = '';
  $('userEmail').disabled = false;
  $('userPassword').required = true;
  $('userFormTitle').textContent = 'إضافة مستخدم';
  $('userFormError').textContent = '';
  syncUserScopeUi();
}

function fillUserForm(id) {
  const u = state.users.find(x => x.id === id);
  if (!u) return;
  $('userId').value = u.id;
  $('userFullName').value = u.name || '';
  $('userJobTitle').value = u.jobTitle || '';
  $('userEmail').value = u.email || '';
  $('userEmail').disabled = true;
  $('userRoleId').value = u.roleId || '';
  $('userScopeType').value = u.scopeType || 'ALL';
  $('userScopeValue').value = u.scopeValue || '';
  syncUserScopeUi();
  $('userPassword').value = '';
  $('userPassword').required = false;
  $('userCanLogin').checked = !!u.canLogin;
  $('userActive').checked = !!u.active;
  $('userFormTitle').textContent = 'تعديل المستخدم';
  $('userFormError').textContent = '';
}

async function loadUsers() {
  if (!permission('USER_VIEW')) return;
  try {
    const [usersData, rolesData] = await Promise.all([api('/api/users'), api('/api/roles')]);
    state.users = usersData.rows || [];
    state.roles = rolesData.rows || [];
    $('userRoleId').innerHTML = optionHtml(state.roles, 'اختر الدور');
    $('usersCount').textContent = state.users.length + ' مستخدم';
    $('usersBody').innerHTML = state.users.length ? state.users.map(u =>
      '<tr>' +
      '<td><strong>' + esc(u.name) + '</strong><br><span class="muted">' + esc(u.jobTitle || '') + '</span></td>' +
      '<td>' + esc(u.email) + '</td>' +
      '<td>' + esc(u.roleName) + '</td>' +
      '<td>' + (u.canLogin ? '<span class="status-text closed">مسموح</span>' : '<span class="status-text">موقوف</span>') + '</td>' +
      '<td>' + (u.active ? '<span class="status-text closed">فعال</span>' : '<span class="status-text">غير فعال</span>') + '</td>' +
      '<td>' + esc(u.lastLogin ? new Date(u.lastLogin).toLocaleString('ar-SA') : 'لم يدخل') + '</td>' +
      '<td>' + (permission('USER_EDIT') ? '<button class="table-action" data-edit-user="' + esc(u.id) + '">تعديل</button>' : '') + '</td>' +
      '</tr>'
    ).join('') : '<tr><td colspan="7">لا يوجد مستخدمون.</td></tr>';
    if (!$('userId').value) resetUserForm();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function saveUser(event) {
  event.preventDefault();
  $('userFormError').textContent = '';
  const editingId = $('userId').value;
  const body = {
    name: $('userFullName').value,
    jobTitle: $('userJobTitle').value,
    email: $('userEmail').value,
    roleId: $('userRoleId').value,
    scopeType: $('userScopeType').value,
    scopeValue: $('userScopeType').value === 'REGION' ? $('userScopeValue').value : '',
    password: $('userPassword').value,
    canLogin: $('userCanLogin').checked,
    active: $('userActive').checked
  };
  if (!editingId && !permission('USER_CREATE')) {
    $('userFormError').textContent = 'ليس لديك صلاحية إنشاء مستخدم.';
    return;
  }
  try {
    await api(editingId ? '/api/users/' + encodeURIComponent(editingId) : '/api/users', {
      method: editingId ? 'PUT' : 'POST',
      body
    });
    toast(editingId ? 'تم تحديث المستخدم' : 'تم إنشاء المستخدم');
    resetUserForm();
    await loadUsers();
  } catch (e) {
    $('userFormError').textContent = e.message;
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

function previewSelectedMedia() {
  const files = selectedMediaFiles();
  $('mediaPreview').innerHTML = files.map(f =>
    '<span class="media-pill">' + esc(f.name) + ' · ' + Math.max(1, Math.round(f.size / 1024)) + ' KB</span>'
  ).join('');
}

function syncClosureRule() {
  const status = (state.lookups?.repairStatuses || []).find(x => x.id === $('repairStatusId').value);
  const isClosed = !!status?.isClosed;
  $('finishedAt').required = isClosed;
  if (isClosed) {
    $('finishedAt').closest('label').classList.add('required-now');
  } else {
    $('finishedAt').closest('label').classList.remove('required-now');
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
$('exportWorksBtn').addEventListener('click', exportWorks);
$('refreshStats').addEventListener('click', loadStats);
$('refreshAudit').addEventListener('click', loadAudit);
$('userForm').addEventListener('submit', saveUser);
$('cancelUserEdit').addEventListener('click', resetUserForm);
$('userScopeType').addEventListener('change', syncUserScopeUi);
$('wfmNo').addEventListener('input', () => {
  clearTimeout(checkWfmDuplicate._t);
  checkWfmDuplicate._t = setTimeout(checkWfmDuplicate, 550);
});
$('wfmNo').addEventListener('blur', checkWfmDuplicate);
$('repairStatusId').addEventListener('change', syncClosureRule);
$('workSearch').addEventListener('input', () => {
  clearTimeout(loadWorks._t);
  loadWorks._t = setTimeout(loadWorks, 350);
});
$('filterRegion').addEventListener('change', loadWorks);
$('filterStatus').addEventListener('change', loadWorks);
$('filterInspector').addEventListener('change', loadWorks);
$('filterContractor').addEventListener('change', loadWorks);
$('filterDateFrom').addEventListener('change', loadWorks);
$('filterDateTo').addEventListener('change', loadWorks);
qa('.lookup-card').forEach(form => form.addEventListener('submit', addLookup));

$('worksBody').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-edit-work]');
  if (btn) loadWorkForEdit(btn.dataset.editWork);
});

$('usersBody').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-edit-user]');
  if (btn) fillUserForm(btn.dataset.editUser);
});

$('mediaFiles').addEventListener('change', previewSelectedMedia);
$('cameraFile').addEventListener('change', previewSelectedMedia);

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
