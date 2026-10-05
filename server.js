const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const multer = require('multer');
const { DateTime } = require('luxon');
const {
  db, initDatabase, nowIso, id, verifyPassword,
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

function lookupData() {
  return {
    regions: db.prepare('SELECT region_id AS id,name FROM regions WHERE active=1 ORDER BY sort_order,name').all(),
    inspectors: db.prepare('SELECT inspector_id AS id,name FROM inspectors WHERE active=1 ORDER BY name').all(),
    contractors: db.prepare('SELECT contractor_id AS id,name FROM contractors WHERE active=1 ORDER BY name').all(),
    breakTypes: db.prepare('SELECT break_type_id AS id,name FROM break_types WHERE active=1 ORDER BY name').all(),
    repairStatuses: db.prepare('SELECT repair_status_id AS id,name,is_closed AS isClosed FROM repair_statuses WHERE active=1 ORDER BY is_closed,name').all()
  };
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
  return {
    total,
    today: todayCount,
    closed,
    open: Math.max(0, total - closed),
    hsePermit: hse,
    completionRate: total ? Math.round((closed / total) * 1000) / 10 : 0
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

  const where = ['w.deleted_at IS NULL'];
  const args = [];
  if (search) {
    where.push("(w.case_code LIKE ? OR w.wfm_no LIKE ? OR w.request_no LIKE ? OR w.neighborhood LIKE ? OR w.notes LIKE ?)");
    const q = '%' + search + '%';
    args.push(q, q, q, q, q);
  }
  if (regionId) { where.push('w.region_id=?'); args.push(regionId); }
  if (repairStatusId) { where.push('w.repair_status_id=?'); args.push(repairStatusId); }
  if (!req.user.permissions.includes('WORK_VIEW_ALL')) {
    where.push('w.created_by=?');
    args.push(req.user.user_id);
  }

  const whereSql = ' WHERE ' + where.join(' AND ');
  const total = db.prepare('SELECT COUNT(*) AS n FROM works w' + whereSql).get(...args).n;
  const rows = db.prepare(workSelect + whereSql + ' ORDER BY w.registered_at DESC,w.created_at DESC LIMIT ? OFFSET ?')
    .all(...args, pageSize, offset)
    .map(rowToWork);

  res.json({ ok: true, page, pageSize, total, rows });
});

app.get('/api/works/:id', requireAuth, requirePermission('WORK_VIEW'), (req, res) => {
  const row = db.prepare(workSelect + ' WHERE w.work_id=? AND w.deleted_at IS NULL').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'الحالة غير موجودة' });
  if (!req.user.permissions.includes('WORK_VIEW_ALL') && row.created_by !== req.user.user_id) {
    return res.status(403).json({ ok: false, error: 'PERMISSION_DENIED' });
  }
  const media = db.prepare('SELECT media_id AS id,original_name AS originalName,mime_type AS mimeType,size_bytes AS sizeBytes,relative_url AS url,uploaded_at AS uploadedAt FROM work_media WHERE work_id=? ORDER BY uploaded_at DESC').all(req.params.id);
  res.json({ ok: true, work: rowToWork(row), media });
});

app.post('/api/works', requireAuth, requirePermission('WORK_CREATE'), (req, res) => {
  const parsed = validateWork(req.body || {});
  if (parsed.errors.length) return res.status(400).json({ ok: false, errors: parsed.errors });
  const v = parsed.value;
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
  if (!req.user.permissions.includes('WORK_EDIT_ALL') && existingRaw.created_by !== req.user.user_id) {
    return res.status(403).json({ ok: false, error: 'PERMISSION_DENIED' });
  }
  const parsed = validateWork(req.body || {});
  if (parsed.errors.length) return res.status(400).json({ ok: false, errors: parsed.errors });
  const v = parsed.value;
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
  const now = nowIso();
  db.prepare('UPDATE works SET deleted_at=?,updated_by=?,updated_at=? WHERE work_id=?')
    .run(now, req.user.user_id, now, req.params.id);
  audit(req.user.user_id, 'DELETE', 'WORK', req.params.id, rowToWork(existing), null);
  res.json({ ok: true });
});

app.post('/api/works/:id/media', requireAuth, requirePermission('MEDIA_ADD'), upload.array('files', 10), (req, res) => {
  const work = db.prepare('SELECT work_id,created_by FROM works WHERE work_id=? AND deleted_at IS NULL').get(req.params.id);
  if (!work) return res.status(404).json({ ok: false, error: 'الحالة غير موجودة' });
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
