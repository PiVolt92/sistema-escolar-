const fs = require('fs');

let code = fs.readFileSync('update_dashboard.js', 'utf8');

// 1. Agregar botón del simulador en la cabecera de preceptoría
const targetBotonPreceptoria = `<button onclick="descargarAlertaPreceptoriaPDF()" class="bg-rose-700 hover:bg-rose-800 text-white text-xs px-3.5 py-2 rounded-lg font-bold shadow-xs transition flex items-center space-x-1.5">
          <i class="fa-solid fa-file-pdf text-rose-200"></i>
          <span>Descargar Alerta PDF</span>
        </button>`;

const replacementBotonPreceptoria = `<button onclick="abrirModalSimulador()" class="bg-indigo-700 hover:bg-indigo-800 text-white text-xs px-3.5 py-2 rounded-lg font-bold shadow-xs transition flex items-center space-x-1.5">
          <i class="fa-solid fa-calculator text-indigo-200"></i>
          <span>Simulador a Fin de Año</span>
        </button>
        ${targetBotonPreceptoria}`;

if (code.includes(targetBotonPreceptoria)) {
  code = code.replace(targetBotonPreceptoria, replacementBotonPreceptoria);
  console.log('✅ Botón Simulador agregado al banner de preceptoría');
}

// 2. Agregar barra de búsqueda y filtros rápidos arriba de la tabla de estudiantes
const targetTabla = `<!-- TABLA DE ALUMNOS Y ASISTENCIAS -->
      <div class="overflow-x-auto">`;

const replacementBarraFiltros = `<!-- BARRA DE BÚSQUEDA Y FILTROS RÁPIDOS -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 bg-slate-50/90 p-3 rounded-xl border border-slate-200 shadow-2xs">
        <!-- Buscador en tiempo real -->
        <div class="relative flex-1 max-w-md">
          <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input type="text" id="buscador-estudiantes" oninput="alBuscarEstudiante(event)" placeholder="Buscar estudiante por apellido, nombre o DNI..." class="w-full text-xs pl-9 pr-8 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 outline-none">
          <button onclick="limpiarBuscador()" id="btn-limpiar-busqueda" class="hidden absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
            <i class="fa-solid fa-circle-xmark"></i>
          </button>
        </div>

        <!-- Filtros de Estado -->
        <div class="flex flex-wrap items-center gap-1.5 text-xs">
          <button onclick="cambiarFiltroTabla('todos')" id="filtro-btn-todos" class="px-2.5 py-1.5 rounded-lg font-bold bg-slate-900 text-white shadow-2xs transition">Todos (<span id="cnt-filtro-todos">0</span>)</button>
          <button onclick="cambiarFiltroTabla('regulares')" id="filtro-btn-regulares" class="px-2.5 py-1.5 rounded-lg font-medium bg-white text-emerald-800 border border-slate-200 hover:bg-slate-100 transition">🟢 Regulares (<span id="cnt-filtro-regulares">0</span>)</button>
          <button onclick="cambiarFiltroTabla('pueden_salvarse')" id="filtro-btn-pueden_salvarse" class="px-2.5 py-1.5 rounded-lg font-bold bg-white text-amber-900 border border-amber-300 hover:bg-amber-50 transition">🟡 Pueden Llegar (<span id="cnt-filtro-pueden_salvarse">0</span>)</button>
          <button onclick="cambiarFiltroTabla('libres')" id="filtro-btn-libres" class="px-2.5 py-1.5 rounded-lg font-bold bg-white text-rose-800 border border-rose-300 hover:bg-rose-50 transition">🔴 Libres (<span id="cnt-filtro-libres">0</span>)</button>
          <button onclick="cambiarFiltroTabla('ausentes_hoy')" id="filtro-btn-ausentes_hoy" class="px-2.5 py-1.5 rounded-lg font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition">Faltaron Hoy (<span id="cnt-filtro-ausentes">0</span>)</button>
        </div>

        <!-- Botón Simulador Directo -->
        <button onclick="abrirModalSimulador()" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-2 rounded-lg font-bold shadow-xs transition flex items-center space-x-1.5 whitespace-nowrap">
          <i class="fa-solid fa-calculator text-indigo-200"></i>
          <span>Simulador a Diciembre</span>
        </button>
      </div>

      <!-- TABLA DE ALUMNOS Y ASISTENCIAS -->
      <div class="overflow-x-auto">`;

