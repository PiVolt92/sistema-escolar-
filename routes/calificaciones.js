// routes/calificaciones.js
// Rutas CRUD para la gestión de calificaciones

const express = require('express');
const router = express.Router();
const db = require('../database');
const { verificarToken } = require('../middleware/auth');

// Proteger todas las rutas con autenticación
router.use(verificarToken);

/**
 * GET /api/calificaciones
 * Obtiene calificaciones. Se puede filtrar por curso, tipo y trimestre.
 * Query params: curso_id (opcional), tipo (opcional: diaria/anual), trimestre (opcional)
 */
router.get('/', (req, res) => {
  try {
    const { curso_id, tipo, trimestre, estudiante_id } = req.query;

    let query = `
      SELECT cal.*, e.nombre, e.apellido FROM calificaciones cal
      INNER JOIN estudiantes e ON cal.estudiante_id = e.id
      INNER JOIN cursos c ON cal.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE col.usuario_id = ?
    `;
    const params = [req.usuario.id];

    // Filtrar por curso
    if (curso_id) {
      query += ' AND cal.curso_id = ?';
      params.push(curso_id);
    }

    // Filtrar por tipo (diaria/anual)
    if (tipo) {
      query += ' AND cal.tipo = ?';
      params.push(tipo);
    }

    // Filtrar por trimestre
    if (trimestre) {
      query += ' AND cal.trimestre = ?';
      params.push(trimestre);
    }

    // Filtrar por estudiante
    if (estudiante_id) {
      query += ' AND cal.estudiante_id = ?';
      params.push(estudiante_id);
    }

    query += ' ORDER BY cal.fecha DESC, e.apellido, e.nombre';

    const calificaciones = db.prepare(query).all(...params);

    res.json({ calificaciones });
  } catch (err) {
    console.error('Error al obtener calificaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * GET /api/calificaciones/:id
 * Obtiene una calificación específica por su ID.
 */
router.get('/:id', (req, res) => {
  try {
    const calificacion = db.prepare(`
      SELECT cal.*, e.nombre, e.apellido FROM calificaciones cal
      INNER JOIN estudiantes e ON cal.estudiante_id = e.id
      INNER JOIN cursos c ON cal.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE cal.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!calificacion) {
      return res.status(404).json({ error: 'Calificación no encontrada.' });
    }

    res.json({ calificacion });
  } catch (err) {
    console.error('Error al obtener calificación:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/calificaciones
 * Crea una nueva calificación.
 */
router.post('/', (req, res) => {
  try {
    const { estudiante_id, curso_id, tipo, nota, descripcion, fecha, trimestre } = req.body;

    if (!estudiante_id || !curso_id || nota === undefined || !fecha) {
      return res.status(400).json({
        error: 'Se requiere estudiante_id, curso_id, nota y fecha.'
      });
    }

    // Validar tipo de calificación
    const tiposValidos = ['diaria', 'anual'];
    if (tipo && !tiposValidos.includes(tipo)) {
      return res.status(400).json({
        error: 'El tipo debe ser "diaria" o "anual".'
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

    const resultado = db.prepare(`
      INSERT INTO calificaciones (estudiante_id, curso_id, tipo, nota, descripcion, fecha, trimestre)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      estudiante_id,
      curso_id,
      tipo || 'diaria',
      nota,
      descripcion || null,
      fecha,
      trimestre || 1
    );

    const calificacion = db.prepare(`
      SELECT cal.*, e.nombre, e.apellido FROM calificaciones cal
      INNER JOIN estudiantes e ON cal.estudiante_id = e.id
      WHERE cal.id = ?
    `).get(resultado.lastInsertRowid);

    res.status(201).json({
      mensaje: 'Calificación registrada correctamente.',
      calificacion
    });
  } catch (err) {
    console.error('Error al crear calificación:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/calificaciones/:id
 * Actualiza una calificación existente.
 */
router.put('/:id', (req, res) => {
  try {
    const { nota, descripcion, tipo, trimestre, fecha } = req.body;

    // Verificar que la calificación pertenece al usuario
    const calExistente = db.prepare(`
      SELECT cal.* FROM calificaciones cal
      INNER JOIN cursos c ON cal.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE cal.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!calExistente) {
      return res.status(404).json({ error: 'Calificación no encontrada.' });
    }

    db.prepare(`
      UPDATE calificaciones
      SET nota = ?, descripcion = ?, tipo = ?, trimestre = ?, fecha = ?
      WHERE id = ?
    `).run(
      nota !== undefined ? nota : calExistente.nota,
      descripcion !== undefined ? descripcion : calExistente.descripcion,
      tipo || calExistente.tipo,
      trimestre || calExistente.trimestre,
      fecha || calExistente.fecha,
      req.params.id
    );

    const calificacion = db.prepare(`
      SELECT cal.*, e.nombre, e.apellido FROM calificaciones cal
      INNER JOIN estudiantes e ON cal.estudiante_id = e.id
      WHERE cal.id = ?
    `).get(req.params.id);

    res.json({
      mensaje: 'Calificación actualizada correctamente.',
      calificacion
    });
  } catch (err) {
    console.error('Error al actualizar calificación:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * DELETE /api/calificaciones/:id
 * Elimina una calificación.
 */
router.delete('/:id', (req, res) => {
  try {
    // Verificar que la calificación pertenece al usuario
    const calificacion = db.prepare(`
      SELECT cal.* FROM calificaciones cal
      INNER JOIN cursos c ON cal.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE cal.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!calificacion) {
      return res.status(404).json({ error: 'Calificación no encontrada.' });
    }

    db.prepare('DELETE FROM calificaciones WHERE id = ?').run(req.params.id);

    res.json({ mensaje: 'Calificación eliminada correctamente.' });
  } catch (err) {
    console.error('Error al eliminar calificación:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
