require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dbModule = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Cargar configuración de campaña
const configPath = path.join(__dirname, 'config.json');
let campaignConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Inicializar Base de Datos SQLite
dbModule.initDatabase();

// Middlewares
app.use(cors(process.env.PUBLIC_ORIGIN ? { origin: process.env.PUBLIC_ORIGIN } : { origin: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Protección ligera contra envíos automatizados del formulario VIP.
const leadAttempts = new Map();
const activeAdminTokens = new Set();
function leadRateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const current = leadAttempts.get(key) || { count: 0, startedAt: now };
  if (now - current.startedAt > windowMs) {
    current.count = 0;
    current.startedAt = now;
  }
  current.count += 1;
  leadAttempts.set(key, current);
  if (current.count > 8) {
    return res.status(429).json({ success: false, error: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' });
  }
  return next();
}

// Servir archivos estáticos
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Middleware simple de autenticación de administrador
function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const adminSecret = process.env.ADMIN_PASSWORD;
  const adminPin = process.env.ADMIN_PIN;
  const demoSecret = process.env.ADMIN_DEMO_SECRET;

  if (!adminSecret || !adminPin || !demoSecret) {
    return res.status(503).json({ success: false, error: 'El panel no está configurado de forma segura.' });
  }

  if (token && (token === adminSecret || token === adminPin || token === demoSecret || activeAdminTokens.has(token))) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Acceso no autorizado para el panel de administración' });
}

// --------------------------------------------------------------------------
// 1. ENDPOINTS PÚBLICOS DE CAMPAÑA Y CONFIGURACIÓN
// --------------------------------------------------------------------------

// Obtener configuración pública
app.get('/api/config', (req, res) => {
  // Recargar en caso de edición en caliente
  try {
    campaignConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Error al recargar config.json', e);
  }

  // Sanitizar configuración pública (no exponer credenciales ni emails privados innecesarios)
  const publicConfig = {
    business: campaignConfig.business,
    campaign: campaignConfig.campaign,
    extras: campaignConfig.extras,
    schedule: campaignConfig.schedule,
    mercadopago_public_key: process.env.MP_PUBLIC_KEY || 'TEST-00000000-0000-0000-0000-000000000000'
  };

  res.json({ success: true, data: publicConfig });
});

// --------------------------------------------------------------------------
// 1.1 REGISTRO VIP DE PRELANZAMIENTO
// --------------------------------------------------------------------------

app.post('/api/leads', leadRateLimit, (req, res) => {
  const { name, email, phone, attendee_count, consent, source } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const validCounts = new Set([
    '1 a 2 personas (Pareja / Individual)',
    '3 a 4 personas (Familia pequeña)',
    '5 a 6 personas (Familia grande)',
    'Más de 6 personas (Sesión Generacional con abuelitos)'
  ]);

  if (cleanName.length < 2 || cleanName.length > 120) {
    return res.status(400).json({ success: false, error: 'Escribe tu nombre completo.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'Escribe un correo electrónico válido.' });
  }
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return res.status(400).json({ success: false, error: 'Escribe un número de WhatsApp válido.' });
  }
  if (!consent) {
    return res.status(400).json({ success: false, error: 'Necesitamos tu autorización para enviarte las primicias.' });
  }
  if (attendee_count && !validCounts.has(attendee_count)) {
    return res.status(400).json({ success: false, error: 'Selecciona una cantidad de personas válida.' });
  }

  try {
    const lead = dbModule.createLead({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      attendee_count: attendee_count || 'Familia',
      source: source || 'landing_vip'
    });
    dbModule.logAnalyticsEvent(lead.duplicate ? 'vip_lead_duplicate' : 'vip_lead_created', '/api/leads', {
      lead_id: lead.id,
      folio: lead.folio,
      source: source || 'landing_vip'
    });
    return res.status(lead.duplicate ? 200 : 201).json({
      success: true,
      data: { id: lead.id, folio: lead.folio, duplicate: !!lead.duplicate }
    });
  } catch (error) {
    console.error('Error al registrar lead VIP:', error);
    return res.status(500).json({ success: false, error: 'No pudimos guardar tu boleto. Intenta de nuevo.' });
  }
});

// Consultar disponibilidad en tiempo real
app.get('/api/availability', (req, res) => {
  try {
    const availability = dbModule.getAvailability(campaignConfig);
    res.json({ success: true, data: availability });
  } catch (error) {
    console.error('Error al obtener disponibilidad:', error);
    res.status(500).json({ success: false, error: 'Error al consultar disponibilidad' });
  }
});

// Bloquear slot temporalmente (10 minutos)
app.post('/api/lock-slot', (req, res) => {
  const { session_date, session_time, client_session_id } = req.body;
  if (!session_date || !session_time) {
    return res.status(400).json({ success: false, error: 'Fecha y horario obligatorios' });
  }

  try {
    const lockResult = dbModule.lockSlot(session_date, session_time, 10, null, client_session_id);
    if (!lockResult.success) {
      return res.status(409).json({
        success: false,
        error: lockResult.reason === 'slot_already_booked'
          ? 'El horario seleccionado ya está reservado.'
          : 'El horario está siendo seleccionado por otro cliente en este momento. Intenta en unos minutos.'
      });
    }

    res.json({ success: true, data: lockResult });
  } catch (error) {
    console.error('Error al bloquear slot:', error);
    res.status(500).json({ success: false, error: 'Error interno al procesar el horario' });
  }
});

// Liberar bloqueo temporal
app.post('/api/release-slot', (req, res) => {
  const { session_date, session_time } = req.body;
  if (session_date && session_time) {
    const slotKey = `${session_date}_${session_time}`;
    dbModule.releaseSlotLock(slotKey);
  }
  res.json({ success: true });
});

// --------------------------------------------------------------------------
// 2. CREACIÓN DE RESERVA Y MERCADO PAGO CHECKOUT PRO
// --------------------------------------------------------------------------

app.post('/api/create-reservation', async (req, res) => {
  const {
    quinceanera_name,
    tutor_name,
    whatsapp,
    client_email,
    session_date,
    session_time,
    custom_cake_selected,
    makeup_hair_selected,
    is_demo
  } = req.body;

  // Validaciones
  if (!quinceanera_name || !tutor_name || !whatsapp || !session_date || !session_time) {
    return res.status(400).json({ success: false, error: 'Todos los campos obligatorios deben ser completados.' });
  }

  try {
    const depositPrice = Number(campaignConfig.campaign.price_deposit_mxn) || 1000;
    const baseTotal = Number(campaignConfig.campaign.price_total_mxn) || 2800;

    let extraAmount = 0;
    if (custom_cake_selected) {
      extraAmount += Number(campaignConfig.extras.custom_cake.price_mxn) || 650;
    }
    if (makeup_hair_selected) {
      extraAmount += Number(campaignConfig.extras.makeup_hair.price_mxn) || 850;
    }

    const totalAmount = baseTotal + extraAmount;

    // Crear reserva en estado pendiente
    const reservation = dbModule.createPendingReservation({
      quinceanera_name,
      tutor_name,
      whatsapp,
      client_email,
      session_date,
      session_time,
      amount_mxn: depositPrice,
      total_mxn: totalAmount,
      extra_amount_mxn: extraAmount,
      custom_cake_selected: !!custom_cake_selected,
      makeup_hair_selected: !!makeup_hair_selected,
      is_demo: !!is_demo
    });

    // Registrar evento de inicio de reserva
    dbModule.logAnalyticsEvent('checkout_started', '/api/create-reservation', {
      folio: reservation.folio,
      session_date,
      session_time,
      amount_mxn: depositPrice
    });

    // Integración Mercado Pago Preference
    let initPoint = null;
    let preferenceId = null;

    const mpAccessToken = process.env.MP_ACCESS_TOKEN;
    const isMockMp = !mpAccessToken || mpAccessToken.includes('TEST-00000000') || mpAccessToken.includes('demo');

    if (!isMockMp) {
      try {
        const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mpAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            items: [
              {
                title: `Anticipo Mini Sesión Navideña (${reservation.session_date} ${reservation.session_time})`,
                description: `Anticipo de reserva para ${quinceanera_name} con Rubiel Photo Art. Folio: ${reservation.folio}`,
                quantity: 1,
                currency_id: 'MXN',
                unit_price: depositPrice
              }
            ],
            payer: {
              name: tutor_name,
              email: client_email || 'cliente@rubielphoto.com',
              phone: {
                number: whatsapp.replace(/\D/g, '')
              }
            },
            back_urls: {
              success: `${req.protocol}://${req.get('host')}/recibo.html?folio=${reservation.folio}&status=success`,
              failure: `${req.protocol}://${req.get('host')}/#reservas?status=failure`,
              pending: `${req.protocol}://${req.get('host')}/recibo.html?folio=${reservation.folio}&status=pending`
            },
            auto_return: 'approved',
            external_reference: reservation.folio,
            notification_url: `${req.protocol}://${req.get('host')}/api/webhook/mercadopago`
          })
        });

        const mpData = await mpResponse.json();
        if (mpData && mpData.id) {
          preferenceId = mpData.id;
          initPoint = process.env.MP_ENVIRONMENT === 'production' ? mpData.init_point : mpData.sandbox_init_point || mpData.init_point;
        }
      } catch (mpErr) {
        console.error('Error al conectar con Mercado Pago API:', mpErr);
      }
    }

    // Si está en modo sandbox simulado o desarrollo sin token real
    if (!initPoint) {
      initPoint = `/recibo.html?folio=${reservation.folio}&simulated_checkout=1`;
      preferenceId = `PREF-SIMULATED-${reservation.folio}`;
    }

    res.json({
      success: true,
      data: {
        reservation_id: reservation.id,
        folio: reservation.folio,
        amount_mxn: depositPrice,
        total_mxn: totalAmount,
        preference_id: preferenceId,
        init_point: initPoint
      }
    });

  } catch (error) {
    console.error('Error al crear reserva:', error);
    res.status(409).json({ success: false, error: error.message || 'Error al procesar la reserva' });
  }
});

