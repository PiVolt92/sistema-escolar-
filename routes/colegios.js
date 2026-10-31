// routes/colegios.js
// Rutas CRUD para la gestión de colegios y sus cursos asociados

const express = require('express');
const router = express.Router();
const db = require('../database');
const { verificarToken } = require('../middleware/auth');

// Proteger todas las rutas con autenticación
router.use(verificarToken);

/**
 * GET /api/colegios
 * Obtiene todos los colegios del usuario autenticado.
 */
router.get('/', (req, res) => {
  try {
    const colegios = db.prepare(
      'SELECT * FROM colegios WHERE usuario_id = ? ORDER BY nombre'
    ).all(req.usuario.id);

    // Retorna array directo para compatibilidad con el frontend
    res.json(colegios);
  } catch (err) {
    console.error('Error al obtener colegios:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * GET /api/colegios/:id
 * Obtiene un colegio específico por su ID.
 */
router.get('/:id', (req, res) => {
  try {
    const colegio = db.prepare(
      'SELECT * FROM colegios WHERE id = ? AND usuario_id = ?'
    ).get(req.params.id, req.usuario.id);

    if (!colegio) {
      return res.status(404).json({ error: 'Colegio no encontrado.' });
    }

    res.json(colegio);
  } catch (err) {
    console.error('Error al obtener colegio:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/colegios
 * Crea un nuevo colegio.
 */
router.post('/', (req, res) => {
  try {
    const { nombre } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del colegio es obligatorio.' });
    }

    const resultado = db.prepare(
      'INSERT INTO colegios (nombre, usuario_id) VALUES (?, ?)'
    ).run(nombre.trim(), req.usuario.id);

    const colegio = db.prepare('SELECT * FROM colegios WHERE id = ?').get(resultado.lastInsertRowid);

    res.status(201).json(colegio);
  } catch (err) {
    console.error('Error al crear colegio:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * GET /api/colegios/:id/cursos
 * Obtiene todos los cursos de un colegio específico.
 */
router.get('/:id/cursos', (req, res) => {
  try {
    const cursos = db.prepare(
      'SELECT * FROM cursos WHERE colegio_id = ? ORDER BY nombre'
    ).all(req.params.id);

    res.json(cursos);
  } catch (err) {
    console.error('Error al obtener cursos del colegio:', err);
    res.status(500).json({ error: 'Error al obtener cursos del colegio.' });
  }
});

/**
 * POST /api/colegios/:id/cursos
 * Crea un nuevo curso dentro de un colegio específico.
 */
router.post('/:id/cursos', (req, res) => {
  try {
    const { nombre, anio, division, turno } = req.body;

    if (!nombre && !anio) {
      return res.status(400).json({ error: 'Debe ingresar el nombre o año del curso.' });
    }

    const nombreCurso = nombre || `${anio || ''}° ${division || ''} ${turno || ''}`.trim();

    const resultado = db.prepare(
      'INSERT INTO cursos (nombre, colegio_id, anio, division, turno) VALUES (?, ?, ?, ?, ?)'
    ).run(
      nombreCurso,
      req.params.id,
      anio || null,
      division || null,
      turno || 'Mañana'
    );

    const curso = db.prepare('SELECT * FROM cursos WHERE id = ?').get(resultado.lastInsertRowid);

    res.status(201).json(curso);
  } catch (err) {
    console.error('Error al crear curso en colegio:', err);
    res.status(500).json({ error: 'Error al crear el curso.' });
  }
});

/**
 * PUT /api/colegios/:id
 * Actualiza un colegio existente.
 */
router.put('/:id', (req, res) => {
  try {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del colegio es obligatorio.' });
    }

    const colegioExistente = db.prepare(
      'SELECT * FROM colegios WHERE id = ? AND usuario_id = ?'
    ).get(req.params.id, req.usuario.id);

    if (!colegioExistente) {
      return res.status(404).json({ error: 'Colegio no encontrado.' });
    }

    db.prepare('UPDATE colegios SET nombre = ? WHERE id = ?').run(nombre, req.params.id);

    const colegio = db.prepare('SELECT * FROM colegios WHERE id = ?').get(req.params.id);

    res.json(colegio);
  } catch (err) {
    console.error('Error al actualizar colegio:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * DELETE /api/colegios/:id
 * Elimina un colegio y todos sus cursos, alumnos y registros asociados en cascada.
 */
router.delete('/:id', (req, res) => {
  try {
    const colegio = db.prepare(
      'SELECT * FROM colegios WHERE id = ? AND usuario_id = ?'
    ).get(req.params.id, req.usuario.id);

    if (!colegio) {
      return res.status(404).json({ error: 'Colegio no encontrado.' });
    }

    const eliminarCascada = db.transaction(() => {
      const cursos = db.prepare('SELECT id FROM cursos WHERE colegio_id = ?').all(req.params.id);
      for (const c of cursos) {
        db.prepare('DELETE FROM asistencia WHERE curso_id = ?').run(c.id);
        db.prepare('DELETE FROM calificaciones WHERE curso_id = ?').run(c.id);
        db.prepare('DELETE FROM estudiantes WHERE curso_id = ?').run(c.id);
        db.prepare('DELETE FROM notificaciones WHERE curso_id = ?').run(c.id);
        db.prepare('DELETE FROM libro_temas WHERE curso_id = ?').run(c.id);
        db.prepare('DELETE FROM horarios WHERE curso_id = ?').run(c.id);
      }
      db.prepare('DELETE FROM cursos WHERE colegio_id = ?').run(req.params.id);
      db.prepare('DELETE FROM colegios WHERE id = ?').run(req.params.id);
    });

    eliminarCascada();

    res.json({ mensaje: `Colegio "${colegio.nombre}" y todos sus cursos fueron eliminados correctamente.` });
  } catch (err) {
    console.error('Error al eliminar colegio:', err);
    res.status(500).json({ error: 'Error interno del servidor al eliminar el colegio.' });
  }
});

module.exports = router;
