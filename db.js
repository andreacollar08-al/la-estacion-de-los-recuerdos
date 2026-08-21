const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'rubiel_navidad.db');
const db = new Database(DB_PATH);

// Habilitar claves foráneas y modo WAL para rendimiento
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT UNIQUE NOT NULL,
      quinceanera_name TEXT NOT NULL,
      tutor_name TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      client_email TEXT,
      session_date TEXT NOT NULL,
      session_time TEXT NOT NULL,
      slot_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_payment',
      amount_mxn REAL NOT NULL,
      total_mxn REAL NOT NULL,
      extra_amount_mxn REAL NOT NULL DEFAULT 0,
      custom_cake_selected INTEGER NOT NULL DEFAULT 0,
      makeup_hair_selected INTEGER NOT NULL DEFAULT 0,
      photos_status TEXT NOT NULL DEFAULT 'pending',
      admin_notes TEXT DEFAULT '',
      mercado_pago_payment_id TEXT DEFAULT NULL,
      mercado_pago_preference_id TEXT DEFAULT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      paid_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT DEFAULT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reservations_slot_key ON reservations(slot_key);
    CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
    CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(session_date);
    CREATE INDEX IF NOT EXISTS idx_reservations_folio ON reservations(folio);

    CREATE TABLE IF NOT EXISTS slot_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_key TEXT UNIQUE NOT NULL,
      reservation_id INTEGER,
      client_session_id TEXT,
      session_date TEXT NOT NULL,
      session_time TEXT NOT NULL,
      locked_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_slot_locks_expires ON slot_locks(expires_at);

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      path TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      attendee_count TEXT NOT NULL DEFAULT 'Familia',
      consent_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'landing_vip',
      status TEXT NOT NULL DEFAULT 'Pendiente',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
  `);

  try {
    db.exec(`ALTER TABLE slot_locks ADD COLUMN client_session_id TEXT;`);
  } catch (e) {
    // columna ya existe
  }

  cleanExpiredLocks();
}

function cleanExpiredLocks() {
  const nowIso = new Date().toISOString();
  // Limpiar bloqueos expirados
  db.prepare('DELETE FROM slot_locks WHERE expires_at <= ?').run(nowIso);
  // Auto-cancelar reservas pendientes que hayan expirado tras 15 minutos sin completar pago
  db.prepare("UPDATE reservations SET status = 'cancelled', admin_notes = 'Expirada por inactividad de pago' WHERE status = 'pending_payment' AND expires_at <= ?").run(nowIso);
}

function generateFolio() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `NAV-2026-${num}`;
}

function getAvailability(config) {
  cleanExpiredLocks();

  const activeReservations = db.prepare(`
    SELECT slot_key, session_date, session_time, status, is_demo
    FROM reservations
    WHERE status IN ('confirmed', 'session_done', 'photos_delivered', 'pending_payment')
  `).all();

  const activeLocks = db.prepare(`
    SELECT slot_key, session_date, session_time
    FROM slot_locks
    WHERE expires_at > ?
  `).all(new Date().toISOString());

  const reservedSlotMap = new Map();
  for (const r of activeReservations) {
    reservedSlotMap.set(r.slot_key, r.status);
  }

  const lockedSlotSet = new Set(activeLocks.map(l => l.slot_key));

  const datesResult = config.schedule.dates.map(dateObj => {
    const dateStr = dateObj.date;
    const timeSlots = config.schedule.time_slots.map(timeStr => {
      const slotKey = `${dateStr}_${timeStr}`;
      let status = 'available';

      if (reservedSlotMap.has(slotKey)) {
        const rStatus = reservedSlotMap.get(slotKey);
        if (rStatus === 'pending_payment') {
          status = 'locked'; // en proceso de pago
        } else {
          status = 'booked'; // ocupado
        }
      } else if (lockedSlotSet.has(slotKey)) {
        status = 'locked';
      }

      return {
        time: timeStr,
        slot_key: slotKey,
        status: status,
        is_available: status === 'available'
      };
    });

    const totalSlots = timeSlots.length;
    const availableSlots = timeSlots.filter(s => s.status === 'available').length;
    const bookedSlots = timeSlots.filter(s => s.status === 'booked' || s.status === 'locked').length;

    let dateBadge = 'available';
    if (availableSlots === 0) {
      dateBadge = 'sold_out';
    } else if (availableSlots <= 3) {
      dateBadge = 'last_spots';
    }

    return {
      ...dateObj,
      total_slots: totalSlots,
      available_slots: availableSlots,
      booked_slots: bookedSlots,
      badge: dateBadge,
      slots: timeSlots
    };
  });

  const totalAllSlots = datesResult.reduce((acc, d) => acc + d.total_slots, 0);
  const totalAvailableSpots = datesResult.reduce((acc, d) => acc + d.available_slots, 0);

  return {
    total_spots: totalAllSlots,
    available_spots: totalAvailableSpots,
    dates: datesResult
  };
}

function lockSlot(sessionDate, sessionTime, durationMinutes = 10, reservationId = null, clientSessionId = null) {
  cleanExpiredLocks();
  const slotKey = `${sessionDate}_${sessionTime}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  // Verificar si ya hay una reserva activa
  const existingRes = db.prepare(`
    SELECT id, status FROM reservations
    WHERE slot_key = ? AND status IN ('confirmed', 'session_done', 'photos_delivered')
  `).get(slotKey);

  if (existingRes) {
    return { success: false, reason: 'slot_already_booked' };
  }

  // Verificar bloqueo existente por otra sesión o cliente
  const existingLock = db.prepare(`
    SELECT id, reservation_id, client_session_id, expires_at FROM slot_locks
    WHERE slot_key = ? AND expires_at > ?
  `).get(slotKey, nowIso);

  if (existingLock) {
    const isSameReservation = reservationId && existingLock.reservation_id === reservationId;
    const isSameClient = clientSessionId && existingLock.client_session_id === clientSessionId;

    if (!isSameReservation && !isSameClient) {
      return { success: false, reason: 'slot_temporarily_locked', expires_at: existingLock.expires_at };
    }
  }

  // Insertar o reemplazar bloqueo
  const stmt = db.prepare(`
    INSERT INTO slot_locks (slot_key, reservation_id, client_session_id, session_date, session_time, locked_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slot_key) DO UPDATE SET
      reservation_id = excluded.reservation_id,
      client_session_id = excluded.client_session_id,
      locked_at = excluded.locked_at,
      expires_at = excluded.expires_at
  `);

  stmt.run(slotKey, reservationId, clientSessionId, sessionDate, sessionTime, nowIso, expiresAt);

  return { success: true, slot_key: slotKey, expires_at: expiresAt };
}

