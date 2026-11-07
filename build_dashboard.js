const fs = require('fs');
const path = require('path');

const xlsxCode = fs.readFileSync('public/js/xlsx.full.min.js', 'utf8');
const dataExport = JSON.parse(fs.readFileSync('data_export.json', 'utf8'));

// Format students and attendances for Dashboard_Docente
const estudiantes = dataExport.estudiantes.map(e => ({
  id: e.id,
  curso_id: e.curso_id,
  apellido: e.apellido,
  nombre: e.nombre || '-',
  dni: e.dni || '',
  nota: 7 + (e.id % 4)
}));

const asistenciasObj = {};
dataExport.asistencia.forEach(a => {
  const key = a.fecha + '_' + a.estudiante_id;
  let code = 'P';
  if (a.estado === 'ausente' || a.estado === 'A') code = 'A';
  else if (a.estado === 'justificada' || a.estado === 'J') code = 'J';
  else if (a.estado === 'tarde' || a.estado === 'T') code = 'T';
  asistenciasObj[key] = code;
});

const initialData = {
  colegios: dataExport.colegios,
  cursos: dataExport.cursos,
  estudiantes: estudiantes,
  asistencias: asistenciasObj
};

console.log('Total students:', estudiantes.length, 'Total asistencias keys:', Object.keys(asistenciasObj).length);

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Escolar con Alerta de Preceptoría — Prof. Facundo</title>
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- FontAwesome Icons -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <!-- SheetJS Embebido Localmente (100% Funcional sin internet) -->
  <script>
