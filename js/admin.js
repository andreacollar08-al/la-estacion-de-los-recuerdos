/**
 * Panel de registros VIP · Navidad 2026
 * Consume la base de datos del servidor; no guarda leads en localStorage.
 */
document.addEventListener('DOMContentLoaded', () => {
  const loginScreen = document.getElementById('login-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  const loginForm = document.getElementById('login-form');
  const pinInput = document.getElementById('admin-pin');
  const btnLogout = document.getElementById('btn-logout');
  const leadsTbody = document.getElementById('leads-tbody');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const filterStatus = document.getElementById('filter-status');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const kpiTotal = document.getElementById('kpi-total');
  const kpiPending = document.getElementById('kpi-pending');
  const kpiContacted = document.getElementById('kpi-contacted');
  const kpiConfirmed = document.getElementById('kpi-confirmed');
  const displayedCount = document.getElementById('displayed-count');
  const totalCount = document.getElementById('total-count');
  const manualModal = document.getElementById('manual-modal');
  const btnOpenManual = document.getElementById('btn-open-manual-modal');
  const btnCloseManual = document.getElementById('btn-close-manual-modal');
  const manualLeadForm = document.getElementById('manual-lead-form');
  let leads = [];

  const token = () => sessionStorage.getItem('rubiel_admin_token') || '';
  async function api(path, options = {}) {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token()}`, ...(options.headers || {}) };
    const response = await fetch(path, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'No se pudo completar la operación.');
    return payload;
  }

  function showLogin() {
    loginScreen.style.display = 'flex';
    dashboardScreen.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'none';
  }

  function showDashboard() {
    loginScreen.style.display = 'none';
    dashboardScreen.style.display = 'block';
    if (btnLogout) btnLogout.style.display = 'block';
    loadDashboard();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      const pin = pinInput.value.trim();
      try {
        const result = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        const payload = await result.json();
        if (!result.ok || !payload.success) throw new Error(payload.error || 'PIN incorrecto.');
        sessionStorage.setItem('rubiel_admin_token', payload.token);
        showDashboard();
      } catch (error) {
        alert(error.message);
        pinInput.value = '';
        pinInput.focus();
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem('rubiel_admin_token');
      showLogin();
    });
  }

  async function loadDashboard() {
    try {
      const [leadResult, metricResult] = await Promise.all([api('/api/admin/leads'), api('/api/admin/leads/metrics')]);
      leads = leadResult.data || [];
      const metrics = metricResult.data || {};
      if (kpiTotal) kpiTotal.textContent = metrics.total || 0;
      if (kpiPending) kpiPending.textContent = metrics.pending || 0;
      if (kpiContacted) kpiContacted.textContent = metrics.contacted || 0;
      if (kpiConfirmed) kpiConfirmed.textContent = metrics.confirmed || 0;
      if (totalCount) totalCount.textContent = metrics.total || 0;
      renderTable();
    } catch (error) {
      alert(error.message);
      sessionStorage.removeItem('rubiel_admin_token');
      showLogin();
    }
  }

  function renderTable() {
    const search = (searchInput?.value || '').toLowerCase().trim();
    const status = filterStatus?.value || 'ALL';
    const filtered = leads.filter(lead => {
      const haystack = [lead.name, lead.phone, lead.email, lead.folio, lead.attendee_count].join(' ').toLowerCase();
      return (!search || haystack.includes(search)) && (status === 'ALL' || lead.status === status);
    });
    if (displayedCount) displayedCount.textContent = filtered.length;
    if (!leadsTbody || !emptyState) return;
    emptyState.style.display = filtered.length ? 'none' : 'block';
    leadsTbody.innerHTML = filtered.map(lead => {
      const date = new Date(lead.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
      const phone = String(lead.phone || '').replace(/\D/g, '');
      const waLink = `https://wa.me/${phone.startsWith('52') ? phone : '52' + phone}?text=${encodeURIComponent(`Hola ${lead.name}, te escribo de Rubiel Photo Art sobre tu boleto prioritario #${lead.folio}.`)}`;
      return `<tr data-id="${lead.id}">
        <td class="folio-badge-cell">#${escapeHtml(lead.folio)}</td>
        <td style="color:#a89f91;font-size:.78rem">${escapeHtml(date)}</td>
        <td class="client-name-cell">${escapeHtml(lead.name)}</td>
        <td><a href="${waLink}" target="_blank" rel="noopener noreferrer" class="wa-chat-btn"><span>${escapeHtml(lead.phone)}</span></a></td>
        <td style="font-size:.8rem;color:#a89f91">${escapeHtml(lead.email)}</td>
        <td style="font-size:.8rem">${escapeHtml(lead.attendee_count)}</td>
        <td><select class="status-select ${escapeHtml(lead.status)}" data-id="${lead.id}">
          <option value="Pendiente" ${lead.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="Contactado" ${lead.status === 'Contactado' ? 'selected' : ''}>Contactado</option>
          <option value="Apartado" ${lead.status === 'Apartado' ? 'selected' : ''}>Apartado</option>
        </select></td>
        <td><button class="btn-delete-row" data-delete-id="${lead.id}" type="button" title="Eliminar registro">×</button></td>
      </tr>`;
    }).join('');

    leadsTbody.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', async event => {
        try {
          const updated = await api(`/api/admin/leads/${event.target.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: event.target.value }) });
          const index = leads.findIndex(lead => String(lead.id) === String(updated.data.id));
          if (index >= 0) leads[index] = updated.data;
          renderTable();
        } catch (error) { alert(error.message); await loadDashboard(); }
      });
    });

    leadsTbody.querySelectorAll('[data-delete-id]').forEach(button => {
      button.addEventListener('click', async () => {
        const lead = leads.find(item => String(item.id) === String(button.dataset.deleteId));
        if (!lead || !confirm(`¿Eliminar el registro de "${lead.name}"?`)) return;
        try {
          await api(`/api/admin/leads/${lead.id}`, { method: 'DELETE' });
          await loadDashboard();
        } catch (error) { alert(error.message); }
      });
    });
  }

  searchInput?.addEventListener('input', renderTable);
  filterStatus?.addEventListener('change', renderTable);

  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/admin/leads.csv', { headers: { Authorization: `Bearer ${token()}` } });
        if (!response.ok) throw new Error('No se pudo exportar el CSV.');
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `leads_vip_navidad_2026_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      } catch (error) { alert(error.message); }
    });
  }

  btnOpenManual?.addEventListener('click', () => { manualModal.classList.add('is-open'); });
  btnCloseManual?.addEventListener('click', () => { manualModal.classList.remove('is-open'); });
  manualLeadForm?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const result = await api('/api/admin/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: document.getElementById('manual-name').value.trim(),
          phone: document.getElementById('manual-phone').value.trim(),
          email: document.getElementById('manual-email').value.trim() || `manual-${Date.now()}@local.invalid`,
          attendee_count: document.getElementById('manual-count').value
        })
      });
      manualLeadForm.reset();
      manualModal.classList.remove('is-open');
      await loadDashboard();
      alert(`Registro guardado con folio #${result.data.folio}.`);
    } catch (error) { alert(error.message); }
  });

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  if (token()) showDashboard(); else showLogin();
});
