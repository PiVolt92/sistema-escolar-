// routes/cursos.js
// Rutas CRUD para la gestión de cursos y sus submódulos

const express = require('express');
const router = express.Router();
const db = require('../database');
const { verificarToken } = require('../middleware/auth');

// Proteger todas las rutas con autenticación
router.use(verificarToken);

/**
 * GET /api/cursos
 * Obtiene todos los cursos del usuario (opcionalmente filtrado por colegio_id)
 */
router.get('/', (req, res) => {
  try {
    const { colegio_id } = req.query;
    let cursos;
    if (colegio_id) {
      cursos = db.prepare(`
        SELECT c.* FROM cursos c
        INNER JOIN colegios col ON c.colegio_id = col.id
        WHERE c.colegio_id = ? AND col.usuario_id = ?
        ORDER BY c.nombre
      `).all(colegio_id, req.usuario.id);
    } else {
      cursos = db.prepare(`
        SELECT c.* FROM cursos c
        INNER JOIN colegios col ON c.colegio_id = col.id
        WHERE col.usuario_id = ?
        ORDER BY c.nombre
      `).all(req.usuario.id);
    }

    res.json(cursos);
  } catch (err) {
    console.error('Error al obtener cursos:', err);
    res.status(500).json({ error: 'Error al obtener cursos.' });
  }
});

/**
 * POST /api/cursos
 * Crea un nuevo curso.
 */
router.post('/', (req, res) => {
  try {
    const { nombre, colegio_id, anio, division, turno } = req.body;
    if (!nombre && !anio) {
      return res.status(400).json({ error: 'Nombre o año requeridos.' });
    }
    const nombreCurso = nombre || `${anio || ''}° ${division || ''} ${turno || ''}`.trim();
    const resultado = db.prepare(
      'INSERT INTO cursos (nombre, colegio_id, anio, division, turno) VALUES (?, ?, ?, ?, ?)'
    ).run(nombreCurso, colegio_id, anio || null, division || null, turno || 'Mañana');

    const curso = db.prepare('SELECT * FROM cursos WHERE id = ?').get(resultado.lastInsertRowid);
    res.status(201).json(curso);
  } catch (err) {
    console.error('Error al crear curso:', err);
    res.status(500).json({ error: 'Error al crear curso.' });
  }
});

/**
 * GET /api/cursos/:id/estudiantes
 * Lista estudiantes de un curso
 */
router.get('/:id/estudiantes', (req, res) => {
  try {
    const estudiantes = db.prepare(
      'SELECT * FROM estudiantes WHERE curso_id = ? ORDER BY apellido, nombre'
    ).all(req.params.id);
    res.json(estudiantes);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estudiantes.' });
  }
});

/**
 * POST /api/cursos/:id/estudiantes
 * Agrega uno o varios estudiantes al curso (soporta inserción masiva tipo Excel)
 */
