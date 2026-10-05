const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'madinah-water.db');

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

function id() {
  return crypto.randomUUID();
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      role_id TEXT PRIMARY KEY,
      role_name_ar TEXT NOT NULL,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS permissions (
      permission_code TEXT PRIMARY KEY,
      permission_name_ar TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL,
      permission_code TEXT NOT NULL,
      allowed INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (role_id, permission_code),
      FOREIGN KEY (role_id) REFERENCES roles(role_id),
      FOREIGN KEY (permission_code) REFERENCES permissions(permission_code)
    );

    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      employee_name TEXT NOT NULL,
      job_title TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role_id TEXT NOT NULL,
      scope_type TEXT NOT NULL DEFAULT 'ALL',
      scope_value TEXT,
      can_login INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      account_status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login TEXT,
      FOREIGN KEY (role_id) REFERENCES roles(role_id)
    );

    CREATE TABLE IF NOT EXISTS regions (
      region_id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inspectors (
      inspector_id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS contractors (
      contractor_id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS break_types (
      break_type_id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS repair_statuses (
      repair_status_id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      is_closed INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS works (
      work_id TEXT PRIMARY KEY,
      case_code TEXT UNIQUE NOT NULL,
      request_no TEXT,
      registered_at TEXT NOT NULL,
      region_id TEXT,
      neighborhood TEXT,
      inspector_id TEXT,
      contractor_id TEXT,
      municipality_permit_no TEXT,
      has_hse_permit INTEGER NOT NULL DEFAULT 0,
      wfm_no TEXT,
      location_text TEXT,
      latitude REAL,
      longitude REAL,
      started_at TEXT,
      finished_at TEXT,
      depth_m REAL,
      break_type_id TEXT,
      repair_status_id TEXT,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'APP',
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (region_id) REFERENCES regions(region_id),
      FOREIGN KEY (inspector_id) REFERENCES inspectors(inspector_id),
      FOREIGN KEY (contractor_id) REFERENCES contractors(contractor_id),
      FOREIGN KEY (break_type_id) REFERENCES break_types(break_type_id),
      FOREIGN KEY (repair_status_id) REFERENCES repair_statuses(repair_status_id),
      FOREIGN KEY (created_by) REFERENCES users(user_id),
      FOREIGN KEY (updated_by) REFERENCES users(user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_works_registered_at ON works(registered_at);
    CREATE INDEX IF NOT EXISTS idx_works_wfm_no ON works(wfm_no);
    CREATE INDEX IF NOT EXISTS idx_works_region ON works(region_id);
    CREATE INDEX IF NOT EXISTS idx_works_status ON works(repair_status_id);

    CREATE TABLE IF NOT EXISTS work_media (
      media_id TEXT PRIMARY KEY,
      work_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      relative_url TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (work_id) REFERENCES works(work_id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      audit_id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_data TEXT,
      new_data TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      notification_id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT,
      updated_at TEXT NOT NULL
    );
  `);
}

const seedData = {
  regions: ['المدينة المنورة','ينبع','بدر','العيص','خيبر','مهد الذهب','وادي الفرع','الحناكية','العلا','قرى المدينة','كشف التسربات'],
  inspectors: [
    'محمد الطيب مصطفى','حسام نشأت فيخراني','عبد العظيم السيد جاد','محمد أحمد العلاف',
    'محمد فتحي عبدالمنعم','وائل محروس رحال','محمد أحمد رزا','محمد إبراهيم عمر',
    'كمال أبوالحمد علي','محروص على محروص','تركي نايف الجابري','نواف حمدان الصبحي',
    'نواف عيد الجهني','خالد سلمان الجهني','سالم سعد مرزرق الحربي','خالد محمد المطيري',
    'انس صالح عليثة الكشي','محمد خير عبدالله','صلاح الدين احمد حامد'
  ],
  contractors: [
    'الشركة الدولية لتوزيع المياه','شركة اركان الوطن للمقاولات العامة','شركة اليمامة للماقولات',
    'شركة عبدالله إبراهيم الصائغ وأولاده','شركة الخريف لتقنية المياه والطاقة'
  ],
  breakTypes: [
    'كسر لي','كسر خط مغذي','كسر خط رئيسي','لم يتم العثور علي كسر','تغيير صمام',
    'كسر ماسورة فرعيه','كسر قائم العداد','تسريب بالعداد','انقطاع','تعدي',
    'انكسار على مسار التوصيلة','انكسار طفاية حريق','صرف','انكسار خط 100',
    'انكسار خط 150','انكسار خط 200','انكسار خط 250','انكسار خط 300',
    'انكسار خط 500','انكسار خط 1000','انكسار خط >1000'
  ],
  repairStatuses: [
    { name: 'تم الاصلاح', closed: 1 },
    { name: 'لم يتم الاصلاح', closed: 0 },
    { name: 'لا يوجد كسر', closed: 1 }
  ]
};

function seedReferenceData() {
  const roles = [
    ['SUPER_ADMIN','مدير النظام','صلاحيات كاملة على النظام'],
    ['PROJECT_MANAGER','مدير المشروع','إدارة المشروع والعمليات والتقارير'],
    ['QUALITY_CONTROLLER','مراقب الجودة','مراجعة الجودة وجودة البيانات'],
    ['HSE_CONTROLLER','مراقب الأمن والسلامة','متابعة السلامة والتصاريح'],
    ['DATA_ANALYST','محلل البيانات','قراءة البيانات والمؤشرات وإصدار التقارير'],
    ['FIELD_INSPECTOR','المراقب الميداني','إدارة الحالات المسندة للمراقب'],
    ['VIEWER','مشاهد فقط','صلاحيات قراءة محدودة']
  ];
  const roleStmt = db.prepare('INSERT OR IGNORE INTO roles(role_id, role_name_ar, description) VALUES(?,?,?)');
  for (const row of roles) roleStmt.run(...row);

  const permissions = [
    ['DASHBOARD_VIEW','عرض الرئيسية'],
    ['WORK_VIEW','عرض الحالات'],
    ['WORK_VIEW_ALL','عرض جميع الحالات'],
    ['WORK_CREATE','إنشاء حالة'],
    ['WORK_EDIT','تعديل الحالة'],
    ['WORK_EDIT_ALL','تعديل جميع الحالات'],
    ['WORK_DELETE','حذف الحالة'],
    ['WORK_CHANGE_STATUS','تغيير حالة الإصلاح'],
    ['MEDIA_VIEW','عرض المرفقات'],
    ['MEDIA_ADD','إضافة مرفقات'],
    ['REPORT_VIEW','عرض التقارير'],
    ['REPORT_EXPORT','تصدير التقارير'],
    ['USER_VIEW','عرض المستخدمين'],
    ['USER_CREATE','إنشاء مستخدم'],
    ['USER_EDIT','تعديل المستخدم'],
    ['ROLE_MANAGE','إدارة الصلاحيات'],
    ['AUDIT_VIEW','عرض سجل التدقيق'],
    ['SETTINGS_MANAGE','إدارة القوائم']
  ];
  const pStmt = db.prepare('INSERT OR IGNORE INTO permissions(permission_code, permission_name_ar) VALUES(?,?)');
  for (const row of permissions) pStmt.run(...row);

  const rpStmt = db.prepare('INSERT OR IGNORE INTO role_permissions(role_id, permission_code, allowed) VALUES(?,?,1)');
  const allPerms = permissions.map(x => x[0]);
  for (const p of allPerms) rpStmt.run('SUPER_ADMIN', p);
  const managerPerms = ['DASHBOARD_VIEW','WORK_VIEW','WORK_VIEW_ALL','WORK_CREATE','WORK_EDIT','WORK_EDIT_ALL','WORK_CHANGE_STATUS','MEDIA_VIEW','MEDIA_ADD','REPORT_VIEW','REPORT_EXPORT','USER_VIEW','AUDIT_VIEW'];
  for (const p of managerPerms) rpStmt.run('PROJECT_MANAGER', p);
  const inspectorPerms = ['DASHBOARD_VIEW','WORK_VIEW','WORK_CREATE','WORK_EDIT','WORK_CHANGE_STATUS','MEDIA_VIEW','MEDIA_ADD'];
  for (const p of inspectorPerms) rpStmt.run('FIELD_INSPECTOR', p);
  const qualityPerms = ['DASHBOARD_VIEW','WORK_VIEW','WORK_VIEW_ALL','MEDIA_VIEW','REPORT_VIEW','REPORT_EXPORT','AUDIT_VIEW'];
  for (const p of qualityPerms) rpStmt.run('QUALITY_CONTROLLER', p);
  const hsePerms = ['DASHBOARD_VIEW','WORK_VIEW','WORK_VIEW_ALL','MEDIA_VIEW','REPORT_VIEW','REPORT_EXPORT'];
  for (const p of hsePerms) rpStmt.run('HSE_CONTROLLER', p);
  const analystPerms = ['DASHBOARD_VIEW','WORK_VIEW','WORK_VIEW_ALL','REPORT_VIEW','REPORT_EXPORT'];
  for (const p of analystPerms) rpStmt.run('DATA_ANALYST', p);
  const viewerPerms = ['DASHBOARD_VIEW','WORK_VIEW','REPORT_VIEW'];
  for (const p of viewerPerms) rpStmt.run('VIEWER', p);

  const insertNamed = (table, idCol, values) => {
    const stmt = db.prepare(`INSERT OR IGNORE INTO ${table}(${idCol}, name, active) VALUES(?,?,1)`);
    values.forEach((name, i) => stmt.run(id(), name));
  };
  insertNamed('regions','region_id',seedData.regions);
  insertNamed('inspectors','inspector_id',seedData.inspectors);
  insertNamed('contractors','contractor_id',seedData.contractors);
  insertNamed('break_types','break_type_id',seedData.breakTypes);

  const rs = db.prepare('INSERT OR IGNORE INTO repair_statuses(repair_status_id, name, is_closed, active) VALUES(?,?,?,1)');
  for (const x of seedData.repairStatuses) rs.run(id(), x.name, x.closed);

  db.prepare('INSERT OR IGNORE INTO app_settings(setting_key, setting_value, updated_at) VALUES(?,?,?)')
    .run('business_name','مياه المدينة',nowIso());
}

function ensureAdmin() {
  const email = String(process.env.ADMIN_EMAIL || 'admin@madinah-water.local').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || 'Madinah@2026');
  const existing = db.prepare('SELECT user_id FROM users WHERE lower(email)=?').get(email);
  if (existing) return existing.user_id;

  const credentials = hashPassword(password);
  const userId = id();
  const now = nowIso();
  db.prepare(`
    INSERT INTO users(
      user_id, employee_name, job_title, email, password_hash, password_salt, role_id,
      scope_type, can_login, active, account_status, created_at, updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    userId,'مدير النظام','مدير النظام',email,credentials.hash,credentials.salt,'SUPER_ADMIN',
    'ALL',1,1,'ACTIVE',now,now
  );
  return userId;
}

function initDatabase() {
  initSchema();
  seedReferenceData();
  ensureAdmin();
}

function getPermissionsForRole(roleId) {
  return db.prepare(`
    SELECT permission_code
    FROM role_permissions
    WHERE role_id=? AND allowed=1
    ORDER BY permission_code
  `).all(roleId).map(x => x.permission_code);
}

function audit(userId, action, entityType, entityId, oldData, newData) {
  db.prepare(`
    INSERT INTO audit_log(audit_id,user_id,action,entity_type,entity_id,old_data,new_data,created_at)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(
    id(), userId || null, action, entityType, entityId || null,
    oldData == null ? null : JSON.stringify(oldData),
    newData == null ? null : JSON.stringify(newData),
    nowIso()
  );
}

module.exports = {
  db,
  initDatabase,
  nowIso,
  id,
  hashPassword,
  verifyPassword,
  getPermissionsForRole,
  audit
};
