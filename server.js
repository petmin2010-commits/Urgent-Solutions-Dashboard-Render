const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const multer = require('multer');
const { DateTime } = require('luxon');
const {
  db, initDatabase, nowIso, id, hashPassword, verifyPassword,
  getPermissionsForRole, audit
} = require('./src/db');

function loadEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv();
initDatabase();

const app = express();
const PORT = Number(process.env.PORT || 3035);
const ZONE = 'Asia/Riyadh';

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:']
    }
  }
}));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  name: 'madinah_water_sid',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex'),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000
  }
}));

const uploadDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safeExt = path.extname(file.originalname || '').slice(0, 12);
      cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + safeExt);
    }
  }),
  limits: { fileSize: 30 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(image|video)\//i.test(file.mimetype) || file.mimetype === 'application/pdf';
    cb(ok ? null : new Error('يسمح بالصور والفيديو وPDF فقط'), ok);
  }
});

function clean(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}
function csvCell(v) {
  const s = String(v == null ? '' : v).replace(/\r?\n/g, ' ');
  return '"' + s.replace(/"/g, '""') + '"';
}
function bool(v) {
  return ['1','true','yes','نعم','on'].includes(clean(v).toLowerCase()) ? 1 : 0;
}
function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
}
function dateOrNull(v) {
  const s = clean(v);
  if (!s) return null;
  const d = DateTime.fromISO(s, { zone: ZONE });
  return d.isValid ? d.toISO() : null;
}
function currentUser(req) {
  if (!req.session.userId) return null;
  const user = db.prepare(`
    SELECT u.user_id,u.employee_name,u.job_title,u.email,u.role_id,u.scope_type,u.scope_value,
           r.role_name_ar
    FROM users u
    JOIN roles r ON r.role_id=u.role_id
    WHERE u.user_id=? AND u.active=1 AND u.can_login=1
  `).get(req.session.userId);
  if (!user) return null;
  user.permissions = getPermissionsForRole(user.role_id);
  return user;
}
function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  req.user = user;
  next();
}
function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.user || currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
    if (!user.permissions.includes(permission)) {
      return res.status(403).json({ ok: false, error: 'PERMISSION_DENIED', permission });
    }
    req.user = user;
    next();
  };
}

function workScopeType(user) {
  return clean(user?.scope_type || 'ALL').toUpperCase();
}

function workScopeAllows(user, row) {
  if (!user || !row) return false;
  const type = workScopeType(user);
  if (type === 'REGION') return clean(row.region_id) === clean(user.scope_value);
  if (type === 'OWN') return clean(row.created_by) === clean(user.user_id);
  if (type === 'ALL') {
    return user.permissions.includes('WORK_VIEW_ALL') || clean(row.created_by) === clean(user.user_id);
  }
  return clean(row.created_by) === clean(user.user_id);
}

function applyWorkScope(user, where, args) {
  const type = workScopeType(user);
  if (type === 'REGION') {
    where.push('w.region_id=?');
    args.push(clean(user.scope_value));
    return;
  }
  if (type === 'OWN' || !user.permissions.includes('WORK_VIEW_ALL')) {
    where.push('w.created_by=?');
    args.push(user.user_id);
  }
}

function lookupData() {
  return {
    regions: db.prepare('SELECT region_id AS id,name FROM regions WHERE active=1 ORDER BY sort_order,name').all(),
    inspectors: db.prepare('SELECT inspector_id AS id,name FROM inspectors WHERE active=1 ORDER BY name').all(),
    contractors: db.prepare('SELECT contractor_id AS id,name FROM contractors WHERE active=1 ORDER BY name').all(),
    breakTypes: db.prepare('SELECT break_type_id AS id,name FROM break_types WHERE active=1 ORDER BY name').all(),
    repairStatuses: db.prepare('SELECT repair_status_id AS id,name,is_closed AS isClosed FROM repair_statuses WHERE active=1 ORDER BY is_closed,name').all()
  };
}

function roleData() {
  return db.prepare(`
    SELECT role_id AS id,role_name_ar AS name,description
    FROM roles
    WHERE active=1
    ORDER BY CASE role_id
      WHEN 'SUPER_ADMIN' THEN 1
      WHEN 'PROJECT_MANAGER' THEN 2
      WHEN 'FIELD_INSPECTOR' THEN 3
      ELSE 9
    END,role_name_ar
  `).all();
}

