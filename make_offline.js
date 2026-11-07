// make_offline.js
const fs = require('fs');
const path = require('path');

const rootDir = 'C:\\Users\\NuevoAdmin\\.gemini\\antigravity\\scratch\\sistema-escolar';
const data = require(path.join(rootDir, 'data_export.json'));

const code = `// offline-db.js
// Base de datos offline integrada para GitHub Pages y modo sin servidor
const INITIAL_OFFLINE_DATA = ${JSON.stringify(data)};

function getOfflineDB() {
  try {
    const saved = localStorage.getItem('tuprofeweb_db_v2');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  try {
    localStorage.setItem('tuprofeweb_db_v2', JSON.stringify(INITIAL_OFFLINE_DATA));
  } catch(e) {}
  return JSON.parse(JSON.stringify(INITIAL_OFFLINE_DATA));
}

function saveOfflineDB(db) {
  try {
    localStorage.setItem('tuprofeweb_db_v2', JSON.stringify(db));
  } catch(e) {}
}

async function handleOfflineApi(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  let body = {};
  try {
    if (options.body) {
      body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    }
  } catch(e) {}

  const db = getOfflineDB();
  let path = url;
  try {
    const parsed = new URL(url, 'http://localhost');
    path = parsed.pathname;
  } catch(e) {}

  if (path === '/api/auth/login') {
    return {
      token: 'offline-token-facundo',
      usuario: { id: 1, nombre: 'Prof. Facundo Casciano', email: 'facundo@escuela.com' }
    };
  }

  if (path === '/api/colegios') {
    if (method === 'GET') return db.colegios || [];
    if (method === 'POST') {
      const nuevo = { id: Date.now(), nombre: body.nombre, usuario_id: 1 };
      if (!db.colegios) db.colegios = [];
      db.colegios.push(nuevo);
      saveOfflineDB(db);
      return nuevo;
    }
  }

  const matchColCursos = path.match(/^\\/api\\/colegios\\/(\\d+)\\/cursos/);
  if (matchColCursos) {
    const colId = parseInt(matchColCursos[1], 10);
    return (db.cursos || []).filter(c => c.colegio_id == colId);
  }

  const matchCursoEst = path.match(/^\\/api\\/cursos\\/(\\d+)\\/estudiantes/);
  if (matchCursoEst) {
    const cursoId = parseInt(matchCursoEst[1], 10);
    if (method === 'GET') {
      return (db.estudiantes || []).filter(e => e.curso_id == cursoId);
    }
    if (method === 'POST') {
      const list = Array.isArray(body) ? body : (Array.isArray(body.estudiantes) ? body.estudiantes : [body]);
      const creados = [];
      if (!db.estudiantes) db.estudiantes = [];
      list.forEach(item => {
        let apellido = (item.apellido || '').trim();
        let nombre = (item.nombre || '').trim();
        const dni = (item.dni || '').trim();
        if (!apellido && nombre) { apellido = nombre; nombre = '-'; }
        if (apellido && !nombre) { nombre = '-'; }
        if (apellido) {
          const existe = db.estudiantes.find(e => e.curso_id == cursoId && e.apellido.toLowerCase().trim() === apellido.toLowerCase() && e.nombre.toLowerCase().trim() === nombre.toLowerCase());
          if (existe) {
            if (dni && !existe.dni) existe.dni = dni;
            creados.push({ id: existe.id, nombre, apellido, dni: dni || existe.dni, existia: true });
          } else {
            const nuevo = { id: Date.now() + Math.floor(Math.random()*1000), nombre, apellido, dni: dni || null, curso_id: cursoId };
            db.estudiantes.push(nuevo);
            creados.push(nuevo);
          }
        }
      });
      saveOfflineDB(db);
      return { mensaje: creados.length + ' estudiante(s) registrado(s) correctamente.', total: creados.length, creados };
    }
  }

  const matchCursoAsistMatriz = path.match(/^\\/api\\/cursos\\/(\\d+)\\/asistencia-matriz-excel/);
  if (matchCursoAsistMatriz && method === 'POST') {
    const cursoId = parseInt(matchCursoAsistMatriz[1], 10);
    const { registrosMatriz } = body;
    if (!db.asistencia) db.asistencia = [];
    if (Array.isArray(registrosMatriz)) {
      for (const dia of registrosMatriz) {
        if (!dia.fecha || !Array.isArray(dia.registros)) continue;
        db.asistencia = db.asistencia.filter(a => !(a.curso_id == cursoId && a.fecha === dia.fecha));
        for (const reg of dia.registros) {
          db.asistencia.push({
            id: Date.now() + Math.floor(Math.random()*10000),
            estudiante_id: reg.estudianteId,
            curso_id: cursoId,
            fecha: dia.fecha,
            estado: reg.estado || 'presente'
          });
        }
      }
    }
    saveOfflineDB(db);
    return { mensaje: 'Matriz de asistencia guardada correctamente.' };
  }

  const matchCursoAsist = path.match(/^\\/api\\/cursos\\/(\\d+)\\/asistencia/);
  if (matchCursoAsist) {
    const cursoId = parseInt(matchCursoAsist[1], 10);
    let res = (db.asistencia || []).filter(a => a.curso_id == cursoId);
    return res;
  }

  if (path === '/api/asistencia') {
    if (method === 'GET') {
      let cursoId = null, fecha = null;
      try {
        const u = new URL(url, 'http://localhost');
        cursoId = u.searchParams.get('curso_id');
        fecha = u.searchParams.get('fecha');
      } catch(e) {}
      let res = db.asistencia || [];
      if (cursoId) res = res.filter(a => a.curso_id == cursoId);
      if (fecha) res = res.filter(a => a.fecha === fecha);
      return res;
    }
    if (method === 'POST') {
      const { curso_id, fecha, asistencias } = body;
      if (!db.asistencia) db.asistencia = [];
      db.asistencia = db.asistencia.filter(a => !(a.curso_id == curso_id && a.fecha === fecha));
      for (const item of (asistencias || [])) {
        db.asistencia.push({
          id: Date.now() + Math.floor(Math.random()*1000),
          estudiante_id: item.estudiante_id,
          curso_id: curso_id,
          fecha: fecha,
          estado: item.estado
        });
      }
      saveOfflineDB(db);
      return { mensaje: 'Asistencia registrada correctamente.' };
    }
  }

  if (path === '/api/licencias') {
    if (method === 'GET') return db.licencias || [];
    if (method === 'POST') {
      const nueva = { id: Date.now(), ...body, usuario_id: 1 };
      if (!db.licencias) db.licencias = [];
      db.licencias.push(nueva);
      saveOfflineDB(db);
      return nueva;
    }
  }

  if (path === '/api/horario') {
    if (method === 'GET') return db.horario || [];
    if (method === 'POST' || method === 'PUT') {
      db.horario = body.horario || [];
      saveOfflineDB(db);
      return { mensaje: 'Horario guardado' };
    }
  }

  return [];
}
`;

fs.writeFileSync(path.join(rootDir, 'public', 'js', 'offline-db.js'), code, 'utf8');
console.log('Saved public/js/offline-db.js successfully! Length:', code.length);