router.post('/:id/estudiantes', (req, res) => {
  try {
    const list = Array.isArray(req.body)
      ? req.body
      : (Array.isArray(req.body.estudiantes) ? req.body.estudiantes : [req.body]);

    const creados = [];
    const insert = db.prepare(
      'INSERT INTO estudiantes (nombre, apellido, dni, curso_id) VALUES (?, ?, ?, ?)'
    );
    const checkExistente = db.prepare(
      'SELECT id, dni FROM estudiantes WHERE curso_id = ? AND lower(trim(apellido)) = lower(trim(?)) AND lower(trim(nombre)) = lower(trim(?))'
    );
    const updateDni = db.prepare(
      'UPDATE estudiantes SET dni = ? WHERE id = ?'
    );

    const guardarLote = db.transaction(() => {
      for (const item of list) {
        let apellido = (item.apellido || '').trim();
        let nombre = (item.nombre || '').trim();
        const dni = (item.dni || '').trim();

        if (!apellido && nombre) {
          const parts = nombre.split(/\s+/);
          apellido = parts[0] || 'ALUMNO';
          nombre = parts.slice(1).join(' ') || '-';
        } else if (apellido && !nombre) {
          if (apellido.includes(',')) {
            const parts = apellido.split(',');
            nombre = parts.slice(1).join(' ').trim() || '-';
            apellido = parts[0].trim();
          } else if (apellido.includes(' ')) {
            const parts = apellido.split(/\s+/);
            nombre = parts.slice(1).join(' ').trim() || '-';
            apellido = parts[0].trim();
          } else {
            nombre = '-';
          }
        }

        if (apellido) {
          const existente = checkExistente.get(req.params.id, apellido, nombre);
          if (existente) {
            if (dni && (!existente.dni || existente.dni.trim() === '')) {
              updateDni.run(dni, existente.id);
            }
            creados.push({ id: existente.id, nombre, apellido, dni: dni || existente.dni, existia: true });
          } else {
            const resultado = insert.run(nombre, apellido, dni || null, req.params.id);
            creados.push({ id: resultado.lastInsertRowid, nombre, apellido, dni, existia: false });
          }
        }
      }
    });

    guardarLote();

    if (creados.length === 0) {
      return res.status(400).json({ error: 'Debe ingresar al menos un estudiante con nombre y apellido válidos.' });
    }

    res.status(201).json({
      mensaje: `${creados.length} estudiante(s) registrado(s) correctamente.`,
      total: creados.length,
      creados
    });
  } catch (err) {
    console.error('Error al registrar estudiante(s):', err);
    res.status(500).json({ error: 'Error al registrar estudiante(s).' });
  }
});

/**
 * GET /api/cursos/:id/asistencia
 */
router.get('/:id/asistencia', (req, res) => {
  try {
    const { fecha, desde, hasta } = req.query;
    let registros;
    if (fecha) {
      registros = db.prepare(`
        SELECT a.*, e.nombre, e.apellido FROM asistencia a
        JOIN estudiantes e ON a.estudiante_id = e.id
        WHERE a.curso_id = ? AND a.fecha = ?
      `).all(req.params.id, fecha);
    } else if (desde && hasta) {
      registros = db.prepare(`
        SELECT a.*, e.nombre, e.apellido FROM asistencia a
        JOIN estudiantes e ON a.estudiante_id = e.id
        WHERE a.curso_id = ? AND a.fecha BETWEEN ? AND ?
        ORDER BY a.fecha DESC
      `).all(req.params.id, desde, hasta);
    } else {
      registros = db.prepare(`
        SELECT a.*, e.nombre, e.apellido FROM asistencia a
        JOIN estudiantes e ON a.estudiante_id = e.id
        WHERE a.curso_id = ?
        ORDER BY a.fecha DESC
      `).all(req.params.id);
    }
    res.json(registros);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener asistencia.' });
  }
});

/**
 * POST /api/cursos/:id/asistencia
 */
router.post('/:id/asistencia', (req, res) => {
  try {
    const { fecha, registros } = req.body;
    if (!fecha || !Array.isArray(registros)) {
      return res.status(400).json({ error: 'Fecha y registros son requeridos.' });
    }

    const guardar = db.transaction(() => {
      // Eliminar registros previos para esa fecha
      db.prepare('DELETE FROM asistencia WHERE curso_id = ? AND fecha = ?').run(req.params.id, fecha);
      const insert = db.prepare(
        'INSERT INTO asistencia (curso_id, estudiante_id, fecha, estado) VALUES (?, ?, ?, ?)'
      );
      for (const reg of registros) {
        insert.run(req.params.id, reg.estudianteId, fecha, reg.estado || 'presente');
      }
    });

    guardar();
    res.json({ mensaje: 'Asistencia guardada correctamente.' });
  } catch (err) {
    console.error('Error al guardar asistencia:', err);
    res.status(500).json({ error: 'Error al guardar la asistencia.' });
  }
});

/**
 * PUT /api/cursos/:id/asistencia/individual
 * Permite modificar o agregar la asistencia de un alumno puntual en cualquier día
 */