function stats() {
  const today = DateTime.now().setZone(ZONE).toISODate();
  const total = db.prepare('SELECT COUNT(*) AS n FROM works WHERE deleted_at IS NULL').get().n;
  const todayCount = db.prepare("SELECT COUNT(*) AS n FROM works WHERE deleted_at IS NULL AND substr(registered_at,1,10)=?").get(today).n;
  const closed = db.prepare(`
    SELECT COUNT(*) AS n FROM works w
    LEFT JOIN repair_statuses s ON s.repair_status_id=w.repair_status_id
    WHERE w.deleted_at IS NULL AND COALESCE(s.is_closed,0)=1
  `).get().n;
  const hse = db.prepare('SELECT COUNT(*) AS n FROM works WHERE deleted_at IS NULL AND has_hse_permit=1').get().n;
  const topRegions = db.prepare(`
    SELECT COALESCE(r.name,'غير محدد') AS label,COUNT(*) AS value
    FROM works w
    LEFT JOIN regions r ON r.region_id=w.region_id
    WHERE w.deleted_at IS NULL
    GROUP BY COALESCE(r.name,'غير محدد')
    ORDER BY value DESC,label
    LIMIT 6
  `).all();
  const byStatus = db.prepare(`
    SELECT COALESCE(s.name,'غير محدد') AS label,COUNT(*) AS value,COALESCE(s.is_closed,0) AS isClosed
    FROM works w
    LEFT JOIN repair_statuses s ON s.repair_status_id=w.repair_status_id
    WHERE w.deleted_at IS NULL
    GROUP BY COALESCE(s.name,'غير محدد'),COALESCE(s.is_closed,0)
    ORDER BY value DESC,label
  `).all();
  const withLocation = db.prepare('SELECT COUNT(*) AS n FROM works WHERE deleted_at IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL').get().n;
  const withMedia = db.prepare(`
    SELECT COUNT(DISTINCT w.work_id) AS n
    FROM works w JOIN work_media m ON m.work_id=w.work_id
    WHERE w.deleted_at IS NULL
  `).get().n;
  return {
    total,
    today: todayCount,
    closed,
    open: Math.max(0, total - closed),
    hsePermit: hse,
    withLocation,
    withMedia,
    completionRate: total ? Math.round((closed / total) * 1000) / 10 : 0,
    locationRate: total ? Math.round((withLocation / total) * 1000) / 10 : 0,
    mediaRate: total ? Math.round((withMedia / total) * 1000) / 10 : 0,
    topRegions,
    byStatus
  };
}

