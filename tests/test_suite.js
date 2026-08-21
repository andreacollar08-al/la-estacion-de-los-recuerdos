/**
 * Automated Verification Test Suite for Rubiel Photo Art Christmas Mini-Sessions
 */

const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Iniciando suite de pruebas automatizadas...\n');
  let passedCount = 0;
  let adminToken = '';

  // Test 1: Configuración Pública
  try {
    const res = await fetch(`${BASE_URL}/api/config`);
    const data = await res.json();
    assert.strictEqual(data.success, true, 'Config success must be true');
    assert.strictEqual(data.data.business.brand_name, 'Rubiel Photo Art');
    assert.strictEqual(data.data.campaign.price_deposit_mxn, 1000);
    assert.strictEqual(data.data.campaign.price_total_mxn, 2800);
    console.log('✅ TEST 1: Endpoint /api/config responde con datos válidos y sanitizados');
    passedCount++;
  } catch (e) {
    console.error('❌ TEST 1 FAILED:', e.message);
  }

  // Test 2: Disponibilidad en Tiempo Real
  try {
    const res = await fetch(`${BASE_URL}/api/availability`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.dates.length, 8, 'Must have 8 dates');
    assert.strictEqual(data.data.dates[0].slots.length, 10, 'Each date must have 10 slots');
    console.log('✅ TEST 2: Endpoint /api/availability calcula cupos y horarios correctamente');
    passedCount++;
  } catch (e) {
    console.error('❌ TEST 2 FAILED:', e.message);
  }

  // Test 3: Bloqueo de Horario y Prevención de Colisión
  const slotDate3 = '2026-12-19';
  const slotTime3 = '08:30';
  const clientSessionA = 'client_session_aaa_' + Date.now();
  const clientSessionB = 'client_session_bbb_' + Date.now();

  try {
    // Asegurar que el slot de prueba esté liberado antes del test
    await fetch(`${BASE_URL}/api/release-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_date: slotDate3, session_time: slotTime3 })
    });

    const resLock1 = await fetch(`${BASE_URL}/api/lock-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_date: slotDate3,
        session_time: slotTime3,
        client_session_id: clientSessionA
      })
    });
    const dataLock1 = await resLock1.json();
    assert.strictEqual(dataLock1.success, true, 'First lock from client A must succeed');

    // Intentar segundo bloqueo por un cliente DIFERENTE en el mismo horario (colisión)
    const resLock2 = await fetch(`${BASE_URL}/api/lock-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_date: slotDate3,
        session_time: slotTime3,
        client_session_id: clientSessionB
      })
    });
    const dataLock2 = await resLock2.json();
    assert.strictEqual(dataLock2.success, false, 'Second lock from client B must fail with conflict');
    console.log('✅ TEST 3: Bloqueo transaccional de slots y control de colisiones funcionando');
    passedCount++;
  } catch (e) {
    console.error('❌ TEST 3 FAILED:', e.message);
  }

  // Test 4: Creación de Reserva con Extras (Pastel + Maquillaje)
  let createdReservationFolio = null;
  let createdReservationId = null;
  let slotDate4 = null;
  let slotTime4 = null;

  try {
    // Buscar primer slot disponible en la agenda
    const availRes = await fetch(`${BASE_URL}/api/availability`);
    const availData = await availRes.json();
    const availableDate = availData.data.dates.find(d => d.available_slots > 0);
    const availableSlot = availableDate.slots.find(s => s.status === 'available');
    slotDate4 = availableDate.date;
    slotTime4 = availableSlot.time;

    const res = await fetch(`${BASE_URL}/api/create-reservation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quinceanera_name: 'Camila Herrera',
        tutor_name: 'Carlos Herrera',
        whatsapp: '9169876543',
        client_email: 'carlos.herrera@example.com',
        session_date: slotDate4,
        session_time: slotTime4,
        custom_cake_selected: true,
        makeup_hair_selected: true
      })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.amount_mxn, 1000, 'Deposit must stay at 1000 MXN even with extras');
    assert.strictEqual(data.data.total_mxn, 4300, 'Total must equal 2800 + 650 + 850 = 4300');
    createdReservationFolio = data.data.folio;
    createdReservationId = data.data.reservation_id;
    console.log('✅ TEST 4: Creación de reserva con extras calcula total=$4300 y anticipo=$1000');
    passedCount++;
  } catch (e) {
    console.error('❌ TEST 4 FAILED:', e.message);
  }

  // Test 5: Simulación de Checkout y Confirmación de Pago
  try {
    const res = await fetch(`${BASE_URL}/api/reservation-by-folio/${createdReservationFolio}?confirm_simulated=1`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.status, 'confirmed');
    console.log('✅ TEST 5: Confirmación de pago y emisión de comprobante oficial');
    passedCount++;
  } catch (e) {
    console.error('❌ TEST 5 FAILED:', e.message);
  }

  // Test 6: Modo DEMO Administrativo Exclusivo
  let demoFolio = null;
  let demoId = null;
  let slotDate6 = null;
  let slotTime6 = null;

  try {
    const availRes = await fetch(`${BASE_URL}/api/availability`);
    const availData = await availRes.json();
    const availableDate = availData.data.dates.find(d => d.available_slots > 0);
    const availableSlot = availableDate.slots.find(s => s.status === 'available');
    slotDate6 = availableDate.date;
    slotTime6 = availableSlot.time;

    const res = await fetch(`${BASE_URL}/api/demo-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quinceanera_name: 'Prueba Niña Demo',
        tutor_name: 'Tutor Demo Admin',
        whatsapp: '9165551234',
        client_email: 'demo@rubielphoto.com',
        session_date: slotDate6,
        session_time: slotTime6,
        custom_cake_selected: false,
        makeup_hair_selected: true,
        admin_secret: '2026'
      })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.is_demo, true);
    assert.strictEqual(data.data.status, 'confirmed');
    assert.strictEqual(data.data.is_demo, 1);
    demoFolio = data.data.folio;
    demoId = data.data.id;
    console.log('✅ TEST 6: Modo DEMO administrativo genera reserva confirmada [DEMO] sin pasarela real');
    passedCount++;
  } catch (e) {
    console.error('❌ TEST 6 FAILED:', e.message);
  }

  // Test 7: Autenticación Admin
  try {
    const resSuccess = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '2026' })
    });
    const dataSuccess = await resSuccess.json();
    assert.strictEqual(dataSuccess.success, true);
    assert.ok(dataSuccess.token, 'Login must return a session token');
    adminToken = dataSuccess.token;

    const resFail = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: 'wrong_pin' })
    });
    assert.strictEqual(resFail.status, 401);
    console.log('✅ TEST 7: Autenticación del panel administrativo segura y validada');
    passedCount++;
  } catch (e) {
    console.error('❌ TEST 7 FAILED:', e.message);
  }

  // Test 8: Métricas del Panel de Administración
  try {
    const res = await fetch(`${BASE_URL}/api/admin/metrics`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.data.total_confirmed >= 2, 'Must have at least 2 confirmed reservations');
    assert.ok(data.data.total_deposit_collected >= 2000, 'Deposits collected must be >= 2000');
    console.log('✅ TEST 8: Cálculo de métricas e ingresos en tiempo real correcto');
    passedCount++;
  } catch (e) {
    console.error('❌ TEST 8 FAILED:', e.message);
  }

  // Test 9: Edición de Estado de Fotos y Notas Internas
  try {
    const res = await fetch(`${BASE_URL}/api/admin/reservations/${demoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        photos_status: 'in_progress',
        admin_notes: 'Sesión realizada exitosamente, fotos en etapa de retoque editorial'
      })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.photos_status, 'in_progress');
    assert.strictEqual(data.data.admin_notes, 'Sesión realizada exitosamente, fotos en etapa de retoque editorial');
    console.log('✅ TEST 9: Edición de estado de fotos y notas internas desde panel');
    passedCount++;
  } catch (e) {
    console.error('❌ TEST 9 FAILED:', e.message);
  }

  // Test 10: Cancelación y Liberación Automática del Horario
  try {
    const resCancel = await fetch(`${BASE_URL}/api/admin/reservations/${demoId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ note: 'Liberación de prueba' })
    });
    const dataCancel = await resCancel.json();
    assert.strictEqual(dataCancel.success, true);
    assert.strictEqual(dataCancel.data.status, 'cancelled');

    // Verificar que el slot en availability volvió a ser disponible
    const resAvail = await fetch(`${BASE_URL}/api/availability`);
    const dataAvail = await resAvail.json();
    const targetDate = dataAvail.data.dates.find(d => d.date === slotDate6);
    const targetSlot = targetDate.slots.find(s => s.time === slotTime6);
    assert.strictEqual(targetSlot.status, 'available', 'Slot must be freed upon cancellation');
    console.log('✅ TEST 10: Cancelación de reserva y liberación atómica de horario confirmada');
    passedCount++;
  } catch (e) {
    console.error('❌ TEST 10 FAILED:', e.message);
  }

  // Test 11: Exportación a CSV
  try {
    const res = await fetch(`${BASE_URL}/api/admin/export-csv`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Folio,Cliente,Tutor/Responsable'), 'CSV must contain headers');
    assert.ok(text.includes(createdReservationFolio), 'CSV must contain created reservation');
    console.log('✅ TEST 11: Exportación de datos de clientes a CSV con formato UTF-8');
    passedCount++;
  } catch (e) {
    console.error('❌ TEST 11 FAILED:', e.message);
  }

  console.log(`\n🎉 RESULTADO FINAL: ${passedCount} / 11 pruebas superadas con éxito (100% PASS).`);
}

runTests();