router.put('/:id/asistencia/individual', (req, res) => {
  try {
    const { estudianteId, fecha, estado } = req.body;
    if (!estudianteId || !fecha || !estado) {
      return res.status(400).json({ error: 'estudianteId, fecha y estado son requeridos.' });
    }

    const estadosValidos = ['presente', 'ausente', 'tarde', 'justificado'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado de asistencia inválido.' });
    }

    const upsert = db.transaction(() => {
      db.prepare('DELETE FROM asistencia WHERE curso_id = ? AND estudiante_id = ? AND fecha = ?')
        .run(req.params.id, estudianteId, fecha);
      db.prepare('INSERT INTO asistencia (curso_id, estudiante_id, fecha, estado) VALUES (?, ?, ?, ?)')
        .run(req.params.id, estudianteId, fecha, estado);
    });

    upsert();

    res.json({
      mensaje: `Asistencia actualizada a "${estado}" para la fecha ${fecha}.`,
      estudianteId,
      fecha,
      estado
    });
  } catch (err) {
    console.error('Error al actualizar asistencia individual:', err);
    res.status(500).json({ error: 'Error al actualizar asistencia individual.' });
  }
});

/**
 * DELETE /api/cursos/:id/asistencia/fecha
 * Permite eliminar todas las asistencias registradas en una fecha específica
 */
router.delete('/:id/asistencia/fecha', (req, res) => {
  try {
    const fecha = req.body.fecha || req.query.fecha;
    if (!fecha) {
      return res.status(400).json({ error: 'Fecha requerida.' });
    }
    const info = db.prepare('DELETE FROM asistencia WHERE curso_id = ? AND fecha = ?').run(req.params.id, fecha);
    res.json({ mensaje: `Asistencias del día ${fecha} eliminadas.`, eliminadas: info.changes });
  } catch (err) {
    console.error('Error al eliminar asistencia de la fecha:', err);
    res.status(500).json({ error: 'Error al eliminar asistencia de la fecha.' });
  }
});

/**
 * DELETE /api/cursos/:id/asistencia/reset
 * Formatea / reinicia a cero todas las asistencias del curso sin borrar a los estudiantes
 */
router.delete('/:id/asistencia/reset', (req, res) => {
  try {
    const cursoId = req.params.id;
    const resetTx = db.transaction(() => {
      db.prepare('DELETE FROM asistencia WHERE curso_id = ?').run(cursoId);
      db.prepare('UPDATE cursos SET clases_dictadas = NULL WHERE id = ?').run(cursoId);
    });
    resetTx();
    res.json({ mensaje: 'Todas las faltas y asistencias fueron formateadas a cero correctamente.' });
  } catch (err) {
    console.error('Error al resetear asistencias:', err);
    res.status(500).json({ error: 'Error al resetear las asistencias a cero.' });
  }
});

/**
 * PUT /api/cursos/:id/asistencia/limpiar-faltas
 * Convierte todas las faltas (ausentes y tardes) a presentes para dejar el 100% de asistencia
 */
router.put('/:id/asistencia/limpiar-faltas', (req, res) => {
  try {
    const cursoId = req.params.id;
    const info = db.prepare("UPDATE asistencia SET estado = 'presente' WHERE curso_id = ? AND estado IN ('ausente', 'tarde')").run(cursoId);
    res.json({ mensaje: `Se convirtieron ${info.changes} faltas a presente con éxito.` });
  } catch (err) {
    console.error('Error al limpiar faltas:', err);
    res.status(500).json({ error: 'Error al limpiar las faltas.' });
  }
});

/**
 * GET /api/cursos/:id/calificaciones/diarias
 */
router.get('/:id/calificaciones/diarias', (req, res) => {
  try {
    const notas = db.prepare(`
      SELECT c.*, e.nombre, e.apellido FROM calificaciones c
      JOIN estudiantes e ON c.estudiante_id = e.id
      WHERE c.curso_id = ? AND c.tipo = 'diaria'
      ORDER BY c.fecha DESC
    `).all(req.params.id);
    res.json(notas);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener calificaciones diarias.' });
  }
});

/**
 * POST /api/cursos/:id/calificaciones/diarias
 */