function rowToWork(row) {
  if (!row) return null;
  return {
    id: row.work_id,
    caseCode: row.case_code,
    requestNo: row.request_no || '',
    registeredAt: row.registered_at,
    regionId: row.region_id || '',
    region: row.region_name || '',
    neighborhood: row.neighborhood || '',
    inspectorId: row.inspector_id || '',
    inspector: row.inspector_name || '',
    contractorId: row.contractor_id || '',
    contractor: row.contractor_name || '',
    municipalityPermitNo: row.municipality_permit_no || '',
    hasHsePermit: !!row.has_hse_permit,
    wfmNo: row.wfm_no || '',
    locationText: row.location_text || '',
    latitude: row.latitude,
    longitude: row.longitude,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    depthM: row.depth_m,
    breakTypeId: row.break_type_id || '',
    breakType: row.break_type_name || '',
    repairStatusId: row.repair_status_id || '',
    repairStatus: row.repair_status_name || '',
    notes: row.notes || '',
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const workSelect = `
  SELECT w.*,
         r.name AS region_name,
         i.name AS inspector_name,
         c.name AS contractor_name,
         b.name AS break_type_name,
         s.name AS repair_status_name
  FROM works w
  LEFT JOIN regions r ON r.region_id=w.region_id
  LEFT JOIN inspectors i ON i.inspector_id=w.inspector_id
  LEFT JOIN contractors c ON c.contractor_id=w.contractor_id
  LEFT JOIN break_types b ON b.break_type_id=w.break_type_id
  LEFT JOIN repair_statuses s ON s.repair_status_id=w.repair_status_id
`;

function validateWork(payload) {
  const errors = [];
  const out = {
    requestNo: clean(payload.requestNo),
    registeredAt: dateOrNull(payload.registeredAt),
    regionId: clean(payload.regionId),
    neighborhood: clean(payload.neighborhood),
    inspectorId: clean(payload.inspectorId),
    contractorId: clean(payload.contractorId),
    municipalityPermitNo: clean(payload.municipalityPermitNo),
    hasHsePermit: bool(payload.hasHsePermit),
    wfmNo: clean(payload.wfmNo),
    locationText: clean(payload.locationText),
    latitude: numOrNull(payload.latitude),
    longitude: numOrNull(payload.longitude),
    startedAt: dateOrNull(payload.startedAt),
    finishedAt: dateOrNull(payload.finishedAt),
    depthM: numOrNull(payload.depthM),
    breakTypeId: clean(payload.breakTypeId),
    repairStatusId: clean(payload.repairStatusId),
    notes: clean(payload.notes)
  };
  if (!out.registeredAt) errors.push('تاريخ تسجيل الحالة مطلوب');
  if (!out.regionId) errors.push('المنطقة مطلوبة');
  if (!out.inspectorId) errors.push('اسم المراقب مطلوب');
  if (!out.contractorId) errors.push('المقاول مطلوب');
  if (!out.wfmNo) errors.push('رقم بلاغ / أمر العمل WFM مطلوب');
  if (!out.breakTypeId) errors.push('وصف الانكسار مطلوب');
  if (!out.repairStatusId) errors.push('حالة الإصلاح مطلوبة');
  const selectedStatus = out.repairStatusId
    ? db.prepare('SELECT name,is_closed FROM repair_statuses WHERE repair_status_id=? AND active=1').get(out.repairStatusId)
    : null;
  if (out.repairStatusId && !selectedStatus) errors.push('حالة الإصلاح المحددة غير صالحة');
  if (selectedStatus && Number(selectedStatus.is_closed) === 1 && !out.finishedAt) {
    errors.push('تاريخ ووقت انتهاء العمل مطلوب عند إغلاق الحالة');
  }
  if (out.depthM != null && (out.depthM < 0 || out.depthM > 100)) errors.push('عمق الحفر غير منطقي');
  if (out.latitude != null && (out.latitude < -90 || out.latitude > 90)) errors.push('خط العرض غير صحيح');
  if (out.longitude != null && (out.longitude < -180 || out.longitude > 180)) errors.push('خط الطول غير صحيح');
  if (out.startedAt && out.finishedAt && Date.parse(out.finishedAt) < Date.parse(out.startedAt)) {
    errors.push('وقت انتهاء العمل لا يمكن أن يسبق وقت المباشرة');
  }
  return { errors, value: out };
}

function makeCaseCode() {
  const stamp = DateTime.now().setZone(ZONE).toFormat('yyyyLLdd');
  return 'MW-' + stamp + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'madinah-water-business', time: DateTime.now().setZone(ZONE).toISO() });
});

app.post('/api/auth/login', (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE lower(email)=? AND active=1 AND can_login=1').get(email);
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    return res.status(401).json({ ok: false, error: 'بيانات الدخول غير صحيحة' });
  }
  req.session.userId = user.user_id;
  const now = nowIso();
  db.prepare('UPDATE users SET last_login=?,updated_at=? WHERE user_id=?').run(now, now, user.user_id);
  audit(user.user_id, 'LOGIN', 'USER', user.user_id, null, { email: user.email });
  res.json({ ok: true });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const userId = req.user.user_id;
  audit(userId, 'LOGOUT', 'USER', userId, null, null);
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/bootstrap', (req, res) => {
  const user = currentUser(req);
  if (!user) {
    return res.json({
      ok: true,
      authenticated: false,
      business: { name: 'مياه المدينة', subtitle: 'منصة إدارة أعمال المياه الميدانية' }
    });
  }
  res.json({
    ok: true,
    authenticated: true,
    business: { name: 'مياه المدينة', subtitle: 'منصة إدارة أعمال المياه الميدانية' },
    user,
    lookups: lookupData(),
    stats: stats()
  });
});

app.get('/api/stats', requireAuth, requirePermission('DASHBOARD_VIEW'), (_req, res) => {
  res.json({ ok: true, stats: stats() });
});

