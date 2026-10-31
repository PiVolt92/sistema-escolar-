// routes/estudiantes.js
// Rutas CRUD para la gestión de estudiantes

const express = require('express');
const router = express.Router();
const db = require('../database');
const { verificarToken } = require('../middleware/auth');

// Proteger todas las rutas con autenticación
router.use(verificarToken);

/**
 * GET /api/estudiantes
 * Obtiene todos los estudiantes. Se puede filtrar por curso con ?curso_id=X
 */
router.get('/', (req, res) => {
  try {
    const { curso_id } = req.query;

    let estudiantes;
    if (curso_id) {
      // Filtrar por curso, verificando que pertenezca al usuario
      estudiantes = db.prepare(`
        SELECT e.* FROM estudiantes e
        INNER JOIN cursos c ON e.curso_id = c.id
        INNER JOIN colegios col ON c.colegio_id = col.id
        WHERE e.curso_id = ? AND col.usuario_id = ?
        ORDER BY e.apellido, e.nombre
      `).all(curso_id, req.usuario.id);
    } else {
      // Obtener todos los estudiantes del usuario
      estudiantes = db.prepare(`
        SELECT e.* FROM estudiantes e
        INNER JOIN cursos c ON e.curso_id = c.id
        INNER JOIN colegios col ON c.colegio_id = col.id
        WHERE col.usuario_id = ?
        ORDER BY e.apellido, e.nombre
      `).all(req.usuario.id);
    }

    res.json({ estudiantes });
  } catch (err) {
    console.error('Error al obtener estudiantes:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * GET /api/estudiantes/:id
 * Obtiene un estudiante específico por su ID.
 */
router.get('/:id', (req, res) => {
  try {
    const estudiante = db.prepare(`
      SELECT e.* FROM estudiantes e
      INNER JOIN cursos c ON e.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE e.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!estudiante) {
      return res.status(404).json({ error: 'Estudiante no encontrado.' });
    }

    res.json({ estudiante });
  } catch (err) {
    console.error('Error al obtener estudiante:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/estudiantes
 * Crea un nuevo estudiante.
 */
router.post('/', (req, res) => {
  try {
    const { nombre, apellido, dni, curso_id } = req.body;

    if (!nombre || !apellido || !curso_id) {
      return res.status(400).json({
        error: 'Nombre, apellido y curso son obligatorios.'
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
      INSERT INTO estudiantes (nombre, apellido, dni, curso_id)
      VALUES (?, ?, ?, ?)
    `).run(nombre, apellido, dni || null, curso_id);

    const estudiante = db.prepare('SELECT * FROM estudiantes WHERE id = ?').get(resultado.lastInsertRowid);

    res.status(201).json({
      mensaje: 'Estudiante creado correctamente.',
      estudiante
    });
  } catch (err) {
    console.error('Error al crear estudiante:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/estudiantes/:id
 * Actualiza un estudiante existente.
 */
router.put('/:id', (req, res) => {
  try {
    const { nombre, apellido, dni, curso_id } = req.body;

    if (!nombre || !apellido) {
      return res.status(400).json({
        error: 'Nombre y apellido son obligatorios.'
      });
    }

    // Verificar que el estudiante pertenece al usuario
    const estudianteExistente = db.prepare(`
      SELECT e.* FROM estudiantes e
      INNER JOIN cursos c ON e.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE e.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!estudianteExistente) {
      return res.status(404).json({ error: 'Estudiante no encontrado.' });
    }

    db.prepare(`
      UPDATE estudiantes SET nombre = ?, apellido = ?, dni = ?, curso_id = ?
      WHERE id = ?
    `).run(nombre, apellido, dni || null, curso_id || estudianteExistente.curso_id, req.params.id);

    const estudiante = db.prepare('SELECT * FROM estudiantes WHERE id = ?').get(req.params.id);

    res.json({
      mensaje: 'Estudiante actualizado correctamente.',
      estudiante
    });
  } catch (err) {
    console.error('Error al actualizar estudiante:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * DELETE /api/estudiantes/:id
 * Elimina un estudiante.
 */
router.delete('/:id', (req, res) => {
  try {
    // Verificar que el estudiante pertenece al usuario
    const estudiante = db.prepare(`
      SELECT e.* FROM estudiantes e
      INNER JOIN cursos c ON e.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE e.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!estudiante) {
      return res.status(404).json({ error: 'Estudiante no encontrado.' });
    }

    db.prepare('DELETE FROM estudiantes WHERE id = ?').run(req.params.id);

    res.json({ mensaje: 'Estudiante eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar estudiante:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
