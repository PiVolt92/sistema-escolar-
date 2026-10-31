// routes/licencias.js
// Rutas CRUD para gestión de licencias médicas, administrativas, feriados y duelo del docente

const express = require('express');
const router = express.Router();
const db = require('../database');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

/**
 * GET /api/licencias
 * Obtiene todas las licencias y feriados del usuario actual.
 * Opcionalmente filtra por curso_id o fecha.
 */
router.get('/', (req, res) => {
  try {
    const { curso_id, fecha } = req.query;
    let query = `
      SELECT l.*, c.nombre as curso_nombre, col.nombre as colegio_nombre 
      FROM licencias_docente l
      LEFT JOIN cursos c ON l.curso_id = c.id
      LEFT JOIN colegios col ON c.colegio_id = col.id
      WHERE l.usuario_id = ?
    `;
    const params = [req.usuario.id];

    if (curso_id) {
      query += ' AND (l.curso_id = ? OR l.curso_id IS NULL)';
      params.push(curso_id);
    }

    if (fecha) {
      query += ' AND l.fecha = ?';
      params.push(fecha);
    }

    query += ' ORDER BY l.fecha DESC, l.id DESC';

    const licencias = db.prepare(query).all(...params);
    res.json(licencias);
  } catch (err) {
    console.error('Error al obtener licencias:', err);
    res.status(500).json({ error: 'Error al obtener las licencias del docente.' });
  }
});

/**
 * POST /api/licencias
 * Registra una nueva licencia, feriado o inasistencia del docente.
 * Body: { fecha, motivo, descripcion, curso_id }
 */
router.post('/', (req, res) => {
  try {
    const { fecha, motivo, descripcion, curso_id } = req.body;

    if (!fecha || !motivo) {
      return res.status(400).json({ error: 'La fecha y el motivo son obligatorios.' });
    }

    const motivosValidos = [
      'Licencia Médica',
      'Licencia Administrativa',
      'Feriado',
      'Duelo',
      'Jornada Institucional',
      'Paro Docente',
      'Otro'
    ];

    const motivoFinal = motivosValidos.includes(motivo) ? motivo : (motivo || 'Otro');
    const cursoIdFinal = curso_id ? parseInt(curso_id, 10) : null;

    const info = db.prepare(`
      INSERT INTO licencias_docente (fecha, motivo, descripcion, curso_id, usuario_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(fecha, motivoFinal, descripcion || '', cursoIdFinal, req.usuario.id);

    const nueva = db.prepare(`
      SELECT l.*, c.nombre as curso_nombre 
      FROM licencias_docente l
      LEFT JOIN cursos c ON l.curso_id = c.id
      WHERE l.id = ?
    `).get(info.lastInsertRowid);

    res.status(201).json({
      mensaje: 'Registro guardado correctamente.',
      licencia: nueva
    });
  } catch (err) {
    console.error('Error al crear licencia:', err);
    res.status(500).json({ error: 'Error al registrar la licencia.' });
  }
});

/**
 * PUT /api/licencias/:id
 * Modifica / edita una licencia existente (cambiar fecha, motivo o descripción si se equivocó).
 * Body: { fecha, motivo, descripcion, curso_id }
 */
router.put('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { fecha, motivo, descripcion, curso_id } = req.body;

    // Verificar que pertenece al usuario
    const existente = db.prepare(
      'SELECT * FROM licencias_docente WHERE id = ? AND usuario_id = ?'
    ).get(id, req.usuario.id);

    if (!existente) {
      return res.status(404).json({ error: 'Registro no encontrado o no autorizado.' });
    }

    const nuevaFecha = fecha || existente.fecha;
    const nuevoMotivo = motivo || existente.motivo;
    const nuevaDesc = descripcion !== undefined ? descripcion : existente.descripcion;
    const nuevoCursoId = curso_id !== undefined ? (curso_id ? parseInt(curso_id, 10) : null) : existente.curso_id;

    db.prepare(`
      UPDATE licencias_docente 
      SET fecha = ?, motivo = ?, descripcion = ?, curso_id = ?
      WHERE id = ? AND usuario_id = ?
    `).run(nuevaFecha, nuevoMotivo, nuevaDesc, nuevoCursoId, id, req.usuario.id);

    const actualizada = db.prepare(`
      SELECT l.*, c.nombre as curso_nombre 
      FROM licencias_docente l
      LEFT JOIN cursos c ON l.curso_id = c.id
      WHERE l.id = ?
    `).get(id);

    res.json({
      mensaje: 'Registro actualizado correctamente.',
      licencia: actualizada
    });
  } catch (err) {
    console.error('Error al editar licencia:', err);
    res.status(500).json({ error: 'Error al actualizar el registro.' });
  }
});

/**
 * DELETE /api/licencias/:id
 * Elimina una licencia o feriado registrado por error.
 */
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const info = db.prepare(
      'DELETE FROM licencias_docente WHERE id = ? AND usuario_id = ?'
    ).run(id, req.usuario.id);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Registro no encontrado o ya eliminado.' });
    }

    res.json({ mensaje: 'Registro eliminado con éxito.' });
  } catch (err) {
    console.error('Error al eliminar licencia:', err);
    res.status(500).json({ error: 'Error al eliminar el registro.' });
  }
});

module.exports = router;
