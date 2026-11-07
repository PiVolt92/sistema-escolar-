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
  <title>Dashboard Escolar — Actualización y Sincronización Inteligente</title>
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
    .btn-disabled {
      opacity: 0.4;
      cursor: not-allowed !important;
      pointer-events: none;
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
          <h1 class="text-lg font-bold text-slate-900 leading-tight">TuProfeWeb <span class="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold ml-1">Actualización Inteligente</span></h1>
          <p class="text-xs text-slate-500">Gestión Escolar Integral &middot; Prof. Facundo Casciano</p>
        </div>
      </div>

      <div class="flex items-center space-x-2 sm:space-x-3">
        <!-- BOTONES DESHACER / REHACER EN NAVBAR -->
        <div class="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button id="btn-undo-nav" onclick="deshacer()" title="Deshacer último cambio (Ctrl + Z)" class="p-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition text-xs font-bold flex items-center space-x-1 btn-disabled">
            <i class="fa-solid fa-rotate-left"></i>
            <span class="hidden md:inline">Deshacer</span>
          </button>
          <button id="btn-redo-nav" onclick="rehacer()" title="Rehacer cambio (Ctrl + Y)" class="p-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition text-xs font-bold flex items-center space-x-1 btn-disabled">
            <i class="fa-solid fa-rotate-right"></i>
            <span class="hidden md:inline">Rehacer</span>
          </button>
        </div>

        <!-- BOTÓN ACTUALIZAR DATOS CON ARCHIVO -->
        <button onclick="document.getElementById('file-upload-excel').click()" class="btn-amber text-xs sm:text-sm px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-sm cursor-pointer">
          <i class="fa-solid fa-rotate text-sm"></i>
          <span>Actualizar con Archivo</span>
        </button>

        <!-- BOTÓN COPIA DE SEGURIDAD -->
        <button onclick="abrirModalBackup()" class="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-sm font-bold transition">
          <i class="fa-solid fa-shield-halved"></i>
          <span class="hidden sm:inline">Copia de Seguridad</span>
        </button>
      </div>
    </div>
  </header>

  <!-- INPUT FILE OCULTO DIRECTO PARA EXCEL/CSV/JSON -->
  <input type="file" id="file-upload-excel" accept=".xlsx,.xls,.csv,.json,.backup" class="hidden" onchange="manejarSubidaArchivoGeneral(event)">
  <!-- INPUT FILE OCULTO DIRECTO PARA RESTAURAR BACKUP -->
  <input type="file" id="file-restore-backup" accept=".json,.backup" class="hidden" onchange="procesarArchivoBackup(event)">

  <!-- CONTENIDO -->
  <main class="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">

    <!-- SELECTOR DE PERÍODO -->
    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <span class="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
          <i class="fa-regular fa-calendar-check"></i> Ciclo Lectivo &middot; Período de Evaluación
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

    <!-- BANNER DE CARGA Y ACTUALIZACIÓN RÁPIDA DRAG & DROP -->
    <div id="dropzone" 
         ondragover="handleDragOver(event)" 
         ondragleave="handleDragLeave(event)" 
         ondrop="handleDrop(event)"
         onclick="document.getElementById('file-upload-excel').click()"
         class="mb-6 p-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-100/50 transition cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-2xs">
      <div class="flex items-center space-x-3.5">
        <div class="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-sm shrink-0">
          <i class="fa-solid fa-cloud-arrow-up"></i>
        </div>
        <div>
          <h3 class="font-bold text-slate-800 text-sm sm:text-base">¿Tenés una planilla nueva para actualizar datos?</h3>
          <p class="text-xs text-slate-600">Arrastrá cualquier archivo <b>Excel (.xlsx), CSV o Copia de Seguridad</b> acá. Podés fusionar nuevas fechas, sumar alumnos o actualizar notas sin perder nada.</p>
        </div>
      </div>
      <button class="btn-amber text-xs px-4 py-2.5 rounded-lg pointer-events-none whitespace-nowrap shadow-sm shrink-0">
        <i class="fa-solid fa-folder-open mr-1"></i> Seleccionar Archivo
      </button>
    </div>

    <!-- BANNER DE ALERTA PARA PRECEPTORÍA (< 70%) -->
    <div id="banner-alerta-preceptoria" class="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div class="flex items-start space-x-3.5">
        <div class="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center text-xl shadow-sm shrink-0 mt-0.5 pulse-danger">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-600 text-white">Alerta Preceptoría</span>
            <span id="alerta-conteo-alumnos" class="text-xs font-bold text-rose-800">Estudiantes en riesgo pedagógico (< 70%)</span>
          </div>
          <p id="alerta-descripcion-texto" class="text-xs text-rose-700 mt-1">
            Los siguientes alumnos no alcanzan el 70% de asistencia obligatoria y deben ser notificados por Preceptoría:
          </p>
          <div id="alerta-chips-alumnos" class="flex flex-wrap gap-1.5 mt-2"></div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 shrink-0">
        <button onclick="copiarInformePreceptoria()" class="bg-white hover:bg-slate-50 text-rose-700 border border-rose-300 text-xs px-3.5 py-2 rounded-lg font-bold shadow-xs transition flex items-center space-x-1.5">
          <i class="fa-brands fa-whatsapp text-emerald-600 text-base"></i>
          <span>Copiar Mensaje Preceptora</span>
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
          <i class="fa-solid fa-calendar-days"></i>
        </div>
        <div>
          <p class="text-xs font-medium text-slate-500">Clases del Período</p>
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
          <span id="badge-turno" class="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Turno</span>
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
          
          <button onclick="descargarExcelProfesionalMultiHoja()" class="btn-amber text-xs px-3.5 py-2 rounded-lg font-bold shadow-sm transition flex items-center space-x-1">
            <i class="fa-solid fa-file-excel mr-1"></i> Descargar Planilla Pro
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
              <th class="py-3 px-4 font-semibold text-center">Estado Hoy</th>
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

  <!-- =========================================================================
       MODAL DE VISTA PREVIA Y ACTUALIZACIÓN INTELIGENTE CON ARCHIVOS
       ========================================================================= -->
  <div id="modal-preview-actualizacion" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 hidden">
    <div class="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl font-bold">
            <i class="fa-solid fa-arrows-rotate"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Actualizar Datos con Archivo</h3>
            <p class="text-xs text-slate-500" id="actualizar-archivo-subtitulo">Archivo listo para procesar</p>
          </div>
        </div>
        <button onclick="cerrarModalActualizacion()" class="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">&times;</button>
      </div>

      <!-- Resumen de lo detectado en el archivo -->
      <div class="space-y-3.5 mb-5">
        <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
          <div class="flex justify-between">
            <span class="text-slate-500 font-medium">📁 Nombre del archivo:</span>
            <span id="resumen-nombre-archivo" class="font-bold text-slate-800">planilla.xlsx</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500 font-medium">👥 Estudiantes encontrados:</span>
            <span id="resumen-total-estudiantes" class="font-bold text-emerald-700">13 alumnos</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500 font-medium">📅 Columnas de fechas:</span>
            <span id="resumen-total-fechas" class="font-bold text-blue-700">21 clases registradas</span>
          </div>
        </div>

        <!-- Selector de Curso Destino -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">
            Curso al que querés aplicar la actualización:
          </label>
          <select id="select-curso-actualizar" class="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-amber-500 focus:bg-white transition">
            <!-- Cursos dinámicos -->
          </select>
        </div>

        <!-- Modo de Actualización -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5">
            ¿Cómo querés aplicar los datos del archivo?
          </label>
          <div class="space-y-2 text-xs">
            <label class="flex items-start p-3 rounded-xl border border-amber-300 bg-amber-50/60 cursor-pointer">
              <input type="radio" name="modo-actualizacion" value="merge" checked class="mt-0.5 text-amber-600">
              <div class="ml-2.5">
                <span class="font-bold text-amber-950">🔄 Actualizar y Fusionar (Recomendado)</span>
                <p class="text-amber-800 mt-0.5 text-[11px]">Conserva los alumnos y fechas que ya tenías, suma las nuevas clases de asistencia y actualiza las notas.</p>
              </div>
            </label>

            <label class="flex items-start p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input type="radio" name="modo-actualizacion" value="replace" class="mt-0.5 text-amber-600">
              <div class="ml-2.5">
                <span class="font-bold text-slate-800">⚡ Reemplazar la lista de este curso</span>
                <p class="text-slate-500 mt-0.5 text-[11px]">Reemplaza la nómina completa del curso por la que viene en este archivo.</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between pt-3 border-t border-slate-100">
        <span class="text-[11px] text-slate-400">💡 Podrás deshacer la acción con Ctrl + Z si es necesario.</span>
        <div class="flex space-x-2">
          <button onclick="cerrarModalActualizacion()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold transition">
            Cancelar
          </button>
          <button onclick="confirmarAplicarActualizacion()" class="btn-amber text-xs px-5 py-2.5 rounded-lg font-bold shadow-sm transition flex items-center space-x-1.5">
            <i class="fa-solid fa-check"></i>
            <span>Confirmar y Actualizar</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL DE COPIA DE SEGURIDAD -->
  <div id="modal-backup" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 hidden">
    <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold">
            <i class="fa-solid fa-shield-halved"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Centro de Copia de Seguridad</h3>
            <p class="text-xs text-slate-500">Respaldo total de datos, notas y asistencias</p>
          </div>
        </div>
        <button onclick="cerrarModalBackup()" class="text-slate-400 hover:text-slate-600 text-lg p-1">&times;</button>
      </div>

      <div class="space-y-4">
        <!-- Tarjeta Exportar Respaldo -->
        <div class="p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50 transition flex items-center justify-between">
          <div>
            <h4 class="font-bold text-slate-800 text-sm">Crear Copia de Seguridad</h4>
            <p class="text-xs text-slate-500 mt-0.5">Descarga un archivo con toda tu información para guardar en tu pendrive o nube.</p>
          </div>
          <button onclick="descargarCopiaSeguridadJSON()" class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2.5 rounded-lg font-bold shadow-sm transition whitespace-nowrap ml-3">
            <i class="fa-solid fa-download mr-1"></i> Descargar Respaldo
          </button>
        </div>

        <!-- Tarjeta Restaurar Respaldo -->
        <div class="p-4 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50 transition flex items-center justify-between">
          <div>
            <h4 class="font-bold text-slate-800 text-sm">Restaurar Copia de Seguridad</h4>
            <p class="text-xs text-slate-500 mt-0.5">Recupera todos tus datos desde un archivo de copia anterior (.json).</p>
          </div>
          <button onclick="document.getElementById('file-restore-backup').click()" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2.5 rounded-lg font-bold shadow-sm transition whitespace-nowrap ml-3">
            <i class="fa-solid fa-upload mr-1"></i> Subir Respaldo
          </button>
        </div>

        <!-- Tarjeta Snapshot en el Navegador -->
        <div class="p-4 rounded-xl border border-amber-200 bg-amber-50/60 flex items-center justify-between">
          <div>
            <h4 class="font-bold text-amber-900 text-sm">Punto de Restauración Automático</h4>
            <p class="text-xs text-amber-700 mt-0.5" id="snapshot-status-txt">Hay una copia guardada en este navegador.</p>
          </div>
          <button onclick="restaurarSnapshotNavegador()" class="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs px-3.5 py-2 rounded-lg font-bold transition whitespace-nowrap ml-3">
            <i class="fa-solid fa-clock-rotate-left mr-1"></i> Restaurar Snapshot
          </button>
        </div>
      </div>

      <div class="mt-6 pt-4 border-t border-slate-100 flex justify-end">
        <button onclick="cerrarModalBackup()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold transition">
          Cerrar
        </button>
      </div>
    </div>
  </div>

  <footer class="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 mt-8">
    <p>TuProfeWeb &copy; 2026 &middot; Con Sistema de Actualización Inteligente, Deshacer/Rehacer y Respaldo Total</p>
  </footer>

  <script>
    const INITIAL_STATE = ${JSON.stringify(initialData)};

    let state = JSON.parse(localStorage.getItem('dashboard_docente_data_v7')) || INITIAL_STATE;
    let colegioActivoId = 2; // Por defecto Tecnica N° 2 (donde está 4° 3 Montaje GB)
    let cursoActivoId = 10;  // 4° 3 Montaje GB
    let fechaHoy = new Date().toISOString().split('T')[0];
    let periodoSeleccionado = 'todo'; // 'todo' | 'p1' | 'p2'

    // Objeto temporal para almacenar datos analizados de un archivo subido
    let archivoPendienteActualizar = null;

    // =========================================================================
    // ↶ MOTOR DE DESHACER (UNDO) / ↷ REHACER (REDO)
    // =========================================================================
    const historyStack = [];
    const redoStack = [];
    const MAX_HISTORY = 40;

    function guardarEstado(registrarEnHistorial = true) {
      if (registrarEnHistorial) {
        const snapshot = localStorage.getItem('dashboard_docente_data_v7') || JSON.stringify(INITIAL_STATE);
        historyStack.push(snapshot);
        if (historyStack.length > MAX_HISTORY) historyStack.shift();
        redoStack.length = 0;
        actualizarBotonesUndoRedo();
      }

      localStorage.setItem('dashboard_docente_data_v7', JSON.stringify(state));
      localStorage.setItem('dashboard_backup_emergency_snapshot', JSON.stringify({
        fecha: new Date().toLocaleString('es-AR'),
        state: state
      }));

      actualizarKPIs();
    }

    function deshacer() {
      if (historyStack.length === 0) return;
      redoStack.push(JSON.stringify(state));
      const anterior = historyStack.pop();
      state = JSON.parse(anterior);
      guardarEstado(false);
      renderTablaEstudiantes();
      actualizarKPIs();
      actualizarBotonesUndoRedo();
      mostrarToastRapido("↶ Acción deshecha con éxito");
    }

    function rehacer() {
      if (redoStack.length === 0) return;
      historyStack.push(JSON.stringify(state));
      const siguiente = redoStack.pop();
      state = JSON.parse(siguiente);
      guardarEstado(false);
      renderTablaEstudiantes();
      actualizarKPIs();
      actualizarBotonesUndoRedo();
      mostrarToastRapido("↷ Acción rehecha con éxito");
    }

    function actualizarBotonesUndoRedo() {
      const btnUndoNav = document.getElementById('btn-undo-nav');
      const btnRedoNav = document.getElementById('btn-redo-nav');
      const btnUndoTool = document.getElementById('btn-undo-toolbar');
      const btnRedoTool = document.getElementById('btn-redo-toolbar');

      if (historyStack.length > 0) {
        btnUndoNav?.classList.remove('btn-disabled');
        btnUndoTool?.classList.remove('btn-disabled');
      } else {
        btnUndoNav?.classList.add('btn-disabled');
        btnUndoTool?.classList.add('btn-disabled');
      }

      if (redoStack.length > 0) {
        btnRedoNav?.classList.remove('btn-disabled');
        btnRedoTool?.classList.remove('btn-disabled');
      } else {
        btnRedoNav?.classList.add('btn-disabled');
        btnRedoTool?.classList.add('btn-disabled');
      }
    }

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          rehacer();
        } else {
          e.preventDefault();
          deshacer();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        rehacer();
      }
    });

    function mostrarToastRapido(msg) {
      let t = document.getElementById('toast-feedback-rapido');
      if (!t) {
        t = document.createElement('div');
        t.id = 'toast-feedback-rapido';
        t.className = "fixed bottom-5 right-5 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg z-50 transition transform duration-200 pointer-events-none";
        document.body.appendChild(t);
      }
      t.innerText = msg;
      t.style.opacity = '1';
      t.style.transform = 'translateY(0)';
      clearTimeout(t.timer);
      t.timer = setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(10px)';
      }, 1800);
    }

    // =========================================================================
    // 🔄 MOTOR DE ACTUALIZACIÓN INTELIGENTE CON ARCHIVOS
    // =========================================================================
    function manejarSubidaArchivoGeneral(e) {
      const files = e.target.files;
      if (files && files.length > 0) {
        analizarYPrepararArchivo(files[0]);
      }
      e.target.value = '';
    }

    function handleDragOver(e) {
      e.preventDefault();
      document.getElementById('dropzone').classList.add('drop-active');
    }
    function handleDragLeave(e) {
      document.getElementById('dropzone').classList.remove('drop-active');
    }
    function handleDrop(e) {
      e.preventDefault();
      document.getElementById('dropzone').classList.remove('drop-active');
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        analizarYPrepararArchivo(files[0]);
      }
    }

    function analizarYPrepararArchivo(file) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      // Si es un archivo de copia de seguridad JSON
      if (ext === '.json' || ext === '.backup') {
        procesarArchivoBackup({ target: { files: [file], value: '' } });
        return;
      }

      // Si es una planilla Excel o CSV
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

          // Detección de fechas
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

          // Detección de estudiantes
          const estudiantesExtraidos = [];
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

            const asistenciasFila = {};
            dateCols.forEach(dc => {
              const val = String(row[dc.colIndex] || '').trim().toUpperCase();
              let code = 'P';
              if (val === 'A') code = 'A';
              else if (val === 'J') code = 'J';
              else if (val === 'T') code = 'T';
              asistenciasFila[dc.dateIso] = code;
            });

            estudiantesExtraidos.push({
              apellido: apellido.toUpperCase(),
              nombre: nombre.toUpperCase(),
              asistencias: asistenciasFila
            });
          }

          if (estudiantesExtraidos.length === 0) {
            alert("No se pudieron detectar estudiantes en la primera columna del archivo.");
            return;
          }

          // Detectar curso coincidente por nombre de archivo o pestaña
          let cursoSugeridoId = cursoActivoId;
          const fileNameLower = (file.name + ' ' + sheetName).toLowerCase();
          const cursoMatch = state.cursos.find(c => {
            const nomClean = c.nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
            return fileNameLower.replace(/[^a-z0-9]/g, '').includes(nomClean) ||
                   (fileNameLower.includes('montaje') && fileNameLower.includes('4') && fileNameLower.includes('3') && c.id === 10);
          });
          if (cursoMatch) {
            cursoSugeridoId = cursoMatch.id;
          }

          // Guardar objeto pendiente
          archivoPendienteActualizar = {
            fileName: file.name,
            sheetName: sheetName,
            estudiantes: estudiantesExtraidos,
            dateCols: dateCols,
            cursoSugeridoId: cursoSugeridoId
          };

          // Abrir modal de vista previa y confirmación
          abrirModalActualizacion();

        } catch(err) {
          console.error(err);
          alert("Error al leer el archivo: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    }

    function abrirModalActualizacion() {
      if (!archivoPendienteActualizar) return;
      const ap = archivoPendienteActualizar;

      document.getElementById('resumen-nombre-archivo').innerText = ap.fileName + ' [' + ap.sheetName + ']';
      document.getElementById('resumen-total-estudiantes').innerText = ap.estudiantes.length + ' alumnos listos';
      document.getElementById('resumen-total-fechas').innerText = ap.dateCols.length + ' fechas detectadas';

      // Llenar selector de cursos
      const select = document.getElementById('select-curso-actualizar');
      select.innerHTML = '';
      state.cursos.forEach(cur => {
        const col = state.colegios.find(c => c.id === cur.colegio_id);
        const opt = document.createElement('option');
        opt.value = cur.id;
        opt.innerText = cur.nombre + ' (' + (col ? col.nombre : '') + ')';
        if (cur.id === ap.cursoSugeridoId) opt.selected = true;
        select.appendChild(opt);
      });

      document.getElementById('modal-preview-actualizacion').classList.remove('hidden');
    }

    function cerrarModalActualizacion() {
      document.getElementById('modal-preview-actualizacion').classList.add('hidden');
      archivoPendienteActualizar = null;
    }

    function confirmarAplicarActualizacion() {
      if (!archivoPendienteActualizar) return;
      const ap = archivoPendienteActualizar;
      const targetCursoId = parseInt(document.getElementById('select-curso-actualizar').value, 10);
      const modo = document.querySelector('input[name="modo-actualizacion"]:checked').value; // 'merge' | 'replace'

      guardarEstado(true); // Registrar estado actual en historial antes de aplicar

      if (modo === 'replace') {
        // Modo reemplazo: limpiar alumnos y asistencias previas de este curso
        const idsAEliminar = state.estudiantes.filter(e => e.curso_id === targetCursoId).map(e => e.id);
        state.estudiantes = state.estudiantes.filter(e => e.curso_id !== targetCursoId);
        Object.keys(state.asistencias).forEach(k => {
          const estId = parseInt(k.split('_')[1], 10);
          if (idsAEliminar.includes(estId)) {
            delete state.asistencias[k];
          }
        });
      }

      let alumnosNuevos = 0;
      let alumnosActualizados = 0;
      let asistenciasGuardadas = 0;

      ap.estudiantes.forEach((item, r) => {
        let est = state.estudiantes.find(e => 
          e.curso_id === targetCursoId && 
          e.apellido.toUpperCase().trim() === item.apellido.toUpperCase().trim()
        );

        if (!est) {
          est = {
            id: Date.now() + Math.floor(Math.random() * 100000) + r,
            curso_id: targetCursoId,
            apellido: item.apellido,
            nombre: item.nombre,
            dni: ''
          };
          state.estudiantes.push(est);
          alumnosNuevos++;
        } else {
          alumnosActualizados++;
          if (item.nombre && item.nombre !== '-' && (!est.nombre || est.nombre === '-')) {
            est.nombre = item.nombre;
          }
        }

        // Cargar/actualizar asistencias de este alumno
        Object.keys(item.asistencias).forEach(fechaIso => {
          state.asistencias[fechaIso + '_' + est.id] = item.asistencias[fechaIso];
          asistenciasGuardadas++;
        });
      });

      guardarEstado(false);
      seleccionarCurso(targetCursoId);
      cerrarModalActualizacion();

      const nomCurso = (state.cursos.find(c => c.id === targetCursoId) || {}).nombre || '';
      alert('¡Actualización completada con éxito!\\n\\n📁 Curso: ' + nomCurso + '\\n👥 Alumnos procesados: ' + (alumnosNuevos + alumnosActualizados) + ' (' + alumnosNuevos + ' nuevos, ' + alumnosActualizados + ' actualizados)\\n📅 Asistencias registradas/actualizadas: ' + asistenciasGuardadas);
    }

    // =========================================================================
    // 🛡️ CENTRO DE COPIA DE SEGURIDAD Y RESTAURACIÓN
    // =========================================================================
    function abrirModalBackup() {
      const snap = localStorage.getItem('dashboard_backup_emergency_snapshot');
      if (snap) {
        try {
          const parsed = JSON.parse(snap);
          document.getElementById('snapshot-status-txt').innerText = "Último punto guardado: " + parsed.fecha;
        } catch(e) {}
      }
      document.getElementById('modal-backup').classList.remove('hidden');
    }

    function cerrarModalBackup() {
      document.getElementById('modal-backup').classList.add('hidden');
    }

    function descargarCopiaSeguridadJSON() {
      const backupData = {
        version: "TuProfeWeb_2026_v1",
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

    function restaurarSnapshotNavegador() {
      const snap = localStorage.getItem('dashboard_backup_emergency_snapshot');
      if (!snap) {
        alert("No hay ningún punto de restauración guardado aún.");
        return;
      }
      try {
        const parsed = JSON.parse(snap);
        if (confirm("¿Deseas volver al punto de restauración del " + parsed.fecha + "?")) {
          guardarEstado(true);
          state = parsed.state;
          guardarEstado(false);
          seleccionarColegio(colegioActivoId);
          seleccionarCurso(cursoActivoId);
          cerrarModalBackup();
          alert("¡Punto de restauración recuperado con éxito!");
        }
      } catch(e) {
        alert("Error al restaurar: " + e.message);
      }
    }

    // =========================================================================
    // INICIALIZACIÓN
    // =========================================================================
    window.addEventListener('DOMContentLoaded', () => {
      document.getElementById('fecha-asistencia').value = fechaHoy;
      renderColegios();
      seleccionarColegio(colegioActivoId);
      seleccionarCurso(cursoActivoId);
      actualizarKPIs();
      actualizarBotonesUndoRedo();
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
              '<p class="text-xs text-emerald-700">Todos los alumnos del curso mantienen la regularidad pedagógica en este período.</p>' +
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
      guardarEstado(true);
      renderTablaEstudiantes();
    }

    function marcarTodos(estado) {
      const fecha = document.getElementById('fecha-asistencia').value || fechaHoy;
      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoActivoId);
      alumnos.forEach(est => {
        state.asistencias[fecha + '_' + est.id] = estado;
      });
      guardarEstado(true);
      renderTablaEstudiantes();
      mostrarToastRapido("Marcados todos como " + (estado === 'P' ? 'Presentes' : 'Ausentes'));
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

      let texto = '📋 *INFORME OFICIAL DE INASISTENCIAS PARA PRECEPTORÍA*\\n';
      texto += '🏫 *Establecimiento:* ' + (col ? col.nombre : '') + '\\n';
      texto += '📘 *Curso:* ' + (cur ? cur.nombre : '') + '\\n';
      texto += '📅 *Período:* ' + nomPeriodo + '\\n';
      texto += '👤 *Docente Titular:* Prof. Facundo Casciano\\n';
      texto += '------------------------------------------\\n';
      texto += '⚠️ *ESTUDIANTES EN RIESGO PEDAGÓGICO (< 70% ASISTENCIA):*\\n\\n';

      if (enRiesgo.length === 0) {
        texto += '✅ *Sin observaciones:* Todos los estudiantes cumplen con la regularidad institucional (>= 70%).';
      } else {
        enRiesgo.forEach((item, i) => {
          texto += (i + 1) + '. *' + item.est.apellido + ' ' + (item.est.nombre !== '-' ? item.est.nombre : '') + '*\\n';
          texto += '   - Porcentaje Asistencia: *' + item.stats.porcentaje + '%*\\n';
          texto += '   - Clases asistidas: ' + item.stats.presentes + ' de ' + item.stats.totalClases + ' clases\\n';
          texto += '   - Total Faltas (Ausentes): *' + item.stats.ausentes + '*\\n';
          texto += '   - Acción requerida: Citación a padres / Preceptoría\\n\\n';
        });
      }

      texto += '------------------------------------------\\n';
      texto += '_Generado y certificado automáticamente por TuProfeWeb_';

      navigator.clipboard.writeText(texto).then(() => {
        alert("¡Informe copiado al portapapeles con éxito!\\n\\nYa podés pegarlo directamente en WhatsApp para la preceptora.");
      }).catch(() => {
        prompt("Copiá este texto para la preceptora:", texto);
      });
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

        const nombreCompleto = est.apellido + ' ' + (est.nombre && est.nombre !== '-' ? est.nombre : '');
        const condicion = stats.enRiesgo ? '⚠️ EN RIESGO (< 70%)' : 'REGULAR';
        const accion = stats.enRiesgo ? 'CITAR TUTOR / ACTA DE INASISTENCIA' : 'REGULAR - SIN OBSERVACIONES';

        s1.push([
          idx + 1,
          nombreCompleto,
          est.dni || '-',
          stats.totalClases,
          stats.presentes,
          stats.ausentes,
          stats.justificadas,
          stats.tardes,
          stats.porcentaje + '%',
          condicion,
          accion
        ]);
      });

      s1.push([]);
      const promedioGeneral = alumnos.length > 0 && fechas.length > 0 
        ? Math.round((sumaPresentesTotal / (alumnos.length * fechas.length)) * 100) : 0;

      s1.push([
        '',
        'TOTALES Y PROMEDIO GENERAL DEL CURSO:',
        '',
        fechas.length,
        sumaPresentesTotal,
        sumaAusentesTotal,
        '',
        '',
        promedioGeneral + '%',
        totalAlumnosRiesgo > 0 ? (totalAlumnosRiesgo + ' ALUMNO(S) EN RIESGO') : 'CURSO 100% REGULAR',
        totalAlumnosRiesgo > 0 ? 'SEGUIMIENTO PRECEPTORÍA URGENTE' : 'SITUACIÓN NORMAL'
      ]);

      s1.push([]);
      s1.push([]);
      s1.push(['', '_______________________________', '', '', '_______________________________', '', '', '_______________________________']);
      s1.push(['', 'Prof. Facundo Casciano', '', '', 'Preceptor/a Responsable', '', '', 'Equipo Directivo']);
      s1.push(['', 'Firma y Sello Docente', '', '', 'Firma y Sello Preceptoría', '', '', 'Visto Bueno Dirección']);

      const ws1 = XLSX.utils.aoa_to_sheet(s1);
      ws1['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } }
      ];
      ws1['!cols'] = [
        { wch: 5 }, { wch: 32 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 26 }, { wch: 38 }
      ];
      XLSX.utils.book_append_sheet(wb, ws1, '📋 Resumen Preceptoría');

      // ── HOJA 2: MATRIZ CLASE POR CLASE (FECHA POR FECHA) ──
      const s2 = [];
      s2.push(['REGISTRO DIARIO CLASE POR CLASE — ' + (cur ? cur.nombre : '') + ' (' + nomPeriodo + ')']);
      s2.push([]);

      const cabeceraFechas = ['N°', 'ESTUDIANTE (APELLIDO Y NOMBRE)'];
      fechas.forEach(f => {
        const p = f.split('-');
        cabeceraFechas.push(p[2] + '/' + p[1]);
      });
      cabeceraFechas.push('TOTAL P', 'TOTAL A', '% ASIST.');
      s2.push(cabeceraFechas);

      const totalesDiariosP = {};
      const totalesDiariosA = {};
      fechas.forEach(f => { totalesDiariosP[f] = 0; totalesDiariosA[f] = 0; });

      alumnos.forEach((est, idx) => {
        const stats = calcularStatsEstudiante(est.id);
        const fila = [idx + 1, est.apellido + ' ' + (est.nombre && est.nombre !== '-' ? est.nombre : '')];
        fechas.forEach(f => {
          const st = state.asistencias[f + '_' + est.id] || 'P';
          fila.push(st);
          if (st === 'P') totalesDiariosP[f]++;
          else if (st === 'A') totalesDiariosA[f]++;
        });
        fila.push(stats.presentes, stats.ausentes, stats.porcentaje + '%');
        s2.push(fila);
      });

      s2.push([]);
      const filaTotalesP = ['', 'PRESENTES DEL DÍA:'];
      const filaTotalesA = ['', 'AUSENTES DEL DÍA:'];
      fechas.forEach(f => {
        filaTotalesP.push(totalesDiariosP[f]);
        filaTotalesA.push(totalesDiariosA[f]);
      });
      s2.push(filaTotalesP);
      s2.push(filaTotalesA);

      const ws2 = XLSX.utils.aoa_to_sheet(s2);
      ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cabeceraFechas.length - 1 } }];
      const cols2 = [{ wch: 5 }, { wch: 32 }];
      fechas.forEach(() => cols2.push({ wch: 8 }));
      cols2.push({ wch: 10 }, { wch: 10 }, { wch: 12 });
      ws2['!cols'] = cols2;
      XLSX.utils.book_append_sheet(wb, ws2, '📅 Matriz Día por Día');

      // ── HOJA 3: SOLO CASOS EN RIESGO (< 70%) ──
      const s3 = [];
      s3.push(['ALERTA DE PRECEPTORÍA — ALUMNOS CON ASISTENCIA INFERIOR AL 70%']);
      s3.push(['LISTADO PARA CITACIÓN DE TUTORES Y NOTIFICACIÓN PEDAGÓGICA']);
      s3.push([]);
      s3.push(['CURSO:', cur ? cur.nombre : '', 'PERÍODO:', nomPeriodo]);
      s3.push([]);
      s3.push(['N°', 'ESTUDIANTE', 'DNI', 'CLASES TOTALES', 'ASISTIÓ', 'FALTAS', '% ASISTENCIA', 'TUTOR / TELÉFONO DE CONTACTO', 'NOTIFICADO']);

      let ordenRiesgo = 1;
      alumnos.forEach(est => {
        const stats = calcularStatsEstudiante(est.id);
        if (stats.enRiesgo) {
          s3.push([
            ordenRiesgo++,
            est.apellido + ' ' + (est.nombre && est.nombre !== '-' ? est.nombre : ''),
            est.dni || '-',
            stats.totalClases,
            stats.presentes,
            stats.ausentes,
            stats.porcentaje + '%',
            '_______________________',
            '[  ] SI   [  ] NO'
          ]);
        }
      });

      if (ordenRiesgo === 1) {
        s3.push(['', '¡Felicitaciones! Ningún alumno registra menos del 70% de asistencia en este período.', '', '', '', '', '', '', '']);
      }

      s3.push([]);
      s3.push([]);
      s3.push(['', '_______________________________', '', '_______________________________']);
      s3.push(['', 'Firma Docente', '', 'Firma y Sello Preceptor/a']);

      const ws3 = XLSX.utils.aoa_to_sheet(s3);
      ws3['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }
      ];
      ws3['!cols'] = [
        { wch: 5 }, { wch: 32 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 32 }, { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, ws3, '⚠️ Solo Casos en Riesgo');

      const nomArchivo = 'Planilla_Oficial_Preceptoria_' + (cur ? cur.nombre.replace(/[^a-zA-Z0-9]/g, '_') : 'Curso') + '_' + archivoPeriodoTag + '.xlsx';
      XLSX.writeFile(wb, nomArchivo);
    }

    function eliminarEstudiante(id) {
      if (confirm("¿Estás seguro de eliminar este estudiante del curso?")) {
        guardarEstado(true);
        state.estudiantes = state.estudiantes.filter(e => e.id !== id);
        guardarEstado(false);
        seleccionarCurso(cursoActivoId);
        mostrarToastRapido("Estudiante eliminado (podés Deshacer con Ctrl+Z)");
      }
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
  </script>
</body>
</html>`;

fs.writeFileSync('C:\\Users\\NuevoAdmin\\Desktop\\Dashboard_Docente.html', html, 'utf8');
console.log('Saved Dashboard_Docente.html with Smart File Updater and Sync successfully!');