if (code.includes(targetTabla)) {
  code = code.replace(targetTabla, replacementBarraFiltros);
  console.log('✅ Barra de búsqueda y filtros rápidos agregados a la tabla');
}

// 3. Modales Nuevos: Ficha del Estudiante y Simulador Interactivo
const nuevosModalesHtml = `
  <!-- MODAL: FICHA PEDAGÓGICA INDIVIDUAL DEL ESTUDIANTE -->
  <div id="modal-ficha-estudiante" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
    <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 shrink-0">
        <div class="flex items-center space-x-3">
          <div id="ficha-avatar" class="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-sm">
            AL
          </div>
          <div>
            <h3 id="ficha-nombre-alumno" class="text-lg font-black text-slate-900">APELLIDO, NOMBRE</h3>
            <p class="text-xs text-slate-500"><span id="ficha-curso-txt">Curso</span> • DNI: <span id="ficha-dni-txt">---</span></p>
          </div>
        </div>
        <button onclick="cerrarFichaEstudiante()" class="text-slate-400 hover:text-slate-600 text-xl p-1">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="overflow-y-auto pr-1 space-y-4 flex-1">
        <!-- Indicadores Clave del Estudiante -->
        <div class="grid grid-cols-4 gap-2.5 text-center">
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span class="text-[10px] uppercase font-bold text-slate-500">Clases</span>
            <div id="ficha-stat-clases" class="text-xl font-black text-slate-800 mt-0.5">0</div>
          </div>
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <span class="text-[10px] uppercase font-bold text-emerald-700">Presentes</span>
            <div id="ficha-stat-presentes" class="text-xl font-black text-emerald-800 mt-0.5">0</div>
          </div>
          <div class="bg-rose-50 p-3 rounded-xl border border-rose-200">
            <span class="text-[10px] uppercase font-bold text-rose-700">Faltas</span>
            <div id="ficha-stat-faltas" class="text-xl font-black text-rose-800 mt-0.5">0</div>
          </div>
          <div class="bg-amber-50 p-3 rounded-xl border border-amber-200">
            <span class="text-[10px] uppercase font-bold text-amber-700">% Asistencia</span>
            <div id="ficha-stat-porcentaje" class="text-xl font-black text-amber-800 mt-0.5">0%</div>
          </div>
        </div>

        <!-- Tarjeta de Condición y Proyección -->
        <div id="ficha-tarjeta-proyeccion" class="p-3.5 rounded-xl border flex items-center justify-between">
          <div>
            <div class="flex items-center space-x-2">
              <span id="ficha-badge-condicion" class="text-xs font-black px-2.5 py-0.5 rounded-full">Condición</span>
            </div>
            <p id="ficha-detalle-proyeccion" class="text-xs text-slate-600 mt-1">Detalle de la proyección</p>
          </div>
          <div id="ficha-icono-proyeccion" class="text-2xl"></div>
        </div>

        <!-- Historial Día por Día -->
        <div>
          <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Historial Diario de Asistencia</span>
            <span class="text-[11px] text-slate-400 font-normal">P: Presente • A: Ausente • J: Justificada • T: Tarde</span>
          </h4>
          <div id="ficha-historial-dias" class="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto"></div>
        </div>
      </div>

      <div class="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 shrink-0">
        <button onclick="copiarMensajeFamiliarWhatsApp()" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition flex items-center space-x-1.5">
          <i class="fa-brands fa-whatsapp text-sm"></i>
          <span>Mensaje para la Familia (WhatsApp)</span>
        </button>
        <button onclick="cerrarFichaEstudiante()" class="text-xs text-slate-600 hover:bg-slate-100 font-bold px-4 py-2.5 rounded-xl transition">
          Cerrar
        </button>
      </div>
    </div>
  </div>

  <!-- MODAL: SIMULADOR INTERACTIVO DE RECUPERABILIDAD A FIN DE AÑO -->
  <div id="modal-simulador" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
    <div class="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 shrink-0">
        <div class="flex items-center space-x-2.5">
          <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
            <i class="fa-solid fa-calculator"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Simulador de Recuperabilidad de Asistencia a Fin de Año</h3>
            <p class="text-xs text-slate-500">Calculá exactamente quiénes salvan la materia y quiénes quedan libres según las clases restantes</p>
          </div>
        </div>
        <button onclick="cerrarModalSimulador()" class="text-slate-400 hover:text-slate-600 text-lg p-1">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Barra de Control del Simulador -->
      <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 mb-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center space-x-3">
          <label class="text-xs font-bold text-indigo-950">Clases restantes a simular:</label>
          <div class="flex items-center space-x-1 bg-white p-1 rounded-lg border border-indigo-300">
            <button onclick="cambiarClasesSimuladas(3)" id="btn-sim-3" class="px-2.5 py-1 text-xs font-bold rounded hover:bg-indigo-100 text-indigo-900">3 clases</button>
            <button onclick="cambiarClasesSimuladas(4)" id="btn-sim-4" class="px-2.5 py-1 text-xs font-bold rounded hover:bg-indigo-100 text-indigo-900">4 clases</button>
            <button onclick="cambiarClasesSimuladas(5)" id="btn-sim-5" class="px-2.5 py-1 text-xs font-bold rounded bg-indigo-600 text-white shadow-2xs">5 clases (Regular)</button>
            <button onclick="cambiarClasesSimuladas(6)" id="btn-sim-6" class="px-2.5 py-1 text-xs font-bold rounded hover:bg-indigo-100 text-indigo-900">6 clases (Intensif.)</button>
          </div>
        </div>

        <div class="text-xs text-indigo-900 font-medium">
          Mínimo exigido: <strong>70% de asistencia</strong>
        </div>
      </div>

      <!-- Tabla del Simulador -->
      <div class="overflow-y-auto flex-1 border border-slate-200 rounded-xl">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-100 text-slate-700 sticky top-0 z-10 uppercase tracking-wider font-bold">
            <tr>
              <th class="py-2.5 px-3">Estudiante</th>
              <th class="py-2.5 px-2 text-center">Pres. Hoy</th>
              <th class="py-2.5 px-2 text-center">% Hoy</th>
              <th class="py-2.5 px-2 text-center">Clases Rest.</th>
              <th class="py-2.5 px-2 text-center">Máx % con Asist. Perfecta</th>
              <th class="py-2.5 px-2 text-center">Presencias Mínimas Necesarias</th>
              <th class="py-2.5 px-3 text-center">Diagnóstico a Diciembre</th>
            </tr>
          </thead>
          <tbody id="simulador-tbody" class="divide-y divide-slate-100"></tbody>
        </table>
      </div>

      <div class="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 shrink-0">
        <div class="text-xs text-slate-500">
          💡 Las asistencias perfectas simulan presencia en el 100% de las fechas restantes.
        </div>
        <button onclick="cerrarModalSimulador()" class="text-xs text-slate-600 hover:bg-slate-100 font-bold px-4 py-2 rounded-lg transition">
          Cerrar
        </button>
      </div>
    </div>
  </div>
`;

