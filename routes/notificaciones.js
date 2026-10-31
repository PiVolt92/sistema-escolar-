// routes/notificaciones.js
// Rutas CRUD para la gestión de notificaciones

const express = require('express');
const router = express.Router();
const db = require('../database');
const { verificarToken } = require('../middleware/auth');

// Proteger todas las rutas con autenticación
router.use(verificarToken);

/**
 * GET /api/notificaciones
 * Obtiene todas las notificaciones del usuario con el conteo de no leídas.
 * Query params: curso_id (opcional), leida (opcional: 0 o 1)
 */
router.get('/', (req, res) => {
  try {
    const { curso_id, leida } = req.query;

    let query = `
      SELECT n.*, c.nombre as curso_nombre FROM notificaciones n
      INNER JOIN cursos c ON n.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE col.usuario_id = ?
    `;
    const params = [req.usuario.id];

    // Filtrar por curso
    if (curso_id) {
      query += ' AND n.curso_id = ?';
      params.push(curso_id);
    }

    // Filtrar por estado de lectura
    if (leida !== undefined) {
      query += ' AND n.leida = ?';
      params.push(parseInt(leida));
    }

    query += ' ORDER BY n.fecha DESC';

    const notificaciones = db.prepare(query).all(...params);

    // Contar notificaciones no leídas
    const noLeidas = db.prepare(`
      SELECT COUNT(*) as total FROM notificaciones n
      INNER JOIN cursos c ON n.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE col.usuario_id = ? AND n.leida = 0
    `).get(req.usuario.id);

    res.json({
      notificaciones,
      no_leidas: noLeidas.total
    });
  } catch (err) {
    console.error('Error al obtener notificaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * GET /api/notificaciones/:id
 * Obtiene una notificación específica por su ID.
 */
router.get('/:id', (req, res) => {
  try {
    const notificacion = db.prepare(`
      SELECT n.*, c.nombre as curso_nombre FROM notificaciones n
      INNER JOIN cursos c ON n.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE n.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!notificacion) {
      return res.status(404).json({ error: 'Notificación no encontrada.' });
    }

    res.json({ notificacion });
  } catch (err) {
    console.error('Error al obtener notificación:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/notificaciones
 * Crea una nueva notificación.
 */
router.post('/', (req, res) => {
  try {
    const { curso_id, mensaje } = req.body;

    if (!curso_id || !mensaje) {
      return res.status(400).json({
        error: 'Se requiere curso_id y mensaje.'
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
      INSERT INTO notificaciones (curso_id, mensaje) VALUES (?, ?)
    `).run(curso_id, mensaje);

    const notificacion = db.prepare(`
      SELECT n.*, c.nombre as curso_nombre FROM notificaciones n
      INNER JOIN cursos c ON n.curso_id = c.id
      WHERE n.id = ?
    `).get(resultado.lastInsertRowid);

    res.status(201).json({
      mensaje: 'Notificación creada correctamente.',
      notificacion
    });
  } catch (err) {
    console.error('Error al crear notificación:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/notificaciones/:id
 * Actualiza una notificación (principalmente para marcar como leída).
 */
router.put('/:id', (req, res) => {
  try {
    const { mensaje, leida } = req.body;

    // Verificar que la notificación pertenece al usuario
    const notifExistente = db.prepare(`
      SELECT n.* FROM notificaciones n
      INNER JOIN cursos c ON n.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE n.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!notifExistente) {
      return res.status(404).json({ error: 'Notificación no encontrada.' });
    }

    db.prepare(`
      UPDATE notificaciones SET mensaje = ?, leida = ? WHERE id = ?
    `).run(
      mensaje || notifExistente.mensaje,
      leida !== undefined ? leida : notifExistente.leida,
      req.params.id
    );

    const notificacion = db.prepare(`
      SELECT n.*, c.nombre as curso_nombre FROM notificaciones n
      INNER JOIN cursos c ON n.curso_id = c.id
      WHERE n.id = ?
    `).get(req.params.id);

    res.json({
      mensaje: 'Notificación actualizada correctamente.',
      notificacion
    });
  } catch (err) {
    console.error('Error al actualizar notificación:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/notificaciones/marcar-todas-leidas
 * Marca todas las notificaciones como leídas.
 */
router.put('/marcar-todas/leidas', (req, res) => {
  try {
    db.prepare(`
      UPDATE notificaciones SET leida = 1
      WHERE curso_id IN (
        SELECT c.id FROM cursos c
        INNER JOIN colegios col ON c.colegio_id = col.id
        WHERE col.usuario_id = ?
      ) AND leida = 0
    `).run(req.usuario.id);

    res.json({ mensaje: 'Todas las notificaciones marcadas como leídas.' });
  } catch (err) {
    console.error('Error al marcar notificaciones como leídas:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * DELETE /api/notificaciones/:id
 * Elimina una notificación.
 */
router.delete('/:id', (req, res) => {
  try {
    // Verificar que la notificación pertenece al usuario
    const notificacion = db.prepare(`
      SELECT n.* FROM notificaciones n
      INNER JOIN cursos c ON n.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE n.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!notificacion) {
      return res.status(404).json({ error: 'Notificación no encontrada.' });
    }

    db.prepare('DELETE FROM notificaciones WHERE id = ?').run(req.params.id);

    res.json({ mensaje: 'Notificación eliminada correctamente.' });
  } catch (err) {
    console.error('Error al eliminar notificación:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