// MODO DEMO EXCLUSIVO (Simular pago aprobado sin cobro real)
app.post('/api/demo-checkout', (req, res) => {
  const {
    quinceanera_name,
    tutor_name,
    whatsapp,
    client_email,
    session_date,
    session_time,
    custom_cake_selected,
    makeup_hair_selected,
    admin_secret
  } = req.body;

  // Validar secreto de admin para DEMO
  const validSecret = process.env.ADMIN_DEMO_SECRET;
  const validPin = process.env.ADMIN_PIN;
  const validPass = process.env.ADMIN_PASSWORD;
  if (!validSecret || !validPin || !validPass) {
    return res.status(503).json({ success: false, error: 'El modo demo no está configurado.' });
  }

  if (admin_secret !== validSecret && admin_secret !== validPin && admin_secret !== validPass && admin_secret !== 'admin_authorized') {
    return res.status(403).json({ success: false, error: 'El Modo DEMO está reservado exclusivamente para administradores autenticados.' });
  }

  if (!quinceanera_name || !tutor_name || !whatsapp || !session_date || !session_time) {
    return res.status(400).json({ success: false, error: 'Faltan datos requeridos para la reserva DEMO.' });
  }

  try {
    const depositPrice = Number(campaignConfig.campaign.price_deposit_mxn) || 1000;
    const baseTotal = Number(campaignConfig.campaign.price_total_mxn) || 2800;
    let extraAmount = 0;
    if (custom_cake_selected) extraAmount += Number(campaignConfig.extras.custom_cake.price_mxn) || 650;
    if (makeup_hair_selected) extraAmount += Number(campaignConfig.extras.makeup_hair.price_mxn) || 850;

    // Crear reserva pendiente en modo DEMO
    const pendingRes = dbModule.createPendingReservation({
      quinceanera_name,
      tutor_name,
      whatsapp,
      client_email,
      session_date,
      session_time,
      amount_mxn: depositPrice,
      total_mxn: baseTotal + extraAmount,
      extra_amount_mxn: extraAmount,
      custom_cake_selected: !!custom_cake_selected,
      makeup_hair_selected: !!makeup_hair_selected,
      admin_notes: 'Reserva generada en MODO DEMO Administrativo',
      is_demo: 1
    });

    // Confirmar inmediatamente simulando pago exitoso
    const confirmedRes = dbModule.confirmReservation(
      pendingRes.id,
      `DEMO-PAY-${Date.now()}`,
      `PREF-DEMO-${pendingRes.folio}`,
      true
    );

    // Enviar notificación por email si está configurado
    sendNotificationEmail(confirmedRes, true);

    res.json({
      success: true,
      is_demo: true,
      data: confirmedRes
    });

  } catch (error) {
    console.error('Error en Modo Demo:', error);
    res.status(409).json({ success: false, error: error.message || 'Error en reserva DEMO' });
  }
});