function releaseSlotLock(slotKey) {
  const stmt = db.prepare('DELETE FROM slot_locks WHERE slot_key = ?');
  stmt.run(slotKey);
}

function createPendingReservation(data) {
  cleanExpiredLocks();
  const slotKey = `${data.session_date}_${data.session_time}`;
  const nowIso = new Date().toISOString();
  const expiresAtIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // Comprobar si ya existe reserva confirmada
  const conflictRes = db.prepare(`
    SELECT id, status FROM reservations
    WHERE slot_key = ? AND status IN ('confirmed', 'session_done', 'photos_delivered')
  `).get(slotKey);

  if (conflictRes) {
    throw new Error('El horario seleccionado ya ha sido reservado por otro cliente.');
  }

  let folio = data.folio || generateFolio();
  // Asegurar unicidad del folio
  while (db.prepare('SELECT id FROM reservations WHERE folio = ?').get(folio)) {
    folio = generateFolio();
  }

  const insertStmt = db.prepare(`
    INSERT INTO reservations (
      folio, quinceanera_name, tutor_name, whatsapp, client_email,
      session_date, session_time, slot_key, status, amount_mxn, total_mxn,
      extra_amount_mxn, custom_cake_selected, makeup_hair_selected,
      photos_status, admin_notes, is_demo, created_at, updated_at, expires_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, 'pending_payment', ?, ?,
      ?, ?, ?,
      'pending', ?, ?, ?, ?, ?
    )
  `);

  const result = insertStmt.run(
    folio,
    data.quinceanera_name.trim(),
    data.tutor_name.trim(),
    data.whatsapp.trim(),
    (data.client_email || '').trim(),
    data.session_date,
    data.session_time,
    slotKey,
    data.amount_mxn,
    data.total_mxn,
    data.extra_amount_mxn || 0,
    data.custom_cake_selected ? 1 : 0,
    data.makeup_hair_selected ? 1 : 0,
    data.admin_notes || '',
    data.is_demo ? 1 : 0,
    nowIso,
    nowIso,
    expiresAtIso
  );

  const reservationId = result.lastInsertRowid;
  // Bloquear slot para esta reserva
  lockSlot(data.session_date, data.session_time, 15, reservationId);

  return getReservationById(reservationId);
}

function getReservationById(id) {
  return db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
}

function getReservationByFolio(folio) {
  return db.prepare('SELECT * FROM reservations WHERE folio = ?').get(folio);
}

