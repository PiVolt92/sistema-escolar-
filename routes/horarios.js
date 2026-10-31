// routes/horarios.js
// Rutas CRUD para la gestión de horarios

const express = require('express');
const router = express.Router();
const db = require('../database');
const { verificarToken } = require('../middleware/auth');

// Proteger todas las rutas con autenticación
router.use(verificarToken);

/**
 * GET /api/horarios
 * Obtiene los horarios. Se puede filtrar por curso con ?curso_id=X
 */
router.get('/', (req, res) => {
  try {
    const { curso_id } = req.query;

    let horarios;
    if (curso_id) {
      // Filtrar por curso, verificando que pertenezca al usuario
      horarios = db.prepare(`
        SELECT h.* FROM horarios h
        INNER JOIN cursos c ON h.curso_id = c.id
        INNER JOIN colegios col ON c.colegio_id = col.id
        WHERE h.curso_id = ? AND col.usuario_id = ?
        ORDER BY CASE h.dia
          WHEN 'Lunes' THEN 1
          WHEN 'Martes' THEN 2
          WHEN 'Miércoles' THEN 3
          WHEN 'Jueves' THEN 4
          WHEN 'Viernes' THEN 5
          WHEN 'Sábado' THEN 6
        END, h.hora_inicio
      `).all(curso_id, req.usuario.id);
    } else {
      // Obtener todos los horarios del usuario
      horarios = db.prepare(`
        SELECT h.*, c.nombre as curso_nombre FROM horarios h
        INNER JOIN cursos c ON h.curso_id = c.id
        INNER JOIN colegios col ON c.colegio_id = col.id
        WHERE col.usuario_id = ?
        ORDER BY CASE h.dia
          WHEN 'Lunes' THEN 1
          WHEN 'Martes' THEN 2
          WHEN 'Miércoles' THEN 3
          WHEN 'Jueves' THEN 4
          WHEN 'Viernes' THEN 5
          WHEN 'Sábado' THEN 6
        END, h.hora_inicio
      `).all(req.usuario.id);
    }

    res.json({ horarios });
  } catch (err) {
    console.error('Error al obtener horarios:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * GET /api/horarios/:id
 * Obtiene un horario específico por su ID.
 */
router.get('/:id', (req, res) => {
  try {
    const horario = db.prepare(`
      SELECT h.* FROM horarios h
      INNER JOIN cursos c ON h.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE h.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!horario) {
      return res.status(404).json({ error: 'Horario no encontrado.' });
    }

    res.json({ horario });
  } catch (err) {
    console.error('Error al obtener horario:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/horarios
 * Crea un nuevo horario.
 */
router.post('/', (req, res) => {
  try {
    const { curso_id, dia, hora_inicio, hora_fin, materia } = req.body;

    if (!curso_id || !dia || !hora_inicio || !hora_fin || !materia) {
      return res.status(400).json({
        error: 'Todos los campos son obligatorios: curso_id, dia, hora_inicio, hora_fin, materia.'
      });
    }

    // Validar día de la semana
    const diasValidos = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    if (!diasValidos.includes(dia)) {
      return res.status(400).json({
        error: `El día debe ser uno de: ${diasValidos.join(', ')}`
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
      INSERT INTO horarios (curso_id, dia, hora_inicio, hora_fin, materia)
      VALUES (?, ?, ?, ?, ?)
    `).run(curso_id, dia, hora_inicio, hora_fin, materia);

    const horario = db.prepare('SELECT * FROM horarios WHERE id = ?').get(resultado.lastInsertRowid);

    res.status(201).json({
      mensaje: 'Horario creado correctamente.',
      horario
    });
  } catch (err) {
    console.error('Error al crear horario:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/horarios/:id
 * Actualiza un horario existente.
 */
router.put('/:id', (req, res) => {
  try {
    const { curso_id, dia, hora_inicio, hora_fin, materia } = req.body;

    // Verificar que el horario pertenece al usuario
    const horarioExistente = db.prepare(`
      SELECT h.* FROM horarios h
      INNER JOIN cursos c ON h.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE h.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!horarioExistente) {
      return res.status(404).json({ error: 'Horario no encontrado.' });
    }

    // Validar día si se proporciona
    if (dia) {
      const diasValidos = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      if (!diasValidos.includes(dia)) {
        return res.status(400).json({
          error: `El día debe ser uno de: ${diasValidos.join(', ')}`
        });
      }
    }

    db.prepare(`
      UPDATE horarios SET curso_id = ?, dia = ?, hora_inicio = ?, hora_fin = ?, materia = ?
      WHERE id = ?
    `).run(
      curso_id || horarioExistente.curso_id,
      dia || horarioExistente.dia,
      hora_inicio || horarioExistente.hora_inicio,
      hora_fin || horarioExistente.hora_fin,
      materia || horarioExistente.materia,
      req.params.id
    );

    const horario = db.prepare('SELECT * FROM horarios WHERE id = ?').get(req.params.id);

    res.json({
      mensaje: 'Horario actualizado correctamente.',
      horario
    });
  } catch (err) {
    console.error('Error al actualizar horario:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * DELETE /api/horarios/:id
 * Elimina un horario.
 */
router.delete('/:id', (req, res) => {
  try {
    // Verificar que el horario pertenece al usuario
    const horario = db.prepare(`
      SELECT h.* FROM horarios h
      INNER JOIN cursos c ON h.curso_id = c.id
      INNER JOIN colegios col ON c.colegio_id = col.id
      WHERE h.id = ? AND col.usuario_id = ?
    `).get(req.params.id, req.usuario.id);

    if (!horario) {
      return res.status(404).json({ error: 'Horario no encontrado.' });
    }

    db.prepare('DELETE FROM horarios WHERE id = ?').run(req.params.id);

    res.json({ mensaje: 'Horario eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar horario:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