code = code.replace('<!-- TOAST DE NOTIFICACIÓN RÁPIDA -->', nuevosModalesHtml + '\n  <!-- TOAST DE NOTIFICACIÓN RÁPIDA -->');
console.log('✅ Modales insertados');

// 4. Agregar lógica de JavaScript limpia sin caracteres de escape conflictivos
const logicaExtraJs = `
    // =========================================================================
    // 🔍 BÚSQUEDA Y FILTRADO AVANZADO DE LA TABLA DE ESTUDIANTES
    // =========================================================================
    let textoBusquedaEstudiante = '';
    let filtroEstadoTabla = 'todos';
    let alumnoSeleccionadoFichaId = null;
    let clasesSimuladasConfig = 5;

    function alBuscarEstudiante(e) {
      textoBusquedaEstudiante = e.target.value.toLowerCase().trim();
      const btnClear = document.getElementById('btn-limpiar-busqueda');
      if (textoBusquedaEstudiante) btnClear.classList.remove('hidden');
      else btnClear.classList.add('hidden');
      renderTablaEstudiantes();
    }

    function limpiarBuscador() {
      const input = document.getElementById('buscador-estudiantes');
      if (input) input.value = '';
      textoBusquedaEstudiante = '';
      document.getElementById('btn-limpiar-busqueda').classList.add('hidden');
      renderTablaEstudiantes();
    }

    function cambiarFiltroTabla(filtro) {
      filtroEstadoTabla = filtro;
      const botones = ['todos', 'regulares', 'pueden_salvarse', 'libres', 'ausentes_hoy'];
      botones.forEach(b => {
        const btn = document.getElementById('filtro-btn-' + b);
        if (btn) {
          if (b === filtro) {
            btn.className = 'px-2.5 py-1.5 rounded-lg font-bold bg-slate-900 text-white shadow-2xs transition';
          } else {
            btn.className = 'px-2.5 py-1.5 rounded-lg font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition';
          }
        }
      });
      renderTablaEstudiantes();
    }

    function actualizarContadoresFiltros(alumnos, fechaHoy) {
      let cntTodos = alumnos.length;
      let cntRegulares = 0;
      let cntPueden = 0;
      let cntLibres = 0;
      let cntAusentes = 0;

      alumnos.forEach(est => {
        const stats = calcularStatsEstudiante(est.id);
        if (stats.estadoProyeccion === 'PUEDE_LLEGAR') cntPueden++;
        else if (stats.estadoProyeccion === 'NO_LLEGA_LIBRE') cntLibres++;
        else cntRegulares++;

        const estadoHoy = state.asistencias[fechaHoy + '_' + est.id] || 'P';
        if (estadoHoy === 'A') cntAusentes++;
      });

      const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setT('cnt-filtro-todos', cntTodos);
      setT('cnt-filtro-regulares', cntRegulares);
      setT('cnt-filtro-pueden_salvarse', cntPueden);
      setT('cnt-filtro-libres', cntLibres);
      setT('cnt-filtro-ausentes', cntAusentes);
    }

    // =========================================================================
    // 👤 FICHA PEDAGÓGICA INDIVIDUAL DEL ESTUDIANTE
    // =========================================================================
    function abrirFichaEstudiante(id) {
      const est = state.estudiantes.find(e => e.id === id);
      if (!est) return;
      alumnoSeleccionadoFichaId = id;

      const cur = state.cursos.find(c => c.id === est.curso_id);
      const stats = calcularStatsEstudiante(id);

      document.getElementById('ficha-nombre-alumno').textContent = (est.apellido + ', ' + est.nombre).toUpperCase();
      document.getElementById('ficha-curso-txt').textContent = cur ? cur.nombre : 'Curso';
      document.getElementById('ficha-dni-txt').textContent = est.dni || 'Sin DNI cargado';

      const iniciales = (est.apellido.slice(0, 1) + (est.nombre ? est.nombre.slice(0, 1) : '')).toUpperCase();
      document.getElementById('ficha-avatar').textContent = iniciales;

      document.getElementById('ficha-stat-clases').textContent = stats.totalClases;
      document.getElementById('ficha-stat-presentes').textContent = stats.presentes;
      document.getElementById('ficha-stat-faltas').textContent = stats.ausentes;
      document.getElementById('ficha-stat-porcentaje').textContent = stats.porcentaje + '%';

      // Tarjeta de proyección
      const card = document.getElementById('ficha-tarjeta-proyeccion');
      const badge = document.getElementById('ficha-badge-condicion');
      const desc = document.getElementById('ficha-detalle-proyeccion');
      const ico = document.getElementById('ficha-icono-proyeccion');

      if (stats.estadoProyeccion === 'PUEDE_LLEGAR') {
        card.className = 'p-3.5 rounded-xl border border-amber-300 bg-amber-50 flex items-center justify-between';
        badge.className = 'text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-300 text-amber-950 border border-amber-500';
        badge.textContent = '🟡 PUEDE LLEGAR (Asistencia Perfecta)';
        desc.textContent = 'Necesita asistir a ' + stats.presMinimosNecesarios + ' de las ' + stats.clasesRestantes + ' clases restantes para alcanzar el 70%. Máximo alcanzable: ' + stats.maxPctPosible + '%.';
        ico.innerHTML = '🟡';
      } else if (stats.estadoProyeccion === 'NO_LLEGA_LIBRE') {
        card.className = 'p-3.5 rounded-xl border border-rose-300 bg-rose-50 flex items-center justify-between';
        badge.className = 'text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-900 border border-rose-400';
        badge.textContent = '🔴 QUEDA LIBRE';
        desc.textContent = 'Aún con asistencia perfecta al 100%, lo máximo que puede alcanzar es ' + stats.maxPctPosible + '% (requiere ' + stats.presMinimosNecesarios + ' clases pero solo quedan ' + stats.clasesRestantes + ').';
        ico.innerHTML = '🔴';
      } else {
        card.className = 'p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 flex items-center justify-between';
        badge.className = 'text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-400';
        badge.textContent = '🟢 CONDICIÓN REGULAR';
        desc.textContent = 'Asistencia satisfactoria por encima del 70%. Puede tolerar hasta ' + Math.max(0, stats.faltasPermitidas) + ' faltas más.';
        ico.innerHTML = '🟢';
      }

      // Renderizar historial de días
      const contHist = document.getElementById('ficha-historial-dias');
      contHist.innerHTML = '';
      const fechas = obtenerFechasDictadasCurso(est.curso_id);

      fechas.forEach(f => {
        const estMarca = state.asistencias[f + '_' + est.id] || 'P';
        const p = f.split('-');
        const fFmt = p.length === 3 ? (p[2] + '/' + p[1]) : f;

        const chip = document.createElement('span');
        let colorChip = 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (estMarca === 'A') colorChip = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
        else if (estMarca === 'J') colorChip = 'bg-amber-100 text-amber-800 border-amber-300';
        else if (estMarca === 'T') colorChip = 'bg-blue-100 text-blue-800 border-blue-300';

        chip.className = 'inline-flex items-center space-x-1 px-2 py-0.5 rounded border text-[11px] ' + colorChip;
        chip.innerHTML = '<span>' + fFmt + '</span><span class="font-black">(' + estMarca + ')</span>';
        contHist.appendChild(chip);
      });

      document.getElementById('modal-ficha-estudiante').classList.remove('hidden');
    }

    function cerrarFichaEstudiante() {
      document.getElementById('modal-ficha-estudiante').classList.add('hidden');
      alumnoSeleccionadoFichaId = null;
    }

    function copiarMensajeFamiliarWhatsApp() {
      if (!alumnoSeleccionadoFichaId) return;
      const est = state.estudiantes.find(e => e.id === alumnoSeleccionadoFichaId);
      const cur = state.cursos.find(c => c.id === est.curso_id);
      const col = state.colegios.find(c => c.id === (cur ? cur.colegio_id : null));
      const stats = calcularStatsEstudiante(alumnoSeleccionadoFichaId);

      const lineas = [
        'Estimada familia de *' + (est.apellido + ', ' + est.nombre).toUpperCase() + '*:',
        '',
        'Nos comunicamos desde la *' + (col ? col.nombre : 'Escuela') + '*, en relación al curso *' + (cur ? cur.nombre : '') + '* a cargo del *Prof. Facundo Casciano*.',
        '',
        '📊 *Estado de Asistencia Escolar al día de la fecha:*',
        '• Clases dictadas en el año: ' + stats.totalClases,
        '• Presentes registrados: ' + stats.presentes,
        '• Inasistencias (faltas): *' + stats.ausentes + '*',
        '• Porcentaje de asistencia actual: *' + stats.porcentaje + '%* (Mínimo requerido por normativa: 70%)',
        ''
      ];

      if (stats.estadoProyeccion === 'NO_LLEGA_LIBRE') {
        lineas.push('⚠️ *SITUACIÓN CRÍTICA:* Se notifica que debido a la cantidad de faltas acumuladas, no alcanza el porcentaje mínimo reglamentario para sostener la regularidad regular y deberá presentarse a comisión evaluadora / intensificación pedagógica.');
      } else if (stats.estadoProyeccion === 'PUEDE_LLEGAR') {
        lineas.push('⚠️ *AVISO URGENTE:* Para no perder la regularidad, el estudiante *debe asistir obligatoriamente a las ' + stats.clasesRestantes + ' clases restantes* sin incurrir en nuevas faltas.');
      } else {
        lineas.push('✅ El estudiante mantiene condición regular de asistencia.');
      }

      lineas.push('');
      lineas.push('Solicitamos responder este mensaje o acercarse a Preceptoría para coordinar y notificarse debidamente.');
      lineas.push('');
      lineas.push('_Equipo de Conducción y Docente Titular_');

      const msg = lineas.join(String.fromCharCode(10));

      navigator.clipboard.writeText(msg).then(() => {
        alert("¡Mensaje oficial para la familia copiado con éxito! Ya podés pegarlo en WhatsApp.");
      }).catch(() => {
        prompt("Copiá este mensaje para enviar por WhatsApp:", msg);
      });
    }

    // =========================================================================
    // 🔮 SIMULADOR INTERACTIVO DE RECUPERABILIDAD A FIN DE AÑO
    // =========================================================================
    function abrirModalSimulador() {
      renderSimulador();
      document.getElementById('modal-simulador').classList.remove('hidden');
    }

    function cerrarModalSimulador() {
      document.getElementById('modal-simulador').classList.add('hidden');
    }

    function cambiarClasesSimuladas(n) {
      clasesSimuladasConfig = n;
      [3, 4, 5, 6].forEach(x => {
        const btn = document.getElementById('btn-sim-' + x);
        if (btn) {
          if (x === n) btn.className = 'px-2.5 py-1 text-xs font-bold rounded bg-indigo-600 text-white shadow-2xs';
          else btn.className = 'px-2.5 py-1 text-xs font-bold rounded hover:bg-indigo-100 text-indigo-900';
        }
      });
      renderSimulador();
    }

    function renderSimulador() {
      const tbody = document.getElementById('simulador-tbody');
      tbody.innerHTML = '';
      const alumnos = state.estudiantes.filter(e => e.curso_id === cursoActivoId);
      const fechas = obtenerFechasDictadasCurso(cursoActivoId);
      const rem = clasesSimuladasConfig;
      const totalAnual = fechas.length + rem;
      const presExigidos = Math.ceil(0.70 * totalAnual);

      alumnos.forEach((est, idx) => {
        let pres = 0;
        fechas.forEach(f => {
          const st = state.asistencias[f + '_' + est.id] || 'P';
          if (st === 'P' || st === 'T') pres++;
        });

        const pctHoy = fechas.length > 0 ? Math.round((pres / fechas.length) * 100) : 100;
        const maxPres = pres + rem;
        const maxPct = totalAnual > 0 ? Math.round((maxPres / totalAnual) * 100) : 100;
        const presMin = presExigidos - pres;

        let badge = '';
        if (maxPct < 70) {
          badge = '<span class="inline-flex items-center text-[10px] font-black text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full">🔴 QUEDA LIBRE (Máx ' + maxPct + '%)</span>';
        } else if (pctHoy < 70) {
          badge = '<span class="inline-flex items-center text-[10px] font-black text-amber-950 bg-amber-300 border border-amber-500 px-2 py-0.5 rounded-full">🟡 PUEDE SALVARSE (' + maxPct + '%)</span>';
        } else {
          badge = '<span class="inline-flex items-center text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">🟢 REGULAR</span>';
        }

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 ' + (maxPct < 70 ? 'bg-rose-50/20' : (pctHoy < 70 ? 'bg-amber-50/20' : ''));
        tr.innerHTML = '<td class="py-2.5 px-3 font-bold text-slate-800">' + (idx + 1) + '. ' + (est.apellido + ', ' + est.nombre).toUpperCase() + '</td>'
          + '<td class="py-2.5 px-2 text-center font-semibold text-slate-600">' + pres + ' / ' + fechas.length + '</td>'
          + '<td class="py-2.5 px-2 text-center font-bold ' + (pctHoy < 70 ? 'text-rose-600' : 'text-slate-800') + '">' + pctHoy + '%</td>'
          + '<td class="py-2.5 px-2 text-center font-bold text-indigo-700">+' + rem + '</td>'
          + '<td class="py-2.5 px-2 text-center font-black ' + (maxPct < 70 ? 'text-rose-700' : 'text-emerald-700') + '">' + maxPct + '%</td>'
          + '<td class="py-2.5 px-2 text-center font-semibold text-slate-700">' + (presMin <= rem ? ('Asistir a <strong>' + Math.max(0, presMin) + '</strong> de ' + rem) : ('<span class="text-rose-600 font-bold">Imposible (' + presMin + ')</span>')) + '</td>'
          + '<td class="py-2.5 px-3 text-center">' + badge + '</td>';

        tbody.appendChild(tr);
      });
    }
`;