function confirmReservation(id, paymentId = null, preferenceId = null, isDemo = false) {
  const nowIso = new Date().toISOString();
  const res = getReservationById(id);
  if (!res) throw new Error('Reserva no encontrada');

  const updateStmt = db.prepare(`
    UPDATE reservations SET
      status = 'confirmed',
      paid_at = ?,
      mercado_pago_payment_id = ?,
      mercado_pago_preference_id = ?,
      is_demo = ?,
      updated_at = ?
    WHERE id = ?
  `);

  updateStmt.run(
    nowIso,
    paymentId ? String(paymentId) : (isDemo ? `DEMO-PAY-${Date.now()}` : res.mercado_pago_payment_id),
    preferenceId ? String(preferenceId) : res.mercado_pago_preference_id,
    isDemo ? 1 : (res.is_demo || 0),
    nowIso,
    id
  );

  // Liberar el bloqueo temporal porque ya está confirmada formalmente en reservations
  releaseSlotLock(res.slot_key);

  return getReservationById(id);
}

function updateReservation(id, data) {
  const nowIso = new Date().toISOString();
  const current = getReservationById(id);
  if (!current) throw new Error('Reserva no encontrada');

  const updateStmt = db.prepare(`
    UPDATE reservations SET
      status = coalesce(?, status),
      photos_status = coalesce(?, photos_status),
      admin_notes = coalesce(?, admin_notes),
      total_mxn = coalesce(?, total_mxn),
      amount_mxn = coalesce(?, amount_mxn),
      extra_amount_mxn = coalesce(?, extra_amount_mxn),
      custom_cake_selected = coalesce(?, custom_cake_selected),
      makeup_hair_selected = coalesce(?, makeup_hair_selected),
      updated_at = ?
    WHERE id = ?
  `);

  updateStmt.run(
    data.status !== undefined ? data.status : null,
    data.photos_status !== undefined ? data.photos_status : null,
    data.admin_notes !== undefined ? data.admin_notes : null,
    data.total_mxn !== undefined ? data.total_mxn : null,
    data.amount_mxn !== undefined ? data.amount_mxn : null,
    data.extra_amount_mxn !== undefined ? data.extra_amount_mxn : null,
    data.custom_cake_selected !== undefined ? (data.custom_cake_selected ? 1 : 0) : null,
    data.makeup_hair_selected !== undefined ? (data.makeup_hair_selected ? 1 : 0) : null,
    nowIso,
    id
  );

  return getReservationById(id);
}

function cancelReservation(id, adminNote = 'Cancelada por administrador') {
  const nowIso = new Date().toISOString();
  const current = getReservationById(id);
  if (!current) throw new Error('Reserva no encontrada');

  const updateStmt = db.prepare(`
    UPDATE reservations SET
      status = 'cancelled',
      admin_notes = CASE WHEN admin_notes = '' THEN ? ELSE admin_notes || ' | ' || ? END,
      updated_at = ?
    WHERE id = ?
  `);

  updateStmt.run(adminNote, adminNote, nowIso, id);
  db.prepare('DELETE FROM slot_locks WHERE slot_key = ? OR reservation_id = ?').run(current.slot_key, id);

  return getReservationById(id);
}

function getAllReservations(filters = {}) {
  let query = 'SELECT * FROM reservations WHERE 1=1';
  const params = [];

  if (filters.status && filters.status !== 'all') {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.session_date && filters.session_date !== 'all') {
    query += ' AND session_date = ?';
    params.push(filters.session_date);
  }

  if (filters.photos_status && filters.photos_status !== 'all') {
    query += ' AND photos_status = ?';
    params.push(filters.photos_status);
  }

  if (filters.search) {
    const s = `%${filters.search.trim()}%`;
    query += ' AND (folio LIKE ? OR quinceanera_name LIKE ? OR tutor_name LIKE ? OR whatsapp LIKE ? OR client_email LIKE ?)';
    params.push(s, s, s, s, s);
  }

  const sortCol = filters.sort_by || 'session_date';
  const sortDir = filters.sort_dir === 'desc' ? 'DESC' : 'ASC';

  if (sortCol === 'time') {
    query += ` ORDER BY session_date ${sortDir}, session_time ${sortDir}`;
  } else if (sortCol === 'name') {
    query += ` ORDER BY quinceanera_name ${sortDir}`;
  } else if (sortCol === 'status') {
    query += ` ORDER BY status ${sortDir}`;
  } else if (sortCol === 'total') {
    query += ` ORDER BY total_mxn ${sortDir}`;
  } else {
    query += ` ORDER BY session_date ${sortDir}, session_time ${sortDir}`;
  }

  return db.prepare(query).all(...params);
}