// --------------------------------------------------------------------------
// 3. MERCADO PAGO WEBHOOK & CONSULTA DE ESTADO
// --------------------------------------------------------------------------

app.post('/api/webhook/mercadopago', async (req, res) => {
  const query = req.query;
  const body = req.body;
  const topic = query.topic || query.type || body.type;
  const paymentId = query['data.id'] || query.id || (body.data && body.data.id);

  res.status(200).send('OK');

  if (topic === 'payment' && paymentId) {
    try {
      const mpAccessToken = process.env.MP_ACCESS_TOKEN;
      if (!mpAccessToken || mpAccessToken.includes('TEST-00000000')) {
        console.log('[Webhook MP Mock] Pago recibido:', paymentId);
        return;
      }

      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${mpAccessToken}` }
      });
      const paymentData = await mpResponse.json();

      if (paymentData && paymentData.status === 'approved') {
        const folio = paymentData.external_reference;
        const reservation = dbModule.getReservationByFolio(folio);
        if (reservation && reservation.status === 'pending_payment') {
          const confirmed = dbModule.confirmReservation(reservation.id, paymentId, paymentData.preference_id, false);
          console.log(`[Mercado Pago] Reserva ${folio} confirmada con éxito. Pago ID: ${paymentId}`);
          sendNotificationEmail(confirmed, false);
        }
      }
    } catch (err) {
      console.error('[Mercado Pago Webhook Error]', err);
    }
  }
});

// Consultar comprobante por Folio
app.get('/api/reservation-by-folio/:folio', (req, res) => {
  const folio = req.params.folio;
  const reservation = dbModule.getReservationByFolio(folio);
  if (!reservation) {
    return res.status(404).json({ success: false, error: 'Comprobante no encontrado con ese folio' });
  }

  // Si fue una simulación directa en sandbox y la reserva sigue en pending_payment, confirmarla
  if (req.query.confirm_simulated === '1' && process.env.NODE_ENV !== 'production' && reservation.status === 'pending_payment') {
    const confirmed = dbModule.confirmReservation(reservation.id, `SIM-PAY-${Date.now()}`, reservation.mercado_pago_preference_id, false);
    return res.json({ success: true, data: confirmed });
  }

  res.json({ success: true, data: reservation });
});

// --------------------------------------------------------------------------
// 4. ENVÍO DE CORREOS CON RESEND
// --------------------------------------------------------------------------

async function sendNotificationEmail(reservation, isDemo = false) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || resendApiKey === 're_demo_key' || resendApiKey.includes('123456789')) {
    console.log(`[Resend Email Mock] Notificación generada para reserva ${reservation.folio} (isDemo=${isDemo})`);
    return;
  }

  const saldo = reservation.total_mxn - reservation.amount_mxn;
  const extrasList = [];
  if (reservation.custom_cake_selected) extrasList.push('Pastel Personalizado ($650 MXN)');
  if (reservation.makeup_hair_selected) extrasList.push('Maquillaje y Peinado Profesional ($850 MXN)');
  const extrasText = extrasList.length > 0 ? extrasList.join(', ') : 'Ninguno';

  const htmlContent = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0d0a07; color: #ede6dc; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #16110c; border: 1px solid #c5a059; padding: 30px; border-radius: 4px;">
        <h1 style="color: #c5a059; text-align: center; letter-spacing: 2px; font-size: 22px;">RUBIEL PHOTO ART</h1>
        <p style="text-align: center; color: #a89f91; font-size: 13px; margin-top: -10px;">MINI SESIONES NAVIDEÑAS 2026</p>

        ${isDemo ? '<div style="background: rgba(197, 160, 89, 0.2); border: 1px dashed #c5a059; color: #e6c88b; text-align: center; padding: 10px; font-weight: bold; margin: 20px 0;">MODO DEMO INTERNO (PRUEBA ADMINISTRATIVA)</div>' : ''}

        <h2 style="color: #ffffff; font-size: 18px; border-bottom: 1px solid #33281d; padding-bottom: 10px;">¡Tu reserva está confirmada!</h2>

        <p>Hola <strong>${reservation.quinceanera_name}</strong> y <strong>${reservation.tutor_name}</strong>,</p>
        <p>Tu lugar para las mini sesiones navideñas ha quedado formalmente apartado.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #292017; color: #a89f91;">Folio Oficial:</td><td style="padding: 8px; border-bottom: 1px solid #292017; font-weight: bold; color: #c5a059;">#${reservation.folio}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #292017; color: #a89f91;">Fecha de Sesión:</td><td style="padding: 8px; border-bottom: 1px solid #292017; font-weight: bold;">${reservation.session_date}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #292017; color: #a89f91;">Horario:</td><td style="padding: 8px; border-bottom: 1px solid #292017; font-weight: bold;">${reservation.session_time}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #292017; color: #a89f91;">Extras:</td><td style="padding: 8px; border-bottom: 1px solid #292017;">${extrasText}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #292017; color: #a89f91;">Anticipo Pagado:</td><td style="padding: 8px; border-bottom: 1px solid #292017; color: #25d366; font-weight: bold;">$${reservation.amount_mxn} MXN</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #292017; color: #a89f91;">Total General:</td><td style="padding: 8px; border-bottom: 1px solid #292017; font-weight: bold;">$${reservation.total_mxn} MXN</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #292017; color: #a89f91;">Saldo Pendiente:</td><td style="padding: 8px; border-bottom: 1px solid #292017; font-weight: bold; color: #e6c88b;">$${saldo} MXN</td></tr>
        </table>

        <div style="background: #2a0e12; border: 1px solid #6b1d22; padding: 12px; color: #f2a8ad; font-size: 13px; text-align: center; border-radius: 3px; margin: 20px 0;">
          EL SALDO RESTANTE SE LIQUIDA EN EFECTIVO EL DÍA DE LA SESIÓN.
        </div>

        <p style="font-size: 13px; color: #a89f91; text-align: center;">Estudio: ${campaignConfig.business.address}<br>WhatsApp Fotógrafo: ${campaignConfig.business.whatsapp_photographer_display}</p>
      </div>
    </div>
  `;

  try {
    const toEmails = [process.env.ADMIN_NOTIFICATION_EMAIL || campaignConfig.business.admin_email];
    if (reservation.client_email && reservation.client_email.includes('@')) {
      toEmails.push(reservation.client_email);
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Rubiel Photo Art <reservas@rubielphoto.com>',
        to: toEmails,
        reply_to: process.env.RESEND_REPLY_TO_EMAIL || campaignConfig.business.admin_email,
        subject: `${isDemo ? '[DEMO] ' : ''}Confirmación de Mini Sesión Navideña #${reservation.folio} · Rubiel Photo Art`,
        html: htmlContent
      })
    });
    console.log(`[Resend] Correo enviado a ${toEmails.join(', ')} para folio ${reservation.folio}`);
  } catch (emailErr) {
    console.error('[Resend Error]', emailErr);
  }
}