const targetAntesRender = `function renderTablaEstudiantes() {`;
code = code.replace(targetAntesRender, logicaExtraJs + '\n    ' + targetAntesRender);
console.log('✅ Lógica de búsqueda, simulador y ficha agregada');

// 5. Modificar renderTablaEstudiantes para soportar búsqueda, filtros y click en nombre para abrir ficha
const targetEnRenderTabla = `      alumnos.forEach((est, index) => {
        const stats = calcularStatsEstudiante(est.id);`;

const replacementEnRenderTabla = `      actualizarContadoresFiltros(alumnos, fecha);

      // Filtrado por buscador y por pestaña activa
      let alumnosFiltrados = alumnos.filter(est => {
        if (textoBusquedaEstudiante) {
          const s = (est.apellido + ' ' + est.nombre + ' ' + (est.dni || '')).toLowerCase();
          if (!s.includes(textoBusquedaEstudiante)) return false;
        }

        const stats = calcularStatsEstudiante(est.id);
        const estadoHoy = state.asistencias[fecha + '_' + est.id] || 'P';

        if (filtroEstadoTabla === 'regulares') return stats.porcentaje >= 70;
        if (filtroEstadoTabla === 'pueden_salvarse') return stats.estadoProyeccion === 'PUEDE_LLEGAR';
        if (filtroEstadoTabla === 'libres') return stats.estadoProyeccion === 'NO_LLEGA_LIBRE';
        if (filtroEstadoTabla === 'ausentes_hoy') return estadoHoy === 'A';
        return true;
      });

      if (alumnosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400 font-medium text-xs"><i class="fa-solid fa-filter text-2xl mb-1.5 block text-slate-300"></i>No hay estudiantes que coincidan con la búsqueda o filtro aplicado.<br><button onclick="limpiarBuscador(); cambiarFiltroTabla(&quot;todos&quot;)" class="text-amber-600 underline font-bold mt-2 inline-block">Restablecer filtros</button></td></tr>';
        return;
      }

      alumnosFiltrados.forEach((est, index) => {
        const stats = calcularStatsEstudiante(est.id);`;