app.get('/api/works', requireAuth, requirePermission('WORK_VIEW'), (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize || 25)));
  const offset = (page - 1) * pageSize;
  const search = clean(req.query.search);
  const regionId = clean(req.query.regionId);
  const repairStatusId = clean(req.query.repairStatusId);
  const inspectorId = clean(req.query.inspectorId);
  const contractorId = clean(req.query.contractorId);
  const dateFrom = clean(req.query.dateFrom);
  const dateTo = clean(req.query.dateTo);

  const where = ['w.deleted_at IS NULL'];
  const args = [];
  if (search) {
    where.push("(w.case_code LIKE ? OR w.wfm_no LIKE ? OR w.request_no LIKE ? OR w.neighborhood LIKE ? OR w.notes LIKE ?)");
    const q = '%' + search + '%';
    args.push(q, q, q, q, q);
  }
  if (regionId) { where.push('w.region_id=?'); args.push(regionId); }
  if (repairStatusId) { where.push('w.repair_status_id=?'); args.push(repairStatusId); }
  if (inspectorId) { where.push('w.inspector_id=?'); args.push(inspectorId); }
  if (contractorId) { where.push('w.contractor_id=?'); args.push(contractorId); }
  if (dateFrom) { where.push('substr(w.registered_at,1,10)>=?'); args.push(dateFrom); }
  if (dateTo) { where.push('substr(w.registered_at,1,10)<=?'); args.push(dateTo); }
  applyWorkScope(req.user, where, args);

  const whereSql = ' WHERE ' + where.join(' AND ');
  const total = db.prepare('SELECT COUNT(*) AS n FROM works w' + whereSql).get(...args).n;
  const rows = db.prepare(workSelect + whereSql + ' ORDER BY w.registered_at DESC,w.created_at DESC LIMIT ? OFFSET ?')
    .all(...args, pageSize, offset)
    .map(rowToWork);

  res.json({ ok: true, page, pageSize, total, rows });
});

app.get('/api/works/export.csv', requireAuth, requirePermission('WORK_VIEW'), (req, res) => {
  const search = clean(req.query.search);
  const regionId = clean(req.query.regionId);
  const repairStatusId = clean(req.query.repairStatusId);
  const inspectorId = clean(req.query.inspectorId);
  const contractorId = clean(req.query.contractorId);
  const dateFrom = clean(req.query.dateFrom);
  const dateTo = clean(req.query.dateTo);

  const where = ['w.deleted_at IS NULL'];
  const args = [];
  if (search) {
    where.push("(w.case_code LIKE ? OR w.wfm_no LIKE ? OR w.request_no LIKE ? OR w.neighborhood LIKE ? OR w.notes LIKE ?)");
    const q = '%' + search + '%';
    args.push(q, q, q, q, q);
  }
  if (regionId) { where.push('w.region_id=?'); args.push(regionId); }
  if (repairStatusId) { where.push('w.repair_status_id=?'); args.push(repairStatusId); }
  if (inspectorId) { where.push('w.inspector_id=?'); args.push(inspectorId); }
  if (contractorId) { where.push('w.contractor_id=?'); args.push(contractorId); }
  if (dateFrom) { where.push('substr(w.registered_at,1,10)>=?'); args.push(dateFrom); }
  if (dateTo) { where.push('substr(w.registered_at,1,10)<=?'); args.push(dateTo); }
  applyWorkScope(req.user, where, args);

  const rows = db.prepare(workSelect + ' WHERE ' + where.join(' AND ') + ' ORDER BY w.registered_at DESC,w.created_at DESC')
    .all(...args).map(rowToWork);

  const headers = [
    'كود الحالة','رقم الريكوست','تاريخ التسجيل','رقم WFM','المنطقة','الحي','المراقب','المقاول',
    'رقم تصريح بلدي','تصريح أمن وسلامة','وصف الموقع','خط العرض','خط الطول','وقت المباشرة',
    'وقت الانتهاء','عمق الحفر','وصف الانكسار','حالة الإصلاح','الملاحظات'
  ];
  const lines = [headers.map(csvCell).join(',')];
  for (const w of rows) {
    lines.push([
      w.caseCode,w.requestNo,w.registeredAt,w.wfmNo,w.region,w.neighborhood,w.inspector,w.contractor,
      w.municipalityPermitNo,w.hasHsePermit ? 'نعم' : 'لا',w.locationText,w.latitude,w.longitude,w.startedAt,
      w.finishedAt,w.depthM,w.breakType,w.repairStatus,w.notes
    ].map(csvCell).join(','));
  }
  const filename = 'madinah-water-works-' + DateTime.now().setZone(ZONE).toFormat('yyyyLLdd-HHmm') + '.csv';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.send('\uFEFF' + lines.join('\r\n'));
});