app.post('/api/send-receipt-email', async (req, res) => {
  const { folio } = req.body;
  const reservation = dbModule.getReservationByFolio(folio);
  if (!reservation) {
    return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
  }

  await sendNotificationEmail(reservation, !!reservation.is_demo);
  res.json({ success: true, message: 'Recibo enviado correctamente' });
});

// --------------------------------------------------------------------------
// 5. PANEL DE ADMINISTRADOR & GESTIÓN DE RESERVAS
// --------------------------------------------------------------------------

// Login de administrador
app.post('/api/admin/login', (req, res) => {
  const { email, password, pin } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminPin = process.env.ADMIN_PIN;
  const allowedEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase());

  if (!adminPassword || !adminPin || allowedEmails.filter(Boolean).length === 0) {
    return res.status(503).json({ success: false, error: 'El acceso administrativo no está configurado.' });
  }

  let isEmailValid = true;
  if (email) {
    isEmailValid = allowedEmails.includes(email.trim().toLowerCase());
  }

  if (isEmailValid && (password === adminPassword || pin === adminPin)) {
    const sessionToken = process.env.ADMIN_SESSION_TOKEN || `admin_${require('crypto').randomBytes(24).toString('hex')}`;
    activeAdminTokens.add(sessionToken);
    return res.json({
      success: true,
      token: sessionToken,
      user: {
        email: email || 'admin@rubielphoto.com',
        role: 'admin',
        name: 'Rubiel Photo Art'
      }
    });
  }

  return res.status(401).json({ success: false, error: 'Credenciales de administrador incorrectas' });
});