${xlsxCode}
  </script>
  <style>
    .btn-amber {
      background-color: #e09f00;
      color: #ffffff;
      font-weight: 700;
      transition: all 0.2s ease;
    }
    .btn-amber:hover {
      background-color: #c98e00;
      transform: translateY(-1px);
    }
    .drop-active {
      border-color: #e09f00 !important;
      background-color: rgba(224, 159, 0, 0.08) !important;
    }
    .tab-periodo.active {
      background-color: #0f172a;
      color: #ffffff;
      border-color: #0f172a;
    }
    @keyframes pulse-subtle {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    .pulse-danger {
      animation: pulse-subtle 2s infinite ease-in-out;
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col font-sans" id="body-app">

  <!-- HEADER / NAVBAR -->
  <header class="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xl shadow-md">
          <i class="fa-solid fa-graduation-cap"></i>
        </div>
        <div>
          <h1 class="text-lg font-bold text-slate-900 leading-tight">TuProfeWeb <span class="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold ml-1">Preceptoría &middot; Asistencia</span></h1>
          <p class="text-xs text-slate-500">Gestión por Períodos &middot; Prof. Facundo Casciano</p>
        </div>
      </div>

      <div class="flex items-center space-x-2 sm:space-x-3">
        <button onclick="document.getElementById('file-upload-excel').click()" class="btn-amber text-xs sm:text-sm px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-sm cursor-pointer">
          <i class="fa-solid fa-file-arrow-up"></i>
          <span>Subir Planilla Excel</span>
        </button>
        <button onclick="descargarInformeDetalladoExcel()" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm px-3 py-2 rounded-lg flex items-center space-x-1.5 shadow-sm font-semibold transition">
          <i class="fa-solid fa-file-excel"></i>
          <span class="hidden sm:inline">Descargar Detallado</span>
        </button>
      </div>
    </div>
  </header>

  <!-- INPUT FILE OCULTO DIRECTO -->
  <input type="file" id="file-upload-excel" accept=".xlsx,.xls,.csv" class="hidden" onchange="manejarSubidaExcel(event)">

  <!-- CONTENIDO -->
  <main class="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">

    <!-- SELECTOR DE PERÍODO -->
    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <span class="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
          <i class="fa-regular fa-calendar-check"></i> Ciclo Lectivo &middot; Filtro por Período
        </span>
        <h2 id="periodo-activo-titulo" class="text-base font-bold text-slate-900 mt-0.5">Todo el Ciclo Lectivo (Marzo a Diciembre)</h2>
      </div>

      <div class="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-bold space-x-1">
        <button onclick="cambiarPeriodo('todo')" id="btn-periodo-todo" class="tab-periodo active px-3.5 py-2 rounded-lg transition">
          🌟 Todo el Año
        </button>
        <button onclick="cambiarPeriodo('p1')" id="btn-periodo-p1" class="tab-periodo px-3.5 py-2 rounded-lg text-slate-600 hover:bg-white transition">
          📘 1° Período (Marzo - Julio)
        </button>
        <button onclick="cambiarPeriodo('p2')" id="btn-periodo-p2" class="tab-periodo px-3.5 py-2 rounded-lg text-slate-600 hover:bg-white transition">
          📙 2° Período (Agosto - Diciembre)
        </button>
      </div>
    </div>

    <!-- BANNER DE ALERTA PARA PRECEPTORÍA (< 70%) -->
    <div id="banner-alerta-preceptoria" class="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div class="flex items-start space-x-3.5">
        <div class="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center text-xl shadow-sm shrink-0 mt-0.5 pulse-danger">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-600 text-white">Aviso Preceptoría</span>
            <span id="alerta-conteo-alumnos" class="text-xs font-bold text-rose-800">4 estudiantes con menos del 70% de asistencia</span>
          </div>
          <p id="alerta-descripcion-texto" class="text-xs text-rose-700 mt-1">
            Los siguientes estudiantes están en riesgo de perder la regularidad en el período seleccionado.
          </p>
          <div id="alerta-chips-alumnos" class="flex flex-wrap gap-1.5 mt-2">
            <!-- Nombres de alumnos en riesgo -->
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 shrink-0">
        <button onclick="copiarInformePreceptoria()" class="bg-white hover:bg-slate-50 text-rose-700 border border-rose-300 text-xs px-3.5 py-2 rounded-lg font-bold shadow-xs transition flex items-center space-x-1.5">
          <i class="fa-brands fa-whatsapp text-emerald-600 text-sm"></i>
          <span>Copiar Mensaje para Preceptora</span>
        </button>
        <button onclick="descargarInformeDetalladoExcel()" class="bg-rose-600 hover:bg-rose-700 text-white text-xs px-3.5 py-2 rounded-lg font-bold shadow-xs transition flex items-center space-x-1.5">
          <i class="fa-solid fa-file-excel"></i>
          <span>Planilla Preceptoría (.xlsx)</span>
        </button>
      </div>
    </div>

    <!-- TARJETAS DE INDICADORES (KPIs) -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <div class="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
          <i class="fa-solid fa-users"></i>
        </div>
        <div>
          <p class="text-xs font-medium text-slate-500">Alumnos del Curso</p>
          <h3 id="stat-total-alumnos" class="text-2xl font-bold text-slate-800">0</h3>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <div class="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
          <i class="fa-solid fa-user-check"></i>
        </div>
        <div>
          <p class="text-xs font-medium text-slate-500">% Asistencia del Curso</p>
          <h3 id="stat-asistencia-promedio" class="text-2xl font-bold text-emerald-600">0%</h3>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <div class="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
          <i class="fa-solid fa-calendar-days"></i>
        </div>
        <div>
          <p class="text-xs font-medium text-slate-500">Clases Dictadas</p>
          <h3 id="stat-clases-dictadas" class="text-2xl font-bold text-blue-600">0</h3>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <div class="w-12 h-12 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-xl">
          <i class="fa-solid fa-user-xmark"></i>
        </div>
        <div>
          <p class="text-xs font-medium text-slate-500">En Riesgo (< 70%)</p>
          <h3 id="stat-alumnos-riesgo" class="text-2xl font-bold text-rose-600">0</h3>
        </div>
      </div>
    </div>

    <!-- SELECCIÓN DE COLEGIO Y CURSOS -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <!-- Panel de Colegios -->
      <div class="md:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
          <span>Colegios</span>
          <i class="fa-solid fa-building-columns text-amber-500"></i>
        </h2>
        <div id="lista-colegios" class="space-y-1.5"></div>
      </div>

      <!-- Panel de Cursos -->
      <div class="md:col-span-3 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 id="colegio-seleccionado-titulo" class="text-lg font-bold text-slate-900">Colegio</h2>
            <p class="text-xs text-slate-500">Hacé clic en cualquier curso para ver el desglose y aviso de preceptoría</p>
          </div>
        </div>
        <div id="lista-cursos" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"></div>
      </div>
    </div>

    <!-- DETALLE DEL CURSO ACTIVO -->
    <div id="seccion-curso-activo" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200">
        <div>
          <span id="badge-turno" class="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Turno</span>
          <h2 id="curso-activo-titulo" class="text-xl font-bold text-slate-900 mt-1">Nombre del Curso</h2>
          <p id="curso-activo-subtitulo" class="text-xs text-slate-500">Alumnos registrados</p>
        </div>

        <!-- Controles de Asistencia Diaria -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <i class="fa-regular fa-calendar-days text-slate-500 mr-2"></i>
            <input type="date" id="fecha-asistencia" class="bg-transparent font-bold text-slate-700 outline-none cursor-pointer" onchange="renderTablaEstudiantes()">
          </div>

          <button onclick="marcarTodos('P')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-2 rounded-lg font-semibold shadow-sm transition">
            <i class="fa-solid fa-check-double mr-1"></i> Todos Presentes
          </button>

          <button onclick="marcarTodos('A')" class="bg-rose-600 hover:bg-rose-700 text-white text-xs px-3 py-2 rounded-lg font-semibold shadow-sm transition">
            <i class="fa-solid fa-xmark mr-1"></i> Todos Ausentes
          </button>
          
          <button onclick="descargarInformeDetalladoExcel()" class="bg-slate-800 hover:bg-slate-900 text-white text-xs px-3 py-2 rounded-lg font-semibold shadow-sm transition">
            <i class="fa-solid fa-download mr-1"></i> Descargar Excel Detallado
          </button>
        </div>
      </div>

      <!-- TABLA DE ALUMNOS Y ASISTENCIAS -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm border-collapse">
          <thead>
            <tr class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
              <th class="py-3 px-3 font-semibold text-center w-12">#</th>
              <th class="py-3 px-4 font-semibold">Apellido y Nombre</th>
              <th class="py-3 px-4 font-semibold text-center">Estado del Día</th>
              <th class="py-3 px-4 font-semibold text-center">Clases / Asist.</th>
              <th class="py-3 px-4 font-semibold text-center">% Asistencia</th>
              <th class="py-3 px-4 font-semibold text-center">Estado Preceptoría</th>
              <th class="py-3 px-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-estudiantes-tbody" class="divide-y divide-slate-100"></tbody>
        </table>
      </div>
    </div>

  </main>

  <footer class="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 mt-8">
    <p>TuProfeWeb &copy; 2026 &middot; Sistema de Gestión Escolar con Control de Regularidad (&gt;= 70%)</p>
  </footer>

  <script>
    const INITIAL_STATE = ${JSON.stringify(initialData)};

    let state = JSON.parse(localStorage.getItem('dashboard_docente_data_v4')) || INITIAL_STATE;
    let colegioActivoId = 2; // Por defecto Tecnica N° 2 (donde está 4° 3 Montaje GB)
    let cursoActivoId = 10;  // 4° 3 Montaje GB
    let fechaHoy = new Date().toISOString().split('T')[0];
    let periodoSeleccionado = 'todo'; // 'todo' | 'p1' | 'p2'

    function guardarEstado() {
      localStorage.setItem('dashboard_docente_data_v4', JSON.stringify(state));
      actualizarKPIs();
    }

    window.addEventListener('DOMContentLoaded', () => {
      document.getElementById('fecha-asistencia').value = fechaHoy;
      renderColegios();
      seleccionarColegio(colegioActivoId);
      seleccionarCurso(cursoActivoId);
      actualizarKPIs();
    });

    function cambiarPeriodo(periodo) {
      periodoSeleccionado = periodo;
      document.querySelectorAll('.tab-periodo').forEach(b => {
        b.classList.remove('active', 'bg-slate-900', 'text-white');
        b.classList.add('text-slate-600');
      });

      const btn = document.getElementById('btn-periodo-' + periodo);
      if (btn) {
        btn.classList.add('active', 'bg-slate-900', 'text-white');
        btn.classList.remove('text-slate-600');
      }

      const titulos = {
        'todo': 'Todo el Ciclo Lectivo (Marzo a Diciembre)',
        'p1': '1° Período: Marzo a Julio (Hasta Receso Invernal)',
        'p2': '2° Período: Agosto a Diciembre (Segundo Semestre)'
      };
      document.getElementById('periodo-activo-titulo').innerText = titulos[periodo] || '';

      renderTablaEstudiantes();
      actualizarKPIs();
    }

    // Filtro de fechas según período
    function fechaCorrespondeAPeriodo(fechaIso) {
      if (periodoSeleccionado === 'todo') return true;
      if (periodoSeleccionado === 'p1') {
        return fechaIso <= '2026-07-31';
      }
      if (periodoSeleccionado === 'p2') {
        return fechaIso >= '2026-08-01';
      }
      return true;
    }

    function obtenerFechasDictadasCurso(cursoId) {
      const prefijo = cursoId;
      const fechasSet = new Set();
      Object.keys(state.asistencias).forEach(k => {
        const partes = k.split('_');
        const f = partes[0];
        const estId = parseInt(partes[1], 10);
        const est = state.estudiantes.find(e => e.id === estId);
        if (est && est.curso_id === cursoId && fechaCorrespondeAPeriodo(f)) {
          fechasSet.add(f);
        }
      });
      return Array.from(fechasSet).sort();
    }

    function renderColegios() {
      const container = document.getElementById('lista-colegios');
      container.innerHTML = '';
      state.colegios.forEach(col => {
        const esActivo = col.id === colegioActivoId;
        const btn = document.createElement('button');
        btn.className = "w-full text-left px-3.5 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-between " +
          (esActivo ? 'bg-amber-500 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-100');
        btn.innerHTML = "<span>" + col.nombre + "</span> <i class='fa-solid fa-chevron-right text-xs opacity-70'></i>";
        btn.onclick = () => seleccionarColegio(col.id);
        container.appendChild(btn);
      });
    }

    function seleccionarColegio(colId) {
      colegioActivoId = colId;
      renderColegios();
      const col = state.colegios.find(c => c.id === colId);
      if (col) {
        document.getElementById('colegio-seleccionado-titulo').innerText = col.nombre;
      }

      const cursos = state.cursos.filter(c => c.colegio_id === colId);
      const container = document.getElementById('lista-cursos');
      container.innerHTML = '';

      cursos.forEach(cur => {
        const count = state.estudiantes.filter(e => e.curso_id === cur.id).length;
        const card = document.createElement('div');
        const esSeleccionado = cur.id === cursoActivoId;
        card.className = "p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between " +
          (esSeleccionado ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-2 ring-amber-400/30' : 'border-slate-200 hover:border-amber-400 bg-white shadow-xs');
        card.onclick = () => seleccionarCurso(cur.id);
        card.innerHTML = 
          '<div class="flex items-start justify-between">' +
            '<h4 class="font-bold text-slate-800 text-sm">' + cur.nombre + '</h4>' +
            '<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">' + (cur.turno || 'Mañana') + '</span>' +
          '</div>' +
          '<p class="text-xs text-slate-500 mt-3 flex items-center">' +
            '<i class="fa-solid fa-users text-amber-500 mr-1.5"></i> ' + count + ' estudiantes' +
          '</p>';
        container.appendChild(card);
      });
    }

    function seleccionarCurso(curId) {
      cursoActivoId = curId;
      const cur = state.cursos.find(c => c.id === curId);
      if (!cur) return;

      colegioActivoId = cur.colegio_id;
      renderColegios();
      seleccionarColegio(colegioActivoId);

      const col = state.colegios.find(c => c.id === cur.colegio_id);
      document.getElementById('curso-activo-titulo').innerText = cur.nombre;
      document.getElementById('badge-turno').innerText = cur.turno || 'Mañana';
      
      const alumnos = state.estudiantes.filter(e => e.curso_id === curId);
      document.getElementById('curso-activo-subtitulo').innerText = alumnos.length + ' estudiantes registrados &middot; ' + (col ? col.nombre : '');

      renderTablaEstudiantes();
      actualizarKPIs();
    }

    function calcularStatsEstudiante(estId) {
      const fechas = obtenerFechasDictadasCurso(cursoActivoId);
      let presentes = 0;
      let ausentes = 0;
      let justificadas = 0;
      let tardes = 0;

      fechas.forEach(f => {
        const estado = state.asistencias[f + '_' + estId] || 'P';
        if (estado === 'P') presentes++;
        else if (estado === 'A') ausentes++;
        else if (estado === 'J') justificadas++;
        else if (estado === 'T') { presentes++; tardes++; }
      });

      const totalClases = fechas.length;
      const porcentaje = totalClases > 0 ? Math.round((presentes / totalClases) * 100) : 100;
      const enRiesgo = totalClases > 0 && porcentaje < 70;

      return { totalClases, presentes, ausentes, justificadas, tardes, porcentaje, enRiesgo };
    }

    function renderTablaEstudiantes() {
      const tbody = document.getElementById('tabla-estudiantes-tbody');
      tbody.innerHTML = '';
      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoActivoId);

      if (alumnos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-10 text-slate-400"><i class="fa-solid fa-folder-open text-3xl mb-2 block text-slate-300"></i>No hay estudiantes en este curso todavía.<br><button onclick="document.getElementById(\\'file-upload-excel\\').click()" class="btn-amber text-xs px-3 py-1.5 rounded-lg mt-3 inline-block">Subir Planilla Excel</button></td></tr>';
        return;
      }

      const fecha = document.getElementById('fecha-asistencia').value || fechaHoy;
      const alumnosRiesgoList = [];

      alumnos.forEach((est, idx) => {
        const key = fecha + '_' + est.id;
        const estadoHoy = state.asistencias[key] || 'P';

        const stats = calcularStatsEstudiante(est.id);
        if (stats.enRiesgo) {
          alumnosRiesgoList.push({ ...est, stats });
        }

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/80 transition border-b border-slate-100 " + (stats.enRiesgo ? 'bg-rose-50/30' : '');
        tr.innerHTML = 
          '<td class="py-3 px-3 font-semibold text-slate-400 text-xs text-center">' + (idx + 1) + '</td>' +
          '<td class="py-3 px-4 font-bold text-slate-800">' +
            est.apellido + ' ' + (est.nombre && est.nombre !== '-' ? est.nombre : '') +
            (stats.enRiesgo ? ' <span class="ml-1 text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">⚠️ <70%</span>' : '') +
          '</td>' +
          '<td class="py-3 px-4 text-center">' +
            '<div class="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 shadow-xs">' +
              '<button onclick="marcarIndividual(' + est.id + ', \\'P\\')" class="px-2.5 py-1 text-xs font-bold rounded-md transition ' + (estadoHoy === 'P' ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200') + '">P</button>' +
              '<button onclick="marcarIndividual(' + est.id + ', \\'A\\')" class="px-2.5 py-1 text-xs font-bold rounded-md transition ' + (estadoHoy === 'A' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200') + '">A</button>' +
              '<button onclick="marcarIndividual(' + est.id + ', \\'J\\')" class="px-2.5 py-1 text-xs font-bold rounded-md transition ' + (estadoHoy === 'J' ? 'bg-blue-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200') + '">J</button>' +
              '<button onclick="marcarIndividual(' + est.id + ', \\'T\\')" class="px-2.5 py-1 text-xs font-bold rounded-md transition ' + (estadoHoy === 'T' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200') + '">T</button>' +
            '</div>' +
          '</td>' +
          '<td class="py-3 px-4 text-center text-xs text-slate-600">' +
            '<b>' + stats.presentes + '</b> / ' + stats.totalClases + ' clases' +
          '</td>' +
          '<td class="py-3 px-4 text-center">' +
            '<span class="inline-block px-2.5 py-1 rounded-lg text-xs font-bold ' + 
              (stats.porcentaje >= 80 ? 'bg-emerald-100 text-emerald-800' : (stats.porcentaje >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700 ring-1 ring-rose-300')) + '">' +
              stats.porcentaje + '%' +
            '</span>' +
          '</td>' +
          '<td class="py-3 px-4 text-center">' +
            (stats.enRiesgo 
              ? '<span class="inline-flex items-center text-xs font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full"><i class="fa-solid fa-triangle-exclamation mr-1"></i> AVISAR PRECEPTORA</span>'
              : '<span class="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><i class="fa-solid fa-circle-check mr-1"></i> Regular</span>'
            ) +
          '</td>' +
          '<td class="py-3 px-4 text-right">' +
            '<button onclick="eliminarEstudiante(' + est.id + ')" class="text-slate-400 hover:text-rose-600 p-1.5 transition" title="Eliminar">' +
              '<i class="fa-solid fa-trash-can text-sm"></i>' +
            '</button>' +
          '</td>';
        tbody.appendChild(tr);
      });

      actualizarBannerPreceptoria(alumnosRiesgoList);
    }

    function actualizarBannerPreceptoria(alumnosRiesgo) {
      const banner = document.getElementById('banner-alerta-preceptoria');
      const conteo = document.getElementById('alerta-conteo-alumnos');
      const chips = document.getElementById('alerta-chips-alumnos');

      if (alumnosRiesgo.length === 0) {
        banner.className = "mb-6 p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4";
        banner.innerHTML = 
          '<div class="flex items-center space-x-3">' +
            '<div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl shrink-0"><i class="fa-solid fa-circle-check"></i></div>' +
            '<div>' +
              '<h4 class="font-bold text-emerald-900 text-sm">¡Excelente! Ningún estudiante tiene menos del 70% de asistencia</h4>' +
              '<p class="text-xs text-emerald-700">Todos los alumnos del curso mantienen la regularidad en este período.</p>' +
            '</div>' +
          '</div>';
        return;
      }

      conteo.innerText = alumnosRiesgo.length + ' estudiante(s) con menos del 70% de asistencia';
      chips.innerHTML = '';
      alumnosRiesgo.forEach(a => {
        const span = document.createElement('span');
        span.className = "text-xs font-bold bg-white text-rose-800 border border-rose-300 px-2 py-0.5 rounded-md shadow-2xs";
        span.innerHTML = a.apellido + ' (' + a.stats.porcentaje + '%)';
        chips.appendChild(span);
      });
    }

    function marcarIndividual(estId, estado) {
      const fecha = document.getElementById('fecha-asistencia').value || fechaHoy;
      state.asistencias[fecha + '_' + estId] = estado;
      guardarEstado();
      renderTablaEstudiantes();
    }

    function marcarTodos(estado) {
      const fecha = document.getElementById('fecha-asistencia').value || fechaHoy;
      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoActivoId);
      alumnos.forEach(est => {
        state.asistencias[fecha + '_' + est.id] = estado;
      });
      guardarEstado();
      renderTablaEstudiantes();
    }

    function copiarInformePreceptoria() {
      const cur = state.cursos.find(c => c.id === cursoActivoId);
      const col = state.colegios.find(c => c.id === (cur ? cur.colegio_id : null));
      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoActivoId);
      const enRiesgo = [];

      alumnos.forEach(e => {
        const stats = calcularStatsEstudiante(e.id);
        if (stats.enRiesgo) enRiesgo.push({ est: e, stats });
      });

      const nomPeriodo = periodoSeleccionado === 'todo' ? 'Ciclo Completo' : (periodoSeleccionado === 'p1' ? '1° Período (Marzo - Julio)' : '2° Período (Agosto - Diciembre)');

      let texto = '📋 *INFORME DE INASISTENCIAS PARA PRECEPTORÍA*\\n';
      texto += '🏫 *Colegio:* ' + (col ? col.nombre : '') + '\\n';
      texto += '📘 *Curso:* ' + (cur ? cur.nombre : '') + '\\n';
      texto += '📅 *Período:* ' + nomPeriodo + '\\n';
      texto += '👤 *Docente:* Prof. Facundo Casciano\\n';
      texto += '------------------------------------------\\n';
      texto += '⚠️ *Estudiantes con menos del 70% de asistencia:*\\n\\n';

      if (enRiesgo.length === 0) {
        texto += '✅ Todos los estudiantes cumplen con el 70% o más de asistencia.';
      } else {
        enRiesgo.forEach((item, i) => {
          texto += (i + 1) + '. *' + item.est.apellido + ' ' + (item.est.nombre !== '-' ? item.est.nombre : '') + '*\\n';
          texto += '   - Asistencia: ' + item.stats.porcentaje + '% (' + item.stats.presentes + ' presentes de ' + item.stats.totalClases + ' clases)\\n';
          texto += '   - Faltas (Ausentes): ' + item.stats.ausentes + '\\n';
        });
      }

      texto += '\\n------------------------------------------\\n';
      texto += '_Generado automáticamente por TuProfeWeb_';

      navigator.clipboard.writeText(texto).then(() => {
        alert("¡Mensaje copiado al portapapeles!\\n\\nYa podés pegarlo en WhatsApp o mandárselo a la preceptora.");
      }).catch(() => {
        prompt("Copiá este texto para la preceptora:", texto);
      });
    }

    // ── DESCARGA DE EXCEL CON DETALLES COMPLETOS ──
    function descargarInformeDetalladoExcel() {
      const cur = state.cursos.find(c => c.id === cursoActivoId);
      const col = state.colegios.find(c => c.id === (cur ? cur.colegio_id : null));
      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoActivoId);
      const fechas = obtenerFechasDictadasCurso(cursoActivoId);

      const nomPeriodo = periodoSeleccionado === 'todo' ? 'Ciclo_Completo' : (periodoSeleccionado === 'p1' ? 'Periodo_1_Mar_Jul' : 'Periodo_2_Ago_Dic');

      const dataFilas = alumnos.map((est, i) => {
        const stats = calcularStatsEstudiante(est.id);
        const fila = {
          "#": i + 1,
          "Colegio": col ? col.nombre : "",
          "Curso": cur ? cur.nombre : "",
          "Período": nomPeriodo,
          "Apellido": est.apellido,
          "Nombre": est.nombre !== '-' ? est.nombre : '',
          "DNI": est.dni || '',
          "Clases Dictadas": stats.totalClases,
          "Presentes": stats.presentes,
          "Ausentes (Faltas)": stats.ausentes,
          "Justificadas": stats.justificadas,
          "Tardes": stats.tardes,
          "% Asistencia": stats.porcentaje + '%',
          "Estado Regularidad": stats.enRiesgo ? "⚠️ EN RIESGO (< 70% - AVISAR PRECEPTORIA)" : "REGULAR"
        };

        // Agregar columna para cada fecha
        fechas.forEach(f => {
          const estado = state.asistencias[f + '_' + est.id] || 'P';
          fila[f] = estado;
        });

        return fila;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataFilas);

      // Ajustar ancho de columnas automáticamente
      const wscols = [
        { wch: 4 },  // #
        { wch: 18 }, // Colegio
        { wch: 18 }, // Curso
        { wch: 18 }, // Período
        { wch: 20 }, // Apellido
        { wch: 20 }, // Nombre
        { wch: 12 }, // DNI
        { wch: 14 }, // Clases Dictadas
        { wch: 10 }, // Presentes
        { wch: 14 }, // Ausentes
        { wch: 12 }, // Justificadas
        { wch: 8 },  // Tardes
        { wch: 14 }, // % Asistencia
        { wch: 38 }  // Estado
      ];
      fechas.forEach(() => wscols.push({ wch: 12 }));
      ws['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, "Informe Asistencia");
      const nombreArchivo = "Informe_Preceptoria_" + (cur ? cur.nombre.replace(/[^a-zA-Z0-9]/g, '_') : 'Curso') + "_" + nomPeriodo + ".xlsx";
      XLSX.writeFile(wb, nombreArchivo);
    }

    function actualizarKPIs() {
      const cur = state.cursos.find(c => c.id === cursoActivoId);
      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoActivoId);
      const fechas = obtenerFechasDictadasCurso(cursoActivoId);

      document.getElementById('stat-total-alumnos').innerText = alumnos.length;
      document.getElementById('stat-clases-dictadas').innerText = fechas.length;

      let sumaPorcentajes = 0;
      let riesgoCount = 0;

      alumnos.forEach(e => {
        const stats = calcularStatsEstudiante(e.id);
        sumaPorcentajes += stats.porcentaje;
        if (stats.enRiesgo) riesgoCount++;
      });

      const promedio = alumnos.length > 0 ? Math.round(sumaPorcentajes / alumnos.length) : 0;
      document.getElementById('stat-asistencia-promedio').innerText = promedio + '%';
      document.getElementById('stat-alumnos-riesgo').innerText = riesgoCount;
    }

    function eliminarEstudiante(id) {
      if (confirm("¿Estás seguro de eliminar este estudiante del curso?")) {
        state.estudiantes = state.estudiantes.filter(e => e.id !== id);
        guardarEstado();
        seleccionarCurso(cursoActivoId);
      }
    }

    function manejarSubidaExcel(e) {
      const files = e.target.files;
      if (files && files.length > 0) {
        procesarArchivoExcel(files[0]);
      }
      e.target.value = '';
    }

    function procesarArchivoExcel(file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

          if (!rows || rows.length === 0) {
            alert("El archivo seleccionado está vacío.");
            return;
          }

          const dateCols = [];
          rows[0].forEach((col, idx) => {
            if (idx === 0) return;
            const str = String(col || '').trim();
            const dMatch = str.match(/^(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{2,4})$/);
            if (dMatch) {
              let dia = dMatch[1].padStart(2, '0');
              let mes = dMatch[2].padStart(2, '0');
              let anio = dMatch[3].length === 2 ? '20' + dMatch[3] : dMatch[3];
              dateCols.push({ colIndex: idx, dateIso: anio + '-' + mes + '-' + dia });
            }
          });

          let targetCursoId = cursoActivoId;
          const fileNameLower = (file.name + ' ' + sheetName).toLowerCase();
          const cursoMatch = state.cursos.find(c => {
            const nomClean = c.nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
            return fileNameLower.replace(/[^a-z0-9]/g, '').includes(nomClean) ||
                   (fileNameLower.includes('montaje') && fileNameLower.includes('4') && fileNameLower.includes('3') && c.id === 10);
          });
          if (cursoMatch) {
            targetCursoId = cursoMatch.id;
          }

          for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || !row[0]) continue;
            const texto = String(row[0]).trim();
            if (!texto || texto.toLowerCase().includes('total')) continue;

            let apellido = texto, nombre = '-';
            if (texto.includes(',')) {
              const p = texto.split(',');
              apellido = p[0].trim();
              nombre = p.slice(1).join(' ').trim() || '-';
            } else {
              const words = texto.split(/\\s+/);
              if (words.length > 1) {
                apellido = words[0];
                nombre = words.slice(1).join(' ');
              }
            }

            let est = state.estudiantes.find(e => 
              e.curso_id === targetCursoId && 
              e.apellido.toUpperCase() === apellido.toUpperCase()
            );

            if (!est) {
              est = {
                id: Date.now() + Math.floor(Math.random() * 10000) + r,
                curso_id: targetCursoId,
                apellido: apellido.toUpperCase(),
                nombre: nombre.toUpperCase(),
                dni: ''
              };
              state.estudiantes.push(est);
            }

            if (dateCols.length > 0) {
              dateCols.forEach(dc => {
                const val = String(row[dc.colIndex] || '').trim().toUpperCase();
                let estado = 'P';
                if (val === 'A') estado = 'A';
                else if (val === 'J') estado = 'J';
                else if (val === 'T') estado = 'T';
                state.asistencias[dc.dateIso + '_' + est.id] = estado;
              });
            }
          }

          guardarEstado();
          seleccionarCurso(targetCursoId);

          const nomCurso = (state.cursos.find(c => c.id === targetCursoId) || {}).nombre || '';
          alert('¡Planilla procesada con éxito!\\n\\n📁 Curso: ' + nomCurso + '\\n👥 Alumnos procesados: ' + (rows.length - 1) + '\\n📅 Fechas de asistencia: ' + dateCols.length);

        } catch(err) {
          console.error(err);
          alert("Error al procesar Excel: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  </script>
</body>
</html>`;

fs.writeFileSync('C:\\\\Users\\\\NuevoAdmin\\\\Desktop\\\\Dashboard_Docente.html', html, 'utf8');
console.log('Saved updated Dashboard_Docente.html with period filter and preceptor alert!');
