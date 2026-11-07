/* ===========================================
   Sistema de Gestión Escolar - Aplicación JS Mejorada
   Prof. Facundo Casciano — tuprofeweb
   Vanilla JavaScript — Alto Rendimiento
   =========================================== */

// =============================================
// ESTADO GLOBAL DE LA APLICACIÓN
// =============================================
const App = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  colegios: [],
  cursos: [],
  selectedColegio: null,
  darkMode: localStorage.getItem('darkMode') === 'true',
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  calendarEvents: [],
  notificationCount: 2,
  syncStatus: 'saved',
};

// =============================================
// UTILIDAD: PETICIONES HTTP CON JWT
// =============================================
async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (App.token) {
    headers['Authorization'] = `Bearer ${App.token}`;
  }
  try {
    showSpinner();
    const resp = await fetch(url, { ...options, headers });
    hideSpinner();

    if (resp.status === 401) {
      logout();
      throw new Error('Sesión expirada. Por favor, ingrese nuevamente.');
    }
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || data.mensaje || `Error del servidor (${resp.status})`);
    }
    if (resp.status === 204) return null;
    return await resp.json();
  } catch (err) {
    hideSpinner();
    throw err;
  }
}

// =============================================
// SPINNER Y TOASTS
// =============================================
let spinnerCount = 0;
function showSpinner() {
  spinnerCount++;
  let overlay = document.getElementById('spinner-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'spinner-overlay';
    overlay.className = 'spinner-overlay';
    overlay.innerHTML = '<div class="spinner-circle"></div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

function hideSpinner() {
  spinnerCount = Math.max(0, spinnerCount - 1);
  if (spinnerCount === 0) {
    const overlay = document.getElementById('spinner-overlay');
    if (overlay) overlay.style.display = 'none';
  }
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function updateSyncStatus(status) {
  App.syncStatus = status;
  const badgeSaved = document.getElementById('badge-saved');
  const badgeOffline = document.getElementById('badge-offline');
  if (!badgeSaved || !badgeOffline) return;

  if (status === 'saved') {
    badgeSaved.textContent = 'Todo guardado';
    badgeSaved.style.display = 'inline-flex';
    badgeOffline.classList.add('hidden');
  } else if (status === 'pending') {
    badgeSaved.textContent = 'Guardando...';
    badgeSaved.style.display = 'inline-flex';
    badgeOffline.classList.add('hidden');
  } else if (status === 'offline') {
    badgeSaved.classList.add('hidden');
    badgeOffline.classList.remove('hidden');
  }
}

function cacheData(key, data) {
  try {
    localStorage.setItem(`cache_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {}
}

function getCachedData(key) {
  try {
    const item = localStorage.getItem(`cache_${key}`);
    return item ? JSON.parse(item).data : null;
  } catch (e) {
    return null;
  }
}

async function syncNow() {
  try {
    showToast('Sincronizando datos con el servidor...', 'info');
    await loadColegios();
    if (App.selectedColegio) {
      await loadCursos(App.selectedColegio.id || App.selectedColegio._id);
    }
    updateSyncStatus('saved');
    showToast('Sincronización completada con éxito', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// AUTENTICACIÓN
// =============================================
function showLogin() {
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
}

function hideLogin() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
}

function logout() {
  App.token = null;
  App.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showLogin();
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';

  if (!email || !password) {
    errorEl.textContent = 'Por favor complete su email y contraseña.';
    return;
  }

  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    App.token = data.token;
    App.user = data.usuario || { nombre: 'Prof. Facundo Casciano', email };
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(App.user));

    hideLogin();
    await initApp();
    showToast('¡Bienvenido Prof. Facundo Casciano!', 'success');
  } catch (err) {
    errorEl.textContent = err.message || 'Error al iniciar sesión';
  }
}

// =============================================
// MODO OSCURO
// =============================================
function toggleDarkMode() {
  App.darkMode = !App.darkMode;
  document.body.classList.toggle('dark-mode', App.darkMode);
  localStorage.setItem('darkMode', App.darkMode);
  const btn = document.getElementById('btn-dark-mode');
  if (btn) btn.textContent = App.darkMode ? '☀️' : '🌙';
}

function applyDarkMode() {
  document.body.classList.toggle('dark-mode', App.darkMode);
  const btn = document.getElementById('btn-dark-mode');
  if (btn) btn.textContent = App.darkMode ? '☀️' : '🌙';
}

// =============================================
// GESTIÓN DE COLEGIOS
// =============================================
async function loadColegios() {
  try {
    const data = await apiFetch('/api/colegios');
    App.colegios = Array.isArray(data) ? data : (data && data.colegios ? data.colegios : []);
    cacheData('colegios', App.colegios);
  } catch (err) {
    const cached = getCachedData('colegios');
    if (cached && Array.isArray(cached)) {
      App.colegios = cached;
    } else {
      App.colegios = [
        { id: 1, nombre: 'Tecnica N° 1 045' },
        { id: 2, nombre: 'Tecnica N° 2 135' },
        { id: 3, nombre: 'Tecnica N° 5 045' },
      ];
    }
  }
  renderColegios();
}

function renderColegios() {
  const list = document.getElementById('school-list');
  if (!list) return;

  const colegiosList = Array.isArray(App.colegios) ? App.colegios : [];
  if (colegiosList.length === 0) {
    list.innerHTML = '<li class="school-item" style="color:var(--text-muted);font-style:italic;">No hay colegios registrados</li>';
    return;
  }

  list.innerHTML = colegiosList.map((c, i) => {
    const id = c.id || c._id || (i + 1);
    const isActive = App.selectedColegio && (App.selectedColegio.id || App.selectedColegio._id) == id;
    const nombreEscapado = (c.nombre || '').replace(/'/g, "\\'");
    return `
      <li class="school-item ${isActive ? 'active' : ''}" onclick="selectColegio('${id}')">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px;">${c.nombre}</span>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          ${isActive ? '<span style="font-size:0.75rem;background:var(--c-blue);color:#fff;padding:2px 7px;border-radius:10px;">Activo</span>' : ''}
          <button type="button" onclick="event.stopPropagation(); eliminarColegio('${id}', '${nombreEscapado}')" style="background:transparent;color:var(--c-red);font-size:0.95rem;padding:2px 5px;cursor:pointer;border-radius:4px;" title="Eliminar escuela que ya no trabajo">🗑️</button>
        </div>
      </li>
    `;
  }).join('');
}

async function eliminarColegio(id, nombre) {
  if (!confirm(`¿Estás seguro de que deseas quitar la escuela "${nombre}"?\n\nSe eliminarán todos sus cursos, alumnos y notas asociadas porque ya no trabajas allí.`)) {
    return;
  }
  try {
    await apiFetch(`/api/colegios/${id}`, { method: 'DELETE' });
    showToast(`Escuela "${nombre}" eliminada correctamente`, 'success');
    App.selectedColegio = null;
    await loadColegios();
    if (App.colegios.length > 0) {
      await selectColegio(App.colegios[0].id || App.colegios[0]._id);
    } else {
      renderCursos();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function selectColegio(id) {
  const colegiosList = Array.isArray(App.colegios) ? App.colegios : [];
  App.selectedColegio = colegiosList.find(c => (c.id || c._id) == id) || null;
  renderColegios();
  if (App.selectedColegio) {
    await loadCursos(id);
  }
}

function showAddColegioModal() {
  openModal('modal-add-colegio');
  document.getElementById('input-colegio-nombre').value = '';
}

async function saveNewColegio() {
  const nombre = document.getElementById('input-colegio-nombre').value.trim();
  if (!nombre) {
    showToast('Ingrese el nombre del colegio', 'warning');
    return;
  }
  try {
    const nuevo = await apiFetch('/api/colegios', {
      method: 'POST',
      body: JSON.stringify({ nombre }),
    });
    closeModal('modal-add-colegio');
    showToast('Colegio registrado exitosamente', 'success');
    await loadColegios();
    if (nuevo && nuevo.id) {
      await selectColegio(nuevo.id);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// GESTIÓN DE CURSOS
// =============================================
async function loadCursos(colegioId) {
  try {
    const data = await apiFetch(`/api/colegios/${colegioId}/cursos`);
    App.cursos = Array.isArray(data) ? data : (data && data.cursos ? data.cursos : []);
    cacheData(`cursos_${colegioId}`, App.cursos);
  } catch (err) {
    const cached = getCachedData(`cursos_${colegioId}`);
    if (cached && Array.isArray(cached)) {
      App.cursos = cached;
    } else {
      App.cursos = [
        { id: 1, nombre: '4° 1 ANALÓGICA GB', turno: 'Mañana' },
        { id: 2, nombre: '4° 1 MONTAJE GB', turno: 'Mañana' },
      ];
    }
  }
  renderCursos();
}

function renderCursos() {
  const container = document.getElementById('courses-container');
  const subtitle = document.getElementById('content-subtitle');
  if (!container) return;

  if (!App.selectedColegio) {
    subtitle.textContent = 'Seleccione un colegio de la lista';
    container.innerHTML = `
      <div style="text-align:center;padding:48px 20px;background:var(--bg-card);border:1px solid var(--border-light);border-radius:var(--radius-sm);">
        <p style="color:var(--text-muted);font-size:1.05rem;">Seleccione un colegio a la izquierda para ver y gestionar sus cursos.</p>
      </div>`;
    return;
  }

  const colegioNombre = App.selectedColegio.nombre || '';
  subtitle.textContent = colegioNombre;

  if (App.cursos.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 20px;background:var(--bg-card);border:1px solid var(--border-light);border-radius:var(--radius-sm);">
        <p style="color:var(--text-muted);font-size:1.05rem;margin-bottom:12px;">No hay cursos registrados en ${colegioNombre}.</p>
        <button class="btn-nav btn-nav-blue" onclick="showAddCursoModal()">+ Agregar el primer curso</button>
      </div>`;
    return;
  }

  container.innerHTML = App.cursos.map(curso => {
    const id = curso.id || curso._id;
    const nombreCurso = curso.nombre || `${curso.anio || ''} ° ${curso.division || ''} ${curso.turno || ''}`;
    const nombreEscapado = nombreCurso.replace(/'/g, "\\'");
    return `
      <div class="course-card">
        <div class="course-header-row">
          <div class="course-title-text">
            <strong>${nombreCurso}</strong>
            <span class="course-title-school">— ${colegioNombre}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge-turno">${curso.turno || 'Mañana'}</span>
            <button type="button" class="btn-action" style="background:transparent;color:var(--c-red);border:1px solid rgba(220,53,69,0.3);padding:3px 8px;font-size:0.75rem;" onclick="eliminarCurso('${id}', '${nombreEscapado}')" title="Quitar curso que ya no trabajo">🗑️ Quitar Curso</button>
          </div>
        </div>
        <div class="course-actions-grid">
          <button class="btn-action btn-act-yellow" onclick="showAsistenciaModal('${id}')">Registrar / Modificar Asistencia</button>
          <button class="btn-action btn-act-gray" onclick="showHistorialAsistenciaModal('${id}')">Historial de Asistencia</button>
          <button class="btn-action btn-act-green" style="font-weight:700;" onclick="showAddEstudianteModal('${id}')">📂 Cargar Alumnos (Excel)</button>
          <button class="btn-action btn-act-red" style="font-weight:600;" onclick="abrirModalFormatearFaltas('${id}')" title="Formatear o reiniciar las faltas de este curso a cero">🧹 Formatear Faltas</button>
          <button class="btn-action btn-act-green" onclick="showCalificacionesDiariasModal('${id}')">Calificaciones diarias</button>
          <button class="btn-action btn-act-blue-bold" onclick="showCalificacionesAnualesModal('${id}')">Calificaciones Anuales</button>
          <button class="btn-action btn-act-dark" onclick="showVisibilidadModal('${id}')">Configurar Visibilidad</button>
          <button class="btn-action btn-act-cyan" onclick="showNotificacionesModal('${id}')">Notificaciones</button>
          <button class="btn-action btn-act-gray" onclick="showLibroTemaModal('${id}')">Libro Tema</button>
          <button class="btn-action btn-act-cyan" onclick="showDescargasModal('${id}')">Descargas</button>
        </div>
      </div>`;
  }).join('');
}

async function eliminarCurso(id, nombre) {
  if (!confirm(`¿Estás seguro de que deseas quitar el curso "${nombre}"?\n\nSe eliminarán sus registros de notas y asistencias asociadas.`)) {
    return;
  }
  try {
    await apiFetch(`/api/cursos/${id}`, { method: 'DELETE' });
    showToast(`Curso "${nombre}" eliminado correctamente`, 'success');
    if (App.selectedColegio) {
      await loadCursos(App.selectedColegio.id || App.selectedColegio._id);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showAddCursoModal() {
  openModal('modal-add-curso');
  const select = document.getElementById('select-curso-colegio');
  const colegiosList = Array.isArray(App.colegios) ? App.colegios : [];
  select.innerHTML = colegiosList.map(c => {
    const id = c.id || c._id;
    const isSel = App.selectedColegio && (App.selectedColegio.id || App.selectedColegio._id) == id;
    return `<option value="${id}" ${isSel ? 'selected' : ''}>${c.nombre}</option>`;
  }).join('');
  document.getElementById('input-curso-nombre').value = '';
  document.getElementById('input-curso-anio').value = '';
  document.getElementById('input-curso-division').value = '';
  document.getElementById('input-curso-turno').value = 'Mañana';
}

async function saveNewCurso() {
  const colegioId = document.getElementById('select-curso-colegio').value;
  const nombre = document.getElementById('input-curso-nombre').value.trim();
  const anio = document.getElementById('input-curso-anio').value.trim();
  const division = document.getElementById('input-curso-division').value.trim();
  const turno = document.getElementById('input-curso-turno').value;

  if (!nombre && !anio) {
    showToast('Indique al menos el nombre o año del curso', 'warning');
    return;
  }

  const fullName = anio && division ? `${anio} ${division} ${nombre || ''}`.trim() : (nombre || 'Curso Nuevo');

  try {
    await apiFetch(`/api/colegios/${colegioId}/cursos`, {
      method: 'POST',
      body: JSON.stringify({ nombre: fullName, anio, division, turno }),
    });
    closeModal('modal-add-curso');
    showToast('Curso agregado correctamente', 'success');
    if (App.selectedColegio && (App.selectedColegio.id || App.selectedColegio._id) == colegioId) {
      await loadCursos(colegioId);
    } else {
      await selectColegio(colegioId);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// GESTIÓN DE ESTUDIANTES (ESTILO EXCEL)
// =============================================
let excelRowsCounter = 0;
let currentExcelWorkbook = null;

function cambiarModoCarga(modo) {
  const btnFile = document.getElementById('tab-btn-file');
  const btnGrid = document.getElementById('tab-btn-grid');
  const btnPaste = document.getElementById('tab-btn-paste');
  const divFile = document.getElementById('modo-carga-file');
  const divPaste = document.getElementById('modo-carga-paste');
  const divGrid = document.getElementById('modo-carga-grid');

  if (modo === 'file') {
    if (btnFile) btnFile.className = 'btn-action btn-act-blue-bold';
    if (btnGrid) btnGrid.className = 'btn-action btn-act-gray';
    if (btnPaste) btnPaste.className = 'btn-action btn-act-gray';
    if (divFile) divFile.classList.remove('hidden');
    if (divPaste) divPaste.classList.add('hidden');
    if (divGrid) divGrid.classList.remove('hidden');
  } else if (modo === 'grid') {
    if (btnFile) btnFile.className = 'btn-action btn-act-gray';
    if (btnGrid) btnGrid.className = 'btn-action btn-act-blue-bold';
    if (btnPaste) btnPaste.className = 'btn-action btn-act-gray';
    if (divFile) divFile.classList.add('hidden');
    if (divPaste) divPaste.classList.add('hidden');
    if (divGrid) divGrid.classList.remove('hidden');
  } else if (modo === 'paste') {
    if (btnFile) btnFile.className = 'btn-action btn-act-gray';
    if (btnGrid) btnGrid.className = 'btn-action btn-act-gray';
    if (btnPaste) btnPaste.className = 'btn-action btn-act-blue-bold';
    if (divFile) divFile.classList.add('hidden');
    if (divPaste) divPaste.classList.remove('hidden');
    if (divGrid) divGrid.classList.remove('hidden');
    const area = document.getElementById('excel-paste-area');
    if (area) area.focus();
  }
}

async function showAddEstudianteModal(targetCursoId = null) {
  openModal('modal-add-estudiante');
  cambiarModoCarga('file');
  resetExcelUpload();

  const selectColegio = document.getElementById('select-est-colegio');
  const selectCurso = document.getElementById('select-est-curso');
  const colegiosList = Array.isArray(App.colegios) ? App.colegios : [];

  let colegioIdInicial = App.selectedColegio ? (App.selectedColegio.id || App.selectedColegio._id) : '';

  if (targetCursoId) {
    const cursoObj = App.cursos.find(c => (c.id || c._id) == targetCursoId);
    if (cursoObj && cursoObj.colegio_id) {
      colegioIdInicial = cursoObj.colegio_id;
    }
  }

  selectColegio.innerHTML = '<option value="">-- Seleccione colegio --</option>' +
    colegiosList.map(c => {
      const id = c.id || c._id;
      const isSel = colegioIdInicial == id;
      return `<option value="${id}" ${isSel ? 'selected' : ''}>${c.nombre}</option>`;
    }).join('');

  const actualizarCursos = async (cId, cursoSeleccionado = null) => {
    if (!cId) {
      selectCurso.innerHTML = '<option value="">-- Primero seleccione colegio --</option>';
      return;
    }
    try {
      const data = await apiFetch(`/api/colegios/${cId}/cursos`);
      const cursos = Array.isArray(data) ? data : (data && data.cursos ? data.cursos : []);
      if (cursos.length === 0) {
        selectCurso.innerHTML = '<option value="">No hay cursos en este colegio</option>';
        return;
      }
      selectCurso.innerHTML = cursos.map((c, i) => {
        const id = c.id || c._id;
        const isSel = cursoSeleccionado ? (id == cursoSeleccionado) : (i === 0);
        return `<option value="${id}" ${isSel ? 'selected' : ''}>${c.nombre}</option>`;
      }).join('');
    } catch {
      selectCurso.innerHTML = '<option value="">Error al cargar cursos</option>';
    }
  };

  selectColegio.onchange = function() {
    actualizarCursos(this.value);
  };

  if (colegioIdInicial) {
    await actualizarCursos(colegioIdInicial, targetCursoId);
  }

  // Inicializar grilla con 5 filas si está vacía
  const tbody = document.getElementById('excel-grid-tbody');
  if (tbody && tbody.children.length === 0) {
    limpiarFilasExcel();
  } else {
    actualizarContadorFilas();
  }
}

// ── Controladores de Drag & Drop y lectura de archivo Excel ──
function handleExcelDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  const dz = document.getElementById('dropzone-excel');
  if (dz) {
    dz.style.borderColor = '#198754';
    dz.style.background = 'rgba(25, 135, 84, 0.08)';
  }
}

function handleExcelDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  const dz = document.getElementById('dropzone-excel');
  if (dz) {
    dz.style.borderColor = '#0d6efd';
    dz.style.background = 'rgba(13, 110, 253, 0.03)';
  }
}

function handleExcelDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  handleExcelDragLeave(e);
  const files = e.dataTransfer ? e.dataTransfer.files : null;
  if (files && files.length > 0) {
    procesarArchivoExcel(files[0]);
  }
}

function handleExcelFileInput(e) {
  const files = e.target.files;
  if (files && files.length > 0) {
    procesarArchivoExcel(files[0]);
  }
}

function resetExcelUpload() {
  currentExcelWorkbook = null;
  const input = document.getElementById('input-excel-file');
  if (input) input.value = '';
  const statusDiv = document.getElementById('excel-file-status');
  if (statusDiv) statusDiv.classList.add('hidden');
  const sheetContainer = document.getElementById('excel-sheet-selector-container');
  if (sheetContainer) sheetContainer.classList.add('hidden');
}

function procesarArchivoExcel(file) {
  if (!file) return;

  const validExts = ['.xlsx', '.xls', '.csv'];
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!validExts.includes(ext)) {
    showToast('Por favor selecciona un archivo Excel (.xlsx, .xls) o .csv válido.', 'warning');
    return;
  }

  if (typeof XLSX === 'undefined') {
    showToast('Cargando motor de lectura Excel, por favor espere...', 'info');
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => procesarArchivoExcel(file);
    script.onerror = () => showToast('No se pudo cargar la librería para leer Excel.', 'error');
    document.head.appendChild(script);
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      currentExcelWorkbook = { workbook, fileName: file.name };

      const sheetContainer = document.getElementById('excel-sheet-selector-container');
      const sheetSelect = document.getElementById('excel-sheet-select');
      if (workbook.SheetNames.length > 1) {
        sheetSelect.innerHTML = workbook.SheetNames.map((s, idx) => 
          `<option value="${idx}">${s}</option>`
        ).join('');
        if (sheetContainer) sheetContainer.classList.remove('hidden');
      } else {
        if (sheetContainer) sheetContainer.classList.add('hidden');
      }

      cargarHojaExcel(workbook.SheetNames[0], file.name);

    } catch (err) {
      console.error('Error al leer Excel:', err);
      showToast('Error al procesar el archivo Excel: ' + err.message, 'error');
    }
  };
  reader.onerror = function() {
    showToast('Error al leer el archivo desde el disco.', 'error');
  };
  reader.readAsArrayBuffer(file);
}

function handleExcelSheetChange() {
  if (!currentExcelWorkbook) return;
  const sheetSelect = document.getElementById('excel-sheet-select');
  const sheetIndex = parseInt(sheetSelect.value, 10);
  const sheetName = currentExcelWorkbook.workbook.SheetNames[sheetIndex];
  cargarHojaExcel(sheetName, currentExcelWorkbook.fileName);
}

function cargarHojaExcel(sheetName, fileName) {
  if (!currentExcelWorkbook) return;
  const sheet = currentExcelWorkbook.workbook.Sheets[sheetName];
  if (!sheet) return;

  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (!rawRows || rawRows.length === 0) {
    showToast('La hoja seleccionada está vacía.', 'warning');
    return;
  }

  // Detectar fila de cabecera e índices de columnas
  let headerRowIdx = -1;
  let studentColIdx = -1;
  let apellidoColIdx = -1;
  let nombreColIdx = -1;
  let dniColIdx = -1;

  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const row = rawRows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').trim().toLowerCase();
      if (val.includes('estudiante') || val.includes('alumno') || val.includes('apellido y nombre') || val.includes('nombre y apellido') || val.includes('nómina') || val.includes('nomina')) {
        headerRowIdx = r;
        studentColIdx = c;
        break;
      }
      if (val === 'apellido' || val === 'apellidos') {
        headerRowIdx = r;
        apellidoColIdx = c;
      }
      if (val === 'nombre' || val === 'nombres') {
        nombreColIdx = c;
      }
      if (val.includes('dni') || val.includes('documento')) {
        dniColIdx = c;
      }
    }
    if (headerRowIdx !== -1) break;
  }

  const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
  const colEst = studentColIdx !== -1 ? studentColIdx : (apellidoColIdx !== -1 ? apellidoColIdx : 0);

  const estudiantesExtraidos = [];

  for (let r = startRow; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    let apellido = '';
    let nombre = '';
    let dni = dniColIdx !== -1 ? String(row[dniColIdx] || '').trim() : '';

    if (apellidoColIdx !== -1 && nombreColIdx !== -1) {
      apellido = String(row[apellidoColIdx] || '').trim();
      nombre = String(row[nombreColIdx] || '').trim();
    } else {
      const fullText = String(row[colEst] || '').trim();
      if (!fullText) continue;
      const lower = fullText.toLowerCase();
      if (lower.includes('total') || lower.includes('promedio') || lower.includes('porcentaje') || lower === 'estudiante' || lower === 'alumno' || lower === 'nombres' || lower === 'apellidos') continue;

      if (fullText.includes(',')) {
        const parts = fullText.split(',');
        apellido = parts[0].trim();
        nombre = parts.slice(1).join(' ').trim();
      } else {
        const words = fullText.split(/\s+/);
        if (words.length === 1) {
          apellido = words[0];
          nombre = '';
        } else {
          apellido = words[0];
          nombre = words.slice(1).join(' ');
        }
      }
    }

    // Limpieza de caracteres residuales
    apellido = apellido.replace(/^[,;.\s]+|[,;.\s]+$/g, '');
    nombre = nombre.replace(/^[,;.\s]+|[,;.\s]+$/g, '');
    dni = dni.replace(/[^0-9.]/g, '');

    if (apellido || nombre) {
      estudiantesExtraidos.push({ apellido, nombre, dni });
    }
  }

  if (estudiantesExtraidos.length === 0) {
    showToast('No se encontraron filas con nombres de estudiantes en esta hoja.', 'warning');
    return;
  }

  // Poblar grilla interactiva
  const tbody = document.getElementById('excel-grid-tbody');
  tbody.innerHTML = '';
  estudiantesExtraidos.forEach(est => {
    agregarFilaExcel(est.apellido, est.nombre, est.dni);
  });

  // Mostrar resumen en UI
  const statusDiv = document.getElementById('excel-file-status');
  const nameEl = document.getElementById('excel-loaded-filename');
  const summaryEl = document.getElementById('excel-loaded-summary');

  if (nameEl) nameEl.textContent = fileName + (sheetName ? ` [Hoja: ${sheetName}]` : '');
  if (summaryEl) summaryEl.textContent = `¡${estudiantesExtraidos.length} estudiante(s) leídos exitosamente! Revisa la grilla abajo y haz clic en "Guardar Alumnos en el Curso".`;
  if (statusDiv) statusDiv.classList.remove('hidden');

  actualizarContadorFilas();
  showToast(`✅ ¡${estudiantesExtraidos.length} estudiantes cargados del archivo Excel!`, 'success');
}

function agregarFilaExcel(apellido = '', nombre = '', dni = '') {
  const tbody = document.getElementById('excel-grid-tbody');
  if (!tbody) return null;
  const tr = document.createElement('tr');
  const rowIndex = tbody.children.length + 1;

  tr.innerHTML = `
    <td style="text-align:center;font-weight:700;color:var(--text-muted);font-size:0.85rem;" class="row-num">${rowIndex}</td>
    <td>
      <input type="text" class="form-input excel-input-apellido" value="${apellido}" placeholder="Apellido (ej: Alvarez)" style="padding:6px 8px;font-size:0.88rem;">
    </td>
    <td>
      <input type="text" class="form-input excel-input-nombre" value="${nombre}" placeholder="Nombre (ej: Mateo)" style="padding:6px 8px;font-size:0.88rem;">
    </td>
    <td>
      <input type="text" class="form-input excel-input-dni" value="${dni}" placeholder="DNI (ej: 45.123.890)" style="padding:6px 8px;font-size:0.88rem;">
    </td>
    <td style="text-align:center;">
      <button type="button" onclick="eliminarFilaExcel(this)" style="background:transparent;color:var(--c-red);font-size:1.1rem;padding:2px 6px;cursor:pointer;" title="Eliminar fila">✕</button>
    </td>
  `;

  tbody.appendChild(tr);

  // Navegación rápida con Enter
  const inputs = tr.querySelectorAll('input');
  inputs.forEach((input, idx) => {
    input.addEventListener('input', () => actualizarContadorFilas());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (idx === inputs.length - 1) {
          const nuevaFila = agregarFilaExcel();
          if (nuevaFila) nuevaFila.querySelector('.excel-input-apellido').focus();
        } else {
          inputs[idx + 1].focus();
        }
      }
    });

    // Soporte para pegar datos tabulados de Excel directamente en la celda
    input.addEventListener('paste', (e) => {
      const pasteText = (e.clipboardData || window.clipboardData).getData('text');
      if (pasteText && (pasteText.includes('\t') || pasteText.includes('\n'))) {
        e.preventDefault();
        insertarTextoPegadoEnFila(tr, pasteText);
      }
    });
  });

  actualizarContadorFilas();
  return tr;
}

function agregarMultiplesFilas(n = 5) {
  for (let i = 0; i < n; i++) {
    agregarFilaExcel();
  }
}

function eliminarFilaExcel(btn) {
  const tr = btn.closest('tr');
  if (tr) {
    tr.remove();
    reindexarFilasExcel();
  }
}

function limpiarFilasExcel() {
  const tbody = document.getElementById('excel-grid-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    agregarFilaExcel();
  }
}

function reindexarFilasExcel() {
  const tbody = document.getElementById('excel-grid-tbody');
  if (!tbody) return;
  Array.from(tbody.children).forEach((tr, idx) => {
    const numCell = tr.querySelector('.row-num');
    if (numCell) numCell.textContent = idx + 1;
  });
  actualizarContadorFilas();
}

function actualizarContadorFilas() {
  const rows = document.querySelectorAll('#excel-grid-tbody tr');
  let conDatos = 0;
  rows.forEach(tr => {
    const ap = (tr.querySelector('.excel-input-apellido') ? tr.querySelector('.excel-input-apellido').value : '').trim();
    const no = (tr.querySelector('.excel-input-nombre') ? tr.querySelector('.excel-input-nombre').value : '').trim();
    if (ap || no) conDatos++;
  });
  const countEl = document.getElementById('excel-filas-count');
  if (countEl) {
    countEl.textContent = `${conDatos} alumno(s) con datos de ${rows.length} fila(s)`;
  }
}

function insertarTextoPegadoEnFila(filaInicio, texto) {
  const lineas = texto.trim().split(/\r?\n/);
  let filaActual = filaInicio;

  lineas.forEach(linea => {
    if (!linea.trim()) return;
    const partes = linea.split(/\t|;|\|/).map(p => p.trim());
    let apellido = partes[0] || '';
    let nombre = partes[1] || '';
    let dni = partes[2] || '';

    if (!nombre && apellido.includes(',')) {
      const splitComa = apellido.split(',');
      apellido = splitComa[0].trim();
      nombre = splitComa[1].trim();
    } else if (!nombre && apellido.includes(' ')) {
      const palabras = apellido.split(' ');
      apellido = palabras[0];
      nombre = palabras.slice(1).join(' ');
    }

    if (!filaActual) {
      filaActual = agregarFilaExcel(apellido, nombre, dni);
    } else {
      const inputAp = filaActual.querySelector('.excel-input-apellido');
      const inputNom = filaActual.querySelector('.excel-input-nombre');
      const inputDni = filaActual.querySelector('.excel-input-dni');
      if (inputAp) inputAp.value = apellido;
      if (inputNom) inputNom.value = nombre;
      if (inputDni) inputDni.value = dni;
    }
    filaActual = filaActual ? filaActual.nextElementSibling : null;
  });

  reindexarFilasExcel();
  showToast('Datos pegados desde Excel con éxito', 'success');
}

function procesarPegadoExcel() {
  const area = document.getElementById('excel-paste-area');
  const texto = area.value.trim();
  if (!texto) {
    showToast('Pega primero los datos de Excel en el cuadro de texto', 'warning');
    return;
  }

  const tbody = document.getElementById('excel-grid-tbody');
  tbody.innerHTML = '';

  const lineas = texto.split(/\r?\n/);
  let agregados = 0;

  lineas.forEach(linea => {
    if (!linea.trim()) return;
    const partes = linea.split(/\t|;|\|/).map(p => p.trim());
    let apellido = partes[0] || '';
    let nombre = partes[1] || '';
    let dni = partes[2] || '';

    if (!nombre && apellido.includes(',')) {
      const splitComa = apellido.split(',');
      apellido = splitComa[0].trim();
      nombre = splitComa[1].trim();
    } else if (!nombre && apellido.includes(' ')) {
      const palabras = apellido.split(' ');
      apellido = palabras[0];
      nombre = palabras.slice(1).join(' ');
    }

    if (apellido || nombre) {
      agregarFilaExcel(apellido, nombre, dni);
      agregados++;
    }
  });

  if (agregados < 3) {
    agregarMultiplesFilas(3 - agregados);
  }

  cambiarModoCarga('grid');
  showToast(`¡${agregados} alumnos cargados en la grilla! Revisa y dale a Guardar`, 'success');
}

async function saveNewEstudiante() {
  const cursoId = document.getElementById('select-est-curso').value;
  const colegioId = document.getElementById('select-est-colegio').value;

  if (!colegioId) {
    showToast('Seleccione un colegio / escuela', 'warning');
    return;
  }
  if (!cursoId) {
    showToast('Seleccione un curso de destino', 'warning');
    return;
  }

  const rows = document.querySelectorAll('#excel-grid-tbody tr');
  const estudiantes = [];

  rows.forEach(tr => {
    const inputAp = tr.querySelector('.excel-input-apellido');
    const inputNom = tr.querySelector('.excel-input-nombre');
    const inputDni = tr.querySelector('.excel-input-dni');
    const apellido = inputAp ? inputAp.value.trim() : '';
    const nombre = inputNom ? inputNom.value.trim() : '';
    const dni = inputDni ? inputDni.value.trim() : '';
    if (apellido && nombre) {
      estudiantes.push({ apellido, nombre, dni });
    }
  });

  if (estudiantes.length === 0) {
    showToast('Debe ingresar al menos un estudiante con Apellido y Nombre', 'warning');
    return;
  }

  try {
    const res = await apiFetch(`/api/cursos/${cursoId}/estudiantes`, {
      method: 'POST',
      body: JSON.stringify({ estudiantes }),
    });

    closeModal('modal-add-estudiante');
    limpiarFilasExcel();
    resetExcelUpload();
    showToast(`✅ ${estudiantes.length} estudiante(s) guardado(s) correctamente`, 'success');

    if (App.selectedColegio && (App.selectedColegio.id || App.selectedColegio._id) == colegioId) {
      await loadCursos(colegioId);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// ASISTENCIA
// =============================================
async function showAsistenciaModal(cursoId, fechaEspecifica = null) {
  openModal('modal-asistencia');
  document.getElementById('asistencia-curso-id').value = cursoId;
  const fechaInput = document.getElementById('input-asistencia-fecha');
  
  if (fechaEspecifica) {
    fechaInput.value = fechaEspecifica;
  } else if (!fechaInput.value) {
    fechaInput.value = todayStr();
  }

  // Escuchar cambios de fecha para cargar automáticamente las asistencias de cualquier día
  if (!fechaInput.dataset.hooked) {
    fechaInput.dataset.hooked = 'true';
    fechaInput.addEventListener('change', () => {
      const cId = document.getElementById('asistencia-curso-id').value;
      if (cId) cargarNominaYAsistencia(cId, fechaInput.value);
    });
  }

  await cargarNominaYAsistencia(cursoId, fechaInput.value);
}

function setFechaAsistenciaRapida(tipo) {
  const input = document.getElementById('input-asistencia-fecha');
  const cursoId = document.getElementById('asistencia-curso-id').value;
  if (!input) return;

  if (tipo === 'hoy') {
    input.value = todayStr();
  } else if (tipo === 'ayer') {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    input.value = formatDate(ayer);
  }

  if (cursoId) {
    cargarNominaYAsistencia(cursoId, input.value);
  }
}

async function cargarNominaYAsistencia(cursoId, fecha) {
  const tbody = document.getElementById('asistencia-tbody');
  tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding:20px;">Cargando nómina y asistencias del día...</td></tr>';

  try {
    const [estudiantes, registrosPrevios] = await Promise.all([
      apiFetch(`/api/cursos/${cursoId}/estudiantes`),
      apiFetch(`/api/cursos/${cursoId}/asistencia?fecha=${fecha}`).catch(() => [])
    ]);

    if (!estudiantes || estudiantes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding:20px;">No hay estudiantes cargados en este curso.<br><small style="color:var(--text-muted);">Utiliza "Agregar Estudiante" para sumarlos.</small></td></tr>';
      actualizarResumenAsistenciaEnVivo();
      return;
    }

    // Actualizar indicador de estado de la fecha seleccionada
    const badgeEstado = document.getElementById('badge-estado-fecha-asist');
    if (badgeEstado) {
      if (registrosPrevios && registrosPrevios.length > 0) {
        badgeEstado.style.background = '#cfe2ff';
        badgeEstado.style.color = '#084298';
        badgeEstado.style.border = '1px solid #b6d4fe';
        badgeEstado.innerHTML = `✏️ Editando asistencias guardadas (${registrosPrevios.length} registros)`;
      } else {
        badgeEstado.style.background = '#d1e7dd';
        badgeEstado.style.color = '#0f5132';
        badgeEstado.style.border = '1px solid #badbcc';
        badgeEstado.innerHTML = `✨ Nueva fecha (sin asistencias registradas)`;
      }
    }

    // Verificar si esta fecha es una Licencia Médica, Feriado o Duelo
    verificarBannerLicenciaFecha(cursoId, fecha);

    // Mapa de asistencias previas guardadas para esta fecha
    const mapaEstados = {};
    if (Array.isArray(registrosPrevios)) {
      registrosPrevios.forEach(r => {
        mapaEstados[r.estudiante_id] = r.estado;
      });
    }

    tbody.innerHTML = estudiantes.map((est, i) => {
      const id = est.id || est._id;
      // Si ya hay un registro guardado para esa fecha, mantenerlo; sino, por defecto 'presente'
      const estadoActual = mapaEstados[id] || 'presente';

      return `
        <tr>
          <td style="text-align:center;font-weight:700;color:var(--text-muted);">${i + 1}</td>
          <td><strong>${est.apellido}</strong>, ${est.nombre}</td>
          <td>
            <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
              <label style="cursor:pointer;color:var(--c-green);font-weight:700;">
                <input type="radio" name="asist_${id}" value="presente" ${estadoActual === 'presente' ? 'checked' : ''} onchange="actualizarResumenAsistenciaEnVivo()"> ✅ Presente
              </label>
              <label style="cursor:pointer;color:var(--c-red);font-weight:700;">
                <input type="radio" name="asist_${id}" value="ausente" ${estadoActual === 'ausente' ? 'checked' : ''} onchange="actualizarResumenAsistenciaEnVivo()"> ❌ Ausente (Falta)
              </label>
              <label style="cursor:pointer;color:var(--c-yellow-dark);font-weight:700;">
                <input type="radio" name="asist_${id}" value="tarde" ${estadoActual === 'tarde' ? 'checked' : ''} onchange="actualizarResumenAsistenciaEnVivo()"> ⏰ Tarde (1/2 Falta)
              </label>
              <label style="cursor:pointer;color:var(--c-blue);font-weight:700;">
                <input type="radio" name="asist_${id}" value="justificado" ${estadoActual === 'justificado' ? 'checked' : ''} onchange="actualizarResumenAsistenciaEnVivo()"> 📝 Justificado
              </label>
            </div>
          </td>
        </tr>`;
    }).join('');

    actualizarResumenAsistenciaEnVivo();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:var(--c-red);text-align:center;">${err.message}</td></tr>`;
  }
}

async function eliminarAsistenciaFechaActual() {
  const cursoId = document.getElementById('asistencia-curso-id').value;
  const fecha = document.getElementById('input-asistencia-fecha').value;
  if (!cursoId || !fecha) return;

  if (!confirm(`¿Estás seguro de que deseas eliminar todas las asistencias registradas para el día ${fecha}?`)) {
    return;
  }

  try {
    await apiFetch(`/api/cursos/${cursoId}/asistencia/fecha`, {
      method: 'DELETE',
      body: JSON.stringify({ fecha })
    });
    showToast(`🗑️ Asistencias del día ${fecha} eliminadas correctamente`, 'success');
    await cargarNominaYAsistencia(cursoId, fecha);
    if (App.currentAsistenciaData) {
      await loadHistorialResumen(cursoId);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function actualizarResumenAsistenciaEnVivo() {
  const rows = document.querySelectorAll('#asistencia-tbody tr');
  const total = rows.length;
  let presentes = 0;
  let ausentes = 0;
  let tardes = 0;

  rows.forEach(tr => {
    const p = tr.querySelector('input[value="presente"]:checked');
    const a = tr.querySelector('input[value="ausente"]:checked');
    const t = tr.querySelector('input[value="tarde"]:checked');
    if (p) presentes++;
    if (a) ausentes++;
    if (t) tardes++;
  });

  const pctPres = total > 0 ? ((presentes / total) * 100).toFixed(0) : '0';
  const pctAus = total > 0 ? ((ausentes / total) * 100).toFixed(0) : '0';

  const elTot = document.getElementById('asist-count-total');
  const elPres = document.getElementById('asist-count-presentes');
  const elPctPres = document.getElementById('asist-pct-presentes');
  const elAus = document.getElementById('asist-count-ausentes');
  const elPctAus = document.getElementById('asist-pct-ausentes');
  const elTard = document.getElementById('asist-count-tardes');

  if (elTot) elTot.textContent = total;
  if (elPres) elPres.textContent = presentes;
  if (elPctPres) elPctPres.textContent = `${pctPres}%`;
  if (elAus) elAus.textContent = ausentes;
  if (elPctAus) elPctAus.textContent = `${pctAus}%`;
  if (elTard) elTard.textContent = tardes;
}

function marcarTodosAsistencia(estado) {
  const inputs = document.querySelectorAll(`#asistencia-tbody input[type="radio"][value="${estado}"]`);
  inputs.forEach(r => { r.checked = true; });
  actualizarResumenAsistenciaEnVivo();
  showToast(`Todos los estudiantes marcados como: ${estado.toUpperCase()}`, 'info');
}

async function saveAsistencia() {
  const cursoId = document.getElementById('asistencia-curso-id').value;
  const fecha = document.getElementById('input-asistencia-fecha').value;
  const checked = document.querySelectorAll('#asistencia-tbody input[type="radio"]:checked');
  const registros = [];

  checked.forEach(r => {
    const estId = r.name.replace('asist_', '');
    registros.push({ estudianteId: estId, estado: r.value });
  });

  if (registros.length === 0) {
    showToast('No hay estudiantes para registrar', 'warning');
    return;
  }

  try {
    await apiFetch(`/api/cursos/${cursoId}/asistencia`, {
      method: 'POST',
      body: JSON.stringify({ fecha, registros }),
    });
    closeModal('modal-asistencia');
    showToast('✅ Asistencia guardada correctamente en la base de datos', 'success');

    // Verificar inmediatamente si algún alumno quedó con menos del 70% de asistencia
    try {
      const resumen = await apiFetch(`/api/cursos/${cursoId}/asistencia/resumen`);
      if (resumen && Array.isArray(resumen.estudiantes)) {
        App.currentAsistenciaData = resumen;
        const bajos = resumen.estudiantes.filter(e => e.totalClases > 0 && e.porcentaje < 70);
        if (bajos.length > 0) {
          setTimeout(() => {
            poblarModalPreceptor(cursoId, bajos);
            openModal('modal-aviso-preceptor');
            showToast(`⚠️ ATENCIÓN: ${bajos.length} alumno(s) tienen menos del 70% de asistencia. Se abrió el comunicado para Preceptoría.`, 'warning');
          }, 350);
          return;
        }
      }
    } catch (e) {
      console.warn('Verificación de preceptoría:', e);
    }

    // Si el modal de historial está abierto, refrescarlo de inmediato
    const modalHist = document.getElementById('modal-historial-asistencia');
    if (modalHist && !modalHist.classList.contains('hidden')) {
      await loadHistorialResumen(cursoId);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// HISTORIAL DE ASISTENCIA DÍA POR DÍA (TUPROFEWEB)
// =============================================

let cicloActivo = 'todo';

async function showHistorialAsistenciaModal(cursoId) {
  openModal('modal-historial-asistencia');
  document.getElementById('historial-curso-id').value = cursoId;

  // Encontrar nombre del curso para el título
  let nombreCurso = '';
  if (App.cursos && App.cursos.length > 0) {
    const cursoObj = App.cursos.find(c => String(c.id) === String(cursoId));
    if (cursoObj) {
      nombreCurso = `${cursoObj.anio || ''}° ${cursoObj.division || ''} ${cursoObj.nombre || ''}`.trim();
    }
  }
  const spanNombre = document.getElementById('historial-curso-nombre');
  if (spanNombre) spanNombre.textContent = nombreCurso || `Curso #${cursoId}`;

  // Resetear filtros de ciclo y fecha
  cicloActivo = 'todo';
  const btn1 = document.getElementById('btn-ciclo-1');
  const btn2 = document.getElementById('btn-ciclo-2');
  const btnTodo = document.getElementById('btn-ciclo-todo');
  const ind = document.getElementById('indicador-ciclo-activo');
  if (btn1) btn1.className = 'btn-action btn-act-gray';
  if (btn2) btn2.className = 'btn-action btn-act-gray';
  if (btnTodo) btnTodo.className = 'btn-action btn-act-blue-bold';
  if (ind) ind.textContent = 'Mostrando: Todo el Año (Completo)';

  const inputDesde = document.getElementById('filtro-matriz-desde');
  const inputHasta = document.getElementById('filtro-matriz-hasta');
  if (inputDesde) inputDesde.value = '';
  if (inputHasta) inputHasta.value = '';

  await loadHistorialMatriz(cursoId);
}

function filtrarPorCiclo(ciclo) {
  const cursoId = document.getElementById('historial-curso-id').value;
  cicloActivo = ciclo;

  const btn1 = document.getElementById('btn-ciclo-1');
  const btn2 = document.getElementById('btn-ciclo-2');
  const btnTodo = document.getElementById('btn-ciclo-todo');
  const ind = document.getElementById('indicador-ciclo-activo');
  const inputDesde = document.getElementById('filtro-matriz-desde');
  const inputHasta = document.getElementById('filtro-matriz-hasta');

  if (btn1) btn1.className = 'btn-action btn-act-gray';
  if (btn2) btn2.className = 'btn-action btn-act-gray';
  if (btnTodo) btnTodo.className = 'btn-action btn-act-gray';

  let desde = '';
  let hasta = '';

  if (String(ciclo) === '1') {
    if (btn1) btn1.className = 'btn-action btn-act-blue-bold';
    desde = '2026-03-01';
    hasta = '2026-08-15';
    if (ind) ind.textContent = 'Mostrando: 1° Ciclo (Marzo a Agosto)';
    showToast('Filtrando 1° Ciclo (Marzo a Agosto)', 'info');
  } else if (String(ciclo) === '2') {
    if (btn2) btn2.className = 'btn-action btn-act-blue-bold';
    desde = '2026-08-16';
    hasta = '2026-12-31';
    if (ind) ind.textContent = 'Mostrando: 2° Ciclo (Agosto a Diciembre)';
    showToast('Filtrando 2° Ciclo (Agosto a Diciembre)', 'info');
  } else {
    if (btnTodo) btnTodo.className = 'btn-action btn-act-blue-bold';
    desde = '';
    hasta = '';
    if (ind) ind.textContent = 'Mostrando: Todo el Año (Completo)';
    showToast('Mostrando todo el ciclo lectivo completo', 'info');
  }

  if (inputDesde) inputDesde.value = desde;
  if (inputHasta) inputHasta.value = hasta;

  loadHistorialMatriz(cursoId, desde, hasta);
}

function filtrarMatrizPorFechas() {
  const cursoId = document.getElementById('historial-curso-id').value;
  const desde = document.getElementById('filtro-matriz-desde').value;
  const hasta = document.getElementById('filtro-matriz-hasta').value;
  cicloActivo = 'personalizado';
  const ind = document.getElementById('indicador-ciclo-activo');
  if (ind) ind.textContent = `Filtro personalizado: ${desde || 'Inicio'} al ${hasta || 'Fin'}`;
  loadHistorialMatriz(cursoId, desde, hasta);
}

function limpiarFiltroMatriz() {
  filtrarPorCiclo('todo');
}

async function loadHistorialMatriz(cursoId, desde = '', hasta = '') {
  if (!cursoId) cursoId = document.getElementById('historial-curso-id').value;
  const thead = document.getElementById('matriz-thead');
  const tbody = document.getElementById('matriz-tbody');
  if (!thead || !tbody) return;

  tbody.innerHTML = '<tr><td colspan="18" class="text-center" style="padding:22px;color:var(--text-muted);">Cargando historial de asistencia...</td></tr>';

  try {
    let url = `/api/cursos/${cursoId}/asistencia/matriz`;
    const params = [];
    if (desde) params.push(`desde=${encodeURIComponent(desde)}`);
    if (hasta) params.push(`hasta=${encodeURIComponent(hasta)}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const data = await apiFetch(url);
    App.currentAsistenciaData = data;
    const fechas = data.fechas || [];
    const estudiantes = data.estudiantes || [];

    // Métricas del pie (Total de Asistencias y Porcentaje General)
    const footerTot = document.getElementById('footer-total-asistencias');
    if (footerTot) footerTot.textContent = data.totalClases || 0;
    const footerPct = document.getElementById('footer-pct-general');
    if (footerPct) footerPct.textContent = `${data.porcentajeGeneral || 0}%`;

    // Alerta de Preceptoría si hay alumnos con menos del 70%
    const estudiantesBajos = estudiantes.filter(e => e.totalClases > 0 && e.porcentaje < 70);
    const cartel = document.getElementById('cartel-alerta-preceptoria');
    const cartelTexto = document.getElementById('cartel-alerta-texto');
    if (cartel) {
      if (estudiantesBajos.length > 0) {
        cartel.classList.remove('hidden');
        if (cartelTexto) {
          const listado = estudiantesBajos.map(e => `${e.apellido} (${e.porcentaje}% - ${e.ausentes} faltas)`).join(', ');
          cartelTexto.innerHTML = `Los siguientes alumnos tienen menos del <b>70%</b> de asistencia: <b>${listado}</b>.`;
        }
      } else {
        cartel.classList.add('hidden');
      }
    }

    if (estudiantes.length === 0) {
      thead.innerHTML = '<tr><th>Estudiante</th></tr>';
      tbody.innerHTML = '<tr><td class="text-center" style="padding:24px;">No hay alumnos registrados en este curso.</td></tr>';
      return;
    }

    // Cabecera idéntica a TuProfeWeb: Estudiante | DD-MM-YYYY | ... | Total Pres. | Total Ausentes | Porcentaje
    let thFechas = fechas.map(f => {
      const p = f.split('-');
      const ddmmyyyy = p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : f;
      return `<th style="text-align:center;min-width:76px;padding:8px 3px;" title="Fecha de clase: ${ddmmyyyy}">${ddmmyyyy}</th>`;
    }).join('');

    if (fechas.length === 0) {
      thFechas = '<th style="text-align:center;color:#adb5bd;padding:8px;">Sin clases en el período</th>';
    }

    thead.innerHTML = `
      <tr>
        <th style="min-width:180px;text-align:left;padding:8px 10px;">Estudiante</th>
        ${thFechas}
        <th style="text-align:center;min-width:85px;padding:8px 6px;">Total Pres.</th>
        <th style="text-align:center;min-width:95px;padding:8px 6px;">Total Ausentes</th>
        <th style="text-align:center;min-width:85px;padding:8px 6px;">Porcentaje</th>
      </tr>
    `;

    // Filas con cada estudiante y sus días
    tbody.innerHTML = estudiantes.map(e => {
      let tdDias = '';
      if (fechas.length === 0) {
        tdDias = '<td style="text-align:center;color:var(--text-muted);">-</td>';
      } else {
        tdDias = fechas.map(f => {
          const estado = e.dias[f];
          let letra = '-';
          let btnClass = 'btn-celda-vacio';
          let title = 'Sin registro';

          if (estado === 'presente') {
            letra = 'P';
            btnClass = 'btn-celda-p';
            title = 'Presente';
          } else if (estado === 'ausente') {
            letra = 'A';
            btnClass = 'btn-celda-a';
            title = 'Ausente / Falta';
          } else if (estado === 'tarde') {
            letra = 'T';
            btnClass = 'btn-celda-t';
            title = 'Tarde (1/2 Falta)';
          }

          return `
            <td style="text-align:center;padding:5px 2px;">
              <button type="button" 
                      class="${btnClass}"
                      title="${e.apellido}: ${title} el ${f}. Clic para cambiar"
                      onclick="ciclarEstadoMatriz('${cursoId}', '${e.id}', '${f}', '${estado || 'vacio'}')">
                ${letra}
              </button>
            </td>
          `;
        }).join('');
      }

      const pct = e.porcentaje;
      const pctColor = pct >= 80 ? 'var(--c-green)' : (pct >= 70 ? 'var(--c-blue)' : 'var(--c-red)');
      const esMenor70 = (e.totalClases > 0 && pct < 70);

      return `
        <tr>
          <td style="padding:6px 10px;white-space:nowrap;">
            <strong style="text-transform:uppercase;">${e.apellido}</strong>, ${e.nombre}
            ${esMenor70 ? '<span title="Asistencia menor al 70%" style="margin-left:4px;cursor:pointer;" onclick="abrirResumenPreceptoria()">⚠️</span>' : ''}
          </td>
          ${tdDias}
          <td style="text-align:center;font-weight:700;font-size:0.92rem;">${e.presentes}</td>
          <td style="text-align:center;font-weight:700;font-size:0.92rem;color:var(--c-red);">${e.ausentes}</td>
          <td style="text-align:center;font-weight:800;font-size:0.92rem;color:${pctColor};">${pct}%</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="18" style="color:var(--c-red);text-align:center;padding:16px;">${err.message}</td></tr>`;
  }
}

async function ciclarEstadoMatriz(cursoId, estudianteId, fecha, estadoActual) {
  // Cicla: presente -> ausente -> tarde -> presente
  let proximo = 'presente';
  if (estadoActual === 'presente') proximo = 'ausente';
  else if (estadoActual === 'ausente') proximo = 'tarde';
  else if (estadoActual === 'tarde') proximo = 'presente';
  else proximo = 'presente';

  try {
    await apiFetch(`/api/cursos/${cursoId}/asistencia/individual`, {
      method: 'PUT',
      body: JSON.stringify({ estudianteId, fecha, estado: proximo })
    });
    showToast(`Asistencia cambiada a ${proximo.toUpperCase()} para el día ${fecha}`, 'success');

    // Recargar con los filtros actuales
    const desde = document.getElementById('filtro-matriz-desde').value;
    const hasta = document.getElementById('filtro-matriz-hasta').value;
    await loadHistorialMatriz(cursoId, desde, hasta);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function abrirAgregarDiaMatriz() {
  const cursoId = document.getElementById('historial-curso-id').value;
  closeModal('modal-historial-asistencia');
  showAsistenciaModal(cursoId);
}

function mostrarInfoHistorial() {
  alert('ℹ️ Historial de Asistencia:\n\n- Muestra cada una de las fechas de clases dictadas.\n- P = Presente (verde), A = Ausente (rojo), T = Tarde (amarillo).\n- Haz clic sobre cualquier letra P o A para corregir la asistencia de ese alumno al instante.\n- Usa los filtros de fecha de inicio y fin para ver un trimestre o período específico.');
}

function irACalificacionesDesdeHistorial() {
  const cursoId = document.getElementById('historial-curso-id').value;
  closeModal('modal-historial-asistencia');
  showCalificacionesAnualesModal(cursoId);
}

async function confirmarEliminarHistorialCompleto() {
  const cursoId = document.getElementById('historial-curso-id').value;
  if (!cursoId) return;

  const confirmar = confirm('⚠️ ¿Está completamente seguro de que desea eliminar TODO el historial de asistencias y calificaciones de este curso?\n\nEsta acción no se puede deshacer.');
  if (!confirmar) return;

  try {
    const res = await apiFetch(`/api/cursos/${cursoId}/historial-completo`, { method: 'DELETE' });
    showToast(res.mensaje || 'Historial eliminado', 'success');
    await loadHistorialMatriz(cursoId);
    if (typeof loadCursos === 'function') loadCursos();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// FORMATEAR / REINICIAR FALTAS A CERO
// =============================================

async function abrirModalFormatearFaltas(cursoId) {
  if (!cursoId) cursoId = document.getElementById('historial-curso-id').value;
  if (!cursoId && App.selectedCurso) cursoId = App.selectedCurso.id || App.selectedCurso._id;
  if (!cursoId) return showToast('Seleccione un curso primero', 'warning');

  document.getElementById('formatear-curso-id').value = cursoId;

  // Encontrar nombre del curso
  let nombreCurso = '';
  if (App.cursos && App.cursos.length > 0) {
    const c = App.cursos.find(item => String(item.id) === String(cursoId));
    if (c) nombreCurso = `${c.anio || ''}° ${c.division || ''} ${c.nombre || ''}`.trim();
  }
  const span = document.getElementById('formatear-curso-nombre');
  if (span) span.textContent = nombreCurso || `Curso #${cursoId}`;

  // Resetear selección a 'todo'
  seleccionarOpcionFormateo('todo');

  // Cargar las fechas disponibles por si el usuario quiere borrar una fecha específica
  try {
    const data = await apiFetch(`/api/cursos/${cursoId}/asistencia/matriz`);
    const select = document.getElementById('select-fecha-formatear');
    if (select && data.fechas) {
      if (data.fechas.length === 0) {
        select.innerHTML = '<option value="">No hay clases registradas aún</option>';
      } else {
        select.innerHTML = data.fechas.map(f => {
          const p = f.split('-');
          const ddmmyyyy = p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : f;
          return `<option value="${f}">${ddmmyyyy} (${f})</option>`;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Error cargando fechas para formatear:', err);
  }

  openModal('modal-formatear-faltas');
}

function seleccionarOpcionFormateo(opcion) {
  const radioTodo = document.getElementById('radio-opt-todo');
  const radioLimpiar = document.getElementById('radio-opt-limpiar');
  const radioFecha = document.getElementById('radio-opt-fecha');
  const cardTodo = document.getElementById('card-opcion-todo');
  const cardLimpiar = document.getElementById('card-opcion-limpiar');
  const cardFecha = document.getElementById('card-opcion-fecha');
  const contFecha = document.getElementById('contenedor-select-fecha-borrar');

  if (opcion === 'todo') {
    if (radioTodo) radioTodo.checked = true;
    if (cardTodo) { cardTodo.style.background = 'rgba(220,53,69,0.06)'; cardTodo.style.border = '2px solid #dc3545'; }
    if (cardLimpiar) { cardLimpiar.style.background = 'var(--bg-main)'; cardLimpiar.style.border = '1px solid var(--border-light)'; }
    if (cardFecha) { cardFecha.style.background = 'var(--bg-main)'; cardFecha.style.border = '1px solid var(--border-light)'; }
    if (contFecha) contFecha.classList.add('hidden');
  } else if (opcion === 'limpiar') {
    if (radioLimpiar) radioLimpiar.checked = true;
    if (cardTodo) { cardTodo.style.background = 'var(--bg-main)'; cardTodo.style.border = '1px solid var(--border-light)'; }
    if (cardLimpiar) { cardLimpiar.style.background = 'rgba(25,135,84,0.08)'; cardLimpiar.style.border = '2px solid var(--c-green)'; }
    if (cardFecha) { cardFecha.style.background = 'var(--bg-main)'; cardFecha.style.border = '1px solid var(--border-light)'; }
    if (contFecha) contFecha.classList.add('hidden');
  } else if (opcion === 'fecha') {
    if (radioFecha) radioFecha.checked = true;
    if (cardTodo) { cardTodo.style.background = 'var(--bg-main)'; cardTodo.style.border = '1px solid var(--border-light)'; }
    if (cardLimpiar) { cardLimpiar.style.background = 'var(--bg-main)'; cardLimpiar.style.border = '1px solid var(--border-light)'; }
    if (cardFecha) { cardFecha.style.background = 'rgba(13,110,253,0.08)'; cardFecha.style.border = '2px solid var(--c-blue)'; }
    if (contFecha) contFecha.classList.remove('hidden');
  }
}

async function ejecutarFormateoFaltas() {
  const cursoId = document.getElementById('formatear-curso-id').value;
  if (!cursoId) return;

  const opcion = document.querySelector('input[name="radio-formateo"]:checked')?.value || 'todo';

  if (opcion === 'todo') {
    const confirmar = confirm('⚠️ ¿Confirmas reiniciar TODAS las asistencias de este curso a CERO?\n\n- Se borrarán todas las fechas de clases.\n- El total de clases volverá a 0.\n- Los alumnos NO se borrarán.');
    if (!confirmar) return;

    try {
      const res = await apiFetch(`/api/cursos/${cursoId}/asistencia/reset`, { method: 'DELETE' });
      showToast(res.mensaje || 'Historial reiniciado a cero correctamente', 'success');
      closeModal('modal-formatear-faltas');

      // Si el modal de historial está abierto, refrescarlo
      await loadHistorialMatriz(cursoId);
      if (typeof loadCursos === 'function') loadCursos();
    } catch (err) {
      showToast(err.message, 'error');
    }

  } else if (opcion === 'limpiar') {
    const confirmar = confirm('¿Confirmas pasar todas las faltas a PRESENTE para este curso (100% de asistencia)?');
    if (!confirmar) return;

    try {
      const res = await apiFetch(`/api/cursos/${cursoId}/asistencia/limpiar-faltas`, { method: 'PUT' });
      showToast(res.mensaje || 'Faltas convertidas a presente', 'success');
      closeModal('modal-formatear-faltas');

      await loadHistorialMatriz(cursoId);
      if (typeof loadCursos === 'function') loadCursos();
    } catch (err) {
      showToast(err.message, 'error');
    }

  } else if (opcion === 'fecha') {
    const fecha = document.getElementById('select-fecha-formatear').value;
    if (!fecha) return showToast('Seleccione una fecha válida para borrar', 'warning');

    const confirmar = confirm(`¿Confirmas borrar la lista de asistencia del día ${fecha}?`);
    if (!confirmar) return;

    try {
      const res = await apiFetch(`/api/cursos/${cursoId}/asistencia/fecha`, {
        method: 'DELETE',
        body: JSON.stringify({ fecha })
      });
      showToast(res.mensaje || `Fecha ${fecha} eliminada`, 'success');
      closeModal('modal-formatear-faltas');

      await loadHistorialMatriz(cursoId);
      if (typeof loadCursos === 'function') loadCursos();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

async function guardarClasesDictadas() {
  const cursoId = document.getElementById('historial-curso-id').value;
  const input = document.getElementById('input-clases-dictadas-num');
  if (!cursoId || !input) return;

  const val = input.value.trim();
  const clases_dictadas = val === '' ? null : parseInt(val);

  try {
    const res = await apiFetch(`/api/cursos/${cursoId}/clases-dictadas`, {
      method: 'PUT',
      body: JSON.stringify({ clases_dictadas })
    });
    showToast(res.mensaje || 'Total de clases dictadas actualizado', 'success');
    await loadHistorialResumen(cursoId);
    await loadHistorialMatriz(cursoId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadHistorialDetalle() {
  const cursoId = document.getElementById('historial-curso-id').value;
  const desde = document.getElementById('input-historial-desde').value;
  const hasta = document.getElementById('input-historial-hasta').value;
  const tbody = document.getElementById('historial-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:16px;">Cargando registros...</td></tr>';

  try {
    const data = await apiFetch(`/api/cursos/${cursoId}/asistencia?desde=${desde}&hasta=${hasta}`);
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:16px;">No se registraron asistencias en ese rango de fechas.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(r => {
      const color = r.estado === 'presente' ? 'var(--c-green)' : (r.estado === 'ausente' ? 'var(--c-red)' : (r.estado === 'tarde' ? 'var(--c-yellow-dark)' : 'var(--c-blue)'));
      return `
        <tr data-estudiante="${(r.apellido || '').toLowerCase()}">
          <td><strong>${r.fecha}</strong></td>
          <td><strong>${r.apellido || ''}</strong>, ${r.nombre || ''}</td>
          <td>
            <select class="form-select" style="width:auto;padding:3px 8px;font-weight:700;font-size:0.83rem;color:${color};background:var(--bg-main);" onchange="cambiarEstadoIndividualDirecto('${cursoId}', '${r.estudiante_id}', '${r.fecha}', this.value)">
              <option value="presente" ${r.estado === 'presente' ? 'selected' : ''}>✅ Presente</option>
              <option value="ausente" ${r.estado === 'ausente' ? 'selected' : ''}>❌ Ausente (Falta)</option>
              <option value="tarde" ${r.estado === 'tarde' ? 'selected' : ''}>⏰ Tarde (1/2 Falta)</option>
              <option value="justificado" ${r.estado === 'justificado' ? 'selected' : ''}>📝 Justificado</option>
            </select>
          </td>
          <td style="text-align:center;">
            <button type="button" class="btn-action btn-act-blue" style="padding:3px 8px;font-size:0.8rem;" onclick="corregirFechaAsistencia('${cursoId}', '${r.fecha}')">
              ✏️ Modificar Todo el Día
            </button>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--c-red);text-align:center;">${err.message}</td></tr>`;
  }
}

async function cambiarEstadoIndividualDirecto(cursoId, estudianteId, fecha, nuevoEstado) {
  try {
    await apiFetch(`/api/cursos/${cursoId}/asistencia/individual`, {
      method: 'PUT',
      body: JSON.stringify({ estudianteId, fecha, estado: nuevoEstado })
    });
    showToast(`✅ Asistencia cambiada a ${nuevoEstado.toUpperCase()} para el día ${fecha}`, 'success');

    // Recalcular métricas de resumen en segundo plano para actualizar los totales y %
    const resumen = await apiFetch(`/api/cursos/${cursoId}/asistencia/resumen`);
    App.currentAsistenciaData = resumen;
    document.getElementById('metric-total-clases').textContent = resumen.totalClases || 0;
    document.getElementById('metric-total-presentes').textContent = resumen.sumaPresentes || 0;
    document.getElementById('metric-total-ausentes').textContent = resumen.sumaAusentes || 0;
    document.getElementById('metric-pct-global').textContent = `${resumen.porcentajeGlobal || 0}%`;
    renderTablaResumenAsistencia();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function filtrarHistorialPorEstudiante(apellido) {
  cambiarVistaHistorial('detalle');
  setTimeout(() => {
    const filas = document.querySelectorAll('#historial-tbody tr');
    let encontrada = false;
    filas.forEach(f => {
      const nom = f.getAttribute('data-estudiante') || '';
      if (nom.includes(apellido.toLowerCase())) {
        f.style.background = 'rgba(13,110,253,0.12)';
        if (!encontrada) {
          f.scrollIntoView({ behavior: 'smooth', block: 'center' });
          encontrada = true;
        }
      } else {
        f.style.background = '';
      }
    });
    showToast(`Mostrando fechas de ${apellido}. Puedes cambiar su estado directamente en el selector.`, 'info');
  }, 250);
}

function corregirFechaAsistencia(cursoId, fecha) {
  closeModal('modal-historial-asistencia');
  showAsistenciaModal(cursoId, fecha);
}

async function quitarEstudianteCurso(cursoId, estudianteId, nombreCompleto) {
  if (!confirm(`¿Deseas quitar a ${nombreCompleto} de este curso?`)) return;
  try {
    await apiFetch(`/api/estudiantes/${estudianteId}`, { method: 'DELETE' });
    showToast(`Estudiante ${nombreCompleto} eliminado`, 'success');
    await loadHistorialResumen(cursoId);
    if (App.selectedColegio) {
      await loadCursos(App.selectedColegio.id || App.selectedColegio._id);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// ALERTA Y COMUNICACIÓN CON PRECEPTORÍA (< 70%)
// =============================================
function abrirResumenPreceptoria() {
  if (!App.currentAsistenciaData) return;
  const cursoId = document.getElementById('historial-curso-id').value;
  const estudiantes = App.currentAsistenciaData.estudiantes || [];
  const estudiantesBajos = estudiantes.filter(e => e.totalClases > 0 && e.porcentaje < 70);

  if (estudiantesBajos.length === 0) {
    showToast('No hay estudiantes con menos del 70% de asistencia en este curso', 'info');
    return;
  }

  poblarModalPreceptor(cursoId, estudiantesBajos);
  openModal('modal-aviso-preceptor');
}

function abrirAvisoPreceptorIndividual(cursoId, estudianteId) {
  if (!App.currentAsistenciaData) return;
  const estudiantes = App.currentAsistenciaData.estudiantes || [];
  const est = estudiantes.find(e => String(e.id) === String(estudianteId));
  if (!est) return;

  poblarModalPreceptor(cursoId, [est]);
  openModal('modal-aviso-preceptor');
}

function poblarModalPreceptor(cursoId, listaEstudiantes) {
  document.getElementById('preceptor-curso-id').value = cursoId;
  const tbody = document.getElementById('preceptor-alumnos-tbody');
  
  if (tbody) {
    tbody.innerHTML = listaEstudiantes.map(e => `
      <tr>
        <td><strong>${e.apellido}</strong>, ${e.nombre}</td>
        <td style="text-align:center;font-weight:600;">${e.totalClases}</td>
        <td style="text-align:center;font-weight:700;color:var(--c-red);">${e.ausentes}</td>
        <td style="text-align:center;font-weight:800;color:var(--c-red);">${e.porcentaje}%</td>
        <td style="text-align:center;">
          <span style="background:var(--c-red);color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:800;">&lt; 70% INASISTENCIAS</span>
        </td>
      </tr>
    `).join('');
  }

  const cursoNombre = App.selectedCurso ? App.selectedCurso.nombre : 'Curso';
  const colegioNombre = App.selectedColegio ? App.selectedColegio.nombre : 'Escuela';
  const hoyStr = new Date().toLocaleDateString('es-AR');

  const detalleAlumnos = listaEstudiantes.map(e => 
    `• ${e.apellido}, ${e.nombre} (DNI: ${e.dni || 'S/D'}) | Clases: ${e.totalClases} | Faltas: ${e.ausentes} | Tardes: ${e.tardes} | Asistencia: ${e.porcentaje}%`
  ).join('\n');

  const texto = 
`INFORME PARA PRECEPTORÍA: ALERTA DE INASISTENCIAS CRÍTICAS (< 70%)
Fecha: ${hoyStr}
Institución: ${colegioNombre}
Curso: ${cursoNombre}
Docente: Prof. Facundo Casciano

Estimado/a Preceptor/a:
Por medio de la presente, cumplo en notificar que los siguientes estudiantes se encuentran por debajo del 70% de asistencia obligatoria requerida:

${detalleAlumnos}

Solicito su pronta intervención para citar a los adultos responsables (padres/tutores) y formalizar el acta de apercibimiento por inasistencias reiteradas.

Atentamente,
Prof. Facundo Casciano`;

  const txtArea = document.getElementById('preceptor-mensaje-texto');
  if (txtArea) {
    txtArea.value = texto;
  }
}

function copiarMensajePreceptor() {
  const textarea = document.getElementById('preceptor-mensaje-texto');
  if (!textarea) return;
  textarea.select();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textarea.value).then(() => {
      showToast('📋 Comunicado para el Preceptor copiado al portapapeles', 'success');
    }).catch(() => {
      document.execCommand('copy');
      showToast('📋 Comunicado copiado al portapapeles', 'success');
    });
  } else {
    document.execCommand('copy');
    showToast('📋 Comunicado copiado al portapapeles', 'success');
  }
}

function compartirWhatsAppPreceptor() {
  const texto = document.getElementById('preceptor-mensaje-texto').value;
  if (!texto) return;
  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
}

async function guardarNotificacionPreceptor() {
  const cursoId = document.getElementById('preceptor-curso-id').value;
  const texto = document.getElementById('preceptor-mensaje-texto').value;
  if (!cursoId || !texto) return;

  try {
    await apiFetch('/api/notificaciones', {
      method: 'POST',
      body: JSON.stringify({
        curso_id: cursoId,
        mensaje: texto
      })
    });
    showToast('💾 Alerta guardada en las Notificaciones Internas', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// CALIFICACIONES DIARIAS Y ANUALES
// =============================================
async function showCalificacionesDiariasModal(cursoId) {
  openModal('modal-calif-diarias');
  document.getElementById('calif-diarias-curso-id').value = cursoId;
  document.getElementById('input-calif-diarias-fecha').value = todayStr();
  document.getElementById('input-calif-diarias-tema').value = '';

  const tbody = document.getElementById('calif-diarias-tbody');
  tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding:20px;">Cargando estudiantes...</td></tr>';

  try {
    const estudiantes = await apiFetch(`/api/cursos/${cursoId}/estudiantes`);
    if (!estudiantes || estudiantes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding:20px;">No hay estudiantes cargados en este curso.</td></tr>';
      return;
    }
    tbody.innerHTML = estudiantes.map((est, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${est.apellido}</strong>, ${est.nombre}</td>
        <td>
          <input type="number" class="form-input" min="1" max="10" step="0.5" data-est-id="${est.id || est._id}" placeholder="Nota 1-10" style="width:105px;font-weight:700;">
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:var(--c-red);">${err.message}</td></tr>`;
  }
}

async function saveCalifDiarias() {
  const cursoId = document.getElementById('calif-diarias-curso-id').value;
  const fecha = document.getElementById('input-calif-diarias-fecha').value;
  const tema = document.getElementById('input-calif-diarias-tema').value.trim();
  const inputs = document.querySelectorAll('#calif-diarias-tbody input[type="number"]');
  const calificaciones = [];

  inputs.forEach(input => {
    if (input.value) {
      calificaciones.push({
        estudianteId: input.dataset.estId,
        nota: parseFloat(input.value),
      });
    }
  });

  if (calificaciones.length === 0) {
    showToast('Ingrese al menos una calificación para guardar', 'warning');
    return;
  }

  try {
    await apiFetch(`/api/cursos/${cursoId}/calificaciones/diarias`, {
      method: 'POST',
      body: JSON.stringify({ fecha, tema, calificaciones }),
    });
    closeModal('modal-calif-diarias');
    showToast('Calificaciones diarias guardadas correctamente', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function showCalificacionesAnualesModal(cursoId) {
  openModal('modal-calif-anuales');
  document.getElementById('calif-anuales-curso-id').value = cursoId;
  const tbody = document.getElementById('calif-anuales-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:20px;">Cargando notas anuales...</td></tr>';

  try {
    const estudiantes = await apiFetch(`/api/cursos/${cursoId}/estudiantes`);
    const califs = await apiFetch(`/api/cursos/${cursoId}/calificaciones/anuales`).catch(() => []);
    const califMap = {};
    (califs || []).forEach(c => { califMap[c.estudianteId] = c; });

    if (!estudiantes || estudiantes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:20px;">No hay estudiantes cargados en este curso.</td></tr>';
      return;
    }

    tbody.innerHTML = estudiantes.map((est, i) => {
      const id = est.id || est._id;
      const c = califMap[id] || {};
      return `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${est.apellido}</strong>, ${est.nombre}</td>
          <td><input type="number" class="form-input" min="1" max="10" step="0.5" data-est-id="${id}" data-trim="1" value="${c.trim1 || ''}" style="width:80px;text-align:center;"></td>
          <td><input type="number" class="form-input" min="1" max="10" step="0.5" data-est-id="${id}" data-trim="2" value="${c.trim2 || ''}" style="width:80px;text-align:center;"></td>
          <td><input type="number" class="form-input" min="1" max="10" step="0.5" data-est-id="${id}" data-trim="3" value="${c.trim3 || ''}" style="width:80px;text-align:center;"></td>
          <td id="prom-${id}" style="font-weight:700;font-size:1rem;text-align:center;">-</td>
          <td id="cond-${id}" style="font-weight:600;font-size:0.85rem;text-align:center;">-</td>
        </tr>`;
    }).join('');

    document.querySelectorAll('#calif-anuales-tbody input').forEach(input => {
      input.addEventListener('input', () => calcPromedioAnual(input.dataset.estId));
    });

    estudiantes.forEach(est => calcPromedioAnual(est.id || est._id));
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--c-red);">${err.message}</td></tr>`;
  }
}

function calcPromedioAnual(estId) {
  const inputs = document.querySelectorAll(`#calif-anuales-tbody input[data-est-id="${estId}"]`);
  let sum = 0, count = 0;
  inputs.forEach(i => {
    if (i.value && !isNaN(parseFloat(i.value))) {
      sum += parseFloat(i.value);
      count++;
    }
  });

  const promEl = document.getElementById(`prom-${estId}`);
  const condEl = document.getElementById(`cond-${estId}`);
  if (!promEl) return;

  if (count > 0) {
    const prom = sum / count;
    promEl.textContent = prom.toFixed(2);
    if (prom >= 7) {
      promEl.style.color = 'var(--c-green)';
      condEl.innerHTML = '<span style="color:var(--c-green);font-weight:700;">APROBADO</span>';
    } else {
      promEl.style.color = 'var(--c-red)';
      condEl.innerHTML = '<span style="color:var(--c-red);font-weight:700;">A RECUPERAR</span>';
    }
  } else {
    promEl.textContent = '-';
    promEl.style.color = '';
    condEl.textContent = '-';
  }
}

async function saveCalifAnuales() {
  const cursoId = document.getElementById('calif-anuales-curso-id').value;
  const inputs = document.querySelectorAll('#calif-anuales-tbody input');
  const calificaciones = {};

  inputs.forEach(input => {
    const estId = input.dataset.estId;
    const trim = input.dataset.trim;
    if (!calificaciones[estId]) calificaciones[estId] = { estudianteId: estId };
    if (input.value) calificaciones[estId][`trim${trim}`] = parseFloat(input.value);
  });

  try {
    await apiFetch(`/api/cursos/${cursoId}/calificaciones/anuales`, {
      method: 'POST',
      body: JSON.stringify({ calificaciones: Object.values(calificaciones) }),
    });
    closeModal('modal-calif-anuales');
    showToast('Calificaciones anuales guardadas con éxito', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// HORARIO
// =============================================
async function showHorarioModal() {
  openModal('modal-horario');
  const grid = document.getElementById('horario-grid');
  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const horas = ['07:30', '08:30', '09:30', '10:45', '11:45', '13:30', '14:30', '15:30', '16:45', '17:45'];

  let html = '<div class="schedule-cell header">HORA</div>';
  dias.forEach(d => { html += `<div class="schedule-cell header">${d}</div>`; });

  horas.forEach(hora => {
    html += `<div class="schedule-cell time-col">${hora}</div>`;
    dias.forEach(dia => {
      html += `<div class="schedule-cell editable" data-dia="${dia}" data-hora="${hora}" onclick="editHorarioCell(this)" title="Clic para escribir materia"></div>`;
    });
  });

  grid.innerHTML = html;

  try {
    const data = await apiFetch('/api/horario');
    if (data && Array.isArray(data)) {
      data.forEach(item => {
        const cell = grid.querySelector(`.schedule-cell[data-dia="${item.dia}"][data-hora="${item.hora}"]`);
        if (cell) {
          cell.textContent = item.materia || '';
          cell.style.backgroundColor = 'rgba(13, 110, 253, 0.12)';
          cell.style.fontWeight = '600';
        }
      });
    }
  } catch (err) {}
}

function editHorarioCell(cell) {
  if (cell.querySelector('input')) return;
  const current = cell.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.className = 'form-input';
  input.style.cssText = 'padding:2px 4px;font-size:0.75rem;height:100%;text-align:center;';
  cell.textContent = '';
  cell.appendChild(input);
  input.focus();

  const guardar = async () => {
    const val = input.value.trim();
    cell.textContent = val;
    if (val) {
      cell.style.backgroundColor = 'rgba(13, 110, 253, 0.12)';
      cell.style.fontWeight = '600';
      try {
        await apiFetch('/api/horario', {
          method: 'POST',
          body: JSON.stringify({ dia: cell.dataset.dia, hora: cell.dataset.hora, materia: val }),
        });
      } catch (e) {}
    } else {
      cell.style.backgroundColor = '';
      cell.style.fontWeight = '';
    }
  };

  input.addEventListener('blur', guardar);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
}

async function saveHorario() {
  const cells = document.querySelectorAll('#horario-grid .schedule-cell.editable');
  const horario = [];
  cells.forEach(cell => {
    if (cell.textContent.trim()) {
      horario.push({
        dia: cell.dataset.dia,
        hora: cell.dataset.hora,
        materia: cell.textContent.trim(),
      });
    }
  });

  try {
    await apiFetch('/api/horario', {
      method: 'PUT',
      body: JSON.stringify({ horario }),
    });
    closeModal('modal-horario');
    showToast('Horario semanal guardado correctamente', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// CALENDARIO ESCOLAR CON FERIADOS NACIONALES ARGENTINOS
// =============================================

// Lista oficial de Feriados Nacionales de la República Argentina y Asuetos Escolares
const FERIADOS_ARGENTINA = {
  '01-01': { nombre: 'Año Nuevo', tipo: 'feriado' },
  '02-16': { nombre: 'Carnaval (Lunes)', tipo: 'feriado' },
  '02-17': { nombre: 'Carnaval (Martes)', tipo: 'feriado' },
  '03-24': { nombre: 'Día de la Memoria por la Verdad y la Justicia', tipo: 'feriado' },
  '04-02': { nombre: 'Día del Veterano y de los Caídos en Malvinas', tipo: 'feriado' },
  '04-03': { nombre: 'Viernes Santo', tipo: 'feriado' },
  '05-01': { nombre: 'Día del Trabajador', tipo: 'feriado' },
  '05-25': { nombre: 'Día de la Revolución de Mayo', tipo: 'feriado' },
  '06-17': { nombre: 'Paso a la Inmortalidad del Gral. Güemes', tipo: 'feriado' },
  '06-20': { nombre: 'Día de la Bandera (Gral. Manuel Belgrano)', tipo: 'feriado' },
  '07-09': { nombre: 'Día de la Independencia', tipo: 'feriado' },
  '08-17': { nombre: 'Paso a la Inmortalidad del Gral. San Martín', tipo: 'feriado' },
  '09-11': { nombre: 'Día del Maestro (Asueto Escolar)', tipo: 'asueto' },
  '09-21': { nombre: 'Día del Estudiante (Asueto Escolar)', tipo: 'asueto' },
  '10-12': { nombre: 'Día del Respeto a la Diversidad Cultural', tipo: 'feriado' },
  '11-20': { nombre: 'Día de la Soberanía Nacional', tipo: 'feriado' },
  '12-08': { nombre: 'Inmaculada Concepción de María', tipo: 'feriado' },
  '12-25': { nombre: 'Navidad', tipo: 'feriado' },
};

async function showCalendarioModal() {
  openModal('modal-calendario');
  await loadCalendarEvents();
  renderCalendar();
}

async function loadCalendarEvents() {
  try {
    const data = await apiFetch(`/api/calendario/eventos?year=${App.calendarYear}&month=${App.calendarMonth + 1}`);
    App.calendarEvents = data || [];
  } catch {
    App.calendarEvents = [
      { fecha: `${App.calendarYear}-11-05`, titulo: 'Entrega Planilla 3° Trim' },
      { fecha: `${App.calendarYear}-11-12`, titulo: 'Examen Final Analógica' },
    ];
  }
}

function renderCalendar() {
  const container = document.getElementById('calendar-body');
  const titleEl = document.getElementById('calendar-title');
  if (!container || !titleEl) return;

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  titleEl.textContent = `${meses[App.calendarMonth]} ${App.calendarYear}`;

  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  let html = diasSemana.map(d => `<div class="cal-header-cell">${d}</div>`).join('');

  const firstDay = new Date(App.calendarYear, App.calendarMonth, 1);
  const lastDay = new Date(App.calendarYear, App.calendarMonth + 1, 0);
  const startDow = firstDay.getDay();

  for (let i = 0; i < startDow; i++) {
    html += '<div class="cal-day-cell other-month"></div>';
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const mm = String(App.calendarMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${App.calendarYear}-${mm}-${dd}`;
    const mmdd = `${mm}-${dd}`;
    const feriado = FERIADOS_ARGENTINA[mmdd];

    const events = (App.calendarEvents || []).filter(e => e.fecha === dateStr);
    const eventsHtml = events.map(e => `<div class="cal-event-dot">${e.titulo}</div>`).join('');

    let feriadoHtml = '';
    let feriadoClass = '';
    if (feriado) {
      if (feriado.tipo === 'asueto') {
        feriadoClass = ' es-asueto';
        feriadoHtml = `<div class="cal-asueto-badge" title="${feriado.nombre}">🏫 ${feriado.nombre}</div>`;
      } else {
        feriadoClass = ' es-feriado';
        feriadoHtml = `<div class="cal-feriado-badge" title="${feriado.nombre}">🇦🇷 ${feriado.nombre}</div>`;
      }
    }

    html += `
      <div class="cal-day-cell${feriadoClass}" onclick="addCalendarEvent('${dateStr}', '${feriado ? feriado.nombre.replace(/'/g, "\\'") : ''}')">
        <span class="cal-day-number">${day}</span>
        ${feriadoHtml}
        ${eventsHtml}
      </div>`;
  }

  container.innerHTML = html;
}

function toggleListaFeriados() {
  const panel = document.getElementById('panel-lista-feriados');
  const contenido = document.getElementById('lista-feriados-contenido');
  if (!panel || !contenido) return;

  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden');
    const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    contenido.innerHTML = Object.entries(FERIADOS_ARGENTINA).map(([mmdd, fer]) => {
      const [m, d] = mmdd.split('-');
      const mesStr = mesesNombres[parseInt(m) - 1];
      const icono = fer.tipo === 'asueto' ? '🏫' : '🇦🇷';
      const color = fer.tipo === 'asueto' ? '#6f42c1' : '#084298';
      return `
        <div style="background:#fff;border-radius:4px;padding:6px 10px;border-left:3px solid ${color};">
          <b style="color:${color};">${d} ${mesStr}:</b> ${icono} ${fer.nombre}
        </div>
      `;
    }).join('');
  } else {
    panel.classList.add('hidden');
  }
}

function calendarPrev() {
  App.calendarMonth--;
  if (App.calendarMonth < 0) {
    App.calendarMonth = 11;
    App.calendarYear--;
  }
  loadCalendarEvents().then(() => renderCalendar());
}

function calendarNext() {
  App.calendarMonth++;
  if (App.calendarMonth > 11) {
    App.calendarMonth = 0;
    App.calendarYear++;
  }
  loadCalendarEvents().then(() => renderCalendar());
}

function addCalendarEvent(dateStr, feriadoNombre = '') {
  let promptMsg = `Agregar evento para el día ${dateStr}:`;
  if (feriadoNombre) {
    promptMsg = `🇦🇷 Nota: El día ${dateStr} coincide con el feriado "${feriadoNombre}".\n\n¿Deseas registrar un evento o examen institucional? Escribe el título:`;
  }

  const titulo = prompt(promptMsg);
  if (!titulo || !titulo.trim()) return;

  apiFetch('/api/calendario/eventos', {
    method: 'POST',
    body: JSON.stringify({ fecha: dateStr, titulo: titulo.trim() }),
  }).then(() => {
    showToast('Evento registrado en el calendario', 'success');
    loadCalendarEvents().then(() => renderCalendar());
  }).catch(err => showToast(err.message, 'error'));
}

// =============================================
// CONFIGURAR VISIBILIDAD
// =============================================
async function showVisibilidadModal(cursoId) {
  openModal('modal-visibilidad');
  document.getElementById('visibilidad-curso-id').value = cursoId;
  const container = document.getElementById('visibilidad-options');

  const opciones = [
    { key: 'asistencia', label: 'Asistencia visible para tutores' },
    { key: 'calificaciones_diarias', label: 'Calificaciones diarias visibles' },
    { key: 'calificaciones_anuales', label: 'Boletín anual y promedios visibles' },
    { key: 'notificaciones', label: 'Tablero de avisos y notificaciones' },
    { key: 'horario', label: 'Horario semanal visible para estudiantes' },
    { key: 'libro_tema', label: 'Libro de temas visible públicamente' },
  ];

  let config = {};
  try {
    config = await apiFetch(`/api/cursos/${cursoId}/visibilidad`) || {};
  } catch (e) {}

  container.innerHTML = opciones.map(op => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light);">
      <span style="font-weight:500;font-size:0.9rem;">${op.label}</span>
      <input type="checkbox" data-key="${op.key}" ${config[op.key] !== false ? 'checked' : ''} style="transform:scale(1.3);cursor:pointer;">
    </div>
  `).join('');
}

async function saveVisibilidad() {
  const cursoId = document.getElementById('visibilidad-curso-id').value;
  const checkboxes = document.querySelectorAll('#visibilidad-options input[type="checkbox"]');
  const config = {};
  checkboxes.forEach(cb => { config[cb.dataset.key] = cb.checked; });

  try {
    await apiFetch(`/api/cursos/${cursoId}/visibilidad`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    closeModal('modal-visibilidad');
    showToast('Preferencias de visibilidad actualizadas', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// NOTIFICACIONES
// =============================================
async function showNotificacionesModal(cursoId) {
  openModal('modal-notificaciones');
  document.getElementById('notif-curso-id').value = cursoId;
  document.getElementById('input-notif-titulo').value = '';
  document.getElementById('input-notif-mensaje').value = '';

  const listEl = document.getElementById('notificaciones-list');
  listEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;">Cargando avisos...</p>';

  try {
    const data = await apiFetch(`/api/cursos/${cursoId}/notificaciones`);
    if (!data || data.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text-muted);font-style:italic;">No hay notificaciones enviadas para este curso.</p>';
      return;
    }
    listEl.innerHTML = data.map(n => `
      <div style="background:var(--bg-main);border-left:4px solid var(--c-cyan);padding:10px 14px;border-radius:var(--radius-sm);margin-bottom:10px;">
        <strong style="color:var(--text-main);font-size:0.95rem;">${n.titulo}</strong>
        <p style="margin:4px 0;font-size:0.88rem;color:var(--text-muted);">${n.mensaje}</p>
        <small style="color:var(--text-muted);font-size:0.75rem;">${n.fecha || ''}</small>
      </div>
    `).join('');
  } catch (err) {
    listEl.innerHTML = `<p style="color:var(--c-red);">${err.message}</p>`;
  }
}

async function sendNotificacion() {
  const cursoId = document.getElementById('notif-curso-id').value;
  const titulo = document.getElementById('input-notif-titulo').value.trim();
  const mensaje = document.getElementById('input-notif-mensaje').value.trim();

  if (!titulo || !mensaje) {
    showToast('Complete el asunto y el mensaje', 'warning');
    return;
  }

  try {
    await apiFetch(`/api/cursos/${cursoId}/notificaciones`, {
      method: 'POST',
      body: JSON.stringify({ titulo, mensaje }),
    });
    showToast('Notificación publicada con éxito', 'success');
    showNotificacionesModal(cursoId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// LIBRO DE TEMA
// =============================================
async function showLibroTemaModal(cursoId) {
  openModal('modal-libro-tema');
  document.getElementById('libro-curso-id').value = cursoId;
  document.getElementById('input-libro-fecha').value = todayStr();
  document.getElementById('input-libro-tema').value = '';
  document.getElementById('input-libro-obs').value = '';

  const tbody = document.getElementById('libro-tema-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:16px;">Cargando libro de temas...</td></tr>';

  try {
    const data = await apiFetch(`/api/cursos/${cursoId}/libro-tema`);
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:16px;">No hay registros cargados aún.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${r.fecha}</strong></td>
        <td>${r.tema}</td>
        <td>${r.observaciones || '-'}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--c-red);text-align:center;">${err.message}</td></tr>`;
  }
}

async function saveLibroTema() {
  const cursoId = document.getElementById('libro-curso-id').value;
  const fecha = document.getElementById('input-libro-fecha').value;
  const tema = document.getElementById('input-libro-tema').value.trim();
  const observaciones = document.getElementById('input-libro-obs').value.trim();

  if (!tema) {
    showToast('Indique el tema dictado en la clase', 'warning');
    return;
  }

  try {
    await apiFetch(`/api/cursos/${cursoId}/libro-tema`, {
      method: 'POST',
      body: JSON.stringify({ fecha, tema, observaciones }),
    });
    showToast('Registro de clase guardado en el libro de temas', 'success');
    showLibroTemaModal(cursoId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// REPORTES, DESCARGAS EN EXCEL Y PLANILLAS OFICIALES
// =============================================

function showDescargasModal(cursoId) {
  openModal('modal-descargas');
  document.getElementById('descargas-curso-id').value = cursoId;

  let nombreCurso = '';
  if (App.cursos && App.cursos.length > 0) {
    const c = App.cursos.find(item => String(item.id) === String(cursoId));
    if (c) nombreCurso = `${c.anio || ''}° ${c.division || ''} ${c.nombre || ''}`.trim();
  }
  const span = document.getElementById('descargas-curso-nombre');
  if (span) span.textContent = nombreCurso || `Curso #${cursoId}`;
}

// Helper para obtener el ciclo o período seleccionado (1° Ciclo, 2° Ciclo, o Todo el Año)
function obtenerRangoCicloSeleccionado() {
  const modalDescargas = document.getElementById('modal-descargas');
  const modalHistorial = document.getElementById('modal-historial-asistencia');

  let ciclo = 'todo';
  let desde = '';
  let hasta = '';
  let nombreCiclo = 'Ciclo Lectivo Completo (Marzo a Diciembre)';
  let sufijo = 'Anual';

  // Si el modal de descargas está visible o fue usado
  const selCicloDescargas = document.getElementById('select-descargas-ciclo')?.value;
  const modalDescargasAbierto = modalDescargas && modalDescargas.classList.contains('active');
  const modalHistorialAbierto = modalHistorial && modalHistorial.classList.contains('active');

  if (modalDescargasAbierto || (!modalHistorialAbierto && selCicloDescargas)) {
    if (selCicloDescargas === '1') {
      ciclo = '1';
      desde = '2026-03-01';
      hasta = '2026-08-15';
      nombreCiclo = '1° Ciclo (Marzo a Agosto)';
      sufijo = '1erCiclo';
    } else if (selCicloDescargas === '2') {
      ciclo = '2';
      desde = '2026-08-16';
      hasta = '2026-12-31';
      nombreCiclo = '2° Ciclo (Agosto a Diciembre)';
      sufijo = '2doCiclo';
    }
  } else if (modalHistorialAbierto) {
    const fDesde = document.getElementById('filtro-matriz-desde')?.value || '';
    const fHasta = document.getElementById('filtro-matriz-hasta')?.value || '';
    if (cicloActivo === '1' || (fDesde === '2026-03-01' && fHasta === '2026-08-15')) {
      ciclo = '1';
      desde = '2026-03-01';
      hasta = '2026-08-15';
      nombreCiclo = '1° Ciclo (Marzo a Agosto)';
      sufijo = '1erCiclo';
    } else if (cicloActivo === '2' || (fDesde === '2026-08-16' && fHasta === '2026-12-31')) {
      ciclo = '2';
      desde = '2026-08-16';
      hasta = '2026-12-31';
      nombreCiclo = '2° Ciclo (Agosto a Diciembre)';
      sufijo = '2doCiclo';
    } else if (fDesde || fHasta) {
      ciclo = 'personalizado';
      desde = fDesde;
      hasta = fHasta;
      nombreCiclo = `Período personalizado (${desde || 'Inicio'} al ${hasta || 'Fin'})`;
      sufijo = 'Personalizado';
    }
  }

  return { ciclo, desde, hasta, nombreCiclo, sufijo };
}

// Helper universal para descargar archivos CSV compatibles al 100% con Microsoft Excel
function descargarArchivoCSV(contenido, nombreArchivo) {
  // \uFEFF añade el Byte Order Mark (BOM) UTF-8 para que Excel muestre tildes y ñ sin romperse
  const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', nombreArchivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 1. Descarga en Excel de la Planilla Matriz Día por Día (Formato TuProfeWeb)
async function descargarExcelAsistenciaMatriz() {
  const cursoId = document.getElementById('descargas-curso-id')?.value || document.getElementById('historial-curso-id')?.value;
  if (!cursoId) return showToast('Seleccione un curso primero', 'warning');

  const rango = obtenerRangoCicloSeleccionado();
  showToast(`Generando planilla de asistencia en Excel (${rango.nombreCiclo})...`, 'info');

  try {
    let url = `/api/cursos/${cursoId}/asistencia/matriz`;
    const params = [];
    if (rango.desde) params.push(`desde=${rango.desde}`);
    if (rango.hasta) params.push(`hasta=${rango.hasta}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const data = await apiFetch(url);
    const fechas = data.fechas || [];
    const estudiantes = data.estudiantes || [];
    const cursoObj = (App.cursos || []).find(c => String(c.id) === String(cursoId)) || {};
    const nombreCurso = `${cursoObj.anio || ''}° ${cursoObj.division || ''} ${cursoObj.nombre || 'Curso'}`.trim();

    // Encabezado CSV: N° ; Estudiante ; DNI ; [fechas...] ; Total Pres. ; Total Ausentes ; % Asistencia
    const fechasHeaders = fechas.map(f => {
      const p = f.split('-');
      return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : f;
    });

    const header = ['"N°"', '"Estudiante"', '"DNI"', ...fechasHeaders.map(f => `"${f}"`), '"Total Presentes"', '"Total Ausentes"', '"Total Tardes"', '"% Asistencia"'].join(';');

    const filas = estudiantes.map((e, idx) => {
      const diasVals = fechas.map(f => {
        const est = e.dias[f];
        if (est === 'presente') return '"P"';
        if (est === 'ausente') return '"A"';
        if (est === 'tarde') return '"T"';
        return '"-"';
      });

      return [
        `"${idx + 1}"`,
        `"${e.apellido}, ${e.nombre}"`,
        `"${e.dni || ''}"`,
        ...diasVals,
        `"${e.presentes}"`,
        `"${e.ausentes}"`,
        `"${e.tardes}"`,
        `"${e.porcentaje}%"`
      ].join(';');
    });

    // Filas de totales al pie
    const separador = ['""', '""', '""', ...fechas.map(() => '""'), '""', '""', '""', '""'].join(';');
    const pieTotalClases = ['"TOTAL DE ASISTENCIAS / CLASES DICTADAS:"', `"${data.totalClases}"`, '""', ...fechas.map(() => '""'), '""', '""', '""', '""'].join(';');
    const piePctGeneral = ['"PORCENTAJE GENERAL DE ASISTENCIA:"', `"${data.porcentajeGeneral}%"`, '""', ...fechas.map(() => '""'), '""', '""', '""', '""'].join(';');

    const csvContent = [
      `"PLANILLA OFICIAL DE ASISTENCIA - TUPROFEWEB"`,
      `"CURSO: ${nombreCurso}"`,
      `"PERÍODO / CICLO: ${rango.nombreCiclo}"`,
      `"FECHA DE DESCARGA: ${todayStr()}"`,
      separador,
      header,
      ...filas,
      separador,
      pieTotalClases,
      piePctGeneral
    ].join('\r\n');

    descargarArchivoCSV(csvContent, `Planilla_Asistencia_${nombreCurso.replace(/\s+/g, '_')}_${rango.sufijo}.csv`);
    showToast(`Planilla de asistencia descargada con éxito (${rango.nombreCiclo})`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 2. Descarga en Excel del Acta de Inasistencias Críticas para Preceptoría (< 70%)
async function descargarExcelFaltasPreceptoria() {
  const cursoId = document.getElementById('descargas-curso-id')?.value || document.getElementById('historial-curso-id')?.value;
  if (!cursoId) return showToast('Seleccione un curso primero', 'warning');

  try {
    const rango = obtenerRangoCicloSeleccionado();
    let url = `/api/cursos/${cursoId}/asistencia/matriz`;
    const params = [];
    if (rango.desde) params.push(`desde=${rango.desde}`);
    if (rango.hasta) params.push(`hasta=${rango.hasta}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const data = await apiFetch(url);
    const estudiantes = (data.estudiantes || []).filter(e => e.totalClases > 0 && e.porcentaje < 70);
    const cursoObj = (App.cursos || []).find(c => String(c.id) === String(cursoId)) || {};
    const nombreCurso = `${cursoObj.anio || ''}° ${cursoObj.division || ''} ${cursoObj.nombre || 'Curso'}`.trim();

    if (estudiantes.length === 0) {
      showToast(`No hay estudiantes con menos del 70% de asistencia en ${rango.nombreCiclo}.`, 'info');
      return;
    }

    const header = ['"N°"', '"Estudiante"', '"DNI"', '"Clases Dictadas"', '"Total Faltas"', '"Tardes"', '"% Asistencia"', '"Condición"', '"Notificación Preceptoría"'].join(';');
    const filas = estudiantes.map((e, idx) => [
      `"${idx + 1}"`,
      `"${e.apellido}, ${e.nombre}"`,
      `"${e.dni || ''}"`,
      `"${e.totalClases}"`,
      `"${e.ausentes}"`,
      `"${e.tardes}"`,
      `"${e.porcentaje}%"`,
      `"EN RIESGO POR FALTAS"`,
      `"CITACIÓN REQUERIDA"`
    ].join(';'));

    const csvContent = [
      `"INFORME OFICIAL DE INASISTENCIAS CRÍTICAS PARA PRECEPTORÍA (< 70%)"`,
      `"CURSO: ${nombreCurso}"`,
      `"PERÍODO / CICLO: ${rango.nombreCiclo}"`,
      `"FECHA: ${todayStr()}"`,
      `"TOTAL DE ALUMNOS EN SITUACIÓN CRÍTICA: ${estudiantes.length}"`,
      '""',
      header,
      ...filas
    ].join('\r\n');

    descargarArchivoCSV(csvContent, `Inasistencias_Preceptoria_${nombreCurso.replace(/\s+/g, '_')}_${rango.sufijo}.csv`);
    showToast(`Informe de preceptoría descargado (${rango.nombreCiclo})`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 3. Descarga en Excel del Resumen General de Asistencia
async function descargarExcelResumenAsistencia() {
  const cursoId = document.getElementById('descargas-curso-id')?.value || document.getElementById('historial-curso-id')?.value;
  if (!cursoId) return showToast('Seleccione un curso primero', 'warning');

  try {
    const rango = obtenerRangoCicloSeleccionado();
    let url = `/api/cursos/${cursoId}/asistencia/matriz`;
    const params = [];
    if (rango.desde) params.push(`desde=${rango.desde}`);
    if (rango.hasta) params.push(`hasta=${rango.hasta}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const data = await apiFetch(url);
    const estudiantes = data.estudiantes || [];
    const cursoObj = (App.cursos || []).find(c => String(c.id) === String(cursoId)) || {};
    const nombreCurso = `${cursoObj.anio || ''}° ${cursoObj.division || ''} ${cursoObj.nombre || 'Curso'}`.trim();

    const header = ['"N°"', '"Estudiante"', '"DNI"', '"Clases"', '"Presentes"', '"Faltas"', '"Tardes"', '"% Asistencia"', '"Condición"'].join(';');
    const filas = estudiantes.map((e, idx) => {
      const cond = e.totalClases === 0 ? '"-"' : (e.porcentaje >= 80 ? '"REGULAR"' : (e.porcentaje >= 70 ? '"REGULAR OBSERVADO"' : '"EN RIESGO POR FALTAS"'));
      return [
        `"${idx + 1}"`,
        `"${e.apellido}, ${e.nombre}"`,
        `"${e.dni || ''}"`,
        `"${e.totalClases}"`,
        `"${e.presentes}"`,
        `"${e.ausentes}"`,
        `"${e.tardes}"`,
        `"${e.porcentaje}%"`,
        cond
      ].join(';');
    });

    const csvContent = [
      `"RESUMEN ESTADÍSTICO DE ASISTENCIAS Y FALTAS"`,
      `"CURSO: ${nombreCurso}"`,
      `"PERÍODO / CICLO: ${rango.nombreCiclo}"`,
      `"FECHA: ${todayStr()}"`,
      `"TOTAL CLASES: ${data.totalClases} | PROMEDIO GENERAL: ${data.porcentajeGeneral}%"`,
      '""',
      header,
      ...filas
    ].join('\r\n');

    descargarArchivoCSV(csvContent, `Resumen_Asistencias_${nombreCurso.replace(/\s+/g, '_')}_${rango.sufijo}.csv`);
    showToast(`Resumen de asistencias descargado (${rango.nombreCiclo})`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 4. Descarga en Excel de Calificaciones
async function descargarExcelCalificaciones() {
  const cursoId = document.getElementById('descargas-curso-id')?.value || document.getElementById('historial-curso-id')?.value;
  if (!cursoId) return showToast('Seleccione un curso primero', 'warning');

  try {
    const estudiantes = await apiFetch(`/api/cursos/${cursoId}/estudiantes`);
    const califs = await apiFetch(`/api/cursos/${cursoId}/calificaciones/anuales`).catch(() => []);
    const califMap = {};
    (califs || []).forEach(c => { califMap[c.estudianteId] = c; });

    const cursoObj = (App.cursos || []).find(c => String(c.id) === String(cursoId)) || {};
    const nombreCurso = `${cursoObj.anio || ''}° ${cursoObj.division || ''} ${cursoObj.nombre || 'Curso'}`.trim();

    const header = ['"N°"', '"Estudiante"', '"DNI"', '"1° Trimestre"', '"2° Trimestre"', '"3° Trimestre"', '"Promedio"', '"Condición"'].join(';');
    const filas = estudiantes.map((e, idx) => {
      const c = califMap[e.id || e._id] || {};
      const t1 = parseFloat(c.trim1) || 0;
      const t2 = parseFloat(c.trim2) || 0;
      const t3 = parseFloat(c.trim3) || 0;
      let cnt = 0, sum = 0;
      if (c.trim1) { sum += t1; cnt++; }
      if (c.trim2) { sum += t2; cnt++; }
      if (c.trim3) { sum += t3; cnt++; }
      const prom = cnt > 0 ? (sum / cnt).toFixed(2) : '-';
      const cond = prom !== '-' ? (parseFloat(prom) >= 7 ? 'APROBADO' : 'RECUPERA') : '-';
      return [
        `"${idx + 1}"`,
        `"${e.apellido}, ${e.nombre}"`,
        `"${e.dni || ''}"`,
        `"${c.trim1 || ''}"`,
        `"${c.trim2 || ''}"`,
        `"${c.trim3 || ''}"`,
        `"${prom}"`,
        `"${cond}"`
      ].join(';');
    });

    const csvContent = [
      `"ACTA OFICIAL DE CALIFICACIONES TRIMESTRALES"`,
      `"CURSO: ${nombreCurso}"`,
      `"FECHA: ${todayStr()}"`,
      '""',
      header,
      ...filas
    ].join('\r\n');

    descargarArchivoCSV(csvContent, `Calificaciones_${nombreCurso.replace(/\s+/g, '_')}.csv`);
    showToast('Acta de notas descargada en Excel', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Helpers para maquetar el documento de impresión oficial (con soporte multi-página por ciclo)
function renderCabeceraImpresionHTML(colegioActual, cursoActual, nombreCiclo) {
  return `
    <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px; display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <h2 style="margin:0 0 4px 0;font-size:18px;letter-spacing:0.5px;">REPÚBLICA ARGENTINA</h2>
        <h4 style="margin:0 0 4px 0;font-weight:normal;font-size:14px;">INSTITUCIÓN: <b>${colegioActual}</b></h4>
        <h4 style="margin:0;font-weight:normal;font-size:14px;">CURSO: <b>${cursoActual.nombre || 'Curso'}</b> — DOCENTE: <b>Prof. Facundo Casciano</b></h4>
        <h5 style="margin:4px 0 0 0;font-weight:700;font-size:13px;color:#0d6efd;">PERÍODO EVALUADO: ${nombreCiclo.toUpperCase()}</h5>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:12px;"><b>Fecha de emisión:</b> ${todayStr()}</p>
        <p style="margin:3px 0 0 0;font-size:11px;color:#555;">Plataforma Oficial tuprofeweb.com</p>
      </div>
    </div>
  `;
}

function renderFirmasImpresionHTML() {
  return `
    <div style="margin-top:40px;display:flex;justify-content:space-around;text-align:center;">
      <div style="border-top:1px solid #000;width:220px;padding-top:6px;font-size:12px;">
        Firma del Docente<br>Prof. Facundo Casciano
      </div>
      <div style="border-top:1px solid #000;width:220px;padding-top:6px;font-size:12px;">
        Firma de Preceptoría
      </div>
      <div style="border-top:1px solid #000;width:220px;padding-top:6px;font-size:12px;">
        Sello y Firma de Dirección
      </div>
    </div>
  `;
}

function renderTablaMatrizHTML(data, subtituloCiclo) {
  const fechas = data.fechas || [];
  const estudiantes = data.estudiantes || [];

  const thFechas = fechas.map(f => {
    const p = f.split('-');
    const ddmmyyyy = p.length === 3 ? `${p[2]}/${p[1]}` : f;
    return `<th style="border:1px solid #333;padding:4px;font-size:11px;text-align:center;background:#2c3034;color:#fff;">${ddmmyyyy}</th>`;
  }).join('');

  return `
    <h3 style="margin-top:14px;border-bottom:2px solid #000;padding-bottom:4px;font-size:14px;">
      PLANILLA OFICIAL DE ASISTENCIA DÍA POR DÍA — ${subtituloCiclo.toUpperCase()}
    </h3>
    <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:11px;">
      <thead>
        <tr style="background:#2c3034;color:#fff;">
          <th style="border:1px solid #333;padding:5px;width:30px;text-align:center;">#</th>
          <th style="border:1px solid #333;padding:5px;text-align:left;">Estudiante</th>
          ${thFechas}
          <th style="border:1px solid #333;padding:5px;text-align:center;width:45px;">Pres.</th>
          <th style="border:1px solid #333;padding:5px;text-align:center;width:45px;">Aus.</th>
          <th style="border:1px solid #333;padding:5px;text-align:center;width:55px;">% Asist.</th>
        </tr>
      </thead>
      <tbody>
        ${estudiantes.length === 0 ? '<tr><td colspan="15" style="text-align:center;padding:12px;">No hay registros de asistencia en este período.</td></tr>' : estudiantes.map((e, idx) => {
          const tdDias = fechas.map(f => {
            const est = e.dias[f];
            let letra = '-';
            let color = '#777';
            if (est === 'presente') { letra = 'P'; color = '#198754'; }
            else if (est === 'ausente') { letra = 'A'; color = '#dc3545'; }
            else if (est === 'tarde') { letra = 'T'; color = '#d39e00'; }
            return `<td style="border:1px solid #ddd;padding:3px;text-align:center;font-weight:bold;color:${color};">${letra}</td>`;
          }).join('');

          return `
            <tr>
              <td style="border:1px solid #ddd;padding:4px;text-align:center;">${idx + 1}</td>
              <td style="border:1px solid #ddd;padding:4px;white-space:nowrap;"><b>${e.apellido}</b>, ${e.nombre}</td>
              ${tdDias}
              <td style="border:1px solid #ddd;padding:4px;text-align:center;font-weight:bold;color:#198754;">${e.presentes}</td>
              <td style="border:1px solid #ddd;padding:4px;text-align:center;font-weight:bold;color:#dc3545;">${e.ausentes}</td>
              <td style="border:1px solid #ddd;padding:4px;text-align:center;font-weight:bold;">${e.porcentaje}%</td>
            </tr>
          `;
        }).join('')}
      </tbody>
      <tfoot>
        <tr style="background:#f8f9fa;font-weight:bold;">
          <td colspan="${fechas.length + 2}" style="border:1px solid #333;padding:6px;">
            TOTAL DE ASISTENCIAS / CLASES EN ESTE CICLO: ${data.totalClases}
          </td>
          <td colspan="3" style="border:1px solid #333;padding:6px;text-align:center;color:#0d6efd;">
            PROMEDIO GENERAL: ${data.porcentajeGeneral}%
          </td>
        </tr>
      </tfoot>
    </table>
  `;
}

function renderTablaPreceptoriaHTML(data, subtituloCiclo) {
  const estudiantes = (data.estudiantes || []).filter(e => e.totalClases > 0 && e.porcentaje < 70);
  return `
    <h3 style="margin-top:14px;border-bottom:2px solid #dc3545;color:#842029;padding-bottom:4px;font-size:14px;">
      ACTA DE ALUMNOS EN SITUACIÓN CRÍTICA POR INASISTENCIAS (&lt; 70%) — ${subtituloCiclo.toUpperCase()}
    </h3>
    <p style="font-size:12px;margin:8px 0;line-height:1.4;">
      Por medio de la presente, se notifica a <b>Preceptoría y Equipo Directivo</b> la nómina de estudiantes con porcentaje de asistencia <b>inferior al 70%</b> obligatorio durante el <b>${subtituloCiclo}</b>, a los efectos de convocar a los tutores y confeccionar el acta correspondiente.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:12px;">
      <thead>
        <tr style="background:#f8d7da;color:#842029;">
          <th style="border:1px solid #f5c2c7;padding:6px;width:30px;">#</th>
          <th style="border:1px solid #f5c2c7;padding:6px;text-align:left;">Estudiante</th>
          <th style="border:1px solid #f5c2c7;padding:6px;">DNI</th>
          <th style="border:1px solid #f5c2c7;padding:6px;text-align:center;">Clases Ciclo</th>
          <th style="border:1px solid #f5c2c7;padding:6px;text-align:center;color:#dc3545;">Faltas</th>
          <th style="border:1px solid #f5c2c7;padding:6px;text-align:center;">% Asistencia</th>
          <th style="border:1px solid #f5c2c7;padding:6px;text-align:center;">Situación</th>
        </tr>
      </thead>
      <tbody>
        ${estudiantes.length === 0 ? `<tr><td colspan="7" style="text-align:center;padding:16px;">No se registran alumnos con menos del 70% de asistencia en ${subtituloCiclo}.</td></tr>` : estudiantes.map((e, idx) => `
          <tr>
            <td style="border:1px solid #ddd;padding:6px;text-align:center;">${idx + 1}</td>
            <td style="border:1px solid #ddd;padding:6px;"><b>${e.apellido}</b>, ${e.nombre}</td>
            <td style="border:1px solid #ddd;padding:6px;text-align:center;">${e.dni || '-'}</td>
            <td style="border:1px solid #ddd;padding:6px;text-align:center;">${e.totalClases}</td>
            <td style="border:1px solid #ddd;padding:6px;text-align:center;font-weight:bold;color:#dc3545;">${e.ausentes}</td>
            <td style="border:1px solid #ddd;padding:6px;text-align:center;font-weight:bold;color:#dc3545;">${e.porcentaje}%</td>
            <td style="border:1px solid #ddd;padding:6px;text-align:center;font-weight:bold;color:#dc3545;">EN RIESGO POR FALTAS</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="margin-top:20px;border:1px dashed #aaa;padding:12px;font-size:11px;">
      <b>Constancia de notificación del Tutor / Preceptor:</b> ___________________________________________________________
    </div>
  `;
}

function renderTablaResumenHTML(data, subtituloCiclo) {
  const estudiantes = data.estudiantes || [];
  return `
    <h3 style="margin-top:14px;border-bottom:2px solid #000;padding-bottom:4px;font-size:14px;">
      RESUMEN GENERAL DE ASISTENCIAS Y FALTAS — ${subtituloCiclo.toUpperCase()}
    </h3>
    <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:12px;">
      <thead>
        <tr style="background:#eee;">
          <th style="border:1px solid #000;padding:6px;width:30px;">#</th>
          <th style="border:1px solid #000;padding:6px;text-align:left;">Estudiante</th>
          <th style="border:1px solid #000;padding:6px;">DNI</th>
          <th style="border:1px solid #000;padding:6px;text-align:center;">Clases</th>
          <th style="border:1px solid #000;padding:6px;text-align:center;color:#198754;">Presentes</th>
          <th style="border:1px solid #000;padding:6px;text-align:center;color:#dc3545;">Faltas</th>
          <th style="border:1px solid #000;padding:6px;text-align:center;">Tardes</th>
          <th style="border:1px solid #000;padding:6px;text-align:center;">% Asist.</th>
          <th style="border:1px solid #000;padding:6px;text-align:center;">Condición</th>
        </tr>
      </thead>
      <tbody>
        ${estudiantes.map((e, idx) => {
          const cond = e.totalClases === 0 ? '-' : (e.porcentaje >= 80 ? 'REGULAR' : (e.porcentaje >= 70 ? 'REGULAR OBS.' : 'EN RIESGO'));
          const color = e.porcentaje >= 80 ? '#198754' : (e.porcentaje >= 70 ? '#0d6efd' : '#dc3545');
          return `
            <tr>
              <td style="border:1px solid #000;padding:5px;text-align:center;">${idx + 1}</td>
              <td style="border:1px solid #000;padding:5px;"><b>${e.apellido}</b>, ${e.nombre}</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;">${e.dni || '-'}</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;">${e.totalClases}</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;color:#198754;">${e.presentes}</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;color:#dc3545;">${e.ausentes}</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;">${e.tardes}</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;color:${color};">${e.porcentaje}%</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;color:${color};">${cond}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// Abre el selector visual de ciclos para impresión
function abrirModalImprimirCiclo(tipo = 'matriz') {
  const inputTipo = document.getElementById('imprimir-ciclo-tipo');
  if (inputTipo) inputTipo.value = tipo;

  const cursoId = document.getElementById('descargas-curso-id')?.value || document.getElementById('historial-curso-id')?.value;
  let nombreCurso = '';
  if (App.cursos && App.cursos.length > 0) {
    const c = App.cursos.find(item => String(item.id) === String(cursoId));
    if (c) nombreCurso = `${c.anio || ''}° ${c.division || ''} ${c.nombre || ''}`.trim();
  }
  const span = document.getElementById('imprimir-ciclo-curso-nombre');
  if (span) span.textContent = nombreCurso ? `(${nombreCurso})` : '';

  openModal('modal-imprimir-ciclo');
}

// Ejecuta la impresión directamente desde la selección del modal
function ejecutarImpresionCiclo(ciclo) {
  const tipo = document.getElementById('imprimir-ciclo-tipo')?.value || 'matriz';
  closeModal('modal-imprimir-ciclo');
  imprimirReporte(tipo, ciclo);
}

// 5. Impresión oficial y Guardar en PDF (Soporta 1° Ciclo, 2° Ciclo, Ambos Ciclos Separados o Continuo)
async function imprimirReporte(tipo = 'matriz', cicloForzado = null) {
  const cursoId = document.getElementById('descargas-curso-id')?.value || document.getElementById('historial-curso-id')?.value;
  if (!cursoId) return showToast('Seleccione un curso primero', 'warning');

  const modalDescargas = document.getElementById('modal-descargas');
  const modalHistorial = document.getElementById('modal-historial-asistencia');
  const modalDescargasAbierto = modalDescargas && modalDescargas.classList.contains('active');
  const modalHistorialAbierto = modalHistorial && modalHistorial.classList.contains('active');

  // Si no se forzó el ciclo, determinar si consultar al usuario o tomar el ciclo activo
  let ciclo = cicloForzado;
  if (!ciclo) {
    if (modalDescargasAbierto) {
      ciclo = document.getElementById('select-descargas-ciclo')?.value || 'ambos';
    } else if (modalHistorialAbierto) {
      if (typeof cicloActivo !== 'undefined' && (cicloActivo === '1' || cicloActivo === '2')) {
        ciclo = cicloActivo;
      } else {
        // Si está en 'todo', abrir el selector para que el usuario elija qué ciclo imprimir
        return abrirModalImprimirCiclo(tipo);
      }
    } else {
      return abrirModalImprimirCiclo(tipo);
    }
  }

  showToast('Generando documento oficial de impresión...', 'info');

  try {
    const cursoActual = App.cursos.find(c => (c.id || c._id) == cursoId) || { nombre: 'Curso' };
    const colegioActual = App.selectedColegio ? App.selectedColegio.nombre : 'Institución Educativa';
    let contenidoPaginas = '';
    let tituloVentana = '';

    if (tipo === 'matriz') {
      tituloVentana = `Planilla de Asistencia - ${cursoActual.nombre}`;

      if (ciclo === 'ambos') {
        const [data1, data2] = await Promise.all([
          apiFetch(`/api/cursos/${cursoId}/asistencia/matriz?desde=2026-03-01&hasta=2026-08-15`),
          apiFetch(`/api/cursos/${cursoId}/asistencia/matriz?desde=2026-08-16&hasta=2026-12-31`)
        ]);

        const hoja1 = `
          <div class="hoja-impresion">
            ${renderCabeceraImpresionHTML(colegioActual, cursoActual, '1° Ciclo (Marzo a Agosto)')}
            ${renderTablaMatrizHTML(data1, '1° Ciclo (Marzo a Agosto)')}
            ${renderFirmasImpresionHTML()}
          </div>
        `;

        const hoja2 = `
          <div class="hoja-impresion salto-pagina" style="page-break-before: always; padding-top: 15px;">
            ${renderCabeceraImpresionHTML(colegioActual, cursoActual, '2° Ciclo (Agosto a Diciembre)')}
            ${renderTablaMatrizHTML(data2, '2° Ciclo (Agosto a Diciembre)')}
            ${renderFirmasImpresionHTML()}
          </div>
        `;

        contenidoPaginas = hoja1 + hoja2;

      } else {
        let desde = '', hasta = '', nombreCiclo = 'Ciclo Lectivo Completo (Marzo a Diciembre)';
        if (ciclo === '1') {
          desde = '2026-03-01'; hasta = '2026-08-15'; nombreCiclo = '1° Ciclo (Marzo a Agosto)';
        } else if (ciclo === '2') {
          desde = '2026-08-16'; hasta = '2026-12-31'; nombreCiclo = '2° Ciclo (Agosto a Diciembre)';
        }

        let url = `/api/cursos/${cursoId}/asistencia/matriz`;
        if (desde && hasta) url += `?desde=${desde}&hasta=${hasta}`;
        const data = await apiFetch(url);

        contenidoPaginas = `
          <div class="hoja-impresion">
            ${renderCabeceraImpresionHTML(colegioActual, cursoActual, nombreCiclo)}
            ${renderTablaMatrizHTML(data, nombreCiclo)}
            ${renderFirmasImpresionHTML()}
          </div>
        `;
      }

    } else if (tipo === 'preceptoria') {
      tituloVentana = `Acta Preceptoría - ${cursoActual.nombre}`;

      if (ciclo === 'ambos') {
        const [data1, data2] = await Promise.all([
          apiFetch(`/api/cursos/${cursoId}/asistencia/matriz?desde=2026-03-01&hasta=2026-08-15`),
          apiFetch(`/api/cursos/${cursoId}/asistencia/matriz?desde=2026-08-16&hasta=2026-12-31`)
        ]);

        contenidoPaginas = `
          <div class="hoja-impresion">
            ${renderCabeceraImpresionHTML(colegioActual, cursoActual, '1° Ciclo (Marzo a Agosto)')}
            ${renderTablaPreceptoriaHTML(data1, '1° Ciclo (Marzo a Agosto)')}
            ${renderFirmasImpresionHTML()}
          </div>
          <div class="hoja-impresion salto-pagina" style="page-break-before: always; padding-top: 15px;">
            ${renderCabeceraImpresionHTML(colegioActual, cursoActual, '2° Ciclo (Agosto a Diciembre)')}
            ${renderTablaPreceptoriaHTML(data2, '2° Ciclo (Agosto a Diciembre)')}
            ${renderFirmasImpresionHTML()}
          </div>
        `;
      } else {
        let desde = '', hasta = '', nombreCiclo = 'Ciclo Lectivo Completo';
        if (ciclo === '1') {
          desde = '2026-03-01'; hasta = '2026-08-15'; nombreCiclo = '1° Ciclo (Marzo a Agosto)';
        } else if (ciclo === '2') {
          desde = '2026-08-16'; hasta = '2026-12-31'; nombreCiclo = '2° Ciclo (Agosto a Diciembre)';
        }

        let url = `/api/cursos/${cursoId}/asistencia/matriz`;
        if (desde && hasta) url += `?desde=${desde}&hasta=${hasta}`;
        const data = await apiFetch(url);

        contenidoPaginas = `
          <div class="hoja-impresion">
            ${renderCabeceraImpresionHTML(colegioActual, cursoActual, nombreCiclo)}
            ${renderTablaPreceptoriaHTML(data, nombreCiclo)}
            ${renderFirmasImpresionHTML()}
          </div>
        `;
      }

    } else if (tipo === 'resumen') {
      tituloVentana = `Resumen General - ${cursoActual.nombre}`;

      if (ciclo === 'ambos') {
        const [data1, data2] = await Promise.all([
          apiFetch(`/api/cursos/${cursoId}/asistencia/matriz?desde=2026-03-01&hasta=2026-08-15`),
          apiFetch(`/api/cursos/${cursoId}/asistencia/matriz?desde=2026-08-16&hasta=2026-12-31`)
        ]);

        contenidoPaginas = `
          <div class="hoja-impresion">
            ${renderCabeceraImpresionHTML(colegioActual, cursoActual, '1° Ciclo (Marzo a Agosto)')}
            ${renderTablaResumenHTML(data1, '1° Ciclo (Marzo a Agosto)')}
            ${renderFirmasImpresionHTML()}
          </div>
          <div class="hoja-impresion salto-pagina" style="page-break-before: always; padding-top: 15px;">
            ${renderCabeceraImpresionHTML(colegioActual, cursoActual, '2° Ciclo (Agosto a Diciembre)')}
            ${renderTablaResumenHTML(data2, '2° Ciclo (Agosto a Diciembre)')}
            ${renderFirmasImpresionHTML()}
          </div>
        `;
      } else {
        let desde = '', hasta = '', nombreCiclo = 'Ciclo Lectivo Completo';
        if (ciclo === '1') {
          desde = '2026-03-01'; hasta = '2026-08-15'; nombreCiclo = '1° Ciclo (Marzo a Agosto)';
        } else if (ciclo === '2') {
          desde = '2026-08-16'; hasta = '2026-12-31'; nombreCiclo = '2° Ciclo (Agosto a Diciembre)';
        }

        let url = `/api/cursos/${cursoId}/asistencia/matriz`;
        if (desde && hasta) url += `?desde=${desde}&hasta=${hasta}`;
        const data = await apiFetch(url);

        contenidoPaginas = `
          <div class="hoja-impresion">
            ${renderCabeceraImpresionHTML(colegioActual, cursoActual, nombreCiclo)}
            ${renderTablaResumenHTML(data, nombreCiclo)}
            ${renderFirmasImpresionHTML()}
          </div>
        `;
      }

    } else if (tipo === 'calificaciones') {
      const estudiantes = await apiFetch(`/api/cursos/${cursoId}/estudiantes`);
      const califs = await apiFetch(`/api/cursos/${cursoId}/calificaciones/anuales`).catch(() => []);
      const califMap = {};
      (califs || []).forEach(c => { califMap[c.estudianteId] = c; });
      tituloVentana = `Calificaciones - ${cursoActual.nombre}`;

      contenidoPaginas = `
        <div class="hoja-impresion">
          ${renderCabeceraImpresionHTML(colegioActual, cursoActual, 'Ciclo Lectivo Anual')}
          <h3 style="margin-top:14px;border-bottom:2px solid #000;padding-bottom:4px;font-size:14px;">ACTA OFICIAL DE CALIFICACIONES TRIMESTRALES</h3>
          <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:12px;">
            <thead>
              <tr style="background:#eee;">
                <th style="border:1px solid #000;padding:6px;width:30px;">#</th>
                <th style="border:1px solid #000;padding:6px;text-align:left;">Estudiante</th>
                <th style="border:1px solid #000;padding:6px;">DNI</th>
                <th style="border:1px solid #000;padding:6px;text-align:center;">1° Trim</th>
                <th style="border:1px solid #000;padding:6px;text-align:center;">2° Trim</th>
                <th style="border:1px solid #000;padding:6px;text-align:center;">3° Trim</th>
                <th style="border:1px solid #000;padding:6px;text-align:center;">Promedio</th>
                <th style="border:1px solid #000;padding:6px;text-align:center;">Condición</th>
              </tr>
            </thead>
            <tbody>
              ${estudiantes.map((e, idx) => {
                const c = califMap[e.id || e._id] || {};
                const t1 = parseFloat(c.trim1) || 0;
                const t2 = parseFloat(c.trim2) || 0;
                const t3 = parseFloat(c.trim3) || 0;
                let cnt = 0, sum = 0;
                if (c.trim1) { sum += t1; cnt++; }
                if (c.trim2) { sum += t2; cnt++; }
                if (c.trim3) { sum += t3; cnt++; }
                const prom = cnt > 0 ? (sum / cnt).toFixed(2) : '-';
                const cond = prom !== '-' ? (parseFloat(prom) >= 7 ? 'APROBADO' : 'RECUPERA') : '-';
                return `
                  <tr>
                    <td style="border:1px solid #000;padding:6px;text-align:center;">${idx + 1}</td>
                    <td style="border:1px solid #000;padding:6px;"><b>${e.apellido}</b>, ${e.nombre}</td>
                    <td style="border:1px solid #000;padding:6px;text-align:center;">${e.dni || '-'}</td>
                    <td style="border:1px solid #000;padding:6px;text-align:center;">${c.trim1 || '-'}</td>
                    <td style="border:1px solid #000;padding:6px;text-align:center;">${c.trim2 || '-'}</td>
                    <td style="border:1px solid #000;padding:6px;text-align:center;">${c.trim3 || '-'}</td>
                    <td style="border:1px solid #000;padding:6px;text-align:center;font-weight:bold;">${prom}</td>
                    <td style="border:1px solid #000;padding:6px;text-align:center;font-weight:bold;">${cond}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          ${renderFirmasImpresionHTML()}
        </div>
      `;

    } else {
      const temas = await apiFetch(`/api/cursos/${cursoId}/libro-tema`).catch(() => []);
      tituloVentana = `Libro de Temas - ${cursoActual.nombre}`;

      contenidoPaginas = `
        <div class="hoja-impresion">
          ${renderCabeceraImpresionHTML(colegioActual, cursoActual, 'Ciclo Lectivo Anual')}
          <h3 style="margin-top:14px;border-bottom:2px solid #000;padding-bottom:4px;font-size:14px;">COPIA DEL LIBRO DE TEMAS CURRICULAR</h3>
          <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:12px;">
            <thead>
              <tr style="background:#eee;">
                <th style="border:1px solid #000;padding:6px;width:40px;">Clase</th>
                <th style="border:1px solid #000;padding:6px;width:100px;">Fecha</th>
                <th style="border:1px solid #000;padding:6px;">Tema Curricular Desarrollado</th>
                <th style="border:1px solid #000;padding:6px;">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${(temas.length > 0 ? temas : [{ fecha: todayStr(), tema: 'Sin temas registrados', observaciones: '' }]).map((t, idx) => `
                <tr>
                  <td style="border:1px solid #000;padding:6px;text-align:center;">${idx + 1}</td>
                  <td style="border:1px solid #000;padding:6px;text-align:center;">${t.fecha}</td>
                  <td style="border:1px solid #000;padding:6px;">${t.tema}</td>
                  <td style="border:1px solid #000;padding:6px;">${t.observaciones || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${renderFirmasImpresionHTML()}
        </div>
      `;
    }

    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${tituloVentana}</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            padding: 24px;
            color: #111;
            margin: 0;
            background: #fff;
          }
          .hoja-impresion {
            margin-bottom: 30px;
          }
          @media print {
            body { padding: 5px; }
            button { display: none !important; }
            @page { margin: 1cm; size: landscape; }
            .salto-pagina { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        ${contenidoPaginas}

        <div style="margin-top:30px;text-align:center;">
          <button onclick="window.print()" style="padding:10px 26px;font-size:15px;background:#0d6efd;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.2);">
            🖨️ Imprimir o Guardar como PDF
          </button>
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Compatibilidad con llamadas legacy
function generarReporte(tipo) {
  imprimirReporte(tipo);
}

// =============================================
// CAMBIO DE CONTRASEÑA
// =============================================
function showChangePasswordModal() {
  openModal('modal-change-password');
  document.getElementById('input-old-password').value = '';
  document.getElementById('input-new-password').value = '';
  document.getElementById('input-confirm-password').value = '';
}

async function saveNewPassword() {
  const oldPass = document.getElementById('input-old-password').value;
  const newPass = document.getElementById('input-new-password').value;
  const confPass = document.getElementById('input-confirm-password').value;

  if (!oldPass || !newPass) {
    showToast('Complete la contraseña actual y la nueva', 'warning');
    return;
  }
  if (newPass !== confPass) {
    showToast('Las contraseñas no coinciden', 'error');
    return;
  }
  if (newPass.length < 6) {
    showToast('La nueva clave debe tener al menos 6 caracteres', 'warning');
    return;
  }

  try {
    await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass }),
    });
    closeModal('modal-change-password');
    showToast('Contraseña actualizada con éxito', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================
// MODALES AUXILIARES
// =============================================
async function showSuscripcionModal() {
  openModal('modal-suscripcion');
  const container = document.getElementById('suscripcion-content');
  container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Cargando estado...</p>';
  try {
    const data = await apiFetch('/api/suscripcion');
    container.innerHTML = `
      <div style="text-align:center;padding:12px;">
        <h3 style="color:var(--c-blue);margin-bottom:8px;">${data.plan}</h3>
        <p style="margin-bottom:6px;">Estado de Cuenta: <b style="color:var(--c-green);">${data.estado}</b></p>
        <p style="margin-bottom:6px;">Vigencia: <b>${data.vigencia}</b></p>
        <p style="margin-bottom:6px;">Colegios: <b>${data.maxColegios}</b></p>
        <p>Cursos y Estudiantes: <b>${data.maxCursos}</b></p>
      </div>`;
  } catch (e) {
    container.innerHTML = '<p style="text-align:center;color:var(--c-green);font-weight:700;">Plan Activo</p>';
  }
}

function showQuienesSomosModal() {
  openModal('modal-quienes-somos');
}

async function showNovedadesModal() {
  openModal('modal-novedades');
  const container = document.getElementById('novedades-content');
  container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Cargando novedades...</p>';
  try {
    const data = await apiFetch('/api/novedades');
    container.innerHTML = data.map(n => `
      <div style="border-bottom:1px solid var(--border-light);padding:12px 0;">
        <h4 style="margin-bottom:4px;color:var(--c-blue);">${n.titulo}</h4>
        <p style="font-size:0.9rem;color:var(--text-muted);">${n.descripcion}</p>
        <small style="color:var(--text-muted);font-size:0.75rem;">${n.fecha}</small>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<p>No hay avisos pendientes.</p>';
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function setupModalOverlayClose() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });
}

function todayStr() {
  return formatDate(new Date());
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

// =============================================
// LICENCIAS, FERIADOS Y DUELO DEL DOCENTE
// =============================================
let licenciasDocenteCache = [];

async function showLicenciasModal(fechaPrevia = null, cursoIdPrevio = null) {
  openModal('modal-licencias');
  cancelarEdicionLicencia();

  // Cargar lista de cursos en el selector
  const selectCurso = document.getElementById('input-licencia-curso');
  if (selectCurso) {
    let opciones = '<option value="">🌐 Todos mis Cursos</option>';
    if (App.cursos && App.cursos.length > 0) {
      App.cursos.forEach(c => {
        const col = App.colegios.find(col => (col.id || col._id) === c.colegio_id);
        const colNombre = col ? ` (${col.nombre})` : '';
        const selected = (cursoIdPrevio && String(c.id || c._id) === String(cursoIdPrevio)) ? 'selected' : '';
        opciones += `<option value="${c.id || c._id}" ${selected}>${c.nombre}${colNombre}</option>`;
      });
    }
    selectCurso.innerHTML = opciones;
  }

  // Pre-cargar fecha si se especificó
  const inputFecha = document.getElementById('input-licencia-fecha');
  if (inputFecha) {
    inputFecha.value = fechaPrevia || todayStr();
  }

  await cargarTablaLicencias();
}

async function cargarTablaLicencias() {
  const tbody = document.getElementById('licencias-tbody');
  const countEl = document.getElementById('licencias-total-count');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:15px;">Cargando registros...</td></tr>';

  try {
    const licencias = await apiFetch('/api/licencias');
    licenciasDocenteCache = Array.isArray(licencias) ? licencias : [];

    if (countEl) {
      countEl.textContent = `${licenciasDocenteCache.length} día(s) registrado(s)`;
    }

    if (licenciasDocenteCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:20px;color:var(--text-muted);">No hay licencias o feriados registrados todavía.<br><small>Utiliza el formulario de arriba para registrar uno.</small></td></tr>';
      return;
    }

    tbody.innerHTML = licenciasDocenteCache.map(lic => {
      // Formatear fecha
      let fechaFmt = lic.fecha;
      if (lic.fecha && lic.fecha.includes('-')) {
        const [y, m, d] = lic.fecha.split('-');
        fechaFmt = `${d}/${m}/${y}`;
      }

      // Estilo de badge según motivo
      let badgeStyle = 'background:#e2e8f0;color:#334155;';
      let icon = '📌';
      if (lic.motivo === 'Licencia Médica') {
        badgeStyle = 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca;';
        icon = '🩺';
      } else if (lic.motivo === 'Licencia Administrativa') {
        badgeStyle = 'background:#e0e7ff;color:#3730a3;border:1px solid #c7d2fe;';
        icon = '📄';
      } else if (lic.motivo === 'Feriado') {
        badgeStyle = 'background:#dcfce7;color:#166534;border:1px solid #bbf7d0;';
        icon = '🇦🇷';
      } else if (lic.motivo === 'Duelo') {
        badgeStyle = 'background:#f3e8ff;color:#6b21a8;border:1px solid #e9d5ff;';
        icon = '🕊️';
      } else if (lic.motivo === 'Jornada Institucional') {
        badgeStyle = 'background:#fef3c7;color:#92400e;border:1px solid #fde68a;';
        icon = '🏫';
      } else if (lic.motivo === 'Paro Docente') {
        badgeStyle = 'background:#ffedd5;color:#9a3412;border:1px solid #fed7aa;';
        icon = '🛑';
      }

      const alcanceTexto = lic.curso_nombre ? `🏫 ${lic.curso_nombre}` : '🌐 Todos los Cursos';

      return `
        <tr>
          <td style="font-weight:700;font-size:0.9rem;">📅 ${fechaFmt}</td>
          <td>
            <span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:0.82rem;font-weight:700;${badgeStyle}">
              ${icon} ${lic.motivo}
            </span>
          </td>
          <td style="font-size:0.85rem;font-weight:600;color:var(--text-main);">${alcanceTexto}</td>
          <td style="font-size:0.85rem;color:var(--text-muted);">${lic.descripcion || '-'}</td>
          <td style="text-align:center;">
            <div style="display:flex;gap:6px;justify-content:center;">
              <button type="button" class="btn-action btn-act-blue" style="padding:3px 8px;font-size:0.78rem;" onclick="editarLicencia(${lic.id})" title="Editar este día o cambiar la fecha si te equivocaste">
                ✏️ Editar
              </button>
              <button type="button" class="btn-action btn-act-gray" style="padding:3px 8px;font-size:0.78rem;color:var(--c-red);" onclick="eliminarLicencia(${lic.id})" title="Eliminar registro">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error al cargar licencias:', err);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color:var(--c-red);padding:15px;">Error al cargar las licencias.</td></tr>';
  }
}

async function guardarLicenciaDocente() {
  const id = document.getElementById('input-licencia-id').value;
  const fecha = document.getElementById('input-licencia-fecha').value;
  const motivo = document.getElementById('input-licencia-motivo').value;
  const curso_id = document.getElementById('input-licencia-curso').value || null;
  const descripcion = document.getElementById('input-licencia-desc').value.trim();

  if (!fecha) {
    showToast('Por favor selecciona una fecha.', 'warning');
    return;
  }
  if (!motivo) {
    showToast('Por favor selecciona el motivo.', 'warning');
    return;
  }

  const payload = { fecha, motivo, curso_id, descripcion };

  try {
    if (id) {
      // Actualizar registro existente (editar)
      await apiFetch(`/api/licencias/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('Registro actualizado exitosamente.', 'success');
    } else {
      // Crear nuevo registro
      await apiFetch('/api/licencias', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast(`Día registrado como "${motivo}" correctamente.`, 'success');
    }

    cancelarEdicionLicencia();
    await cargarTablaLicencias();

    // Actualizar banner en asistencia si está abierto
    const cursoAsistId = document.getElementById('asistencia-curso-id')?.value;
    const fechaAsist = document.getElementById('input-asistencia-fecha')?.value;
    if (cursoAsistId && fechaAsist) {
      verificarBannerLicenciaFecha(cursoAsistId, fechaAsist);
    }
  } catch (err) {
    console.error('Error al guardar licencia:', err);
    showToast(err.message || 'Error al guardar el registro.', 'danger');
  }
}

function editarLicencia(id) {
  const item = licenciasDocenteCache.find(l => l.id === id);
  if (!item) return;

  document.getElementById('input-licencia-id').value = item.id;
  document.getElementById('input-licencia-fecha').value = item.fecha;
  document.getElementById('input-licencia-motivo').value = item.motivo;
  document.getElementById('input-licencia-curso').value = item.curso_id || '';
  document.getElementById('input-licencia-desc').value = item.descripcion || '';

  const tituloEl = document.getElementById('licencia-form-titulo');
  if (tituloEl) {
    tituloEl.innerHTML = `✏️ Modificar Día Registrado (Fecha actual: ${item.fecha})`;
    tituloEl.style.color = 'var(--c-blue)';
  }

  const btnGuardar = document.getElementById('btn-guardar-licencia');
  if (btnGuardar) {
    btnGuardar.textContent = '💾 Actualizar Cambios';
    btnGuardar.className = 'btn-action btn-act-blue';
  }

  const btnCancelar = document.getElementById('btn-cancelar-edicion-licencia');
  if (btnCancelar) {
    btnCancelar.style.display = 'inline-block';
  }

  // Scroll suave al formulario
  document.getElementById('input-licencia-fecha').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('input-licencia-fecha').focus();
}

function cancelarEdicionLicencia() {
  document.getElementById('input-licencia-id').value = '';
  document.getElementById('input-licencia-fecha').value = todayStr();
  document.getElementById('input-licencia-motivo').value = 'Licencia Médica';
  document.getElementById('input-licencia-curso').value = '';
  document.getElementById('input-licencia-desc').value = '';

  const tituloEl = document.getElementById('licencia-form-titulo');
  if (tituloEl) {
    tituloEl.innerHTML = '➕ Registrar Inasistencia / Día sin clases';
    tituloEl.style.color = 'var(--text-main)';
  }

  const btnGuardar = document.getElementById('btn-guardar-licencia');
  if (btnGuardar) {
    btnGuardar.textContent = '➕ Guardar Día';
    btnGuardar.className = 'btn-action btn-act-green';
  }

  const btnCancelar = document.getElementById('btn-cancelar-edicion-licencia');
  if (btnCancelar) {
    btnCancelar.style.display = 'none';
  }
}

async function eliminarLicencia(id) {
  const item = licenciasDocenteCache.find(l => l.id === id);
  const texto = item ? `el día ${item.fecha} (${item.motivo})` : 'este registro';
  if (!confirm(`¿Estás seguro de que deseas eliminar ${texto}?`)) {
    return;
  }

  try {
    await apiFetch(`/api/licencias/${id}`, { method: 'DELETE' });
    showToast('Registro eliminado correctamente.', 'success');
    cancelarEdicionLicencia();
    await cargarTablaLicencias();

    // Actualizar banner en asistencia si está abierto
    const cursoAsistId = document.getElementById('asistencia-curso-id')?.value;
    const fechaAsist = document.getElementById('input-asistencia-fecha')?.value;
    if (cursoAsistId && fechaAsist) {
      verificarBannerLicenciaFecha(cursoAsistId, fechaAsist);
    }
  } catch (err) {
    console.error('Error al eliminar licencia:', err);
    showToast(err.message || 'Error al eliminar el registro.', 'danger');
  }
}

function abrirRegistrarLicenciaParaFechaActual() {
  const cursoId = document.getElementById('asistencia-curso-id')?.value;
  const fecha = document.getElementById('input-asistencia-fecha')?.value || todayStr();
  showLicenciasModal(fecha, cursoId);
}

async function verificarBannerLicenciaFecha(cursoId, fecha) {
  const banner = document.getElementById('banner-licencia-asistencia');
  if (!banner) return;

  try {
    const res = await apiFetch(`/api/licencias?fecha=${fecha}`);
    const licenciasFecha = Array.isArray(res) ? res : [];
    
    // Filtrar la que aplique a este curso (o a todos los cursos)
    const licencia = licenciasFecha.find(l => !l.curso_id || String(l.curso_id) === String(cursoId));

    if (licencia) {
      banner.style.display = 'flex';
      const motivoEl = document.getElementById('banner-licencia-motivo');
      const textoEl = document.getElementById('banner-licencia-texto');
      if (motivoEl) motivoEl.textContent = `📌 ${licencia.motivo}`;
      if (textoEl) {
        textoEl.textContent = licencia.descripcion 
          ? `${licencia.descripcion} (Registrado como día sin clases)`
          : 'Registrado como día sin clases para el docente.';
      }
    } else {
      banner.style.display = 'none';
    }
  } catch (err) {
    banner.style.display = 'none';
  }
}

// =============================================
// INICIALIZACIÓN
// =============================================
async function initApp() {
  applyDarkMode();
  updateSyncStatus('saved');
  await loadColegios();
  if (App.colegios.length > 0 && !App.selectedColegio) {
    const primerId = App.colegios[0].id || App.colegios[0]._id;
    await selectColegio(primerId);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupModalOverlayClose();
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  if (App.token) {
    hideLogin();
    initApp();
  } else {
    showLogin();
  }

  applyDarkMode();
});