app.get('/api/works/check-wfm', requireAuth, requirePermission('WORK_VIEW'), (req, res) => {
  const wfm = clean(req.query.wfm);
  const excludeId = clean(req.query.excludeId);
  if (!wfm) return res.json({ ok: true, duplicate: false, matches: [] });

  const countArgs = [wfm];
  let countSql = 'SELECT COUNT(*) AS n FROM works WHERE deleted_at IS NULL AND trim(wfm_no)=?';
  if (excludeId) {
    countSql += ' AND work_id<>?';
    countArgs.push(excludeId);
  }
  const duplicate = Number(db.prepare(countSql).get(...countArgs).n || 0) > 0;

  const where = ['w.deleted_at IS NULL', 'trim(w.wfm_no)=?'];
  const args = [wfm];
  if (excludeId) {
    where.push('w.work_id<>?');
    args.push(excludeId);
  }
  applyWorkScope(req.user, where, args);
  const matches = db.prepare(workSelect + ' WHERE ' + where.join(' AND ') + ' ORDER BY w.created_at DESC LIMIT 5')
    .all(...args).map(rowToWork);

  res.json({ ok: true, duplicate, matches });
});

app.get('/api/works/:id/history', requireAuth, requirePermission('WORK_VIEW'), (req, res) => {
  const work = db.prepare('SELECT work_id,created_by,region_id FROM works WHERE work_id=? AND deleted_at IS NULL').get(req.params.id);
  if (!work) return res.status(404).json({ ok: false, error: 'الحالة غير موجودة' });
  if (!workScopeAllows(req.user, work)) {
    return res.status(403).json({ ok: false, error: 'PERMISSION_DENIED' });
  }
  const rows = db.prepare(`
    SELECT a.audit_id AS id,a.action,a.created_at AS createdAt,
           COALESCE(u.employee_name,'النظام') AS userName
    FROM audit_log a
    LEFT JOIN users u ON u.user_id=a.user_id
    WHERE a.entity_type='WORK' AND a.entity_id=?
    ORDER BY a.created_at DESC
    LIMIT 100
  `).all(req.params.id);
  res.json({ ok: true, rows });
});

app.get('/api/works/:id', requireAuth, requirePermission('WORK_VIEW'), (req, res) => {
  const row = db.prepare(workSelect + ' WHERE w.work_id=? AND w.deleted_at IS NULL').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'الحالة غير موجودة' });
  if (!workScopeAllows(req.user, row)) {
    return res.status(403).json({ ok: false, error: 'PERMISSION_DENIED' });
  }
  const media = db.prepare('SELECT media_id AS id,original_name AS originalName,mime_type AS mimeType,size_bytes AS sizeBytes,relative_url AS url,uploaded_at AS uploadedAt FROM work_media WHERE work_id=? ORDER BY uploaded_at DESC').all(req.params.id);
  res.json({ ok: true, work: rowToWork(row), media });
});