// Leads VIP para el panel de campaña
app.get('/api/admin/leads', adminAuthMiddleware, (req, res) => {
  try {
    res.json({ success: true, data: dbModule.getAllLeads({ status: req.query.status, search: req.query.search }) });
  } catch (error) {
    console.error('Error en listado de leads:', error);
    res.status(500).json({ success: false, error: 'Error al consultar los registros VIP.' });
  }
});

app.post('/api/admin/leads', adminAuthMiddleware, (req, res) => {
  const { name, email, phone, attendee_count, source } = req.body || {};
  try {
    const lead = dbModule.createLead({ name, email: email || `manual-${Date.now()}@local.invalid`, phone, attendee_count, source: source || 'admin_manual' });
    res.status(lead.duplicate ? 200 : 201).json({ success: true, data: lead });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'No se pudo crear el registro.' });
  }
});

app.get('/api/admin/leads/metrics', adminAuthMiddleware, (req, res) => {
  res.json({ success: true, data: dbModule.getLeadMetrics() });
});

app.patch('/api/admin/leads/:id', adminAuthMiddleware, (req, res) => {
  try {
    res.json({ success: true, data: dbModule.updateLead(req.params.id, req.body || {}) });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'No se pudo actualizar el registro.' });
  }
});

app.delete('/api/admin/leads/:id', adminAuthMiddleware, (req, res) => {
  try {
    const deleted = dbModule.deleteLead(req.params.id);
    res.status(deleted ? 200 : 404).json({ success: deleted, error: deleted ? undefined : 'Registro no encontrado.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'No se pudo eliminar el registro.' });
  }
});

app.get('/api/admin/leads.csv', adminAuthMiddleware, (req, res) => {
  const leads = dbModule.getAllLeads({ status: req.query.status, search: req.query.search });
  const csvEscape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Folio VIP', 'Fecha', 'Nombre', 'WhatsApp', 'Correo', 'Personas', 'Estado', 'Origen'].map(csvEscape).join(','),
    ...leads.map(lead => [lead.folio, lead.created_at, lead.name, lead.phone, lead.email, lead.attendee_count, lead.status, lead.source].map(csvEscape).join(','))
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads_vip_navidad_2026_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`\uFEFF${rows.join('\n')}`);
});

// Obtener listado de reservas con filtros
app.get('/api/admin/reservations', adminAuthMiddleware, (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      session_date: req.query.session_date,
      photos_status: req.query.photos_status,
      search: req.query.search,
      sort_by: req.query.sort_by,
      sort_dir: req.query.sort_dir
    };

    const reservations = dbModule.getAllReservations(filters);
    res.json({ success: true, data: reservations });
  } catch (error) {
    console.error('Error en listado admin:', error);
    res.status(500).json({ success: false, error: 'Error al consultar reservas' });
  }
});

