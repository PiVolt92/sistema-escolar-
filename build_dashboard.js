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

// Incidencias iniciales (licencias, paros, sin luz, etc.)
const incidenciasObj = {};
if (Array.isArray(dataExport.licencias)) {
  dataExport.licencias.forEach(lic => {
    const key = lic.fecha + '_' + (lic.curso_id || 'general');
    incidenciasObj[key] = {
      tipo: 'licencia',
      motivo: lic.motivo || 'Licencia Docente',
      descripcion: lic.descripcion || '',
      noComputa: true,
      fecha: lic.fecha,
      curso_id: lic.curso_id || null
    };
  });
}

const initialData = {
  colegios: dataExport.colegios,
  cursos: dataExport.cursos,
  estudiantes: estudiantes,
  asistencias: asistenciasObj,
  incidencias: incidenciasObj
};

console.log('Total students:', estudiantes.length, 'Total asistencias keys:', Object.keys(asistenciasObj).length, 'Total incidencias:', Object.keys(incidenciasObj).length);

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Escolar — Gestión Integral con Alertas, PDF e Incidencias</title>
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- FontAwesome Icons -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    body {
      font-family: 'Inter', sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
    }
    .amber-gradient {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    }
    .btn-amber {
      background-color: #e09f00;
      color: #0f172a;
    }
    .btn-amber:hover {
      background-color: #cca700;
    }
    .badge-presente {
      background-color: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    .badge-ausente {
      background-color: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    .badge-justificada {
      background-color: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .badge-tarde {
      background-color: #e0e7ff;
      color: #3730a3;
      border: 1px solid #c7d2fe;
    }
    .btn-disabled {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }
    /* Estilos para arrastrar y soltar archivo */
    .drag-active {
      border: 2px dashed #e09f00 !important;
      background-color: #fefce8 !important;
    }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)">

  <!-- BARRA DE NAVEGACIÓN SUPERIOR -->
  <header class="amber-gradient text-white shadow-md sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/40 text-amber-400 font-black text-xl shadow-inner">
          <i class="fa-solid fa-graduation-cap"></i>
        </div>
        <div>
          <h1 class="text-lg font-black tracking-tight text-white flex items-center gap-2">
            TuProfeWeb <span class="text-xs bg-amber-500 text-slate-950 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Gestión Escolar</span>
          </h1>
          <p class="text-xs text-slate-400">Prof. Facundo Casciano • E.E.S.T. / E.E.S.</p>
        </div>
      </div>

      <!-- Herramientas de Cabecera: Deshacer/Rehacer, Incidencias, Actualizar Archivo, Backup -->
      <div class="flex items-center space-x-2 sm:space-x-3">
        <!-- Deshacer / Rehacer -->
        <div class="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60 shadow-inner">
          <button onclick="deshacer()" id="btn-undo" title="Deshacer (Ctrl+Z)" class="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded font-bold text-xs transition btn-disabled">
            <i class="fa-solid fa-rotate-left mr-1"></i><span class="hidden md:inline">Deshacer</span>
          </button>
          <button onclick="rehacer()" id="btn-redo" title="Rehacer (Ctrl+Y)" class="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded font-bold text-xs transition btn-disabled">
            <i class="fa-solid fa-rotate-right mr-1"></i><span class="hidden md:inline">Rehacer</span>
          </button>
        </div>

        <!-- Botón Incidencia / Novedad Escolar -->
        <button onclick="abrirModalIncidencia()" class="bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs px-3 py-2 rounded-lg font-bold shadow-sm transition flex items-center space-x-1.5 border border-indigo-500/50">
          <i class="fa-solid fa-triangle-exclamation text-indigo-200"></i>
          <span class="hidden sm:inline">Días Especiales (Paro / Luz / Lic.)</span>
          <span class="sm:hidden">Días Esp.</span>
        </button>

        <!-- Botón Cargar / Actualizar Archivo -->
        <button onclick="document.getElementById('file-upload-excel').click()" class="btn-amber text-xs px-3.5 py-2 rounded-lg font-bold shadow-sm transition flex items-center space-x-1.5">
          <i class="fa-solid fa-file-arrow-up text-sm"></i>
          <span class="hidden sm:inline">Actualizar con Archivo</span>
          <span class="sm:hidden">Subir</span>
        </button>
        <input type="file" id="file-upload-excel" accept=".xlsx, .xls, .csv, .json, .backup" class="hidden" onchange="analizarYPrepararArchivo(event)">

        <!-- Copia de Seguridad -->
        <button onclick="abrirModalBackup()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-2 rounded-lg font-medium border border-slate-700 transition flex items-center space-x-1">
          <i class="fa-solid fa-floppy-disk text-amber-400"></i>
          <span class="hidden md:inline">Backup</span>
        </button>

        <button onclick="abrirModalNuevoEstudiante()" class="bg-slate-700/60 hover:bg-slate-700 text-white text-xs px-3 py-2 rounded-lg font-medium transition flex items-center space-x-1 border border-slate-600">
          <i class="fa-solid fa-user-plus text-amber-400"></i>
          <span class="hidden lg:inline">Nuevo Alumno</span>
        </button>
      </div>
    </div>
  </header>

  <!-- CONTENIDO PRINCIPAL -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">

    <!-- CABECERA INSTITUCIONAL Y FILTRO POR PERÍODO -->
    <div class="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center space-x-2">
          <span class="text-xs font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">Ciclo Lectivo 2026</span>
          <span id="badge-periodo-activo" class="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">Todo el Año</span>
        </div>
        <h2 id="titulo-institucion" class="text-xl font-bold text-slate-900 mt-1">E.E.S.T. N° 4 / E.E.S. — Control de Asistencia y Regularidad</h2>
        <p class="text-xs text-slate-500">Visualización de asistencia, umbral mínimo de regularidad del 70% y reporte a Preceptoría.</p>
      </div>

      <!-- SELECTOR DE PERÍODO ESCOLAR -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
        <span class="text-xs font-bold text-slate-500 px-2">Período:</span>
        <div class="grid grid-cols-3 gap-1 w-full sm:w-auto">
          <button onclick="cambiarPeriodo('todo')" id="btn-periodo-todo" class="px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs bg-amber-500 text-slate-950">
            🌟 Todo el Año
          </button>
          <button onclick="cambiarPeriodo('p1')" id="btn-periodo-p1" class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition hover:bg-slate-200">
            📘 1° Período <span class="text-[10px] block opacity-80">(Mar - Jul)</span>
          </button>
          <button onclick="cambiarPeriodo('p2')" id="btn-periodo-p2" class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition hover:bg-slate-200">
            📙 2° Período <span class="text-[10px] block opacity-80">(Ago - Dic)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- BANNER DE ALERTA DE PRECEPTORÍA (< 70% ASISTENCIA) -->
    <div id="alerta-preceptoria-container" class="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 mb-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hidden">
      <div class="flex items-start space-x-3.5">
        <div class="w-10 h-10 rounded-lg bg-rose-600 text-white flex items-center justify-center text-xl shrink-0 shadow-sm mt-0.5">
          <i class="fa-solid fa-bell"></i>
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <h3 class="text-sm font-black text-rose-900 uppercase tracking-wide">
              ⚠️ Alerta de Preceptoría: Estudiantes en Riesgo (<span id="alerta-conteo-riesgo">0</span>)
            </h3>
            <span class="text-[11px] bg-rose-200 text-rose-800 font-extrabold px-2 py-0.5 rounded-full">Menos del 70% Asistencia</span>
          </div>
          <p class="text-xs text-rose-700 mt-0.5">
            Los siguientes alumnos no alcanzan el 70% de asistencia obligatoria y deben ser notificados por Preceptoría:
          </p>
          <div id="alerta-chips-alumnos" class="flex flex-wrap gap-1.5 mt-2"></div>
        </div>
      </div>

      <!-- BOTONES DE ACCIÓN PRECEPTORÍA -->
      <div class="flex flex-wrap items-center gap-2 shrink-0">
        <button onclick="descargarAlertaPreceptoriaPDF()" class="bg-rose-700 hover:bg-rose-800 text-white text-xs px-3.5 py-2 rounded-lg font-bold shadow-xs transition flex items-center space-x-1.5">
          <i class="fa-solid fa-file-pdf text-rose-200"></i>
          <span>Descargar Alerta PDF</span>
        </button>
        <button onclick="copiarInformePreceptoria()" class="bg-white hover:bg-slate-50 text-rose-700 border border-rose-300 text-xs px-3.5 py-2 rounded-lg font-bold shadow-xs transition flex items-center space-x-1.5">
          <i class="fa-brands fa-whatsapp text-emerald-600 text-base"></i>
          <span>Copiar Mensaje WhatsApp</span>
        </button>
        <button onclick="descargarExcelProfesionalMultiHoja()" class="bg-rose-600 hover:bg-rose-700 text-white text-xs px-3.5 py-2 rounded-lg font-bold shadow-xs transition flex items-center space-x-1.5">
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
          <p class="text-xs font-medium text-slate-500">Matrícula del Curso</p>
          <h3 id="stat-total-alumnos" class="text-2xl font-bold text-slate-800">0</h3>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <div class="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
          <i class="fa-solid fa-user-check"></i>
        </div>
        <div>
          <p class="text-xs font-medium text-slate-500">% Asistencia Promedio</p>
          <h3 id="stat-asistencia-promedio" class="text-2xl font-bold text-emerald-600">0%</h3>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <div class="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
          <i class="fa-solid fa-calendar-check"></i>
        </div>
        <div>
          <p class="text-xs font-medium text-slate-500">Clases Computadas</p>
          <h3 id="stat-clases-evaluadas" class="text-2xl font-bold text-slate-800">0</h3>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <div class="w-12 h-12 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-xl">
          <i class="fa-solid fa-user-xmark"></i>
        </div>
        <div>
          <p class="text-xs font-medium text-slate-500">Alumnos &lt; 70% Asist.</p>
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
            <p class="text-xs text-slate-500">Hacé clic en cualquier curso para ver la planilla y las alertas</p>
          </div>
        </div>
        <div id="lista-cursos" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"></div>
      </div>
    </div>

    <!-- DETALLE DEL CURSO ACTIVO -->
    <div id="seccion-curso-activo" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200">
        <div>
          <div class="flex items-center space-x-2">
            <span id="badge-turno" class="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Turno</span>
            <span id="badge-incidencia-activa" class="hidden text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300"></span>
          </div>
          <h2 id="curso-activo-titulo" class="text-xl font-bold text-slate-900 mt-1">Nombre del Curso</h2>
          <p id="curso-activo-subtitulo" class="text-xs text-slate-500">Alumnos registrados</p>
        </div>

        <!-- Barra de Herramientas y Asistencia -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- Deshacer / Rehacer Rápido -->
          <div class="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 mr-1">
            <button onclick="deshacer()" id="btn-undo-toolbar" title="Deshacer (Ctrl+Z)" class="px-2 py-1 text-slate-600 hover:text-slate-900 rounded font-bold text-xs btn-disabled">
              <i class="fa-solid fa-rotate-left"></i>
            </button>
            <button onclick="rehacer()" id="btn-redo-toolbar" title="Rehacer (Ctrl+Y)" class="px-2 py-1 text-slate-600 hover:text-slate-900 rounded font-bold text-xs btn-disabled">
              <i class="fa-solid fa-rotate-right"></i>
            </button>
          </div>

          <!-- Selector de Fecha de Clase -->
          <div class="flex items-center bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <i class="fa-regular fa-calendar-days text-slate-500 mr-2"></i>
            <input type="date" id="fecha-asistencia" class="bg-transparent font-bold text-slate-700 outline-none cursor-pointer" onchange="alCambiarFecha()">
          </div>

          <!-- Botón de Estado / Novedad del Día -->
          <button onclick="abrirModalIncidencia()" id="btn-estado-dia" class="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs px-2.5 py-1.5 rounded-lg font-bold transition flex items-center space-x-1">
            <i class="fa-solid fa-tag text-amber-500"></i>
            <span id="btn-estado-dia-texto">🟢 Clase Normal</span>
          </button>

          <button onclick="marcarTodos('P')" id="btn-marcar-todos-p" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-2 rounded-lg font-semibold shadow-sm transition">
            <i class="fa-solid fa-check-double mr-1"></i> Todos Presentes
          </button>

          <button onclick="marcarTodos('A')" id="btn-marcar-todos-a" class="bg-rose-600 hover:bg-rose-700 text-white text-xs px-3 py-2 rounded-lg font-semibold shadow-sm transition">
            <i class="fa-solid fa-xmark mr-1"></i> Todos Ausentes
          </button>
          
          <button onclick="descargarExcelProfesionalMultiHoja()" class="btn-amber text-xs px-3 py-2 rounded-lg font-bold shadow-sm transition flex items-center space-x-1">
            <i class="fa-solid fa-file-excel mr-1"></i> Excel Pro
          </button>

          <button onclick="descargarAlertaPreceptoriaPDF()" class="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs px-3 py-2 rounded-lg font-bold shadow-sm transition flex items-center space-x-1">
            <i class="fa-solid fa-file-pdf text-rose-600 mr-1"></i> Acta PDF
          </button>
        </div>
      </div>

      <!-- BANNER INFORMATIVO SI ESTE DÍA TIENE INCIDENCIA (PARO, SIN LUZ, LICENCIA) -->
      <div id="banner-dia-incidencia" class="hidden mb-4 p-3.5 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl flex items-center justify-between shadow-xs">
        <div class="flex items-center space-x-3">
          <div id="banner-incidencia-icono" class="text-xl text-amber-600">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <h4 id="banner-incidencia-titulo" class="text-sm font-bold text-amber-900">Día Especial Registrado</h4>
            <p id="banner-incidencia-desc" class="text-xs text-amber-700 mt-0.5">Este día no computa inasistencias injustificadas a la matrícula escolar.</p>
          </div>
        </div>
        <button onclick="abrirModalIncidencia()" class="text-xs font-bold text-amber-800 hover:text-amber-950 underline px-2 py-1">
          Cambiar / Quitar
        </button>
      </div>

      <!-- TABLA DE ALUMNOS Y ASISTENCIAS -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm border-collapse">
          <thead>
            <tr class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
              <th class="py-3 px-3 font-semibold text-center w-12">#</th>
              <th class="py-3 px-4 font-semibold">Apellido y Nombre</th>
              <th class="py-3 px-4 font-semibold text-center">Estado de Asistencia Hoy</th>
              <th class="py-3 px-4 font-semibold text-center">Clases / Asist.</th>
              <th class="py-3 px-4 font-semibold text-center">% Asistencia</th>
              <th class="py-3 px-4 font-semibold text-center">Condición Preceptoría</th>
              <th class="py-3 px-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-estudiantes-tbody" class="divide-y divide-slate-100"></tbody>
        </table>
      </div>
    </div>
  </main>

  <!-- MODAL: REGISTRO DE DÍA ESPECIAL / INCIDENCIA (PARO, SIN LUZ, LICENCIA, ETC.) -->
  <div id="modal-incidencia" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
    <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center space-x-2.5">
          <div class="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <i class="fa-solid fa-calendar-day"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Novedad Institucional del Día</h3>
            <p class="text-xs text-slate-500">Fecha seleccionada: <span id="modal-incidencia-fecha-txt" class="font-bold text-slate-800"></span></p>
          </div>
        </div>
        <button onclick="cerrarModalIncidencia()" class="text-slate-400 hover:text-slate-600 text-lg p-1">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Situación o Tipo de Novedad:</label>
          <select id="incidencia-tipo-select" onchange="alCambiarTipoIncidencia()" class="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 bg-white font-medium focus:ring-2 focus:ring-amber-500 outline-none">
            <option value="normal">🟢 Clases Normales (Sin Novedad)</option>
            <option value="paro">🛑 Paro Docente / Gremial</option>
            <option value="sin_luz">⚡ Sin Luz / Corte de Energía Eléctrica</option>
            <option value="sin_agua">💧 Sin Agua / Problemas Sanitarios</option>
            <option value="licencia">🩺 Licencia Docente (Art. 114 / Examen / Médica)</option>
            <option value="jornada">🏛️ Jornada Institucional / PNFP / Capacitación</option>
            <option value="feriado">🇦🇷 Feriado Nacional / Asueto Escolar</option>
            <option value="acto">🎖️ Acto Escolar / Conmemoración</option>
            <option value="clima">🌧️ Suspensión por Temporal / Alerta Meteorológica</option>
            <option value="desinfeccion">🧪 Desinfección / Fumigación Edilicia</option>
            <option value="otro">ℹ️ Otra Situación Particular</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Motivo o Detalle Explicativo (opcional):</label>
          <input type="text" id="incidencia-motivo-input" placeholder="Ej: Medida gremial provincial / Corte general en el barrio" class="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none">
        </div>

        <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start space-x-2">
          <i class="fa-solid fa-circle-info text-amber-600 mt-0.5"></i>
          <div>
            <strong>Impacto Pedagógico en Asistencia:</strong>
            <p class="mt-0.5 text-amber-800">
              Al marcar este día, los estudiantes <strong>no acumularán inasistencias injustificadas</strong> y el día quedará asentado en el Acta Oficial de Preceptoría y en el Libro Excel.
            </p>
          </div>
        </div>

        <!-- Ámbito de aplicación -->
        <div class="flex items-center space-x-4 pt-1 text-xs">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="radio" name="incidencia-alcance" value="curso" checked class="text-amber-500 focus:ring-amber-400">
            <span class="font-medium text-slate-700">Solo para este curso</span>
          </label>
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="radio" name="incidencia-alcance" value="colegio" class="text-amber-500 focus:ring-amber-400">
            <span class="font-medium text-slate-700">Para toda la escuela / todos los cursos</span>
          </label>
        </div>
      </div>

      <div class="flex items-center justify-between pt-5 mt-5 border-t border-slate-100">
        <button onclick="quitarIncidencia()" id="btn-quitar-incidencia" class="text-xs text-rose-600 hover:text-rose-800 font-bold px-3 py-2 rounded-lg hover:bg-rose-50 transition">
          <i class="fa-solid fa-trash-can mr-1"></i> Quitar Novedad
        </button>
        <div class="flex space-x-2">
          <button onclick="cerrarModalIncidencia()" class="text-xs text-slate-600 hover:bg-slate-100 font-bold px-4 py-2 rounded-lg transition">
            Cancelar
          </button>
          <button onclick="guardarIncidencia()" class="btn-amber text-xs font-bold px-5 py-2 rounded-lg shadow-sm transition">
            Guardar Novedad
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL: CENTRO DE COPIA DE SEGURIDAD Y RESTAURACIÓN -->
  <div id="modal-backup" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
    <div class="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center space-x-2.5">
          <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <i class="fa-solid fa-shield-halved text-lg"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Centro de Copias de Seguridad</h3>
            <p class="text-xs text-slate-500">Respaldo total de estudiantes, asistencias y novedades</p>
          </div>
        </div>
        <button onclick="cerrarModalBackup()" class="text-slate-400 hover:text-slate-600 text-lg p-1">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="space-y-4">
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <h4 class="text-sm font-bold text-slate-800">Descargar Copia de Seguridad</h4>
            <p class="text-xs text-slate-500 mt-0.5">Guarda un archivo .json completo en tu computadora.</p>
          </div>
          <button onclick="descargarCopiaSeguridadJSON()" class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2.5 rounded-lg font-bold shadow-sm transition whitespace-nowrap ml-3">
            <i class="fa-solid fa-download mr-1"></i> Descargar Respaldo
          </button>
        </div>

        <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <h4 class="text-sm font-bold text-slate-800">Restaurar Copia de Seguridad</h4>
            <p class="text-xs text-slate-500 mt-0.5">Seleccioná un archivo de respaldo previo para restaurarlo.</p>
          </div>
          <button onclick="document.getElementById('file-restore-backup').click()" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2.5 rounded-lg font-bold shadow-sm transition whitespace-nowrap ml-3">
            <i class="fa-solid fa-upload mr-1"></i> Subir Archivo
          </button>
          <input type="file" id="file-restore-backup" accept=".json, .backup" class="hidden" onchange="procesarArchivoBackup(event)">
        </div>
      </div>

      <div class="mt-6 pt-3 border-t border-slate-100 flex justify-end">
        <button onclick="cerrarModalBackup()" class="text-xs text-slate-600 hover:bg-slate-100 font-bold px-4 py-2 rounded-lg transition">
          Cerrar
        </button>
      </div>
    </div>
  </div>

  <!-- MODAL: VISTA PREVIA Y CONFIRMACIÓN DE ACTUALIZACIÓN INTELIGENTE -->
  <div id="modal-preview-actualizacion" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
    <div class="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center space-x-2.5">
          <div class="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
            <i class="fa-solid fa-file-excel text-lg"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Actualización Inteligente de Archivo</h3>
            <p class="text-xs text-slate-500" id="preview-nombre-archivo">Archivo detectado</p>
          </div>
        </div>
        <button onclick="cerrarModalPreviewActualizacion()" class="text-slate-400 hover:text-slate-600 text-lg p-1">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="space-y-4">
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p class="text-[11px] font-bold text-amber-700 uppercase">Alumnos en Archivo</p>
            <p id="preview-total-alumnos" class="text-xl font-black text-amber-900 mt-1">0</p>
          </div>
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p class="text-[11px] font-bold text-blue-700 uppercase">Fechas de Clase</p>
            <p id="preview-total-fechas" class="text-xl font-black text-blue-900 mt-1">0</p>
          </div>
          <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <p class="text-[11px] font-bold text-emerald-700 uppercase">Curso Detectado</p>
            <p id="preview-curso-destino" class="text-xs font-black text-emerald-900 mt-2 truncate">---</p>
          </div>
        </div>

        <div class="space-y-2">
          <label class="block text-xs font-bold text-slate-700">Seleccionar el Curso de Destino:</label>
          <select id="preview-select-curso" class="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white font-medium focus:ring-2 focus:ring-amber-500 outline-none"></select>
        </div>

        <div class="space-y-3 pt-2">
          <div class="border border-amber-300 bg-amber-50/70 p-3.5 rounded-xl flex items-start space-x-3 cursor-pointer hover:bg-amber-50 transition" onclick="document.getElementById('radio-modo-merge').checked = true">
            <input type="radio" id="radio-modo-merge" name="modo-actualizacion" value="merge" checked class="mt-1 text-amber-600 focus:ring-amber-500">
            <div>
              <label for="radio-modo-merge" class="text-xs font-black text-amber-950 block cursor-pointer">
                🔄 Actualizar y Fusionar (Smart Merge - Recomendado)
              </label>
              <p class="text-[11px] text-amber-800 mt-0.5">
                Conserva todo el historial previo. Si el archivo trae clases nuevas las agrega, si hay alumnos nuevos los suma a la lista y actualiza asistencias sin duplicar datos.
              </p>
            </div>
          </div>

          <div class="border border-slate-200 bg-slate-50/70 p-3.5 rounded-xl flex items-start space-x-3 cursor-pointer hover:bg-slate-100 transition" onclick="document.getElementById('radio-modo-replace').checked = true">
            <input type="radio" id="radio-modo-replace" name="modo-actualizacion" value="replace" class="mt-1 text-slate-600 focus:ring-amber-500">
            <div>
              <label for="radio-modo-replace" class="text-xs font-bold text-slate-900 block cursor-pointer">
                ⚡ Reemplazar la lista de este curso
              </label>
              <p class="text-[11px] text-slate-500 mt-0.5">
                Elimina los alumnos y asistencias anteriores de este curso y los reemplaza exactamente por lo que está en este archivo.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end space-x-2 pt-5 mt-5 border-t border-slate-100">
        <button onclick="cerrarModalPreviewActualizacion()" class="text-xs text-slate-600 hover:bg-slate-100 font-bold px-4 py-2 rounded-lg transition">
          Cancelar
        </button>
        <button onclick="ejecutarActualizacionConfirmada()" class="btn-amber text-xs font-black px-5 py-2.5 rounded-lg shadow-sm transition flex items-center space-x-1.5">
          <i class="fa-solid fa-bolt"></i>
          <span>Confirmar y Aplicar Cambios</span>
        </button>
      </div>
    </div>
  </div>

  <!-- MODAL PARA NUEVO ESTUDIANTE -->
  <div id="modal-nuevo-estudiante" class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
    <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <h3 class="text-base font-bold text-slate-900">Agregar Nuevo Estudiante</h3>
        <button onclick="cerrarModalNuevoEstudiante()" class="text-slate-400 hover:text-slate-600 text-lg">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">Apellido:</label>
          <input type="text" id="nuevo-apellido" class="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">Nombre:</label>
          <input type="text" id="nuevo-nombre" class="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">DNI:</label>
          <input type="text" id="nuevo-dni" class="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none">
        </div>
      </div>
      <div class="flex items-center justify-end space-x-2 pt-4 mt-4 border-t border-slate-100">
        <button onclick="cerrarModalNuevoEstudiante()" class="text-xs text-slate-600 hover:bg-slate-100 font-bold px-4 py-2 rounded-lg transition">Cancelar</button>
        <button onclick="guardarNuevoEstudiante()" class="btn-amber text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition">Guardar</button>
      </div>
    </div>
  </div>

  <!-- TOAST DE NOTIFICACIÓN RÁPIDA -->
  <div id="toast-notificacion" class="fixed bottom-5 right-5 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 transition-all duration-300 transform translate-y-20 opacity-0 z-50">
    <i class="fa-solid fa-circle-check text-emerald-400 text-base"></i>
    <span id="toast-mensaje" class="font-medium">Cambio guardado</span>
  </div>

  <!-- SCRIPTS Y MOTOR LÓGICO COMPLETO -->
  <script>
    ${xlsxCode}

    // DATOS INICIALES AUTÓNOMOS
    let state = ${JSON.stringify(initialData)};

    // ESTADO DE NAVEGACIÓN Y CONFIGURACIÓN
    let colegioActivoId = state.colegios.length > 0 ? state.colegios[0].id : 1;
    let cursoActivoId = 10; // 4° 3 MONTAJE GB por defecto
    let periodoSeleccionado = 'todo'; // 'todo', 'p1' (Mar-Jul), 'p2' (Ago-Dic)
    let fechaHoyStr = new Date().toISOString().split('T')[0];

    // PILAS DE HISTORIAL PARA DESHACER / REHACER (40 PASOS)
    let historyStack = [];
    let redoStack = [];
    const MAX_HISTORY = 40;

    function guardarEstado(limpiarRedo = true) {
      if (historyStack.length >= MAX_HISTORY) {
        historyStack.shift();
      }
      historyStack.push(JSON.stringify(state));
      if (limpiarRedo) {
        redoStack = [];
      }
      actualizarBotonesDeshacerRehacer();
    }

    function deshacer() {
      if (historyStack.length === 0) return;
      redoStack.push(JSON.stringify(state));
      const estadoPrevio = historyStack.pop();
      state = JSON.parse(estadoPrevio);
      actualizarBotonesDeshacerRehacer();
      renderTodo();
      mostrarToastRapido("↶ Acción deshecha con éxito");
    }

    function rehacer() {
      if (redoStack.length === 0) return;
      historyStack.push(JSON.stringify(state));
      const estadoSiguiente = redoStack.pop();
      state = JSON.parse(estadoSiguiente);
      actualizarBotonesDeshacerRehacer();
      renderTodo();
      mostrarToastRapido("↷ Acción rehecha con éxito");
    }

    function actualizarBotonesDeshacerRehacer() {
      const uBtn = document.getElementById('btn-undo');
      const rBtn = document.getElementById('btn-redo');
      const uBtnT = document.getElementById('btn-undo-toolbar');
      const rBtnT = document.getElementById('btn-redo-toolbar');

      if (historyStack.length > 0) {
        uBtn.classList.remove('btn-disabled');
        if (uBtnT) uBtnT.classList.remove('btn-disabled');
      } else {
        uBtn.classList.add('btn-disabled');
        if (uBtnT) uBtnT.classList.add('btn-disabled');
      }

      if (redoStack.length > 0) {
        rBtn.classList.remove('btn-disabled');
        if (rBtnT) rBtnT.classList.remove('btn-disabled');
      } else {
        rBtn.classList.add('btn-disabled');
        if (rBtnT) rBtnT.classList.add('btn-disabled');
      }
    }

    // Atajos de Teclado Globales (Ctrl+Z / Ctrl+Y)
    window.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            e.preventDefault();
            rehacer();
          } else {
            e.preventDefault();
            deshacer();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          rehacer();
        }
      }
    });

    // =========================================================================
    // 🏷️ SISTEMA DE INCIDENCIAS / DÍAS ESPECIALES (PARO, SIN LUZ, LICENCIA...)
    // =========================================================================
    function obtenerIncidenciaDia(fecha, cursoId) {
      if (!state.incidencias) state.incidencias = {};
      // Prioridad 1: Incidencia del curso específico
      if (state.incidencias[fecha + '_' + cursoId]) {
        return state.incidencias[fecha + '_' + cursoId];
      }
      // Prioridad 2: Incidencia general de la escuela
      if (state.incidencias[fecha + '_general']) {
        return state.incidencias[fecha + '_general'];
      }
      return null;
    }

    function alCambiarFecha() {
      actualizarEstadoDiaUI();
      renderTablaEstudiantes();
    }

    function actualizarEstadoDiaUI() {
      const fecha = document.getElementById('fecha-asistencia').value || fechaHoyStr;
      const inc = obtenerIncidenciaDia(fecha, cursoActivoId);
      const btnTexto = document.getElementById('btn-estado-dia-texto');
      const badgeActiva = document.getElementById('badge-incidencia-activa');
      const banner = document.getElementById('banner-dia-incidencia');
      const btnP = document.getElementById('btn-marcar-todos-p');
      const btnA = document.getElementById('btn-marcar-todos-a');

      if (!inc || inc.tipo === 'normal') {
        btnTexto.innerHTML = '🟢 Clase Normal';
        badgeActiva.classList.add('hidden');
        banner.classList.add('hidden');
        if (btnP) btnP.classList.remove('btn-disabled');
        if (btnA) btnA.classList.remove('btn-disabled');
      } else {
        const info = getInfoIncidencia(inc.tipo);
        btnTexto.innerHTML = info.icono + ' ' + info.nombreCorto;
        badgeActiva.classList.remove('hidden');
        badgeActiva.innerHTML = info.icono + ' ' + (inc.motivo || info.nombreCorto);
        
        banner.classList.remove('hidden');
        document.getElementById('banner-incidencia-titulo').innerHTML = info.icono + ' ' + (inc.motivo || info.titulo);
        document.getElementById('banner-incidencia-desc').innerHTML = (inc.descripcion ? inc.descripcion + ' • ' : '') + 'Este día está registrado como sin clase computable. No acumula inasistencias a los estudiantes.';
        
        // Deshabilitar botones de asistencia masiva para evitar faltas accidentales
        if (btnP) btnP.classList.add('btn-disabled');
        if (btnA) btnA.classList.add('btn-disabled');
      }
    }

    function getInfoIncidencia(tipo) {
      switch(tipo) {
        case 'paro': return { icono: '🛑', nombreCorto: 'Paro Docente', titulo: 'Día de Paro Docente / Gremial' };
        case 'sin_luz': return { icono: '⚡', nombreCorto: 'Sin Luz', titulo: 'Corte de Suministro Eléctrico / Sin Luz' };
        case 'sin_agua': return { icono: '💧', nombreCorto: 'Sin Agua', titulo: 'Falta de Suministro de Agua Potable' };
        case 'licencia': return { icono: '🩺', nombreCorto: 'Licencia Docente', titulo: 'Licencia Docente (Art. 114 / Examen / Médica)' };
        case 'jornada': return { icono: '🏛️', nombreCorto: 'Jornada Inst.', titulo: 'Jornada Institucional / PNFP' };
        case 'feriado': return { icono: '🇦🇷', nombreCorto: 'Feriado / Asueto', titulo: 'Feriado Nacional / Asueto Escolar' };
        case 'acto': return { icono: '🎖️', nombreCorto: 'Acto Escolar', titulo: 'Acto Escolar Conmemorativo' };
        case 'clima': return { icono: '🌧️', nombreCorto: 'Suspensión Clima', titulo: 'Suspensión por Alerta Meteorológica' };
        case 'desinfeccion': return { icono: '🧪', nombreCorto: 'Desinfección', titulo: 'Suspensión por Desinfección Edilicia' };
        default: return { icono: 'ℹ️', nombreCorto: 'Novedad', titulo: 'Novedad Institucional' };
      }
    }

    function abrirModalIncidencia() {
      const fecha = document.getElementById('fecha-asistencia').value || fechaHoyStr;
      document.getElementById('modal-incidencia-fecha-txt').textContent = formatearFechaLegible(fecha);
      const inc = obtenerIncidenciaDia(fecha, cursoActivoId);
      
      const select = document.getElementById('incidencia-tipo-select');
      const inputMotivo = document.getElementById('incidencia-motivo-input');
      const btnQuitar = document.getElementById('btn-quitar-incidencia');

      if (inc && inc.tipo !== 'normal') {
        select.value = inc.tipo;
        inputMotivo.value = inc.motivo || '';
        btnQuitar.classList.remove('hidden');
      } else {
        select.value = 'paro';
        inputMotivo.value = '';
        btnQuitar.classList.add('hidden');
      }

      document.getElementById('modal-incidencia').classList.remove('hidden');
    }

    function cerrarModalIncidencia() {
      document.getElementById('modal-incidencia').classList.add('hidden');
    }

    function alCambiarTipoIncidencia() {
      const select = document.getElementById('incidencia-tipo-select');
      const inputMotivo = document.getElementById('incidencia-motivo-input');
      const info = getInfoIncidencia(select.value);
      if (select.value === 'normal') {
        inputMotivo.value = '';
      } else if (!inputMotivo.value || inputMotivo.value.startsWith('Día') || inputMotivo.value.startsWith('Corte') || inputMotivo.value.startsWith('Paro') || inputMotivo.value.startsWith('Licencia') || inputMotivo.value.startsWith('Sin')) {
        inputMotivo.value = info.titulo;
      }
    }

    function guardarIncidencia() {
      const fecha = document.getElementById('fecha-asistencia').value || fechaHoyStr;
      const select = document.getElementById('incidencia-tipo-select');
      const tipo = select.value;
      const motivo = document.getElementById('incidencia-motivo-input').value.trim() || getInfoIncidencia(tipo).titulo;
      const alcance = document.querySelector('input[name="incidencia-alcance"]:checked').value;

      if (!state.incidencias) state.incidencias = {};
      guardarEstado(true);

      const key = alcance === 'colegio' ? (fecha + '_general') : (fecha + '_' + cursoActivoId);

      if (tipo === 'normal') {
        delete state.incidencias[fecha + '_' + cursoActivoId];
        delete state.incidencias[fecha + '_general'];
        mostrarToastRapido("🟢 Día restablecido como Clase Normal");
      } else {
        state.incidencias[key] = {
          tipo: tipo,
          motivo: motivo,
          descripcion: '',
          noComputa: true,
          fecha: fecha,
          curso_id: alcance === 'colegio' ? null : cursoActivoId
        };
        mostrarToastRapido("✅ Novedad registrada: " + motivo);
      }

      cerrarModalIncidencia();
      actualizarEstadoDiaUI();
      renderTablaEstudiantes();
      renderAlertasPreceptoria();
      actualizarEstadisticas();
    }

    function quitarIncidencia() {
      const fecha = document.getElementById('fecha-asistencia').value || fechaHoyStr;
      guardarEstado(true);
      if (state.incidencias) {
        delete state.incidencias[fecha + '_' + cursoActivoId];
        delete state.incidencias[fecha + '_general'];
      }
      mostrarToastRapido("🟢 Novedad eliminada. Clase normal.");
      cerrarModalIncidencia();
      actualizarEstadoDiaUI();
      renderTablaEstudiantes();
      renderAlertasPreceptoria();
      actualizarEstadisticas();
    }

    // =========================================================================
    // 📄 GENERADOR PROFESIONAL DE ACTA Y ALERTA EN PDF PARA PRECEPTORÍA
    // =========================================================================
    function descargarAlertaPreceptoriaPDF() {
      const cur = state.cursos.find(c => c.id === cursoActivoId);
      const col = state.colegios.find(c => c.id === (cur ? cur.colegio_id : null));
      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoActivoId);
      const fechas = obtenerFechasDictadasCurso(cursoActivoId);

      const nomPeriodo = periodoSeleccionado === 'todo' ? 'Ciclo Lectivo Completo (Marzo - Diciembre)' : (periodoSeleccionado === 'p1' ? '1° Período (Marzo - Julio)' : '2° Período (Agosto - Diciembre)');

      const enRiesgo = [];
      alumnos.forEach(est => {
        const stats = calcularStatsEstudiante(est.id);
        if (stats.enRiesgo) {
          const fechasAusente = [];
          fechas.forEach(f => {
            const inc = obtenerIncidenciaDia(f, cursoActivoId);
            if (inc && inc.noComputa) return; // Días de paro/luz no cuentan como falta
            const estado = state.asistencias[f + '_' + est.id] || 'P';
            if (estado === 'A') {
              const p = f.split('-');
              fechasAusente.push(p.length === 3 ? (p[2] + '/' + p[1]) : f);
            }
          });
          enRiesgo.push({ est: est, stats: stats, fechasAusente: fechasAusente });
        }
      });

      // Recopilar incidencias de este período
      const listaIncidenciasPeriodo = [];
      fechas.forEach(f => {
        const inc = obtenerIncidenciaDia(f, cursoActivoId);
        if (inc && inc.tipo !== 'normal') {
          const p = f.split('-');
          const fLegible = p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : f;
          listaIncidenciasPeriodo.push({ fecha: fLegible, info: getInfoIncidencia(inc.tipo), motivo: inc.motivo });
        }
      });

      const fechaHoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const horaHoy = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

      let filasHtml = '';
      if (enRiesgo.length === 0) {
        filasHtml = '<tr><td colspan="9" style="text-align:center; padding: 25px; color: #166534; background: #f0fdf4; font-weight: bold; font-size: 11pt;">✅ Enhorabuena: No se registran estudiantes con asistencia menor al 70% en este período. Toda la matrícula cumple las pautas de regularidad escolar.</td></tr>';
      } else {
        enRiesgo.forEach((item, index) => {
          const ausTexto = item.fechasAusente.length > 0 
            ? item.fechasAusente.map(f => '<span style="display:inline-block; background:#fee2e2; color:#991b1b; padding:1px 5px; border-radius:3px; margin:1px; font-size:8pt; font-weight:700;">' + f + '</span>').join('')
            : '<span style="color:#64748b; font-style:italic;">Sin registro</span>';

          filasHtml += '<tr style="border-bottom: 1px solid #cbd5e1; page-break-inside: avoid;">'
            + '<td style="padding: 7px 5px; text-align: center; font-weight: bold; color: #475569;">' + (index + 1) + '</td>'
            + '<td style="padding: 7px 6px; font-weight: 700; color: #0f172a; font-size: 10pt;">' + (item.est.apellido + ', ' + item.est.nombre).toUpperCase() + '</td>'
            + '<td style="padding: 7px 5px; text-align: center; color: #475569; font-size: 8.5pt;">' + (item.est.dni || '---') + '</td>'
            + '<td style="padding: 7px 5px; text-align: center; font-weight: 600;">' + item.stats.totalClases + '</td>'
            + '<td style="padding: 7px 5px; text-align: center; color: #15803d; font-weight: 700;">' + item.stats.presentes + '</td>'
            + '<td style="padding: 7px 5px; text-align: center; color: #b91c1c; font-weight: 800; background: #fff1f2;">' + item.stats.ausentes + '</td>'
            + '<td style="padding: 7px 5px; text-align: center; font-weight: 800; color: #991b1b; background: #fee2e2; font-size: 11pt; border: 1px solid #f87171; border-radius: 4px;">' + item.stats.porcentaje + '%</td>'
            + '<td style="padding: 6px 6px; font-size: 8.5pt;">' + ausTexto + '</td>'
            + '<td style="padding: 6px 6px; text-align: center; font-size: 8pt; color: #334155;"><div style="border-bottom: 1px dashed #94a3b8; height: 20px; margin-bottom: 2px;"></div><span>Notif. / Fecha</span></td>'
            + '</tr>';
        });
      }

      // Bloque de incidencias
      let bloqueIncidenciasHtml = '';
      if (listaIncidenciasPeriodo.length > 0) {
        bloqueIncidenciasHtml = '<div style="margin-top:14px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:8px 12px; font-size:8.5pt;">'
          + '<strong style="color:#0f172a;">📅 DÍAS SIN CLASE COMPUTABLE / NOVEDADES INSTITUCIONALES EN ESTE PERÍODO:</strong>'
          + '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:4px;">';
        listaIncidenciasPeriodo.forEach(inc => {
          bloqueIncidenciasHtml += '<span style="background:#e2e8f0; padding:2px 8px; border-radius:4px; color:#334155;"><strong>' + inc.fecha + ':</strong> ' + inc.info.icono + ' ' + inc.motivo + '</span>';
        });
        bloqueIncidenciasHtml += '</div>'
          + '<p style="color:#64748b; margin-top:4px; font-size:7.5pt;">* Estos días no han generado inasistencias injustificadas a los alumnos según normativa vigente.</p>'
          + '</div>';
      }

      const win = window.open('', '_blank');
      if (!win) {
        alert("Por favor habilita las ventanas emergentes (popups) en tu navegador para ver y descargar el Acta en PDF.");
        return;
      }

      const docHtml = '<!DOCTYPE html>'
        + '<html lang="es">'
        + '<head>'
        + '<meta charset="UTF-8">'
        + '<title>Acta Oficial de Alerta de Asistencia - Preceptoría - ' + (cur ? cur.nombre : 'Curso') + '</title>'
        + '<style>'
        + '@page { size: A4 portrait; margin: 10mm 12mm; }'
        + 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #f8fafc; }'
        + '.screen-bar { background: #0f172a; color: #ffffff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); position: sticky; top: 0; z-index: 999; }'
        + '.screen-bar-title { font-weight: 700; font-size: 13pt; display: flex; align-items: center; gap: 8px; }'
        + '.screen-bar-buttons { display: flex; gap: 10px; }'
        + '.btn { cursor: pointer; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 10pt; transition: all 0.2s; }'
        + '.btn-print { background: #e09f00; color: #0f172a; }'
        + '.btn-print:hover { background: #cca700; }'
        + '.btn-close { background: #334155; color: #ffffff; }'
        + '.page-container { max-width: 950px; margin: 20px auto; background: #ffffff; padding: 30px 35px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); border-radius: 8px; box-sizing: border-box; }'
        + '@media print {'
        + '  body { background: #ffffff !important; }'
        + '  .screen-bar { display: none !important; }'
        + '  .page-container { margin: 0 !important; padding: 0 !important; box-shadow: none !important; max-width: 100% !important; }'
        + '}'
        + '.header-border { border-bottom: 2.5px double #0f172a; padding-bottom: 10px; margin-bottom: 12px; }'
        + '.badge-danger { background: #fee2e2; color: #991b1b; padding: 3px 8px; border-radius: 9999px; font-size: 8.5pt; font-weight: 800; border: 1px solid #f87171; display: inline-block; }'
        + 'table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9.5pt; }'
        + 'th { background: #0f172a; color: #ffffff; padding: 6px 5px; text-align: center; font-size: 8.5pt; font-weight: 700; letter-spacing: 0.3px; }'
        + '.info-card { background: #f8fafc; border-left: 4px solid #e09f00; padding: 10px 14px; border-radius: 4px; margin-bottom: 12px; }'
        + '.signatures { margin-top: 35px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; text-align: center; page-break-inside: avoid; }'
        + '.sig-line { border-top: 1.5px solid #0f172a; padding-top: 5px; font-size: 9pt; font-weight: 700; color: #1e293b; }'
        + '.sig-sub { font-size: 8pt; color: #64748b; margin-top: 2px; }'
        + '</style>'
        + '</head>'
        + '<body>'
        + '<div class="screen-bar">'
        + '  <div class="screen-bar-title">📄 Acta Oficial de Notificación a Preceptoría (PDF)</div>'
        + '  <div class="screen-bar-buttons">'
        + '    <button class="btn btn-print" onclick="window.print()">🖨️ Guardar como PDF / Imprimir</button>'
        + '    <button class="btn btn-close" onclick="window.close()">✖️ Cerrar</button>'
        + '  </div>'
        + '</div>'
        + '<div class="page-container">'
        + '  <div class="header-border" style="display:flex; justify-content:space-between; align-items:flex-start;">'
        + '    <div>'
        + '      <div style="font-size:8pt; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:1px;">Dirección General de Cultura y Educación • DGCyE</div>'
        + '      <div style="font-size:14pt; font-weight:900; color:#0f172a; margin-top:1px;">ACTA OFICIAL DE ELEVACIÓN A PRECEPTORÍA</div>'
        + '      <div style="font-size:10pt; font-weight:700; color:#b91c1c; margin-top:2px;">NOTIFICACIÓN DE ALERTA: ESTUDIANTES CON ASISTENCIA INFERIOR AL 70%</div>'
        + '    </div>'
        + '    <div style="text-align:right;">'
        + '      <span class="badge-danger">UMBRAL CRÍTICO &lt; 70%</span>'
        + '      <div style="font-size:8pt; color:#64748b; margin-top:4px;">Control de Asiduidad y Regularidad</div>'
        + '    </div>'
        + '  </div>'
        + '  <div class="info-card">'
        + '    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 9pt;">'
        + '      <div><strong>Establecimiento:</strong> ' + (col ? col.nombre : 'Secundaria Técnica') + '</div>'
        + '      <div><strong>Curso y División:</strong> <span style="font-size:10pt; font-weight:800; color:#0f172a;">' + (cur ? cur.nombre : '4° 3°') + '</span></div>'
        + '      <div><strong>Docente Titular:</strong> Prof. Facundo Casciano</div>'
        + '      <div><strong>Período Evaluado:</strong> <span style="font-weight:700; color:#b45309;">' + nomPeriodo + '</span></div>'
        + '      <div><strong>Fecha de Emisión:</strong> ' + fechaHoy + ' (' + horaHoy + ' hs)</div>'
        + '      <div><strong>Clases Computadas:</strong> ' + fechas.length + ' clases</div>'
        + '    </div>'
        + '  </div>'
        + '  <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">'
        + '    <div style="font-size:10pt; font-weight:800; color:#0f172a;">'
        + '      Nómina de Estudiantes en Riesgo: <span style="color:#b91c1c;">' + enRiesgo.length + ' de ' + alumnos.length + ' alumnos</span> (' + (alumnos.length > 0 ? Math.round((enRiesgo.length / alumnos.length) * 100) : 0) + '% del curso)'
        + '    </div>'
        + '  </div>'
        + '  <table>'
        + '    <thead>'
        + '      <tr>'
        + '        <th style="width:25px;">#</th>'
        + '        <th style="text-align:left;">Estudiante (Apellido y Nombre)</th>'
        + '        <th style="width:70px;">DNI</th>'
        + '        <th style="width:45px;">Clases</th>'
        + '        <th style="width:45px;">Pres.</th>'
        + '        <th style="width:45px;">Faltas</th>'
        + '        <th style="width:55px;">% Asist.</th>'
        + '        <th style="text-align:left;">Fechas Exactas de Inasistencia</th>'
        + '        <th style="width:105px;">Firma Notif. Preceptoría</th>'
        + '      </tr>'
        + '    </thead>'
        + '    <tbody>'
        +        filasHtml
        + '    </tbody>'
        + '  </table>'
        +    bloqueIncidenciasHtml
        + '  <div style="margin-top:14px; font-size:8pt; color:#475569; background:#fffbeb; border:1px solid #fde68a; padding:8px 12px; border-radius:6px; line-height:1.4;">'
        + '    <strong>Marco Reglamentario:</strong> Se eleva la presente nómina al cuerpo de Preceptoría y Equipo de Orientación Escolar (EOE) a efectos de arbitrar con carácter de urgente las citaciones a padres/tutores y la suscripción de actas de compromiso pedagógico para garantizar la continuidad pedagógica.'
        + '  </div>'
        + '  <div class="signatures">'
        + '    <div>'
        + '      <div class="sig-line">Prof. Facundo Casciano</div>'
        + '      <div class="sig-sub">Docente Responsable</div>'
        + '    </div>'
        + '    <div>'
        + '      <div class="sig-line">Preceptor/a a Cargo</div>'
        + '      <div class="sig-sub">Recibido: ___ / ___ / 2026</div>'
        + '    </div>'
        + '    <div>'
        + '      <div class="sig-line">Equipo Directivo / EOE</div>'
        + '      <div class="sig-sub">Sello Institucional</div>'
        + '    </div>'
        + '  </div>'
        + '  <div style="margin-top:25px; border-top:1px solid #e2e8f0; padding-top:6px; display:flex; justify-content:space-between; font-size:7.5pt; color:#94a3b8;">'
        + '    <span>Documento Oficial Certificado • TuProfeWeb Gestión Escolar</span>'
        + '    <span>Emisión: ' + fechaHoy + ' ' + horaHoy + '</span>'
        + '  </div>'
        + '</div>'
        + '</body>'
        + '</html>';

      win.document.write(docHtml);
      win.document.close();
      win.focus();
      setTimeout(function() {
        try { win.print(); } catch(e) {}
      }, 500);
    }

    // =========================================================================
    // 🏆 GENERADOR PROFESIONAL DE LIBRO EXCEL MULTI-HOJA
    // =========================================================================
    function descargarExcelProfesionalMultiHoja() {
      const cur = state.cursos.find(c => c.id === cursoActivoId);
      const col = state.colegios.find(c => c.id === (cur ? cur.colegio_id : null));
      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoActivoId);
      const fechas = obtenerFechasDictadasCurso(cursoActivoId);

      const nomPeriodo = periodoSeleccionado === 'todo' ? 'Ciclo Lectivo Completo (Marzo - Diciembre)' : (periodoSeleccionado === 'p1' ? '1° Período (Marzo - Julio)' : '2° Período (Agosto - Diciembre)');
      const archivoPeriodoTag = periodoSeleccionado === 'todo' ? 'Ciclo_Completo' : (periodoSeleccionado === 'p1' ? 'P1_Mar_Jul' : 'P2_Ago_Dic');

      const wb = XLSX.utils.book_new();

      // ── HOJA 1: RESUMEN DE PRECEPTORÍA CON FORMATO INSTITUCIONAL ──
      const s1 = [];
      s1.push(['DIRECCIÓN GENERAL DE EDUCACIÓN TÉCNICA']);
      s1.push(['PLANILLA OFICIAL DE ASISTENCIA Y CONTROL DE REGULARIDAD ESCOLAR']);
      s1.push(['REGISTRO INSTITUCIONAL DE ASISTENCIAS — UMBRAL MÍNIMO EXIGIDO: 70%']);
      s1.push([]);
      s1.push(['ESTABLECIMIENTO:', col ? col.nombre : '', '', 'DOCENTE TITULAR:', 'Prof. Facundo Casciano']);
      s1.push(['CURSO Y DIVISIÓN:', cur ? cur.nombre : '', '', 'CICLO LECTIVO:', '2026']);
      s1.push(['PERÍODO EVALUADO:', nomPeriodo, '', 'FECHA DE EMISIÓN:', new Date().toLocaleDateString('es-AR') + ' ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })]);
      s1.push(['TOTAL MATRÍCULA:', alumnos.length + ' Estudiantes', '', 'CLASES DICTADAS:', fechas.length + ' Clases']);
      s1.push([]);

      // Cabecera de la tabla
      s1.push([
        'N°',
        'ESTUDIANTE (APELLIDO Y NOMBRE)',
        'DNI',
        'CLASES DICTADAS',
        'PRESENTES',
        'FALTAS (AUSENCIAS)',
        'JUSTIFICADAS',
        'TARDES',
        '% ASISTENCIA',
        'CONDICIÓN DE REGULARIDAD',
        'ACCIÓN PRECEPTORÍA'
      ]);

      let sumaPresentesTotal = 0;
      let sumaAusentesTotal = 0;
      let totalAlumnosRiesgo = 0;

      alumnos.forEach((est, idx) => {
        const stats = calcularStatsEstudiante(est.id);
        sumaPresentesTotal += stats.presentes;
        sumaAusentesTotal += stats.ausentes;
        if (stats.enRiesgo) totalAlumnosRiesgo++;

        s1.push([
          idx + 1,
          est.apellido.toUpperCase() + ', ' + est.nombre,
          est.dni || '',
          stats.totalClases,
          stats.presentes,
          stats.ausentes,
          stats.justificadas,
          stats.tardes,
          stats.porcentaje / 100,
          stats.enRiesgo ? 'EN RIESGO PEDAGÓGICO' : 'REGULAR',
          stats.enRiesgo ? 'AVISAR A PRECEPTORÍA / CITAR FAMILIA' : 'Asistencia Satisfactoria'
        ]);
      });

      s1.push([]);
      s1.push([
        'TOTALES Y PROMEDIOS',
        '',
        '',
        fechas.length,
        sumaPresentesTotal,
        sumaAusentesTotal,
        '',
        '',
        alumnos.length > 0 ? (sumaPresentesTotal / (alumnos.length * fechas.length || 1)) : 0,
        'ALUMNOS EN RIESGO (< 70%): ' + totalAlumnosRiesgo + ' de ' + alumnos.length,
        ''
      ]);

      s1.push([]);
      s1.push(['CONSTANCIA Y FIRMAS REGLAMENTARIAS:']);
      s1.push([]);
      s1.push(['_______________________________', '', '_______________________________', '', '_______________________________']);
      s1.push(['Prof. Facundo Casciano', '', 'Preceptor/a a Cargo', '', 'Dirección / Vicedirección']);
      s1.push(['Docente Responsable', '', 'Recepción Preceptoría: Fecha __/__/2026', '', 'Sello del Establecimiento']);

      const ws1 = XLSX.utils.aoa_to_sheet(s1);

      ws1['!cols'] = [
        { wch: 5 },
        { wch: 34 },
        { wch: 14 },
        { wch: 16 },
        { wch: 12 },
        { wch: 18 },
        { wch: 14 },
        { wch: 10 },
        { wch: 15 },
        { wch: 25 },
        { wch: 36 }
      ];

      ws1['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } }
      ];

      const range1 = XLSX.utils.decode_range(ws1['!ref']);
      for (let R = 7; R <= 7 + alumnos.length; ++R) {
        const cellRef = XLSX.utils.encode_cell({ c: 8, r: R });
        if (ws1[cellRef]) ws1[cellRef].z = '0%';
      }
      const celdaPromedio = XLSX.utils.encode_cell({ c: 8, r: 8 + alumnos.length });
      if (ws1[celdaPromedio]) ws1[celdaPromedio].z = '0.0%';

      XLSX.utils.book_append_sheet(wb, ws1, '📋 Resumen Preceptoría');

      // ── HOJA 2: MATRIZ DÍA POR DÍA ──
      const s2 = [];
      s2.push(['MATRIZ COMPLETA DE ASISTENCIA DIARIA DÍA POR DÍA']);
      s2.push(['CURSO:', cur ? cur.nombre : '', 'PERÍODO:', nomPeriodo]);
      s2.push([]);

      const cabeceraH2 = ['N°', 'APELLIDO Y NOMBRE', 'DNI'];
      fechas.forEach(f => {
        const p = f.split('-');
        const inc = obtenerIncidenciaDia(f, cursoActivoId);
        const tag = inc && inc.tipo !== 'normal' ? ' (' + inc.tipo.toUpperCase() + ')' : '';
        cabeceraH2.push((p.length === 3 ? (p[2] + '/' + p[1]) : f) + tag);
      });
      cabeceraH2.push('TOTAL PRES.');
      cabeceraH2.push('TOTAL FALTAS');
      cabeceraH2.push('% ASIST.');
      s2.push(cabeceraH2);

      alumnos.forEach((est, idx) => {
        const fila = [idx + 1, est.apellido.toUpperCase() + ', ' + est.nombre, est.dni || ''];
        let pres = 0;
        let aus = 0;

        fechas.forEach(f => {
          const inc = obtenerIncidenciaDia(f, cursoActivoId);
          if (inc && inc.noComputa) {
            fila.push(getInfoIncidencia(inc.tipo).icono + ' S/C');
            return;
          }
          const estado = state.asistencias[f + '_' + est.id] || 'P';
          if (estado === 'P') { pres++; fila.push('P'); }
          else if (estado === 'A') { aus++; fila.push('A'); }
          else if (estado === 'J') { fila.push('J'); }
          else if (estado === 'T') { pres++; fila.push('T'); }
        });

        fila.push(pres);
        fila.push(aus);
        fila.push(fechas.length > 0 ? (pres / fechas.length) : 1);
        s2.push(fila);
      });

      const ws2 = XLSX.utils.aoa_to_sheet(s2);
      ws2['!cols'] = [{ wch: 4 }, { wch: 32 }, { wch: 12 }];
      fechas.forEach(() => ws2['!cols'].push({ wch: 8 }));
      ws2['!cols'].push({ wch: 12 }, { wch: 14 }, { wch: 12 });

      XLSX.utils.book_append_sheet(wb, ws2, '📅 Matriz Día por Día');

      // ── HOJA 3: CASOS EN RIESGO (< 70%) ──
      const s3 = [];
      s3.push(['NÓMINA OFICIAL DE ESTUDIANTES EN SITUACIÓN DE RIESGO DE REGULARIDAD']);
      s3.push(['ALUMNOS CON ASISTENCIA INFERIOR AL 70% OBLIGATORIO']);
      s3.push(['CURSO:', cur ? cur.nombre : '', 'PERÍODO:', nomPeriodo]);
      s3.push([]);
      s3.push(['N°', 'APELLIDO Y NOMBRE', 'DNI', 'CLASES COMPUTADAS', 'PRESENTES', 'FALTAS', '% ASISTENCIA', 'ESTADO', 'FIRMA NOTIFICACIÓN PRECEPTOR']);

      let ordenRiesgo = 1;
      alumnos.forEach(est => {
        const stats = calcularStatsEstudiante(est.id);
        if (stats.enRiesgo) {
          s3.push([
            ordenRiesgo++,
            est.apellido.toUpperCase() + ', ' + est.nombre,
            est.dni || '',
            stats.totalClases,
            stats.presentes,
            stats.ausentes,
            stats.porcentaje / 100,
            '⚠️ CITAR FAMILIA',
            ''
          ]);
        }
      });

      if (ordenRiesgo === 1) {
        s3.push(['', 'NO HAY ALUMNOS EN RIESGO EN ESTE PERÍODO', '', '', '', '', '', '', '']);
      }

      const ws3 = XLSX.utils.aoa_to_sheet(s3);
      ws3['!cols'] = [{ wch: 5 }, { wch: 34 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 30 }];
      for (let R = 5; R <= 5 + ordenRiesgo; ++R) {
        const cellRef = XLSX.utils.encode_cell({ c: 6, r: R });
        if (ws3[cellRef]) ws3[cellRef].z = '0%';
      }
      XLSX.utils.book_append_sheet(wb, ws3, '⚠️ Solo Casos en Riesgo');

      // ── HOJA 4: NOVEDADES INSTITUCIONALES / DÍAS ESPECIALES ──
      const s4 = [];
      s4.push(['REGISTRO DE NOVEDADES DEL CALENDARIO ESCOLAR E INCIDENCIAS']);
      s4.push(['DÍAS DE PARO, CORTES DE SUMINISTRO, LICENCIAS Y JORNADAS INSTITUCIONALES']);
      s4.push(['CURSO:', cur ? cur.nombre : '', 'PERÍODO:', nomPeriodo]);
      s4.push([]);
      s4.push(['FECHA', 'TIPO DE NOVEDAD', 'MOTIVO / DESCRIPCIÓN', 'ALCANCE', 'COMPUTA ASISTENCIA', 'OBSERVACIÓN PEDAGÓGICA']);

      let cantIncidencias = 0;
      fechas.forEach(f => {
        const inc = obtenerIncidenciaDia(f, cursoActivoId);
        if (inc && inc.tipo !== 'normal') {
          cantIncidencias++;
          s4.push([
            f,
            getInfoIncidencia(inc.tipo).titulo,
            inc.motivo || '',
            inc.curso_id ? 'Curso Específico' : 'Toda la Escuela',
            'NO COMPUTA FALTA',
            'Justificado por normativa escolar vigente'
          ]);
        }
      });

      if (cantIncidencias === 0) {
        s4.push(['---', 'Sin incidencias especiales registradas en este período', '', '', '', '']);
      }

      const ws4 = XLSX.utils.aoa_to_sheet(s4);
      ws4['!cols'] = [{ wch: 14 }, { wch: 35 }, { wch: 35 }, { wch: 18 }, { wch: 20 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(wb, ws4, '🛑 Novedades e Incidencias');

      const nombreCursoSeguro = (cur ? cur.nombre : 'Curso').replace(/[^a-zA-Z0-9_-]/g, '_');
      const nombreArchivo = 'Planilla_Asistencia_' + nombreCursoSeguro + '_' + archivoPeriodoTag + '_2026.xlsx';

      XLSX.writeFile(wb, nombreArchivo);
      mostrarToastRapido('✅ Libro Excel Profesional descargado con éxito');
    }

    // =========================================================================
    // 📋 COPIAR MENSAJE PARA PRECEPTORÍA (WHATSAPP)
    // =========================================================================
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

      let texto = '📋 *INFORME OFICIAL DE INASISTENCIAS PARA PRECEPTORÍA*\\n';
      texto += '🏛️ *Establecimiento:* ' + (col ? col.nombre : '') + '\\n';
      texto += '📚 *Curso:* ' + (cur ? cur.nombre : '') + '\\n';
      texto += '📅 *Período:* ' + nomPeriodo + '\\n';
      texto += '👨‍🏫 *Docente Titular:* Prof. Facundo Casciano\\n';
      texto += '------------------------------------------\\n';
      texto += '⚠️ *ESTUDIANTES EN RIESGO PEDAGÓGICO (< 70% ASISTENCIA):*\\n\\n';

      if (enRiesgo.length === 0) {
        texto += '✅ *No hay alumnos con asistencia menor al 70% en este período.*\\n';
      } else {
        enRiesgo.forEach((item, i) => {
          texto += (i + 1) + '. *' + item.est.apellido.toUpperCase() + ', ' + item.est.nombre + '*\\n';
          texto += '   - Porcentaje de Asistencia: *' + item.stats.porcentaje + '%* 🔴\\n';
          texto += '   - Clases Presente: ' + item.stats.presentes + ' de ' + item.stats.totalClases + '\\n';
          texto += '   - Total Faltas (Ausentes): *' + item.stats.ausentes + '*\\n';
          texto += '   - Acción requerida: Citación a padres / Preceptoría\\n\\n';
        });
      }

      texto += '------------------------------------------\\n';
      texto += '_Generado automáticamente por TuProfeWeb Gestión Escolar_';

      navigator.clipboard.writeText(texto).then(() => {
        alert("¡Informe copiado al portapapeles con éxito!\\n\\nYa podés pegarlo directamente en WhatsApp para la preceptora.");
      }).catch(() => {
        prompt("Copiá este texto para la preceptora:", texto);
      });
    }

    // =========================================================================
    // 💾 CENTRO DE COPIA DE SEGURIDAD Y RESTAURACIÓN
    // =========================================================================
    function abrirModalBackup() {
      document.getElementById('modal-backup').classList.remove('hidden');
    }

    function cerrarModalBackup() {
      document.getElementById('modal-backup').classList.add('hidden');
    }

    function descargarCopiaSeguridadJSON() {
      const backupData = {
        version: "TuProfeWeb_2026_v2",
        fechaExportacion: new Date().toISOString(),
        fechaLegible: new Date().toLocaleString('es-AR'),
        docente: "Prof. Facundo Casciano",
        datos: state
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fechaStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = "Copia_Seguridad_TuProfeWeb_" + fechaStr + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      mostrarToastRapido("✅ Copia de seguridad descargada");
    }

    function procesarArchivoBackup(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const json = JSON.parse(evt.target.result);
          const datos = json.datos || json;

          if (!datos.colegios || !datos.cursos || !datos.estudiantes) {
            alert("El archivo seleccionado no tiene el formato válido de copia de seguridad de TuProfeWeb.");
            return;
          }

          if (confirm("¿Estás seguro de restaurar esta copia de seguridad?\\n\\nSe reemplazarán los datos actuales por los contenidos en el archivo (" + (datos.estudiantes.length) + " estudiantes).")) {
            guardarEstado(true);
            state = datos;
            guardarEstado(false);
            seleccionarColegio(colegioActivoId);
            seleccionarCurso(cursoActivoId);
            cerrarModalBackup();
            alert("¡Copia de seguridad restaurada con total éxito!");
          }
        } catch(err) {
          alert("Error al leer el archivo de respaldo: " + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }

    // =========================================================================
    // 📂 ACTUALIZADOR INTELIGENTE DE ARCHIVOS (SMART MERGE / REEMPLAZAR)
    // =========================================================================
    let datosAnalizadosArchivo = null;

    function handleDragOver(e) {
      e.preventDefault();
      document.body.classList.add('drag-active');
    }

    function handleDragLeave(e) {
      if (e.relatedTarget === null) {
        document.body.classList.remove('drag-active');
      }
    }

    function handleDrop(e) {
      e.preventDefault();
      document.body.classList.remove('drag-active');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        procesarArchivoSubido(e.dataTransfer.files[0]);
      }
    }

    function analizarYPrepararArchivo(e) {
      if (e.target.files && e.target.files.length > 0) {
        procesarArchivoSubido(e.target.files[0]);
        e.target.value = '';
      }
    }

    function procesarArchivoSubido(file) {
      const extension = file.name.split('.').pop().toLowerCase();
      if (extension === 'json' || extension === 'backup') {
        const reader = new FileReader();
        reader.onload = function(evt) {
          try {
            const json = JSON.parse(evt.target.result);
            if (confirm("Se detectó una Copia de Seguridad completa (.json).\\n¿Deseas restaurar todo el sistema con este archivo?")) {
              guardarEstado(true);
              state = json.datos || json;
              renderTodo();
              alert("¡Copia de seguridad restaurada con éxito!");
            }
          } catch(err) {
            alert("Error al procesar el archivo JSON: " + err.message);
          }
        };
        reader.readAsText(file);
        return;
      }

      // Procesar archivo Excel (.xlsx, .xls) o CSV
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

          if (!rows || rows.length < 2) {
            alert("El archivo no contiene suficientes filas de datos.");
            return;
          }

          // Detección automática de cabeceras, columnas de alumnos y columnas de fechas
          let headerIdx = -1;
          for (let i = 0; i < Math.min(15, rows.length); i++) {
            const rowStr = rows[i].map(c => String(c).toLowerCase()).join(' ');
            if (rowStr.includes('alumno') || rowStr.includes('estudiante') || rowStr.includes('apellido') || rowStr.includes('nombre')) {
              headerIdx = i;
              break;
            }
          }
          if (headerIdx === -1) headerIdx = 0;

          const headerRow = rows[headerIdx];
          let colNombreIdx = -1;
          headerRow.forEach((col, idx) => {
            const s = String(col).toLowerCase();
            if (s.includes('alumno') || s.includes('estudiante') || s.includes('apellido') || s.includes('nombre')) {
              if (colNombreIdx === -1) colNombreIdx = idx;
            }
          });
          if (colNombreIdx === -1) colNombreIdx = 0;

          // Detectar columnas de fechas
          const dateCols = [];
          headerRow.forEach((col, idx) => {
            if (idx === colNombreIdx) return;
            const strVal = String(col).trim();
            const iso = parsearFechaFlexible(strVal);
            if (iso) {
              dateCols.push({ colIdx: idx, fechaIso: iso, labelOriginal: strVal });
            }
          });

          // Detectar alumnos y asistencias
          const alumnosDetectados = [];
          const asistenciasDetectadas = [];

          for (let r = headerIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || !row[colNombreIdx]) continue;
            const nombreCompleto = String(row[colNombreIdx]).trim();
            if (!nombreCompleto || nombreCompleto.toLowerCase().includes('total') || nombreCompleto.toLowerCase().includes('promedio') || nombreCompleto.toLowerCase().includes('observacion')) continue;

            const partes = nombreCompleto.includes(',') ? nombreCompleto.split(',') : nombreCompleto.split(' ');
            const apellido = partes[0].trim();
            const nombre = partes.slice(1).join(' ').trim() || '-';

            const filaAsistencias = {};
            dateCols.forEach(dc => {
              const val = String(row[dc.colIdx] || '').trim().toUpperCase();
              let estado = 'P';
              if (val === 'A' || val === 'AUSENTE' || val === 'FALTA' || val === 'F') estado = 'A';
              else if (val === 'J' || val === 'JUSTIFICADA') estado = 'J';
              else if (val === 'T' || val === 'TARDE') estado = 'T';
              else if (val === 'P' || val === 'PRESENTE' || val === '1' || val === 'X') estado = 'P';
              filaAsistencias[dc.fechaIso] = estado;
            });

            alumnosDetectados.push({
              apellido: apellido,
              nombre: nombre,
              dni: '',
              asistencias: filaAsistencias
            });
          }

          if (alumnosDetectados.length === 0) {
            alert("No se pudieron detectar alumnos en el archivo seleccionado. Verifique el formato.");
            return;
          }

          // Detección automática del curso destino
          let cursoSugeridoId = cursoActivoId;
          const textoCompleto = (file.name + ' ' + rows.slice(0, 5).flat().join(' ')).toUpperCase();
          state.cursos.forEach(cur => {
            const nomClean = cur.nombre.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const txtClean = textoCompleto.replace(/[^A-Z0-9]/g, '');
            if (txtClean.includes(nomClean) || (nomClean.includes('43') && txtClean.includes('43'))) {
              cursoSugeridoId = cur.id;
            }
          });

          datosAnalizadosArchivo = {
            nombreArchivo: file.name,
            alumnos: alumnosDetectados,
            dateCols: dateCols,
            cursoSugeridoId: cursoSugeridoId
          };

          abrirModalPreviewActualizacion();
        } catch(err) {
          alert("Error al leer el archivo Excel: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    }

    function parsearFechaFlexible(val) {
      if (!val) return null;
      if (typeof val === 'number') {
        const dateObj = new Date(Math.round((val - (25567 + 2)) * 86400 * 1000));
        return dateObj.toISOString().split('T')[0];
      }
      const s = String(val).trim();
      const partes = s.replace(/[\/\.]/g, '-').split('-');
      if (partes.length === 3) {
        const d = partes[0].padStart(2, '0');
        const m = partes[1].padStart(2, '0');
        let y = partes[2];
        if (y.length === 2) y = '20' + y;
        if (y.length === 4) return y + '-' + m + '-' + d;
      }
      if (partes.length === 2) {
        const d = partes[0].padStart(2, '0');
        const m = partes[1].padStart(2, '0');
        return '2026-' + m + '-' + d;
      }
      return null;
    }

    function abrirModalPreviewActualizacion() {
      if (!datosAnalizadosArchivo) return;
      document.getElementById('preview-nombre-archivo').textContent = datosAnalizadosArchivo.nombreArchivo;
      document.getElementById('preview-total-alumnos').textContent = datosAnalizadosArchivo.alumnos.length;
      document.getElementById('preview-total-fechas').textContent = datosAnalizadosArchivo.dateCols.length;

      const cur = state.cursos.find(c => c.id === datosAnalizadosArchivo.cursoSugeridoId);
      document.getElementById('preview-curso-destino').textContent = cur ? cur.nombre : 'Curso Actual';

      const select = document.getElementById('preview-select-curso');
      select.innerHTML = '';
      state.cursos.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre + ' (' + c.turno + ')';
        if (c.id === datosAnalizadosArchivo.cursoSugeridoId) opt.selected = true;
        select.appendChild(opt);
      });

      document.getElementById('modal-preview-actualizacion').classList.remove('hidden');
    }

    function cerrarModalPreviewActualizacion() {
      document.getElementById('modal-preview-actualizacion').classList.add('hidden');
      datosAnalizadosArchivo = null;
    }

    function ejecutarActualizacionConfirmada() {
      if (!datosAnalizadosArchivo) return;
      guardarEstado(true);

      const targetCursoId = parseInt(document.getElementById('preview-select-curso').value);
      const modo = document.querySelector('input[name="modo-actualizacion"]:checked').value;
      const alumnosNuevos = datosAnalizadosArchivo.alumnos;

      if (modo === 'replace') {
        // Modo Reemplazar: eliminar alumnos y asistencias actuales de este curso
        const alumnosIdsAnteriores = state.estudiantes.filter(e => e.curso_id === targetCursoId).map(e => e.id);
        state.estudiantes = state.estudiantes.filter(e => e.curso_id !== targetCursoId);

        // Limpiar asistencias
        Object.keys(state.asistencias).forEach(k => {
          const parts = k.split('_');
          const estId = parseInt(parts[1]);
          if (alumnosIdsAnteriores.includes(estId)) {
            delete state.asistencias[k];
          }
        });

        // Insertar nuevos alumnos y asistencias
        let maxId = state.estudiantes.reduce((max, e) => Math.max(max, e.id), 0);
        alumnosNuevos.forEach((a, idx) => {
          maxId++;
          const nuevoEst = {
            id: maxId,
            curso_id: targetCursoId,
            apellido: a.apellido,
            nombre: a.nombre,
            dni: a.dni || '',
            nota: 7 + (idx % 4)
          };
          state.estudiantes.push(nuevoEst);

          Object.keys(a.asistencias).forEach(fecha => {
            state.asistencias[fecha + '_' + nuevoEst.id] = a.asistencias[fecha];
          });
        });

        mostrarToastRapido("⚡ Lista reemplazada exitosamente (" + alumnosNuevos.length + " alumnos)");
      } else {
        // Modo Smart Merge: fusionar sin duplicar
        const alumnosExistentes = state.estudiantes.filter(e => e.curso_id === targetCursoId);
        let maxId = state.estudiantes.reduce((max, e) => Math.max(max, e.id), 0);
        let countSumados = 0;
        let countActualizados = 0;

        alumnosNuevos.forEach(a => {
          const normNuevo = a.apellido.toUpperCase().trim();
          let match = alumnosExistentes.find(e => e.apellido.toUpperCase().trim() === normNuevo);

          if (!match) {
            maxId++;
            match = {
              id: maxId,
              curso_id: targetCursoId,
              apellido: a.apellido,
              nombre: a.nombre,
              dni: a.dni || '',
              nota: 7 + (maxId % 4)
            };
            state.estudiantes.push(match);
            alumnosExistentes.push(match);
            countSumados++;
          } else {
            countActualizados++;
          }

          // Fusionar asistencias
          Object.keys(a.asistencias).forEach(fecha => {
            state.asistencias[fecha + '_' + match.id] = a.asistencias[fecha];
          });
        });

        mostrarToastRapido("🔄 Fusión completada: " + countActualizados + " alumnos actualizados, " + countSumados + " agregados");
      }

      cursoActivoId = targetCursoId;
      const targetCurso = state.cursos.find(c => c.id === targetCursoId);
      if (targetCurso) colegioActivoId = targetCurso.colegio_id;

      cerrarModalPreviewActualizacion();
      renderTodo();
    }

    // =========================================================================
    // 📊 LÓGICA DE CÁLCULO DE ASISTENCIA Y PERÍODOS
    // =========================================================================
    function cambiarPeriodo(p) {
      periodoSeleccionado = p;

      document.getElementById('btn-periodo-todo').className = p === 'todo'
        ? 'px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs bg-amber-500 text-slate-950'
        : 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition hover:bg-slate-200';

      document.getElementById('btn-periodo-p1').className = p === 'p1'
        ? 'px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs bg-amber-500 text-slate-950'
        : 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition hover:bg-slate-200';

      document.getElementById('btn-periodo-p2').className = p === 'p2'
        ? 'px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs bg-amber-500 text-slate-950'
        : 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition hover:bg-slate-200';

      const badge = document.getElementById('badge-periodo-activo');
      if (p === 'todo') badge.textContent = 'Todo el Año (Marzo - Diciembre)';
      else if (p === 'p1') badge.textContent = '1° Período (Marzo - Julio)';
      else if (p === 'p2') badge.textContent = '2° Período (Agosto - Diciembre)';

      renderTablaEstudiantes();
      renderAlertasPreceptoria();
      actualizarEstadisticas();
    }

    function obtenerFechasDictadasCurso(cursoId) {
      const fechasSet = new Set();
      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoId);
      const alumnosIds = alumnos.map(e => e.id);

      Object.keys(state.asistencias).forEach(key => {
        const parts = key.split('_');
        if (parts.length >= 2) {
          const f = parts[0];
          const estId = parseInt(parts[1]);
          if (alumnosIds.includes(estId)) {
            fechasSet.add(f);
          }
        }
      });

      const fechasArray = Array.from(fechasSet).sort();

      if (periodoSeleccionado === 'todo') return fechasArray;

      return fechasArray.filter(f => {
        const partes = f.split('-');
        if (partes.length < 2) return true;
        const mes = parseInt(partes[1], 10);
        if (periodoSeleccionado === 'p1') return mes >= 1 && mes <= 7;
        if (periodoSeleccionado === 'p2') return mes >= 8 && mes <= 12;
        return true;
      });
    }

    function calcularStatsEstudiante(estId) {
      const fechas = obtenerFechasDictadasCurso(cursoActivoId);
      let presentes = 0;
      let ausentes = 0;
      let justificadas = 0;
      let tardes = 0;
      let clasesComputables = 0;

      fechas.forEach(f => {
        const inc = obtenerIncidenciaDia(f, cursoActivoId);
        // Días de Paro, Sin Luz, Licencia Docente no computan falta
        if (inc && inc.noComputa) {
          return;
        }
        clasesComputables++;
        const estado = state.asistencias[f + '_' + estId] || 'P';
        if (estado === 'P') presentes++;
        else if (estado === 'A') ausentes++;
        else if (estado === 'J') justificadas++;
        else if (estado === 'T') { presentes++; tardes++; }
      });

      const totalClases = clasesComputables;
      const porcentaje = totalClases > 0 ? Math.round((presentes / totalClases) * 100) : 100;
      const enRiesgo = totalClases > 0 && porcentaje < 70;

      return { totalClases, presentes, ausentes, justificadas, tardes, porcentaje, enRiesgo };
    }

    // =========================================================================
    // 🎨 RENDERIZADO VISUAL DEL DASHBOARD
    // =========================================================================
    function renderTodo() {
      renderColegios();
      renderCursos();
      actualizarEstadoDiaUI();
      renderTablaEstudiantes();
      renderAlertasPreceptoria();
      actualizarEstadisticas();
      actualizarBotonesDeshacerRehacer();
    }

    function renderColegios() {
      const cont = document.getElementById('lista-colegios');
      cont.innerHTML = '';
      state.colegios.forEach(col => {
        const btn = document.createElement('button');
        const activo = col.id === colegioActivoId;
        btn.className = 'w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-between '
          + (activo ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 hover:bg-slate-100');
        btn.innerHTML = '<span>' + col.nombre + '</span><i class="fa-solid fa-chevron-right text-[10px] opacity-60"></i>';
        btn.onclick = () => seleccionarColegio(col.id);
        cont.appendChild(btn);
      });
      const col = state.colegios.find(c => c.id === colegioActivoId);
      if (col) document.getElementById('colegio-seleccionado-titulo').textContent = col.nombre;
    }

    function seleccionarColegio(id) {
      colegioActivoId = id;
      const cursosCol = state.cursos.filter(c => c.colegio_id === id);
      if (cursosCol.length > 0) {
        cursoActivoId = cursosCol[0].id;
      }
      renderTodo();
    }

    function renderCursos() {
      const cont = document.getElementById('lista-cursos');
      cont.innerHTML = '';
      const cursosCol = state.cursos.filter(c => c.colegio_id === colegioActivoId);

      cursosCol.forEach(cur => {
        const activo = cur.id === cursoActivoId;
        const card = document.createElement('div');
        card.className = 'p-3.5 rounded-xl border transition cursor-pointer '
          + (activo ? 'border-amber-500 bg-amber-50/50 shadow-xs' : 'border-slate-200 hover:border-amber-300 hover:bg-slate-50');

        const cantAlumnos = state.estudiantes.filter(e => e.curso_id === cur.id).length;

        card.innerHTML = '<div class="flex items-center justify-between mb-1">'
          + '<span class="text-xs font-bold ' + (activo ? 'text-amber-900' : 'text-slate-900') + '">' + cur.nombre + '</span>'
          + '<span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">' + cur.turno + '</span>'
          + '</div>'
          + '<p class="text-xs text-slate-500">' + cantAlumnos + ' estudiantes registrados</p>';

        card.onclick = () => seleccionarCurso(cur.id);
        cont.appendChild(card);
      });

      const curso = state.cursos.find(c => c.id === cursoActivoId);
      if (curso) {
        document.getElementById('curso-activo-titulo').textContent = curso.nombre;
        document.getElementById('badge-turno').textContent = 'Turno ' + curso.turno;
        const cant = state.estudiantes.filter(e => e.curso_id === curso.id).length;
        document.getElementById('curso-activo-subtitulo').textContent = cant + ' estudiantes matriculados';
      }
    }

    function seleccionarCurso(id) {
      cursoActivoId = id;
      renderCursos();
      actualizarEstadoDiaUI();
      renderTablaEstudiantes();
      renderAlertasPreceptoria();
      actualizarEstadisticas();
    }

    function renderTablaEstudiantes() {
      const tbody = document.getElementById('tabla-estudiantes-tbody');
      tbody.innerHTML = '';
      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoActivoId);

      if (alumnos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-10 text-slate-400"><i class="fa-solid fa-folder-open text-3xl mb-2 block text-slate-300"></i>No hay estudiantes en este curso todavía.<br><button onclick="document.getElementById(\\'file-upload-excel\\').click()" class="btn-amber text-xs px-3 py-1.5 rounded-lg mt-3 inline-block">Subir Planilla Excel</button></td></tr>';
        return;
      }

      const fecha = document.getElementById('fecha-asistencia').value || fechaHoyStr;
      const inc = obtenerIncidenciaDia(fecha, cursoActivoId);
      const diaConIncidencia = inc && inc.noComputa;

      alumnos.forEach((est, index) => {
        const stats = calcularStatsEstudiante(est.id);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/80 transition ' + (stats.enRiesgo ? 'bg-rose-50/30' : '');

        let estadoHoy = state.asistencias[fecha + '_' + est.id] || 'P';

        // Renderizado del selector de estado de hoy
        let estadoSelectorHtml = '';
        if (diaConIncidencia) {
          const info = getInfoIncidencia(inc.tipo);
          estadoSelectorHtml = '<div class="inline-flex items-center text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-lg shadow-2xs">'
            + info.icono + ' <span class="ml-1">' + (inc.motivo || info.nombreCorto) + ' (Sin Clase)</span>'
            + '</div>';
        } else {
          estadoSelectorHtml = '<div class="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">'
            + '<button onclick="cambiarAsistencia(' + est.id + ', \\'P\\')" class="px-2.5 py-1 text-xs font-bold rounded ' + (estadoHoy === 'P' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900') + '">P</button>'
            + '<button onclick="cambiarAsistencia(' + est.id + ', \\'A\\')" class="px-2.5 py-1 text-xs font-bold rounded ' + (estadoHoy === 'A' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900') + '">A</button>'
            + '<button onclick="cambiarAsistencia(' + est.id + ', \\'J\\')" class="px-2 py-1 text-xs font-bold rounded ' + (estadoHoy === 'J' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900') + '">J</button>'
            + '<button onclick="cambiarAsistencia(' + est.id + ', \\'T\\')" class="px-2 py-1 text-xs font-bold rounded ' + (estadoHoy === 'T' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900') + '">T</button>'
            + '</div>';
        }

        const badgeCondicion = stats.enRiesgo
          ? '<span class="inline-flex items-center text-xs font-extrabold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full"><i class="fa-solid fa-triangle-exclamation mr-1"></i> AVISAR PRECEPTORA</span>'
          : '<span class="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Regular</span>';

        const colorPorcentaje = stats.porcentaje >= 80 ? 'text-emerald-600' : (stats.porcentaje >= 70 ? 'text-amber-600' : 'text-rose-600 font-extrabold');

        tr.innerHTML = '<td class="py-3 px-3 text-center text-slate-400 font-medium text-xs">' + (index + 1) + '</td>'
          + '<td class="py-3 px-4 font-semibold text-slate-900">'
          +   '<div>' + est.apellido.toUpperCase() + ', ' + est.nombre + '</div>'
          +   (est.dni ? '<div class="text-[11px] text-slate-400 font-normal">DNI: ' + est.dni + '</div>' : '')
          + '</td>'
          + '<td class="py-3 px-4 text-center">' + estadoSelectorHtml + '</td>'
          + '<td class="py-3 px-4 text-center text-xs font-medium text-slate-600">'
          +   '<span class="text-emerald-700 font-bold">' + stats.presentes + ' pres.</span> / ' + stats.totalClases + ' clases'
          + '</td>'
          + '<td class="py-3 px-4 text-center text-sm font-bold ' + colorPorcentaje + '">' + stats.porcentaje + '%</td>'
          + '<td class="py-3 px-4 text-center">' + badgeCondicion + '</td>'
          + '<td class="py-3 px-4 text-right">'
          +   '<button onclick="eliminarEstudiante(' + est.id + ')" class="text-slate-400 hover:text-rose-600 p-1 rounded transition" title="Eliminar estudiante">'
          +     '<i class="fa-regular fa-trash-can"></i>'
          +   '</button>'
          + '</td>';

        tbody.appendChild(tr);
      });
    }

    function cambiarAsistencia(estId, nuevoEstado) {
      const fecha = document.getElementById('fecha-asistencia').value || fechaHoyStr;
      guardarEstado(true);
      state.asistencias[fecha + '_' + estId] = nuevoEstado;
      renderTablaEstudiantes();
      renderAlertasPreceptoria();
      actualizarEstadisticas();
    }

    function marcarTodos(estado) {
      const fecha = document.getElementById('fecha-asistencia').value || fechaHoyStr;
      const inc = obtenerIncidenciaDia(fecha, cursoActivoId);
      if (inc && inc.noComputa) {
        alert("Este día está registrado como '" + (inc.motivo || inc.tipo) + "'. No se computan asistencias normales.");
        return;
      }
      guardarEstado(true);
      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoActivoId);
      alumnos.forEach(e => {
        state.asistencias[fecha + '_' + e.id] = estado;
      });
      renderTablaEstudiantes();
      renderAlertasPreceptoria();
      actualizarEstadisticas();
      mostrarToastRapido("Marcados todos como " + (estado === 'P' ? 'Presentes' : 'Ausentes'));
    }

    function renderAlertasPreceptoria() {
      const cont = document.getElementById('alerta-preceptoria-container');
      const chipsCont = document.getElementById('alerta-chips-alumnos');
      const conteoTxt = document.getElementById('alerta-conteo-riesgo');
      chipsCont.innerHTML = '';

      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoActivoId);
      const enRiesgo = [];

      alumnos.forEach(e => {
        const stats = calcularStatsEstudiante(e.id);
        if (stats.enRiesgo) enRiesgo.push({ est: e, stats });
      });

      if (enRiesgo.length === 0) {
        cont.classList.add('hidden');
        return;
      }

      cont.classList.remove('hidden');
      conteoTxt.textContent = enRiesgo.length;

      enRiesgo.forEach(item => {
        const chip = document.createElement('span');
        chip.className = 'inline-flex items-center text-xs font-bold bg-white text-rose-800 border border-rose-300 px-2.5 py-1 rounded-lg shadow-2xs';
        chip.innerHTML = '<span class="mr-1.5">' + item.est.apellido.toUpperCase() + '</span>'
          + '<span class="bg-rose-600 text-white font-extrabold text-[10px] px-1.5 py-0.2 rounded-full">' + item.stats.porcentaje + '%</span>';
        chipsCont.appendChild(chip);
      });
    }

    function actualizarEstadisticas() {
      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoActivoId);
      document.getElementById('stat-total-alumnos').textContent = alumnos.length;

      let sumaPorcentajes = 0;
      let cantRiesgo = 0;

      alumnos.forEach(e => {
        const stats = calcularStatsEstudiante(e.id);
        sumaPorcentajes += stats.porcentaje;
        if (stats.enRiesgo) cantRiesgo++;
      });

      const promedio = alumnos.length > 0 ? Math.round(sumaPorcentajes / alumnos.length) : 0;
      document.getElementById('stat-asistencia-promedio').textContent = promedio + '%';
      document.getElementById('stat-alumnos-riesgo').textContent = cantRiesgo;

      const fechas = obtenerFechasDictadasCurso(cursoActivoId);
      document.getElementById('stat-clases-evaluadas').textContent = fechas.length;
    }

    // =========================================================================
    // 👤 GESTIÓN DE NUEVO ESTUDIANTE
    // =========================================================================
    function abrirModalNuevoEstudiante() {
      document.getElementById('modal-nuevo-estudiante').classList.remove('hidden');
      document.getElementById('nuevo-apellido').focus();
    }

    function cerrarModalNuevoEstudiante() {
      document.getElementById('modal-nuevo-estudiante').classList.add('hidden');
      document.getElementById('nuevo-apellido').value = '';
      document.getElementById('nuevo-nombre').value = '';
      document.getElementById('nuevo-dni').value = '';
    }

    function guardarNuevoEstudiante() {
      const ap = document.getElementById('nuevo-apellido').value.trim();
      const nom = document.getElementById('nuevo-nombre').value.trim() || '-';
      const dni = document.getElementById('nuevo-dni').value.trim();

      if (!ap) {
        alert("Por favor ingrese el apellido del estudiante.");
        return;
      }

      guardarEstado(true);
      const maxId = state.estudiantes.reduce((max, e) => Math.max(max, e.id), 0);
      const nuevo = {
        id: maxId + 1,
        curso_id: cursoActivoId,
        apellido: ap,
        nombre: nom,
        dni: dni,
        nota: 8
      };

      state.estudiantes.push(nuevo);
      cerrarModalNuevoEstudiante();
      renderTodo();
      mostrarToastRapido("✅ Estudiante agregado con éxito");
    }

    function eliminarEstudiante(id) {
      const est = state.estudiantes.find(e => e.id === id);
      if (!est) return;
      if (confirm("¿Estás seguro de eliminar a " + est.apellido + ", " + est.nombre + "?")) {
        guardarEstado(true);
        state.estudiantes = state.estudiantes.filter(e => e.id !== id);
        Object.keys(state.asistencias).forEach(k => {
          if (k.endsWith('_' + id)) delete state.asistencias[k];
        });
        renderTodo();
        mostrarToastRapido("🗑️ Estudiante eliminado");
      }
    }

    // =========================================================================
    // 🛠️ UTILIDADES
    // =========================================================================
    function mostrarToastRapido(mensaje) {
      const toast = document.getElementById('toast-notificacion');
      document.getElementById('toast-mensaje').textContent = mensaje;
      toast.classList.remove('translate-y-20', 'opacity-0');
      setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
      }, 3000);
    }

    function formatearFechaLegible(fechaIso) {
      if (!fechaIso) return '';
      const p = fechaIso.split('-');
      if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
      return fechaIso;
    }

    // INICIALIZACIÓN AUTOMÁTICA
    window.onload = function() {
      document.getElementById('fecha-asistencia').value = fechaHoyStr;
      renderTodo();
    };
  </script>
</body>
</html>`;

fs.writeFileSync('C:\\Users\\NuevoAdmin\\Desktop\\Dashboard_Docente.html', html, 'utf8');
fs.writeFileSync('public/dashboard.html', html, 'utf8');
fs.writeFileSync('build_dashboard.js', fs.readFileSync(__filename, 'utf8'), 'utf8');

console.log('✅ Dashboard Docente actualizado con éxito con Incidencias (Paro, Sin Luz, Licencia), Acta PDF y Excel Pro!');