app.post('/api/works', requireAuth, requirePermission('WORK_CREATE'), (req, res) => {
  const parsed = validateWork(req.body || {});
  if (parsed.errors.length) return res.status(400).json({ ok: false, errors: parsed.errors });
  const v = parsed.value;
  if (workScopeType(req.user) === 'REGION' && clean(v.regionId) !== clean(req.user.scope_value)) {
    return res.status(403).json({ ok: false, error: 'لا يمكن إنشاء حالة خارج المنطقة المخصصة للمستخدم' });
  }
  const workId = id();
  const caseCode = makeCaseCode();
  const now = nowIso();

  db.prepare(`
    INSERT INTO works(
      work_id,case_code,request_no,registered_at,region_id,neighborhood,inspector_id,contractor_id,
      municipality_permit_no,has_hse_permit,wfm_no,location_text,latitude,longitude,started_at,finished_at,
      depth_m,break_type_id,repair_status_id,notes,source,created_by,updated_by,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    workId,caseCode,v.requestNo,v.registeredAt,v.regionId,v.neighborhood,v.inspectorId,v.contractorId,
    v.municipalityPermitNo,v.hasHsePermit,v.wfmNo,v.locationText,v.latitude,v.longitude,v.startedAt,v.finishedAt,
    v.depthM,v.breakTypeId,v.repairStatusId,v.notes,'APP',req.user.user_id,req.user.user_id,now,now
  );

  const created = rowToWork(db.prepare(workSelect + ' WHERE w.work_id=?').get(workId));
  audit(req.user.user_id, 'CREATE', 'WORK', workId, null, created);
  res.status(201).json({ ok: true, work: created });
});

app.put('/api/works/:id', requireAuth, requirePermission('WORK_EDIT'), (req, res) => {
  const existingRaw = db.prepare(workSelect + ' WHERE w.work_id=? AND w.deleted_at IS NULL').get(req.params.id);
  if (!existingRaw) return res.status(404).json({ ok: false, error: 'الحالة غير موجودة' });
  if (!workScopeAllows(req.user, existingRaw)) {
    return res.status(403).json({ ok: false, error: 'PERMISSION_DENIED' });
  }
  if (!req.user.permissions.includes('WORK_EDIT_ALL') && existingRaw.created_by !== req.user.user_id) {
    return res.status(403).json({ ok: false, error: 'PERMISSION_DENIED' });
  }
  const parsed = validateWork(req.body || {});
  if (parsed.errors.length) return res.status(400).json({ ok: false, errors: parsed.errors });
  const v = parsed.value;
  if (workScopeType(req.user) === 'REGION' && clean(v.regionId) !== clean(req.user.scope_value)) {
    return res.status(403).json({ ok: false, error: 'لا يمكن نقل الحالة خارج المنطقة المخصصة للمستخدم' });
  }
  const now = nowIso();

  db.prepare(`
    UPDATE works SET
      request_no=?,registered_at=?,region_id=?,neighborhood=?,inspector_id=?,contractor_id=?,
      municipality_permit_no=?,has_hse_permit=?,wfm_no=?,location_text=?,latitude=?,longitude=?,
      started_at=?,finished_at=?,depth_m=?,break_type_id=?,repair_status_id=?,notes=?,
      updated_by=?,updated_at=?
    WHERE work_id=?
  `).run(
    v.requestNo,v.registeredAt,v.regionId,v.neighborhood,v.inspectorId,v.contractorId,
    v.municipalityPermitNo,v.hasHsePermit,v.wfmNo,v.locationText,v.latitude,v.longitude,
    v.startedAt,v.finishedAt,v.depthM,v.breakTypeId,v.repairStatusId,v.notes,
    req.user.user_id,now,req.params.id
  );

  const updated = rowToWork(db.prepare(workSelect + ' WHERE w.work_id=?').get(req.params.id));
  audit(req.user.user_id, 'UPDATE', 'WORK', req.params.id, rowToWork(existingRaw), updated);
  res.json({ ok: true, work: updated });
});

app.delete('/api/works/:id', requireAuth, requirePermission('WORK_DELETE'), (req, res) => {
  const existing = db.prepare(workSelect + ' WHERE w.work_id=? AND w.deleted_at IS NULL').get(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'الحالة غير موجودة' });
  if (!workScopeAllows(req.user, existing)) {
    return res.status(403).json({ ok: false, error: 'PERMISSION_DENIED' });
  }
  const now = nowIso();
  db.prepare('UPDATE works SET deleted_at=?,updated_by=?,updated_at=? WHERE work_id=?')
    .run(now, req.user.user_id, now, req.params.id);
  audit(req.user.user_id, 'DELETE', 'WORK', req.params.id, rowToWork(existing), null);
  res.json({ ok: true });
});

app.post('/api/works/:id/media', requireAuth, requirePermission('MEDIA_ADD'), upload.array('files', 10), (req, res) => {
  const work = db.prepare('SELECT work_id,created_by,region_id FROM works WHERE work_id=? AND deleted_at IS NULL').get(req.params.id);
  if (!work) return res.status(404).json({ ok: false, error: 'الحالة غير موجودة' });
  if (!workScopeAllows(req.user, work)) {
    return res.status(403).json({ ok: false, error: 'PERMISSION_DENIED' });
  }
  if (!req.user.permissions.includes('WORK_EDIT_ALL') && work.created_by !== req.user.user_id) {
    return res.status(403).json({ ok: false, error: 'PERMISSION_DENIED' });
  }

  const inserted = [];
  for (const file of req.files || []) {
    const mediaId = id();
    const relativeUrl = '/uploads/' + file.filename;
    const uploadedAt = nowIso();
    db.prepare(`
      INSERT INTO work_media(media_id,work_id,original_name,stored_name,mime_type,size_bytes,relative_url,uploaded_by,uploaded_at)
      VALUES(?,?,?,?,?,?,?,?,?)
    `).run(mediaId, req.params.id, file.originalname, file.filename, file.mimetype, file.size, relativeUrl, req.user.user_id, uploadedAt);
    inserted.push({ id: mediaId, originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, url: relativeUrl, uploadedAt });
  }
  audit(req.user.user_id, 'MEDIA_ADD', 'WORK', req.params.id, null, inserted.map(x => ({ id: x.id, name: x.originalName })));
  res.status(201).json({ ok: true, media: inserted });
});

app.get('/api/roles', requireAuth, requirePermission('USER_VIEW'), (_req, res) => {
  res.json({ ok: true, rows: roleData() });
});

app.get('/api/users', requireAuth, requirePermission('USER_VIEW'), (_req, res) => {
  const rows = db.prepare(`
    SELECT u.user_id AS id,u.employee_name AS name,u.job_title AS jobTitle,u.email,
           u.role_id AS roleId,r.role_name_ar AS roleName,u.scope_type AS scopeType,
           u.scope_value AS scopeValue,u.can_login AS canLogin,u.active,
           u.account_status AS accountStatus,u.last_login AS lastLogin,u.created_at AS createdAt
    FROM users u
    JOIN roles r ON r.role_id=u.role_id
    ORDER BY u.active DESC,u.employee_name
  `).all().map(x => ({ ...x, canLogin: !!x.canLogin, active: !!x.active }));
  res.json({ ok: true, rows });
});

app.post('/api/users', requireAuth, requirePermission('USER_CREATE'), (req, res) => {
  const name = clean(req.body.name);
  const jobTitle = clean(req.body.jobTitle);
  const email = clean(req.body.email).toLowerCase();
  const password = String(req.body.password || '');
  const roleId = clean(req.body.roleId);
  const scopeType = (clean(req.body.scopeType) || 'ALL').toUpperCase();
  const scopeValue = clean(req.body.scopeValue);
  if (!['ALL','OWN','REGION'].includes(scopeType)) {
    return res.status(400).json({ ok: false, error: 'نطاق المستخدم غير صالح' });
  }
  if (scopeType === 'REGION' && !db.prepare('SELECT 1 FROM regions WHERE region_id=? AND active=1').get(scopeValue)) {
    return res.status(400).json({ ok: false, error: 'يجب اختيار منطقة صالحة لنطاق المستخدم' });
  }
  if (!name || !email || !roleId || password.length < 8) {
    return res.status(400).json({ ok: false, error: 'الاسم والبريد والدور وكلمة مرور من 8 أحرف على الأقل مطلوبة' });
  }
  const role = db.prepare('SELECT role_id FROM roles WHERE role_id=? AND active=1').get(roleId);
  if (!role) return res.status(400).json({ ok: false, error: 'الدور المحدد غير صالح' });
  if (db.prepare('SELECT 1 FROM users WHERE lower(email)=?').get(email)) {
    return res.status(409).json({ ok: false, error: 'البريد الإلكتروني مستخدم بالفعل' });
  }
  const userId = id();
  const c = hashPassword(password);
  const now = nowIso();
  db.prepare(`
    INSERT INTO users(
      user_id,employee_name,job_title,email,password_hash,password_salt,role_id,
      scope_type,scope_value,can_login,active,account_status,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    userId,name,jobTitle,email,c.hash,c.salt,roleId,scopeType,scopeValue || null,
    bool(req.body.canLogin) ? 1 : 0,1,'ACTIVE',now,now
  );
  audit(req.user.user_id,'CREATE','USER',userId,null,{ name,jobTitle,email,roleId,scopeType,scopeValue });
  res.status(201).json({ ok: true, id: userId });
});

app.put('/api/users/:id', requireAuth, requirePermission('USER_EDIT'), (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE user_id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'المستخدم غير موجود' });
  const name = clean(req.body.name) || existing.employee_name;
  const jobTitle = clean(req.body.jobTitle);
  const roleId = clean(req.body.roleId) || existing.role_id;
  const scopeType = (clean(req.body.scopeType) || existing.scope_type || 'ALL').toUpperCase();
  const scopeValue = clean(req.body.scopeValue);
  if (!['ALL','OWN','REGION'].includes(scopeType)) {
    return res.status(400).json({ ok: false, error: 'نطاق المستخدم غير صالح' });
  }
  if (scopeType === 'REGION' && !db.prepare('SELECT 1 FROM regions WHERE region_id=? AND active=1').get(scopeValue)) {
    return res.status(400).json({ ok: false, error: 'يجب اختيار منطقة صالحة لنطاق المستخدم' });
  }
  const active = req.body.active === undefined ? Number(existing.active) : bool(req.body.active);
  const canLogin = req.body.canLogin === undefined ? Number(existing.can_login) : bool(req.body.canLogin);
  if (req.params.id === req.user.user_id && (!active || !canLogin)) {
    return res.status(400).json({ ok: false, error: 'لا يمكن إيقاف حسابك الحالي أو منع تسجيل الدخول له' });
  }
  const role = db.prepare('SELECT role_id FROM roles WHERE role_id=? AND active=1').get(roleId);
  if (!role) return res.status(400).json({ ok: false, error: 'الدور المحدد غير صالح' });
  const now = nowIso();
  const password = String(req.body.password || '');
  if (password) {
    if (password.length < 8) return res.status(400).json({ ok: false, error: 'كلمة المرور يجب ألا تقل عن 8 أحرف' });
    const c = hashPassword(password);
    db.prepare(`
      UPDATE users SET employee_name=?,job_title=?,role_id=?,scope_type=?,scope_value=?,
        can_login=?,active=?,account_status=?,password_hash=?,password_salt=?,updated_at=?
      WHERE user_id=?
    `).run(
      name,jobTitle,roleId,scopeType,scopeValue || null,canLogin,active,active ? 'ACTIVE' : 'DISABLED',
      c.hash,c.salt,now,req.params.id
    );
  } else {
    db.prepare(`
      UPDATE users SET employee_name=?,job_title=?,role_id=?,scope_type=?,scope_value=?,
        can_login=?,active=?,account_status=?,updated_at=?
      WHERE user_id=?
    `).run(
      name,jobTitle,roleId,scopeType,scopeValue || null,canLogin,active,active ? 'ACTIVE' : 'DISABLED',
      now,req.params.id
    );
  }
  audit(req.user.user_id,'UPDATE','USER',req.params.id,
    { name:existing.employee_name,roleId:existing.role_id,active:!!existing.active },
    { name,jobTitle,roleId,scopeType,scopeValue,canLogin:!!canLogin,active:!!active }
  );
  res.json({ ok: true });
});