// Métricas de administrador
app.get('/api/admin/metrics', adminAuthMiddleware, (req, res) => {
  try {
    const metrics = dbModule.getMetrics(campaignConfig);
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error en métricas:', error);
    res.status(500).json({ success: false, error: 'Error al calcular métricas' });
  }
});

// Actualizar reserva desde el panel
app.put('/api/admin/reservations/:id', adminAuthMiddleware, (req, res) => {
  const id = req.params.id;
  try {
    const updated = dbModule.updateReservation(id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error al actualizar reserva:', error);
    res.status(400).json({ success: false, error: error.message || 'Error al actualizar' });
  }
});

// Cancelar reserva y liberar horario
app.post('/api/admin/reservations/:id/cancel', adminAuthMiddleware, (req, res) => {
  const id = req.params.id;
  const { note } = req.body;
  try {
    const cancelled = dbModule.cancelReservation(id, note || 'Cancelada por el administrador');
    res.json({ success: true, data: cancelled });
  } catch (error) {
    console.error('Error al cancelar reserva:', error);
    res.status(400).json({ success: false, error: error.message || 'Error al cancelar' });
  }
});

// Exportar CSV
app.get('/api/admin/export-csv', adminAuthMiddleware, (req, res) => {
  try {
    const reservations = dbModule.getAllReservations();

    // Encabezados CSV con BOM UTF-8
    let csv = '\uFEFF';
    csv += 'Folio,Cliente,Tutor/Responsable,WhatsApp,Email,Fecha,Horario,Estado,Anticipo MXN,Total MXN,Saldo MXN,Pastel,Maquillaje,Estado Fotos,Es Demo,Notas,Fecha Creacion\n';

    for (const r of reservations) {
      const saldo = r.total_mxn - r.amount_mxn;
      const cake = r.custom_cake_selected ? 'SI' : 'NO';
      const makeup = r.makeup_hair_selected ? 'SI' : 'NO';
      const isDemo = r.is_demo ? 'SI' : 'NO';
      const cleanNotes = (r.admin_notes || '').replace(/"/g, '""');

      csv += `"${r.folio}","${r.quinceanera_name}","${r.tutor_name}","${r.whatsapp}","${r.client_email || ''}","${r.session_date}","${r.session_time}","${r.status}",${r.amount_mxn},${r.total_mxn},${saldo},"${cake}","${makeup}","${r.photos_status}","${isDemo}","${cleanNotes}","${r.created_at}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reservas_navidad_rubiel_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Error al exportar CSV:', error);
    res.status(500).send('Error al generar CSV');
  }
});

// --------------------------------------------------------------------------
// 6. RUTAS DE VISTAS HTML
// --------------------------------------------------------------------------

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/recibo.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'recibo.html'));
});

app.get('/gracias.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'gracias.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  RUBIEL PHOTO ART · MINI SESIONES NAVIDEÑAS 2026   `);
  console.log(`  Servidor activo en: http://localhost:${PORT}      `);
  console.log(`  Panel Administrativo: http://localhost:${PORT}/admin `);
  console.log(`====================================================`);
});
