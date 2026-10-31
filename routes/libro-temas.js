// routes/libro-temas.js
// Rutas CRUD para la gestión del libro de temas

const express = require('express');
const router = express.Router();
const db = require('../database');
const { verificarToken } = require('../middleware/auth');

// Proteger todas las rutas con autenticación
router.use(verificarToken);

/**
 * GET /api/libro-temas
 * Obtiene las entradas del libro de temas. Se puede filtrar por curso.
 * Query params: curso_id (opcional)
 */
router.get('/', (req, res) => {
  try {
    const { curso_id } = req.query;

    let query = `
      SELECT lt.*, c.nombre as curso_nombre FROM libro_temas lt
      INNER JOIN cursos c ON lt.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE col.usuario_id = ?
    `;
    const params = [req.usuario.id];

    if (curso_id) {
      query += ' AND lt.curso_id = ?';
      params.push(curso_id);
    }

    query += ' ORDER BY lt.fecha DESC';

    const temas = db.prepare(query).all(...params);

    res.json({ temas });
  } catch (err) {
    console.error('Error al obtener libro de temas:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * GET /api/libro-temas/:id
 * Obtiene una entrada específica del libro de temas por su ID.
 */
router.get('/:id', (req, res) => {
  try {
    const tema = db.prepare(`
      SELECT lt.*, c.nombre as curso_nombre FROM libro_temas lt
      INNER JOIN cursos c ON lt.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE lt.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!tema) {
      return res.status(404).json({ error: 'Entrada del libro de temas no encontrada.' });
    }

    res.json({ tema });
  } catch (err) {
    console.error('Error al obtener entrada del libro de temas:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/libro-temas
 * Crea una nueva entrada en el libro de temas.
 */
router.post('/', (req, res) => {
  try {
    const { curso_id, fecha, tema, observaciones } = req.body;

    if (!curso_id || !fecha || !tema) {
      return res.status(400).json({
        error: 'Se requiere curso_id, fecha y tema.'
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
      INSERT INTO libro_temas (curso_id, fecha, tema, observaciones)
      VALUES (?, ?, ?, ?)
    `).run(curso_id, fecha, tema, observaciones || null);

    const nuevoTema = db.prepare(`
      SELECT lt.*, c.nombre as curso_nombre FROM libro_temas lt
      INNER JOIN cursos c ON lt.curso_id = c.id
      WHERE lt.id = ?
    `).get(resultado.lastInsertRowid);

    res.status(201).json({
      mensaje: 'Entrada del libro de temas creada correctamente.',
      tema: nuevoTema
    });
  } catch (err) {
    console.error('Error al crear entrada del libro de temas:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/libro-temas/:id
 * Actualiza una entrada del libro de temas.
 */
router.put('/:id', (req, res) => {
  try {
    const { curso_id, fecha, tema, observaciones } = req.body;

    // Verificar que la entrada pertenece al usuario
    const temaExistente = db.prepare(`
      SELECT lt.* FROM libro_temas lt
      INNER JOIN cursos c ON lt.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE lt.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!temaExistente) {
      return res.status(404).json({ error: 'Entrada del libro de temas no encontrada.' });
    }

    db.prepare(`
      UPDATE libro_temas SET curso_id = ?, fecha = ?, tema = ?, observaciones = ?
      WHERE id = ?
    `).run(
      curso_id || temaExistente.curso_id,
      fecha || temaExistente.fecha,
      tema || temaExistente.tema,
      observaciones !== undefined ? observaciones : temaExistente.observaciones,
      req.params.id
    );

    const temaActualizado = db.prepare(`
      SELECT lt.*, c.nombre as curso_nombre FROM libro_temas lt
      INNER JOIN cursos c ON lt.curso_id = c.id
      WHERE lt.id = ?
    `).get(req.params.id);

    res.json({
      mensaje: 'Entrada del libro de temas actualizada correctamente.',
      tema: temaActualizado
    });
  } catch (err) {
    console.error('Error al actualizar entrada del libro de temas:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * DELETE /api/libro-temas/:id
 * Elimina una entrada del libro de temas.
 */
router.delete('/:id', (req, res) => {
  try {
    // Verificar que la entrada pertenece al usuario
    const tema = db.prepare(`
      SELECT lt.* FROM libro_temas lt
      INNER JOIN cursos c ON lt.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE lt.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!tema) {
      return res.status(404).json({ error: 'Entrada del libro de temas no encontrada.' });
    }

    db.prepare('DELETE FROM libro_temas WHERE id = ?').run(req.params.id);

    res.json({ mensaje: 'Entrada del libro de temas eliminada correctamente.' });
  } catch (err) {
    console.error('Error al eliminar entrada del libro de temas:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