function getMetrics(config) {
  cleanExpiredLocks();
  const availability = getAvailability(config);

  const confirmedCount = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(amount_mxn), 0) as total_deposit, COALESCE(SUM(total_mxn), 0) as total_revenue
    FROM reservations
    WHERE status IN ('confirmed', 'session_done', 'photos_delivered')
  `).get();

  const pendingCount = db.prepare(`
    SELECT COUNT(*) as count FROM reservations WHERE status = 'pending_payment'
  `).get().count;

  const totalBalanceDue = confirmedCount.total_revenue - confirmedCount.total_deposit;

  return {
    total_confirmed: confirmedCount.count,
    pending_payment: pendingCount,
    total_deposit_collected: confirmedCount.total_deposit,
    total_revenue_expected: confirmedCount.total_revenue,
    total_balance_due: totalBalanceDue > 0 ? totalBalanceDue : 0,
    available_spots: availability.available_spots,
    total_spots: availability.total_spots
  };
}

function logAnalyticsEvent(event, pathName, metadata = {}) {
  const stmt = db.prepare(`
    INSERT INTO analytics_events (event, path, metadata, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(event, pathName, JSON.stringify(metadata), new Date().toISOString());
}

function normalizeLeadEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeLeadPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function generateLeadFolio() {
  let folio;
  do {
    folio = `VIP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (db.prepare('SELECT 1 FROM leads WHERE folio = ?').get(folio));
  return folio;
}

function getLeadByContact(email, phone) {
  return db.prepare('SELECT * FROM leads WHERE email = ? OR phone = ? LIMIT 1').get(email, phone);
}

function createLead(data) {
  const nowIso = new Date().toISOString();
  const email = normalizeLeadEmail(data.email);
  const phone = normalizeLeadPhone(data.phone);
  const existing = getLeadByContact(email, phone);

  if (existing) {
    db.prepare('UPDATE leads SET updated_at = ?, attendee_count = ?, consent_at = ? WHERE id = ?')
      .run(nowIso, data.attendee_count || existing.attendee_count, nowIso, existing.id);
    return { ...db.prepare('SELECT * FROM leads WHERE id = ?').get(existing.id), duplicate: true };
  }

  const folio = generateLeadFolio();
  const result = db.prepare(`
    INSERT INTO leads (folio, name, email, phone, attendee_count, consent_at, source, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?, ?)
  `).run(
    folio,
    String(data.name).trim(),
    email,
    phone,
    String(data.attendee_count || 'Familia').trim(),
    nowIso,
    String(data.source || 'landing_vip').trim(),
    nowIso,
    nowIso
  );

  return db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
}

function getAllLeads(filters = {}) {
  let query = 'SELECT * FROM leads WHERE 1=1';
  const params = [];
  if (filters.status && filters.status !== 'ALL') {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.search) {
    const search = `%${String(filters.search).trim()}%`;
    query += ' AND (folio LIKE ? OR name LIKE ? OR email LIKE ? OR phone LIKE ? OR attendee_count LIKE ?)';
    params.push(search, search, search, search, search);
  }
  query += ' ORDER BY created_at DESC';
  return db.prepare(query).all(...params);
}

function updateLead(id, data) {
  const current = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!current) throw new Error('Registro no encontrado');
  const status = ['Pendiente', 'Contactado', 'Apartado'].includes(data.status) ? data.status : current.status;
  const notes = data.notes !== undefined ? String(data.notes).slice(0, 2000) : current.notes;
  const nowIso = new Date().toISOString();
  db.prepare('UPDATE leads SET status = ?, notes = ?, updated_at = ? WHERE id = ?').run(status, notes, nowIso, id);
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

function deleteLead(id) {
  const result = db.prepare('DELETE FROM leads WHERE id = ?').run(id);
  return result.changes > 0;
}

function getLeadMetrics() {
  const total = db.prepare('SELECT COUNT(*) AS count FROM leads').get().count;
  const pending = db.prepare("SELECT COUNT(*) AS count FROM leads WHERE status = 'Pendiente'").get().count;
  const contacted = db.prepare("SELECT COUNT(*) AS count FROM leads WHERE status = 'Contactado'").get().count;
  const confirmed = db.prepare("SELECT COUNT(*) AS count FROM leads WHERE status = 'Apartado'").get().count;
  return { total, pending, contacted, confirmed };
}

module.exports = {
  db,
  initDatabase,
  getAvailability,
  lockSlot,
  releaseSlotLock,
  createPendingReservation,
  getReservationById,
  getReservationByFolio,
  confirmReservation,
  updateReservation,
  cancelReservation,
  getAllReservations,
  getMetrics,
  createLead,
  getAllLeads,
  updateLead,
  deleteLead,
  getLeadMetrics,
  logAnalyticsEvent
};