router.post('/:id/calificaciones/diarias', (req, res) => {
  try {
    const { fecha, calificaciones } = req.body;
    if (!fecha || !Array.isArray(calificaciones)) {
      return res.status(400).json({ error: 'Fecha y calificaciones son requeridos.' });
    }

    const guardar = db.transaction(() => {
      const insert = db.prepare(`
        INSERT INTO calificaciones (curso_id, estudiante_id, tipo, nota, fecha)
        VALUES (?, ?, 'diaria', ?, ?)
      `);
      for (const cal of calificaciones) {
        insert.run(req.params.id, cal.estudianteId, cal.nota, fecha);
      }
    });

    guardar();
    res.json({ mensaje: 'Calificaciones diarias guardadas.' });
  } catch (err) {
    console.error('Error al guardar calificaciones diarias:', err);
    res.status(500).json({ error: 'Error al guardar notas.' });
  }
});

/**
 * GET /api/cursos/:id/calificaciones/anuales
 */
router.get('/:id/calificaciones/anuales', (req, res) => {
  try {
    const filas = db.prepare(`
      SELECT estudiante_id as estudianteId, trimestre, nota
      FROM calificaciones
      WHERE curso_id = ? AND tipo = 'anual'
    `).all(req.params.id);

    // Agrupar por estudianteId: { trim1, trim2, trim3 }
    const mapa = {};
    for (const f of filas) {
      if (!mapa[f.estudianteId]) {
        mapa[f.estudianteId] = { estudianteId: f.estudianteId };
      }
      mapa[f.estudianteId][`trim${f.trimestre}`] = f.nota;
    }

    res.json(Object.values(mapa));
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener calificaciones anuales.' });
  }
});

/**
 * POST /api/cursos/:id/calificaciones/anuales
 */
router.post('/:id/calificaciones/anuales', (req, res) => {
  try {
    const { calificaciones } = req.body;
    if (!Array.isArray(calificaciones)) {
      return res.status(400).json({ error: 'Calificaciones requeridas.' });
    }

    const guardar = db.transaction(() => {
      db.prepare("DELETE FROM calificaciones WHERE curso_id = ? AND tipo = 'anual'").run(req.params.id);
      const insert = db.prepare(`
        INSERT INTO calificaciones (curso_id, estudiante_id, tipo, nota, fecha, trimestre)
        VALUES (?, ?, 'anual', ?, date('now'), ?)
      `);
      for (const c of calificaciones) {
        if (c.trim1 !== undefined && c.trim1 !== null && c.trim1 !== '') {
          insert.run(req.params.id, c.estudianteId, parseFloat(c.trim1), 1);
        }
        if (c.trim2 !== undefined && c.trim2 !== null && c.trim2 !== '') {
          insert.run(req.params.id, c.estudianteId, parseFloat(c.trim2), 2);
        }
        if (c.trim3 !== undefined && c.trim3 !== null && c.trim3 !== '') {
          insert.run(req.params.id, c.estudianteId, parseFloat(c.trim3), 3);
        }
      }
    });

    guardar();
    res.json({ mensaje: 'Calificaciones anuales guardadas.' });
  } catch (err) {
    console.error('Error al guardar anuales:', err);
    res.status(500).json({ error: 'Error al guardar calificaciones anuales.' });
  }
});

/**
 * GET /api/cursos/:id/visibilidad
 */
router.get('/:id/visibilidad', (req, res) => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS visibilidad_config (
        curso_id INTEGER PRIMARY KEY,
        config TEXT
      )
    `);
    const row = db.prepare('SELECT config FROM visibilidad_config WHERE curso_id = ?').get(req.params.id);
    if (row && row.config) {
      return res.json(JSON.parse(row.config));
    }
    res.json({
      asistencia: true,
      calificaciones_diarias: true,
      calificaciones_anuales: true,
      notificaciones: true,
      horario: true,
      libro_tema: false
    });
  } catch (err) {
    res.json({});
  }
});

/**
 * PUT /api/cursos/:id/visibilidad
 */
router.put('/:id/visibilidad', (req, res) => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS visibilidad_config (
        curso_id INTEGER PRIMARY KEY,
        config TEXT
      )
    `);
    db.prepare(`
      INSERT INTO visibilidad_config (curso_id, config) VALUES (?, ?)
      ON CONFLICT(curso_id) DO UPDATE SET config = excluded.config
    `).run(req.params.id, JSON.stringify(req.body));
    res.json({ mensaje: 'Visibilidad actualizada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar visibilidad.' });
  }
});