if (code.includes(targetEnRenderTabla)) {
  code = code.replace(targetEnRenderTabla, replacementEnRenderTabla);
  console.log('✅ Filtrado dinámico inyectado en renderTablaEstudiantes');
}

// 6. Hacer clickeable el nombre del estudiante para abrir su ficha
const targetTdNombre = `+ '<td class="py-3 px-4 font-semibold text-slate-900">'
          +   '<div>' + est.apellido.toUpperCase() + ', ' + est.nombre + '</div>'`;

const replacementTdNombre = `+ '<td class="py-3 px-4 font-semibold text-slate-900 cursor-pointer group" onclick="abrirFichaEstudiante(' + est.id + ')" title="Hacé clic para ver la Ficha Individual y mensaje para la familia">'
          +   '<div class="group-hover:text-amber-600 transition flex items-center space-x-1.5">'
          +     '<span>' + est.apellido.toUpperCase() + ', ' + est.nombre + '</span>'
          +     '<i class="fa-solid fa-address-card text-slate-300 group-hover:text-amber-500 text-xs"></i>'
          +   '</div>'`;

if (code.includes(targetTdNombre)) {
  code = code.replace(targetTdNombre, replacementTdNombre);
  console.log('✅ Ficha clickeable agregada a la celda del estudiante');
}

fs.writeFileSync('update_dashboard.js', code, 'utf8');
console.log('🌟 update_dashboard.js actualizado con éxito!');
