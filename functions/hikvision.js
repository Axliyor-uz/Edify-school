/**
 * Hikvision (HikCentral Connect) face terminal bridge — Cloud Functions.
 *
 * Terminal → HikCentral Connect (cloud) → [this function] → face_events → app
 *
 * WHY server-side: AK/SK are SECRET keys. They cannot be placed in the browser
 * (anyone could see them), and CORS won't allow it either. Keys live in the
 * `_private/hik` Firestore doc, which clients CANNOT read (firestore.rules) —
 * only these functions (Admin SDK) read them.
 *
 * Gateway: /api/hccgw/... (HikCentral Connect gateway).
 * Token: POST {baseUrl}/api/hccgw/platform/v1/token/get {appKey, secretKey}
 *        → { accessToken, expireTime, userId, areaDomain }
 * Subsequent requests go to the areaDomain from the token response.
 *
 * Config: Firestore `_private/hik` document (closed to clients, see firestore.rules):
 *   {
 *     enabled: true,
 *     centerId: '<center id>',
 *     baseUrl: 'https://ieu.hikcentralconnect.com',
 *     tzOffsetMin: 300,        // UTC+5 (Tashkent)
 *     groupId: '1',            // Root Department
 *     accessLevelId: '<...>'   // which level pushes person to device
 *   }
 *
 * Deploy:
 *   firebase deploy --only functions,firestore:rules
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { getFirestore } = require('firebase-admin/firestore');

const CFG_DOC = '_private/hik';
const DEFAULTS = {
  baseUrl: 'https://ieu.hikcentralconnect.com',
  tokenPath: '/api/hccgw/platform/v1/token/get',
  tzOffsetMin: 300, // UTC+5
  pageSize: 100,
};

// ── API paths (verified on live API) ────────────────────────────────────────
const PATHS = {
  devices:           '/api/hccgw/resource/v1/devices/get',
  personsList:       '/api/hccgw/person/v1/persons/list',
  personsGet:        '/api/hccgw/person/v1/persons/get',
  personsAdd:        '/api/hccgw/person/v1/persons/add',
  personsUpdate:     '/api/hccgw/person/v1/persons/update',
  personsPhoto:      '/api/hccgw/person/v1/persons/photo',
  groupsSearch:      '/api/hccgw/person/v1/groups/search',
  aclPersonAdd:      '/api/hccgw/acspm/v1/accesslevel/person/add',
  aclList:           '/api/hccgw/acspm/v1/accesslevel/list',
  personElementDetail: '/api/hccgw/acspm/v1/maintain/overview/person/{personId}/elementdetail',
  mqSubscribe:       '/api/hccgw/rawmsg/v1/mq/subscribe',
  mqMessages:        '/api/hccgw/rawmsg/v1/mq/messages',
  mqComplete:        '/api/hccgw/rawmsg/v1/mq/messages/complete',
};

const ROOT_GROUP_ID = '1';
const MSG_TYPES = ['Msg110001', 'Msg110002', 'Msg110003', 'Msg110009', 'Msg110010'];
const TOKEN_ERRORS = /OPEN000006|TOKEN_NOT_FOUND|500004/i;
const NOT_SUBSCRIBED = /OPEN000016/i;
const RESCAN_MIN = 5; // duplicate scan threshold (minutes)

const isOk = (json) => String(json?.errorCode ?? '') === '0';
const brief = (json) => JSON.stringify(json ?? null).slice(0, 400);
const isNotFound = (json) => {
  if (Number(json?.status) === 404) return true;
  const s = `${json?.errorCode ?? ''} ${json?.msg ?? json?.message ?? ''} ${json?.error ?? ''}`;
  return /not\s*found|no\s*such|404|invalid\s*(url|uri|path)/i.test(s);
};

const fdb = () => getFirestore();
const cfgRef = () => fdb().doc(CFG_DOC);

async function loadCfg() {
  const snap = await cfgRef().get();
  return { ...DEFAULTS, ...(snap.exists ? snap.data() : {}) };
}

// ── Time helpers ────────────────────────────────────────────────────────────
function toLocalIso(input, tzOffsetMin) {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return null;
  const shifted = new Date(d.getTime() + tzOffsetMin * 60000);
  return shifted.toISOString().slice(0, 19);
}

function toOffsetIso(date, tzOffsetMin) {
  const sign = tzOffsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(tzOffsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${toLocalIso(date, tzOffsetMin)}${sign}${hh}:${mm}`;
}

// ── Token: AK/SK → accessToken (cached ~7 days) ────────────────────────────
async function getToken(cfg, force = false) {
  const now = Date.now();
  if (!force && cfg.accessToken && cfg.tokenExpireAt && cfg.tokenExpireAt - 60000 > now) {
    return { token: cfg.accessToken, domain: cfg.areaDomain || cfg.baseUrl };
  }
  if (!cfg.appKey || !cfg.secretKey) {
    throw new Error('AK/SK not configured — set them in Face ID settings');
  }
  const res = await fetch(`${cfg.baseUrl}${cfg.tokenPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appKey: cfg.appKey, secretKey: cfg.secretKey }),
  });
  const json = await res.json().catch(() => ({}));
  const data = json.data || json;
  const token = data.accessToken;
  if (!token) throw new Error(`token/get: ${JSON.stringify(json).slice(0, 300)}`);

  const domain = (data.areaDomain || cfg.baseUrl).replace(/\/+$/, '');
  const expireAt = Number(data.expireTime) > 0
    ? Number(data.expireTime) * 1000
    : now + 6 * 24 * 3600 * 1000;
  await cfgRef().set({ accessToken: token, tokenExpireAt: expireAt, areaDomain: domain }, { merge: true });
  return { token, domain };
}

const authHeaders = (token) => ({
  'Content-Type': 'application/json',
  Token: token,
});

async function hikCall(cfg, path, body, { method = 'POST', timeoutMs = 30000 } = {}) {
  let { token, domain } = await getToken(cfg);
  const send = async (t) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(`${domain}${path}`, {
        method,
        headers: authHeaders(t),
        signal: ac.signal,
        ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }),
      });
      return await r.json().catch(() => ({}));
    } finally {
      clearTimeout(timer);
    }
  };

  let json = await send(token);
  const err = `${json?.errorCode ?? json?.code ?? ''} ${json?.msg ?? json?.message ?? ''}`;
  if (TOKEN_ERRORS.test(err)) {
    ({ token } = await getToken(cfg, true));
    json = await send(token);
  }
  return json;
}

// ── Extract event list from response ────────────────────────────────────────
function extractList(json) {
  const d = json?.data ?? json;
  for (const k of ['list', 'records', 'rows', 'items', 'events', 'data']) {
    if (Array.isArray(d?.[k])) return d[k];
  }
  return Array.isArray(d) ? d : [];
}

const pick = (o, keys) => { for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k]; return undefined; };

function flatten(ev) {
  const inner = ev?.data?.openDoorInfo?.event ?? ev?.data?.openDoorInfo ?? ev?.data ?? ev;
  return { ...(inner?.basicInfo || {}), ...(inner?.intelliInfo || {}), ...inner };
}

function normalize(rawEvent, tzOffsetMin) {
  const raw = flatten(rawEvent);
  const personId = pick(raw, ['personId']);
  const employeeNo = pick(raw, ['personCode', 'employeeNo', 'employeeId', 'workNo', 'jobNo']);
  const rawAt = pick(raw, ['occurTime', 'occurrenceTime', 'happenTime', 'eventTime', 'checkTime', 'time', 'attendanceTime']);
  const at = rawAt ? toLocalIso(rawAt, tzOffsetMin) : null;
  if ((!personId && !employeeNo) || !at) return null;
  if (raw.authResult != null && Number(raw.authResult) !== 1) return null;

  const msgType = String(rawEvent?.basicInfo?.msgType ?? rawEvent?.msgType ?? raw?.eventType ?? '');
  const st = Number(raw?.attendanceStatus ?? 0);
  let kind;
  if (st === 1 || /110009/.test(msgType)) kind = 'checkin';
  else if (st === 2 || /110010/.test(msgType)) kind = 'checkout';

  const serial = pick(raw, ['eventId', 'recordId', 'serialNo', 'id']);
  const eventId = `${personId || employeeNo}_${at}${serial ? `_${serial}` : ''}`;

  return {
    eventId, at, kind,
    personId: personId ? String(personId) : undefined,
    employeeNo: employeeNo ? String(employeeNo) : undefined,
    source: pick(raw, ['deviceName', 'devName', 'deviceSerial', 'deviceSerialNo']),
  };
}

// ── Devices: name, model, online status ─────────────────────────────────────
async function fetchDevices(cfg) {
  const json = await hikCall(cfg, PATHS.devices, { pageIndex: 1, pageSize: 100 });
  const list = json?.data?.device || [];
  const devices = list.map(d => ({
    id: d.id,
    name: d.name || d.serialNo || '—',
    model: d.type || '',
    serialNo: d.serialNo || '',
    online: Number(d.onlineStatus) === 1,
    isTerminal: d.category === 'accessControllerDevice',
  }));
  const terminals = devices.filter(d => d.isTerminal);
  return {
    devices, terminals,
    anyTerminalOnline: terminals.some(d => d.online),
    onlineTerminal: terminals.find(d => d.online) || null,
  };
}

// ── Employee map: resolve face event → staff uid ────────────────────────────
async function employeeMap(centerId) {
  let q = fdb().collection('users');
  if (centerId) q = q.where('centerId', '==', centerId);
  const snap = await q.get();
  const byCode = new Map();
  const byPersonId = new Map();
  snap.forEach(d => {
    const u = d.data();
    const rec = {
      uid: u.uid || d.id,
      name: u.displayName || u.name || u.fullName || '',
      role: u.role || 'student',
    };
    if (u.employeeNo) byCode.set(String(u.employeeNo).trim(), rec);
    if (u.hikPersonId) byPersonId.set(String(u.hikPersonId).trim(), rec);
  });
  return {
    byCode, byPersonId,
    get size() { return byCode.size; },
    resolve(ev) {
      return (ev.personId && byPersonId.get(String(ev.personId)))
        || (ev.employeeNo && byCode.get(String(ev.employeeNo)))
        || null;
    },
  };
}

// ── Minutes gap between two ISO times ───────────────────────────────────────
function gapMin(a, b) {
  return Math.abs(new Date(`${a}Z`).getTime() - new Date(`${b}Z`).getTime()) / 60000;
}

// ── Classify scan: check-in, check-out, or duplicate ────────────────────────
async function classifyScan(centerId, uid, ev) {
  const date = ev.at.slice(0, 10);
  const ref = fdb().collection('att_day').doc(`${centerId}_${uid}_${date}`);

  return fdb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const m = snap.exists ? snap.data() : null;

    // Already seen this exact event?
    if (m && m.lastEventId === ev.eventId) return { action: 'redeliver' };

    // First scan of the day → check-in
    if (!m) {
      tx.set(ref, {
        state: 'in', checkinAt: ev.at, lastAt: ev.at,
        lastEventId: ev.eventId, date,
      });
      return { action: 'checkin', checkinAt: ev.at };
    }

    const gap = m.lastAt ? gapMin(ev.at, m.lastAt) : Infinity;

    // Duplicate (within RESCAN_MIN of last change)
    if (gap < RESCAN_MIN) {
      tx.update(ref, { lastEventId: ev.eventId });
      return { action: 'dup', checkinAt: m.checkinAt, checkoutAt: m.checkoutAt };
    }

    // Terminal says direction → use it
    const said = ev.kind;
    if (said === 'checkin' && m.state === 'in') {
      tx.update(ref, { lastEventId: ev.eventId });
      return { action: 'dup', checkinAt: m.checkinAt };
    }
    if (said === 'checkout' && m.state === 'out') {
      tx.update(ref, { lastEventId: ev.eventId });
      return { action: 'dup', checkoutAt: m.checkoutAt };
    }

    if (m.state === 'in') {
      tx.update(ref, { state: 'out', checkoutAt: ev.at, lastAt: ev.at, lastEventId: ev.eventId });
      return { action: 'checkout', checkinAt: m.checkinAt, checkoutAt: ev.at };
    }
    // was 'out' → re-check-in (came back from break or second shift)
    tx.update(ref, { state: 'in', checkinAt: ev.at, lastAt: ev.at, lastEventId: ev.eventId });
    return { action: 'checkin', checkinAt: ev.at };
  });
}

// ── Write face events to Firestore ──────────────────────────────────────────
async function writeEvents(events, centerId, map, cfg) {
  let written = 0, unknown = 0;

  for (const ev of events) {
    const user = map.resolve(ev);
    if (!user) { unknown++; continue; }

    let cls;
    try {
      cls = await classifyScan(centerId, user.uid, ev);
    } catch (e) {
      logger.error('classifyScan error:', String(e).slice(0, 200));
      continue;
    }
    if (cls.action === 'redeliver' || cls.action === 'dup') continue;

    const isCheckin = cls.action === 'checkin';
    const id = `hik_${centerId}_${ev.eventId}`.replace(/[/\s]/g, '_');
    try {
      await fdb().collection('face_events').doc(id).create({
        id, centerId, staffUid: user.uid, staffName: user.name, role: user.role, at: ev.at,
        kind: isCheckin ? 'checkin' : 'checkout',
        source: ev.source || 'hikvision',
        processed: false,
      });
      written++;
    } catch (e) {
      if (e.code !== 6) logger.error('face_events write failed:', String(e).slice(0, 200));
    }
  }
  return { written, unknown };
}

// ── MQ subscription ─────────────────────────────────────────────────────────
async function subscribeMq(cfg) {
  const json = await hikCall(cfg, PATHS.mqSubscribe, { subscribeType: 1, msgType: MSG_TYPES });
  if (!isOk(json)) throw new Error(`mq/subscribe: ${brief(json)}`);
  await cfgRef().set({ mqSubscribedAt: new Date().toISOString() }, { merge: true });
  return json;
}

// ── Drain one batch from MQ ─────────────────────────────────────────────────
async function drainOnce(cfg, map) {
  let json = await hikCall(cfg, PATHS.mqMessages, {});

  if (NOT_SUBSCRIBED.test(`${json?.errorCode ?? ''} ${json?.message ?? ''}`)) {
    logger.info('hik: not subscribed — resubscribing');
    await subscribeMq(cfg);
    json = await hikCall(cfg, PATHS.mqMessages, {});
  }
  if (!isOk(json)) throw new Error(`mq/messages: ${brief(json)}`);

  const d = json.data || {};
  const list = Array.isArray(d.event) ? d.event : [];
  const batchId = d.batchId;
  const remaining = Number(d.remainingNumber) || 0;

  if (list.length) {
    const events = list.map(r => normalize(r, cfg.tzOffsetMin)).filter(Boolean);
    if (!events.length) {
      logger.warn('hik: unrecognized event format →', JSON.stringify(list[0]).slice(0, 1500));
    }
    try {
      const { written, unknown } = await writeEvents(events, cfg.centerId, map, cfg);
      const lastEventAt = events.reduce((m, e) => (e.at > m ? e.at : m), cfg.lastEventAt || '');
      if (lastEventAt) await cfgRef().set({ lastEventAt }, { merge: true });
      logger.info(`hik: batch=${list.length} written=${written} unknown=${unknown} remaining=${remaining}`);
    } catch (e) {
      logger.error('hik: batch write error (batch acknowledged anyway) →', String(e).slice(0, 300));
    }
  }

  // ALWAYS acknowledge — otherwise the queue gets stuck
  if (batchId && String(batchId) !== '0') {
    const c = await hikCall(cfg, PATHS.mqComplete, { batchId });
    if (!isOk(c)) logger.warn('hik: complete rejected →', brief(c));
  }
  return { count: list.length, remaining };
}

// ── 1. Poll attendance every 2 minutes ──────────────────────────────────────
exports.hikPollAttendance = onSchedule(
  { schedule: 'every 2 minutes', timeZone: 'Asia/Tashkent', region: 'us-central1', retryCount: 0, timeoutSeconds: 300 },
  async () => {
    const cfg = await loadCfg();
    if (!cfg.enabled) return;
    if (!cfg.appKey || !cfg.secretKey) return;
    if (!cfg.centerId) { logger.warn('hik: centerId not configured'); return; }

    try {
      const map = await employeeMap(cfg.centerId);
      let total = 0;
      for (let i = 0; i < 20; i++) {
        const { count, remaining } = await drainOnce(cfg, map);
        total += count;
        if (!count || !remaining) break;
      }
      await cfgRef().set({ lastPollAt: new Date().toISOString(), lastError: null }, { merge: true });
      if (total) logger.info(`hik: total ${total} events read`);
    } catch (e) {
      logger.error('hik poll error:', e);
      await cfgRef().set({ lastError: String(e).slice(0, 500), lastPollAt: new Date().toISOString() }, { merge: true });
    }
  }
);

// ── 2. Webhook: Hik cloud pushes events directly ────────────────────────────
exports.hikWebhook = onRequest(
  { cors: false, region: 'us-central1' },
  async (req, res) => {
    const cfg = await loadCfg();
    if (!cfg.debugKey || req.query.key !== cfg.debugKey) { res.status(403).send('forbidden'); return; }
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const list = Array.isArray(body) ? body : extractList(body);
      const events = (list.length ? list : [body]).map(r => normalize(r, cfg.tzOffsetMin)).filter(Boolean);
      if (!events.length) {
        logger.warn('hikWebhook: unrecognized format', JSON.stringify(body).slice(0, 1000));
        res.json({ ok: true, parsed: 0 });
        return;
      }
      const map = await employeeMap(cfg.centerId);
      const { written, unknown } = await writeEvents(events, cfg.centerId, map, cfg);
      logger.info(`hikWebhook: written=${written} unknown=${unknown}`);
      res.json({ ok: true, written, unknown });
    } catch (e) {
      logger.error('hikWebhook error:', e);
      res.status(500).json({ ok: false, error: String(e) });
    }
  }
);

// ── Auth: verify caller is a center manager ─────────────────────────────────
async function assertManager(request) {
  const t = request.auth && request.auth.token;
  if (!t) throw new HttpsError('unauthenticated', 'Please sign in');
  // Accept manager role or superadmin
  if (t.role !== 'manager' && t.role !== 'SUPERADMIN' && t.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Manager access required');
  }
  return t;
}

const mask = (s) => (s ? `••••${String(s).slice(-4)}` : null);

// ── 3. Save config ──────────────────────────────────────────────────────────
exports.hikSaveConfig = onCall({ region: 'us-central1' }, async (request) => {
  await assertManager(request);
  const d = request.data || {};
  const patch = {};

  for (const k of ['appKey', 'secretKey', 'debugKey', 'baseUrl', 'centerId', 'groupId', 'accessLevelId']) {
    if (typeof d[k] === 'string' && d[k].trim()) patch[k] = d[k].trim();
  }
  if (typeof d.enabled === 'boolean') patch.enabled = d.enabled;
  if (Number.isFinite(d.tzOffsetMin)) patch.tzOffsetMin = Number(d.tzOffsetMin);

  const keysChanged = !!(patch.appKey || patch.secretKey);
  if (keysChanged) {
    patch.accessToken = null; patch.tokenExpireAt = null; patch.areaDomain = null; patch.lastError = null;
  }
  await cfgRef().set(patch, { merge: true });

  if (keysChanged) {
    try {
      const { domain } = await getToken(await loadCfg(), true);
      return { ok: true, saved: Object.keys(patch), verified: true, areaDomain: domain, info: 'Saved and keys verified ✅' };
    } catch (e) {
      const raw = String(e);
      const info = /AK_NOT_FOUND|OPEN000001/i.test(raw)
        ? 'Saved, but Hikvision did NOT recognize this AppKey. Copy-paste the key instead of typing it manually.'
        : `Saved, but keys failed: ${raw.slice(0, 200)}`;
      await cfgRef().set({ lastError: raw.slice(0, 500) }, { merge: true });
      return { ok: false, saved: Object.keys(patch), verified: false, info };
    }
  }
  return { ok: true, saved: Object.keys(patch), verified: false, info: 'Saved' };
});

// ── 4. Status ───────────────────────────────────────────────────────────────
exports.hikStatus = onCall({ region: 'us-central1' }, async (request) => {
  await assertManager(request);
  const cfg = await loadCfg();
  const map = await employeeMap(cfg.centerId);
  return {
    ok: true,
    enabled: !!cfg.enabled,
    hasKeys: !!(cfg.appKey && cfg.secretKey),
    appKey: mask(cfg.appKey),
    secretKey: mask(cfg.secretKey),
    debugKey: mask(cfg.debugKey),
    baseUrl: cfg.baseUrl,
    centerId: cfg.centerId || null,
    groupId: cfg.groupId || ROOT_GROUP_ID,
    accessLevelId: cfg.accessLevelId || null,
    mqSubscribedAt: cfg.mqSubscribedAt || null,
    areaDomain: cfg.areaDomain || null,
    lastPollAt: cfg.lastPollAt || null,
    lastEventAt: cfg.lastEventAt || null,
    lastError: cfg.lastError || null,
    linkedEmployees: map.size,
  };
});

// ── 5. Test connection ──────────────────────────────────────────────────────
exports.hikTest = onCall({ region: 'us-central1' }, async (request) => {
  await assertManager(request);
  const cfg = await loadCfg();
  try {
    const { domain } = await getToken(cfg, true);
    const dev = await fetchDevices(cfg);
    const sub = await subscribeMq(cfg);

    const acl = await hikCall(cfg, PATHS.aclList, {
      accessLevelSearchRequest: { pageIndex: 1, pageSize: 50 },
    });
    const levels = (acl?.data?.accessLevelResponse?.accessLevelList || [])
      .map(l => ({ id: String(l.id), name: l.name || '' }));
    const grp = await hikCall(cfg, PATHS.groupsSearch, { pageIndex: 1, pageSize: 50 });
    const groups = (grp?.data?.personGroupList || [])
      .map(g => ({ id: String(g.groupId), name: g.groupName || '' }));

    const chosen = cfg.accessLevelId
      ? levels.find(l => l.id === String(cfg.accessLevelId))
      : (levels.length === 1 ? levels[0] : null);

    return {
      ok: true, token: true, areaDomain: domain,
      devices: dev.devices.length,
      terminals: dev.terminals.length,
      onlineTerminal: dev.onlineTerminal ? `${dev.onlineTerminal.name} (${dev.onlineTerminal.model})` : null,
      subscribed: isOk(sub),
      levels, groups,
      accessLevelId: cfg.accessLevelId || null,
      accessLevelName: chosen?.name || null,
      groupId: cfg.groupId || ROOT_GROUP_ID,
      info: !dev.anyTerminalOnline
        ? `Connected, but face terminal is OFFLINE (${dev.terminals.length} found)`
        : !levels.length
          ? `${dev.onlineTerminal.name} online, but no Access Level — create one in the console`
          : !chosen
            ? `${dev.onlineTerminal.name} online. ${levels.length} Access Levels — select which one to use`
            : `Connected ✅ · ${dev.onlineTerminal.name} online · Access Level «${chosen.name}» · MQ subscribed`,
    };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 300) };
  }
});

// ── 6. Enroll a staff member's face to the terminal ─────────────────────────
const FACE_MAX_BYTES = 5 * 1024 * 1024;

const personDates = (tzOffsetMin) => ({
  startDate: toOffsetIso(new Date(Date.now() - 365 * 24 * 3600 * 1000), tzOffsetMin),
  endDate: toOffsetIso(new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000), tzOffsetMin),
});

async function findPersonByCode(cfg, personCode) {
  for (let page = 1; page <= 10; page++) {
    const json = await hikCall(cfg, PATHS.personsList, { pageIndex: page, pageSize: 100 });
    const list = json?.data?.personList || [];
    if (!list.length) return null;
    const hit = list.find(w => String(w?.personInfo?.personCode || '') === String(personCode));
    if (hit) return hit.personInfo;
    if (list.length < 100) return null;
  }
  return null;
}

async function pushToDevices(cfg, personId) {
  let levelId = cfg.accessLevelId;
  let levelName = '';

  if (!levelId) {
    const list = await hikCall(cfg, PATHS.aclList, {
      accessLevelSearchRequest: { pageIndex: 1, pageSize: 50 },
    });
    const levels = list?.data?.accessLevelResponse?.accessLevelList || [];
    if (!levels.length) return { pushed: false, info: 'No Access Level — create one in Hik console' };
    if (levels.length > 1) {
      const names = levels.map(l => `${l.name} (${l.id})`).join(', ');
      return { pushed: false, info: `Multiple Access Levels — select one in Face ID settings: ${names}` };
    }
    levelId = levels[0].id;
    levelName = levels[0].name || '';
    await cfgRef().set({ accessLevelId: String(levelId) }, { merge: true });
  }

  const j = await hikCall(cfg, PATHS.aclPersonAdd, {
    personList: [{ personId: String(personId), accessLevelIdList: [String(levelId)] }],
  });
  const who = levelName ? `«${levelName}»` : `id ${levelId}`;
  if (!isOk(j)) return { pushed: false, levelId: String(levelId), levelName, info: `${who} rejected: ${brief(j)}` };
  const failed = j?.data?.accessLevelFailed || [];
  if (failed.length) {
    const names = failed.map(f => f.accessLevelName || f.accessLevelId || '?').join(', ');
    return { pushed: false, levelId: String(levelId), levelName, info: `${who} not applied: ${names}` };
  }
  return { pushed: true, levelId: String(levelId), levelName, info: `${who} — pushed to terminal` };
}

async function checkDeviceApply(cfg, personId) {
  const path = PATHS.personElementDetail.replace('{personId}', String(personId));
  const j = await hikCall(cfg, path, { returnSuccess: true });
  if (!isOk(j)) return { known: false, info: `Cannot read status: ${brief(j)}` };

  const list = j?.data?.elementDetailList || [];
  if (!list.length) return { known: true, applied: false, info: 'Not linked to any door — check Access Level settings' };
  const problems = [];
  let anyOk = false;
  for (const el of list) {
    const certs = el.certificateStatusList || [];
    const bad = certs.filter(c => c.errorCode);
    if (bad.length) {
      problems.push(`${el.name}: ${bad.map(c => c.errorCode).join(', ')}`);
    } else if (Number(el?.elementStatus?.status) === 1 || certs.length) {
      anyOk = true;
    }
  }
  if (problems.length) {
    const hint = /0x60000037|0x60000031|face/i.test(problems.join(' '))
      ? ' — usually: face not found in photo or quality too low. Use a front-facing photo where the face fills most of the frame.'
      : '';
    return { known: true, applied: false, info: `Device rejected → ${problems.join('; ')}${hint}` };
  }
  return { known: true, applied: anyOk, info: anyOk ? 'Applied to device ✅' : 'Not yet synced to device (syncing...)' };
}

exports.hikEnrollFace = onCall({ region: 'us-central1', timeoutSeconds: 300 }, async (request) => {
  await assertManager(request);
  const uid = String(request.data?.uid || '').trim();
  if (!uid) throw new HttpsError('invalid-argument', 'uid required');

  const cfg = await loadCfg();
  if (!cfg.appKey || !cfg.secretKey) {
    throw new HttpsError('failed-precondition', 'AK/SK not configured — set them in Face ID settings');
  }

  const snap = await fdb().collection('users').doc(uid).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Staff member not found');
  const u = snap.data();

  const employeeNo = String(u.employeeNo || '').trim();
  if (!employeeNo) throw new HttpsError('failed-precondition', 'Terminal number not set — edit the staff member to add it');
  if (!u.photoURL) throw new HttpsError('failed-precondition', 'Face photo missing — upload a photo first');

  // Download the photo
  let photoRes;
  try {
    photoRes = await fetch(u.photoURL);
    if (!photoRes.ok) throw new Error(`HTTP ${photoRes.status}`);
  } catch (e) {
    throw new HttpsError('failed-precondition', `Cannot download photo: ${String(e).slice(0, 100)}`);
  }
  const buf = await photoRes.arrayBuffer();
  if (buf.byteLength > FACE_MAX_BYTES) {
    throw new HttpsError('failed-precondition', `Photo too large (${(buf.byteLength / 1048576).toFixed(1)} MB, max 5 MB)`);
  }
  const base64 = Buffer.from(buf).toString('base64');

  const groupId = cfg.groupId || ROOT_GROUP_ID;
  const dates = personDates(cfg.tzOffsetMin || DEFAULTS.tzOffsetMin);
  const nameParts = (u.displayName || u.name || 'Staff').split(/\s+/);
  const firstName = nameParts[0] || 'Staff';
  const lastName = nameParts.slice(1).join(' ') || 'Member';

  // Check if person already exists
  let personId = null;
  let created = false;
  const existing = await findPersonByCode(cfg, employeeNo);
  if (existing) {
    personId = existing.personId;
    const upd = await hikCall(cfg, PATHS.personsUpdate, {
      personId, personCode: employeeNo, personName: u.displayName || u.name || '',
      firstName, lastName, gender: 0, groupId,
      ...dates,
    });
    if (!isOk(upd)) logger.warn('persons/update:', brief(upd));
  } else {
    const add = await hikCall(cfg, PATHS.personsAdd, {
      personCode: employeeNo, personName: u.displayName || u.name || '',
      firstName, lastName, gender: 0, groupId,
      ...dates,
    });
    if (!isOk(add)) throw new HttpsError('internal', `persons/add failed: ${brief(add)}`);
    personId = add?.data?.personId;
    if (!personId) throw new HttpsError('internal', `persons/add: no personId in response`);
    created = true;
  }

  // Upload face photo
  const photo = await hikCall(cfg, PATHS.personsPhoto, {
    personId, facePhoto: { faceData: base64 },
  }, { timeoutMs: 60000 });
  const faceUploaded = isOk(photo);
  if (!faceUploaded) logger.warn('persons/photo:', brief(photo));

  // Push to devices via Access Level
  const push = await pushToDevices(cfg, personId);

  // Verify device accepted the face
  let deviceApplied = false;
  if (push.pushed) {
    await new Promise(r => setTimeout(r, 3000));
    const check = await checkDeviceApply(cfg, personId);
    deviceApplied = check.applied || false;
  }

  // Verify headPicUrl
  let headPicUrl = null;
  try {
    const person = await hikCall(cfg, PATHS.personsGet, { personId });
    headPicUrl = person?.data?.personInfo?.headPicUrl || null;
  } catch (e) { /* not critical */ }

  // Save hikPersonId to user doc
  await fdb().collection('users').doc(uid).set({ hikPersonId: personId, employeeNo }, { merge: true });

  return {
    ok: true,
    info: deviceApplied ? 'Face enrolled and applied to terminal ✅' : (faceUploaded ? 'Face uploaded, waiting for device sync...' : 'Person created but face upload failed'),
    employeeNo, personId, created, faceUploaded,
    deviceApplied, pushedToDevices: push.pushed,
    accessLevelName: push.levelName || null,
    headPicUrl,
  };
});

// ── 7. Device list (lightweight, no secrets) ────────────────────────────────
exports.hikDevices = onCall({ region: 'us-central1' }, async (request) => {
  await assertManager(request);
  const cfg = await loadCfg();
  if (!cfg.appKey || !cfg.secretKey) {
    return { ok: true, configured: false, devices: [], terminals: [] };
  }
  try {
    const dev = await fetchDevices(cfg);
    return { ok: true, configured: true, ...dev };
  } catch (e) {
    return { ok: false, configured: true, error: String(e).slice(0, 200), devices: [], terminals: [] };
  }
});
