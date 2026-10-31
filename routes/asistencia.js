// routes/asistencia.js
// Rutas para la gestión de asistencia de estudiantes

const express = require('express');
const router = express.Router();
const db = require('../database');
const { verificarToken } = require('../middleware/auth');

// Proteger todas las rutas con autenticación
router.use(verificarToken);

/**
 * POST /api/asistencia
 * Registra la asistencia de forma masiva para todos los estudiantes de un curso.
 * Body esperado: { curso_id, fecha, asistencias: [{ estudiante_id, estado }] }
 */
router.post('/', (req, res) => {
  try {
    const { curso_id, fecha, asistencias } = req.body;

    if (!curso_id || !fecha || !asistencias || !Array.isArray(asistencias)) {
      return res.status(400).json({
        error: 'Se requiere curso_id, fecha y un arreglo de asistencias.'
      });
    }

    // Verificar que el curso pertenece al usuario
    const curso = db.prepare(`
      SELECT c.* FROM cursos c
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE c.id = ? AND col.usuario_id = ?
    `).get(curso_id, req.usuario.id);

    if (!curso) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }

    // Usar una transacción para insertar/actualizar todas las asistencias
    const insertarAsistencia = db.prepare(`
      INSERT INTO asistencia (estudiante_id, curso_id, fecha, estado)
      VALUES (?, ?, ?, ?)
    `);

    // Eliminar asistencia previa para esa fecha y curso (para permitir re-registro)
    const eliminarPrevias = db.prepare(
      'DELETE FROM asistencia WHERE curso_id = ? AND fecha = ?'
    );

    const transaccion = db.transaction(() => {
      // Eliminar registros previos de esa fecha
      eliminarPrevias.run(curso_id, fecha);

      // Insertar los nuevos registros
      for (const asist of asistencias) {
        if (!asist.estudiante_id || !asist.estado) continue;

        // Validar que el estado sea válido
        const estadosValidos = ['presente', 'ausente', 'tarde', 'justificado'];
        if (!estadosValidos.includes(asist.estado)) continue;

        insertarAsistencia.run(asist.estudiante_id, curso_id, fecha, asist.estado);
      }
    });

    transaccion();

    // Obtener los registros insertados
    const registros = db.prepare(`
      SELECT a.*, e.nombre, e.apellido FROM asistencia a
      INNER JOIN estudiantes e ON a.estudiante_id = e.id
      WHERE a.curso_id = ? AND a.fecha = ?
      ORDER BY e.apellido, e.nombre
    `).all(curso_id, fecha);

    res.status(201).json({
      mensaje: 'Asistencia registrada correctamente.',
      asistencia: registros
    });
  } catch (err) {
    console.error('Error al registrar asistencia:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * GET /api/asistencia
 * Obtiene la asistencia de un curso en una fecha específica.
 * Query params: curso_id (requerido), fecha (requerido)
 */
router.get('/', (req, res) => {
  try {
    const { curso_id, fecha } = req.query;

    if (!curso_id || !fecha) {
      return res.status(400).json({
        error: 'Se requiere curso_id y fecha como parámetros.'
      });
    }

    // Verificar que el curso pertenece al usuario
    const curso = db.prepare(`
      SELECT c.* FROM cursos c
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE c.id = ? AND col.usuario_id = ?
    `).get(curso_id, req.usuario.id);

    if (!curso) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }

    const asistencia = db.prepare(`
      SELECT a.*, e.nombre, e.apellido, e.dni FROM asistencia a
      INNER JOIN estudiantes e ON a.estudiante_id = e.id
      WHERE a.curso_id = ? AND a.fecha = ?
      ORDER BY e.apellido, e.nombre
    `).all(curso_id, fecha);

    res.json({ asistencia });
  } catch (err) {
    console.error('Error al obtener asistencia:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * GET /api/asistencia/historial
 * Obtiene el historial de asistencia de un curso.
 * Query params: curso_id (requerido), desde (opcional), hasta (opcional)
 */
router.get('/historial', (req, res) => {
  try {
    const { curso_id, desde, hasta } = req.query;

    if (!curso_id) {
      return res.status(400).json({
        error: 'Se requiere curso_id como parámetro.'
      });
    }

    // Verificar que el curso pertenece al usuario
    const curso = db.prepare(`
      SELECT c.* FROM cursos c
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE c.id = ? AND col.usuario_id = ?
    `).get(curso_id, req.usuario.id);

    if (!curso) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }

    let query = `
      SELECT a.*, e.nombre, e.apellido, e.dni FROM asistencia a
      INNER JOIN estudiantes e ON a.estudiante_id = e.id
      WHERE a.curso_id = ?
    `;
    const params = [curso_id];

    // Filtrar por rango de fechas si se proporcionan
    if (desde) {
      query += ' AND a.fecha >= ?';
      params.push(desde);
    }
    if (hasta) {
      query += ' AND a.fecha <= ?';
      params.push(hasta);
    }

    query += ' ORDER BY a.fecha DESC, e.apellido, e.nombre';

    const historial = db.prepare(query).all(...params);

    // Agrupar por fecha para facilitar la visualización
    const historialAgrupado = {};
    for (const registro of historial) {
      if (!historialAgrupado[registro.fecha]) {
        historialAgrupado[registro.fecha] = [];
      }
      historialAgrupado[registro.fecha].push(registro);
    }

    res.json({
      historial,
      historialAgrupado
    });
  } catch (err) {
    console.error('Error al obtener historial de asistencia:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