const lookupMap = {
  regions: { table: 'regions', idCol: 'region_id' },
  inspectors: { table: 'inspectors', idCol: 'inspector_id' },
  contractors: { table: 'contractors', idCol: 'contractor_id' },
  breakTypes: { table: 'break_types', idCol: 'break_type_id' },
  repairStatuses: { table: 'repair_statuses', idCol: 'repair_status_id' }
};

app.post('/api/lookups/:type', requireAuth, requirePermission('SETTINGS_MANAGE'), (req, res) => {
  const cfg = lookupMap[req.params.type];
  const name = clean(req.body.name);
  if (!cfg || !name) return res.status(400).json({ ok: false, error: 'بيانات غير صحيحة' });
  const newId = id();
  if (cfg.table === 'repair_statuses') {
    db.prepare(`INSERT INTO repair_statuses(repair_status_id,name,is_closed,active) VALUES(?,?,?,1)`)
      .run(newId, name, bool(req.body.isClosed));
  } else if (cfg.table === 'regions') {
    db.prepare(`INSERT INTO regions(region_id,name,active,sort_order) VALUES(?,?,1,999)`).run(newId, name);
  } else {
    db.prepare(`INSERT INTO ${cfg.table}(${cfg.idCol},name,active) VALUES(?,?,1)`).run(newId, name);
  }
  audit(req.user.user_id, 'CREATE', 'LOOKUP_' + req.params.type, newId, null, { name });
  res.status(201).json({ ok: true, id: newId, name, lookups: lookupData() });
});

app.get('/api/audit', requireAuth, requirePermission('AUDIT_VIEW'), (req, res) => {
  const rows = db.prepare(`
    SELECT a.audit_id,a.action,a.entity_type,a.entity_id,a.created_at,u.employee_name
    FROM audit_log a LEFT JOIN users u ON u.user_id=a.user_id
    ORDER BY a.created_at DESC LIMIT 100
  `).all();
  res.json({ ok: true, rows });
});

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
}));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, error: err.message });
  }
  res.status(500).json({ ok: false, error: err.message || 'حدث خطأ غير متوقع' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Madinah Water Business running on http://localhost:' + PORT);
});