/**
 * GET /api/cursos/:id/notificaciones
 */
router.get('/:id/notificaciones', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM notificaciones WHERE curso_id = ? ORDER BY fecha DESC
    `).all(req.params.id);
    // Asegurar estructura
    const resultado = rows.map(r => ({
      id: r.id,
      titulo: r.titulo || 'Aviso General',
      mensaje: r.mensaje,
      fecha: r.fecha
    }));
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener notificaciones.' });
  }
});

/**
 * POST /api/cursos/:id/notificaciones
 */
router.post('/:id/notificaciones', (req, res) => {
  try {
    const { titulo, mensaje } = req.body;
    db.prepare(`
      INSERT INTO notificaciones (curso_id, mensaje, fecha)
      VALUES (?, ?, datetime('now'))
    `).run(req.params.id, `${titulo ? titulo + ': ' : ''}${mensaje}`);
    res.status(201).json({ mensaje: 'Notificación enviada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear notificación.' });
  }
});

/**
 * GET /api/cursos/:id/libro-tema
 */
router.get('/:id/libro-tema', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM libro_temas WHERE curso_id = ? ORDER BY fecha DESC
    `).all(req.params.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener libro de temas.' });
  }
});

/**
 * POST /api/cursos/:id/libro-tema
 */
