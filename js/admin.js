/**
 * RUBIEL PHOTO ART - PANEL DE ADMINISTRADOR (NAVIDAD 2026)
 * Gestión en tiempo real de registros, cambio de estado, exportación a Excel y enlaces directos de WhatsApp
 */

document.addEventListener('DOMContentLoaded', () => {
  const CORRECT_PIN = '2026';
  const STORAGE_KEY = 'rubiel_leads_2026';

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

  // Modal Manual
  const manualModal = document.getElementById('manual-modal');
  const btnOpenManual = document.getElementById('btn-open-manual-modal');
  const btnCloseManual = document.getElementById('btn-close-manual-modal');
  const manualLeadForm = document.getElementById('manual-lead-form');

  let leads = [];

  // 1. GESTIÓN DE SESIÓN Y LOGIN
  function checkAuth() {
    const isAuth = sessionStorage.getItem('rubiel_admin_auth') === 'true';
    if (isAuth) {
      showDashboard();
    } else {
      showLogin();
    }
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
    loadLeads();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredPin = pinInput.value.trim();
      if (enteredPin === CORRECT_PIN || enteredPin === 'rubiel2026') {
        sessionStorage.setItem('rubiel_admin_auth', 'true');
        showDashboard();
      } else {
        alert('PIN incorrecto. Por favor verifica e intenta de nuevo.');
        pinInput.value = '';
        pinInput.focus();
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem('rubiel_admin_auth');
      showLogin();
    });
  }

  // 2. CARGA Y PROCESAMIENTO DE LEADS
  function loadLeads() {
    try {
      leads = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      // Asegurar que cada lead tenga ID y estado
      leads = leads.map(l => ({
        id: l.id || 'lead_' + Math.random().toString(36).substr(2, 9),
        name: l.name || 'Sin nombre',
        email: l.email || '—',
        phone: l.phone || '',
        count: l.count || 'Familia',
        folioCode: l.folioCode || 'VIP-2026-0000',
        date: l.date || new Date().toISOString(),
        status: l.status || 'Pendiente'
      }));
    } catch (e) {
      console.error('Error cargando leads', e);
      leads = [];
    }

    renderTable();
    updateKPIs();
  }

  function saveLeads() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    } catch (e) {
      console.error('Error guardando leads', e);
    }
  }

  // 3. ACTUALIZAR KPIs
  function updateKPIs() {
    const total = leads.length;
    const pending = leads.filter(l => l.status === 'Pendiente').length;
    const contacted = leads.filter(l => l.status === 'Contactado').length;
    const confirmed = leads.filter(l => l.status === 'Apartado').length;

    if (kpiTotal) kpiTotal.textContent = total;
    if (kpiPending) kpiPending.textContent = pending;
    if (kpiContacted) kpiContacted.textContent = contacted;
    if (kpiConfirmed) kpiConfirmed.textContent = confirmed;
    if (totalCount) totalCount.textContent = total;
  }

  // 4. RENDERIZAR TABLA DE CLIENTES
  function renderTable() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const statusFilter = filterStatus ? filterStatus.value : 'ALL';

    const filtered = leads.filter(l => {
      const matchSearch = 
        l.name.toLowerCase().includes(searchTerm) ||
        l.phone.toLowerCase().includes(searchTerm) ||
        l.email.toLowerCase().includes(searchTerm) ||
        l.folioCode.toLowerCase().includes(searchTerm);

      const matchStatus = statusFilter === 'ALL' || l.status === statusFilter;

      return matchSearch && matchStatus;
    });

    if (displayedCount) displayedCount.textContent = filtered.length;

    if (filtered.length === 0) {
      leadsTbody.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    // Ordenar del más reciente al más antiguo
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    leadsTbody.innerHTML = filtered.map(lead => {
      const dateObj = new Date(lead.date);
      const formattedDate = dateObj.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });

      const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
      const waLink = `https://wa.me/52${cleanPhone}?text=${encodeURIComponent(`¡Hola ${lead.name}! Te saluda Rubiel Photo Art. Nos comunicamos contigo con respecto a tu registro prioritario para las Sesiones Navideñas 2026 (Folio #${lead.folioCode}).`)}`;

      return `
        <tr data-id="${lead.id}">
          <td class="folio-badge-cell">#${escapeHtml(lead.folioCode)}</td>
          <td style="color: #a89f91; font-size: 0.78rem;">${formattedDate}</td>
          <td class="client-name-cell">${escapeHtml(lead.name)}</td>
          <td>
            ${lead.phone ? `
              <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="wa-chat-btn" title="Abrir chat en WhatsApp">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
                <span>${escapeHtml(lead.phone)}</span>
              </a>
            ` : '—'}
          </td>
          <td style="font-size: 0.8rem; color: #a89f91;">${escapeHtml(lead.email)}</td>
          <td style="font-size: 0.8rem;">${escapeHtml(lead.count)}</td>
          <td>
            <select class="status-select ${lead.status}" data-id="${lead.id}">
              <option value="Pendiente" ${lead.status === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
              <option value="Contactado" ${lead.status === 'Contactado' ? 'selected' : ''}>💬 Contactado</option>
              <option value="Apartado" ${lead.status === 'Apartado' ? 'selected' : ''}>✅ Apartado</option>
            </select>
          </td>
          <td>
            <button class="btn-delete-row" data-delete-id="${lead.id}" title="Eliminar registro">✕</button>
          </td>
        </tr>
      `;
    }).join('');

    // Eventos para cambiar estado en vivo
    document.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const newStatus = e.target.value;
        const targetLead = leads.find(l => l.id === id);
        if (targetLead) {
          targetLead.status = newStatus;
          saveLeads();
          updateKPIs();
          e.target.className = `status-select ${newStatus}`;
        }
      });
    });

    // Eventos para eliminar fila
    document.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-delete-id');
        const targetLead = leads.find(l => l.id === id);
        if (targetLead && confirm(`¿Estás seguro de eliminar el registro de "${targetLead.name}"?`)) {
          leads = leads.filter(l => l.id !== id);
          saveLeads();
          renderTable();
          updateKPIs();
        }
      });
    });
  }

  // 5. FILTROS Y BÚSQUEDA
  if (searchInput) searchInput.addEventListener('input', renderTable);
  if (filterStatus) filterStatus.addEventListener('change', renderTable);

  // 6. EXPORTAR A EXCEL (.CSV)
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      if (leads.length === 0) {
        alert('No hay registros disponibles para exportar.');
        return;
      }

      let csvContent = '\uFEFF'; // BOM para que Excel reconozca tildes y caracteres en español
      csvContent += 'Folio VIP,Fecha,Nombre,WhatsApp,Correo,Tipo de Familia,Estado\n';

      leads.forEach(l => {
        const dateStr = new Date(l.date).toLocaleString('es-MX');
        const row = [
          `"${l.folioCode}"`,
          `"${dateStr}"`,
          `"${l.name.replace(/"/g, '""')}"`,
          `"${l.phone}"`,
          `"${l.email}"`,
          `"${l.count}"`,
          `"${l.status}"`
        ];
        csvContent += row.join(',') + '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      link.setAttribute('href', url);
      link.setAttribute('download', `clientes_navidad_2026_rubiel_photo_art_${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // 7. REGISTRO MANUAL
  if (btnOpenManual) {
    btnOpenManual.addEventListener('click', () => {
      if (manualModal) manualModal.classList.add('is-open');
    });
  }

  if (btnCloseManual) {
    btnCloseManual.addEventListener('click', () => {
      if (manualModal) manualModal.classList.remove('is-open');
    });
  }

  if (manualLeadForm) {
    manualLeadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('manual-name').value.trim();
      const phone = document.getElementById('manual-phone').value.trim();
      const email = document.getElementById('manual-email').value.trim() || '—';
      const count = document.getElementById('manual-count').value;

      if (!name || !phone) {
        alert('Por favor ingresa al menos el nombre y el número de teléfono.');
        return;
      }

      const randomFolio = Math.floor(1000 + Math.random() * 9000);
      const newLead = {
        id: 'lead_' + Date.now(),
        name,
        email,
        phone,
        count,
        folioCode: `VIP-2026-${randomFolio}`,
        date: new Date().toISOString(),
        status: 'Pendiente'
      };

      leads.unshift(newLead);
      saveLeads();
      renderTable();
      updateKPIs();

      manualLeadForm.reset();
      if (manualModal) manualModal.classList.remove('is-open');
      alert(`¡Cliente "${name}" guardado exitosamente con Folio #${newLead.folioCode}!`);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
      t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t)
    );
  }

  // Inicializar
  checkAuth();
});