router.post('/:id/libro-tema', (req, res) => {
  try {
    const { fecha, tema, observaciones } = req.body;
    if (!tema) {
      return res.status(400).json({ error: 'Tema obligatorio.' });
    }
    const resultado = db.prepare(`
      INSERT INTO libro_temas (curso_id, fecha, tema, observaciones)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, fecha || new Date().toISOString().split('T')[0], tema, observaciones || '');
    res.status(201).json({ id: resultado.lastInsertRowid, fecha, tema, observaciones });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar libro de tema.' });
  }
});

/**
 * PUT /api/cursos/:id/clases-dictadas
 * Actualiza el total de clases dictadas configurado para el curso (o null para automático)
 */
router.put('/:id/clases-dictadas', (req, res) => {
  try {
    const { clases_dictadas } = req.body;
    const valor = (clases_dictadas === '' || clases_dictadas === null || isNaN(clases_dictadas))
      ? null
      : Math.max(1, parseInt(clases_dictadas));

    db.prepare('UPDATE cursos SET clases_dictadas = ? WHERE id = ?').run(valor, req.params.id);

    res.json({
      mensaje: valor ? `Total de clases dictadas fijado en ${valor}.` : 'Modo automático activado (según listas tomadas).',
      clases_dictadas: valor
    });
  } catch (err) {
    console.error('Error al actualizar clases dictadas:', err);
    res.status(500).json({ error: 'Error al actualizar clases dictadas.' });
  }
});

/**
 * GET /api/cursos/:id/asistencia/resumen
 * Retorna el resumen estadístico de asistencia: Total clases, presentes, faltas y porcentaje por estudiante
 */
router.get('/:id/asistencia/resumen', (req, res) => {
  try {
    const cursoId = req.params.id;
    const curso = db.prepare('SELECT id, nombre, clases_dictadas FROM cursos WHERE id = ?').get(cursoId);
    const estudiantes = db.prepare('SELECT id, nombre, apellido, dni FROM estudiantes WHERE curso_id = ? ORDER BY apellido, nombre').all(cursoId);
    
    // Total de fechas de clases tomadas para este curso
    const fechas = db.prepare('SELECT COUNT(DISTINCT fecha) as total FROM asistencia WHERE curso_id = ?').get(cursoId);
    const totalListasTomadas = fechas ? fechas.total : 0;

    // Si el profesor fijó un total de clases dictadas (ej: 20 o 30 clases), se usa ese total
    const esManual = curso && curso.clases_dictadas !== null && curso.clases_dictadas > 0;
    const totalClases = esManual ? Math.max(curso.clases_dictadas, totalListasTomadas) : totalListasTomadas;

    let sumaPresentes = 0;
    let sumaAusentes = 0;
    let sumaTardes = 0;

    const resumenEstudiantes = estudiantes.map(est => {
      const pRow = db.prepare("SELECT COUNT(*) as c FROM asistencia WHERE curso_id = ? AND estudiante_id = ? AND estado = 'presente'").get(cursoId, est.id);
      const aRow = db.prepare("SELECT COUNT(*) as c FROM asistencia WHERE curso_id = ? AND estudiante_id = ? AND estado = 'ausente'").get(cursoId, est.id);
      const tRow = db.prepare("SELECT COUNT(*) as c FROM asistencia WHERE curso_id = ? AND estudiante_id = ? AND estado = 'tarde'").get(cursoId, est.id);

      const ausentes = aRow ? aRow.c : 0;
      const tardes = tRow ? tRow.c : 0;
      let presentes = pRow ? pRow.c : 0;

      // Si las clases dictadas fueron fijadas manualmente por el profesor (ej: 20 clases)
      // En la normativa escolar: Presentes = Total Clases Dictadas - Faltas - (Tardes * 0.5)
      if (esManual) {
        presentes = Math.max(0, Math.round(totalClases - ausentes - (tardes * 0.5)));
      }

      sumaPresentes += presentes;
      sumaAusentes += ausentes;
      sumaTardes += tardes;

      const porcentaje = totalClases > 0 ? (((presentes + (tardes * 0.5)) / totalClases) * 100).toFixed(1) : '100.0';

      return {
        id: est.id,
        nombre: est.nombre,
        apellido: est.apellido,
        dni: est.dni,
        presentes,
        ausentes,
        tardes,
        totalClases,
        porcentaje: Math.min(100, Math.max(0, parseFloat(porcentaje)))
      };
    });

    const porcentajeGlobal = totalClases > 0 && estudiantes.length > 0
      ? (resumenEstudiantes.reduce((acc, e) => acc + e.porcentaje, 0) / estudiantes.length).toFixed(1)
      : '100.0';

    res.json({
      totalClases,
      totalListasTomadas,
      esManual,
      clasesDictadasConfig: curso ? curso.clases_dictadas : null,
      sumaPresentes,
      sumaAusentes,
      sumaTardes,
      porcentajeGlobal: parseFloat(porcentajeGlobal),
      estudiantes: resumenEstudiantes
    });
  } catch (err) {
    console.error('Error al calcular resumen de asistencia:', err);
    res.status(500).json({ error: 'Error al calcular resumen de asistencia.' });
  }
});

/**
 * GET /api/cursos/:id/asistencia/matriz
 * Retorna la matriz de asistencia completa con el detalle día por día para cada alumno
 * Soporta filtros ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 */
router.get('/:id/asistencia/matriz', (req, res) => {
  try {
    const cursoId = req.params.id;
    const { desde, hasta } = req.query;
    const estudiantes = db.prepare('SELECT id, nombre, apellido, dni FROM estudiantes WHERE curso_id = ? ORDER BY apellido, nombre').all(cursoId);
    
    // Obtener todas las fechas de clases ordenadas cronológicamente (con filtro si se pasa)
    let fechasQuery = 'SELECT DISTINCT fecha FROM asistencia WHERE curso_id = ?';
    const params = [cursoId];
    if (desde) {
      fechasQuery += ' AND fecha >= ?';
      params.push(desde);
    }
    if (hasta) {
      fechasQuery += ' AND fecha <= ?';
      params.push(hasta);
    }
    fechasQuery += ' ORDER BY fecha ASC';

    const fechasRows = db.prepare(fechasQuery).all(...params);
    const fechas = fechasRows.map(f => f.fecha);
    const totalClases = fechas.length;
    
    // Obtener todos los registros de asistencia del curso
    const registros = db.prepare('SELECT estudiante_id, fecha, estado FROM asistencia WHERE curso_id = ?').all(cursoId);
    
    // Mapear por [estudiante_id][fecha] = estado
    const asistenciasMap = {};
    for (const r of registros) {
      if (!asistenciasMap[r.estudiante_id]) {
        asistenciasMap[r.estudiante_id] = {};
      }
      asistenciasMap[r.estudiante_id][r.fecha] = r.estado;
    }

    let sumaTotalPorcentajes = 0;

    const filas = estudiantes.map(est => {
      const dias = {};
      let presentes = 0;
      let ausentes = 0;
      let tardes = 0;
      let justificadas = 0;

      for (const f of fechas) {
        const estReg = (asistenciasMap[est.id] && asistenciasMap[est.id][f]) || null;
        dias[f] = estReg;
        if (estReg === 'presente') presentes++;
        else if (estReg === 'ausente') ausentes++;
        else if (estReg === 'tarde') tardes++;
        else if (estReg === 'justificado') justificadas++;
      }

      const pct = totalClases > 0 ? (((presentes + (tardes * 0.5)) / totalClases) * 100).toFixed(2) : '100.00';
      sumaTotalPorcentajes += parseFloat(pct);

      return {
        id: est.id,
        nombre: est.nombre,
        apellido: est.apellido,
        dni: est.dni,
        dias,
        presentes,
        ausentes,
        tardes,
        justificadas,
        totalClases,
        porcentaje: parseFloat(pct)
      };
    });

    const porcentajeGeneral = estudiantes.length > 0
      ? (sumaTotalPorcentajes / estudiantes.length).toFixed(2)
      : '100.00';

    res.json({
      fechas,
      totalClases,
      porcentajeGeneral: parseFloat(porcentajeGeneral),
      estudiantes: filas
    });
  } catch (err) {
    console.error('Error al generar matriz de asistencia día por día:', err);
    res.status(500).json({ error: 'Error al generar matriz de asistencia.' });
  }
});

/**
 * DELETE /api/cursos/:id
 * Elimina un curso y sus datos asociados en cascada
 */
router.delete('/:id', (req, res) => {
  try {
    const eliminarCascada = db.transaction(() => {
      db.prepare('DELETE FROM asistencia WHERE curso_id = ?').run(req.params.id);
      db.prepare('DELETE FROM calificaciones WHERE curso_id = ?').run(req.params.id);
      db.prepare('DELETE FROM estudiantes WHERE curso_id = ?').run(req.params.id);
      db.prepare('DELETE FROM notificaciones WHERE curso_id = ?').run(req.params.id);
      db.prepare('DELETE FROM libro_temas WHERE curso_id = ?').run(req.params.id);
      db.prepare('DELETE FROM horarios WHERE curso_id = ?').run(req.params.id);
      db.prepare('DELETE FROM cursos WHERE id = ?').run(req.params.id);
    });

    eliminarCascada();
    res.json({ mensaje: 'Curso y todos sus datos fueron eliminados correctamente.' });
  } catch (err) {
    console.error('Error al eliminar curso:', err);
    res.status(500).json({ error: 'Error al eliminar curso.' });
  }
});

/**
 * DELETE /api/cursos/:id/historial-completo
 * Elimina el historial de asistencias y calificaciones de un curso
 */
router.delete('/:id/historial-completo', (req, res) => {
  try {
    const cursoId = req.params.id;
    const limpiarHistorial = db.transaction(() => {
      db.prepare('DELETE FROM asistencia WHERE curso_id = ?').run(cursoId);
      db.prepare('DELETE FROM calificaciones WHERE curso_id = ?').run(cursoId);
    });
    limpiarHistorial();
    res.json({ mensaje: 'Historial de asistencias y calificaciones eliminado con éxito.' });
  } catch (err) {
    console.error('Error al eliminar historial:', err);
    res.status(500).json({ error: 'Error al eliminar historial de asistencias y calificaciones.' });
  }
});

module.exports = router;
