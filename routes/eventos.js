// routes/eventos.js
// Rutas CRUD para la gestión de eventos del calendario

const express = require('express');
const router = express.Router();
const db = require('../database');
const { verificarToken } = require('../middleware/auth');

// Proteger todas las rutas con autenticación
router.use(verificarToken);

/**
 * GET /api/eventos
 * Obtiene todos los eventos del usuario. Se puede filtrar por mes/año.
 * Query params: mes (opcional), anio (opcional)
 */
router.get('/', (req, res) => {
  try {
    const { mes, anio } = req.query;

    let query = 'SELECT * FROM eventos WHERE usuario_id = ?';
    const params = [req.usuario.id];

    // Filtrar por año y mes si se proporcionan
    if (anio && mes) {
      query += " AND strftime('%Y', fecha) = ? AND strftime('%m', fecha) = ?";
      params.push(anio, mes.padStart(2, '0'));
    } else if (anio) {
      query += " AND strftime('%Y', fecha) = ?";
      params.push(anio);
    }

    query += ' ORDER BY fecha ASC';

    const eventos = db.prepare(query).all(...params);

    res.json({ eventos });
  } catch (err) {
    console.error('Error al obtener eventos:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * GET /api/eventos/:id
 * Obtiene un evento específico por su ID.
 */
router.get('/:id', (req, res) => {
  try {
    const evento = db.prepare(
      'SELECT * FROM eventos WHERE id = ? AND usuario_id = ?'
    ).get(req.params.id, req.usuario.id);

    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado.' });
    }

    res.json({ evento });
  } catch (err) {
    console.error('Error al obtener evento:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/eventos
 * Crea un nuevo evento en el calendario.
 */
router.post('/', (req, res) => {
  try {
    const { titulo, descripcion, fecha } = req.body;

    if (!titulo || !fecha) {
      return res.status(400).json({
        error: 'El título y la fecha son obligatorios.'
      });
    }

    const resultado = db.prepare(`
      INSERT INTO eventos (titulo, descripcion, fecha, usuario_id)
      VALUES (?, ?, ?, ?)
    `).run(titulo, descripcion || null, fecha, req.usuario.id);

    const evento = db.prepare('SELECT * FROM eventos WHERE id = ?').get(resultado.lastInsertRowid);

    res.status(201).json({
      mensaje: 'Evento creado correctamente.',
      evento
    });
  } catch (err) {
    console.error('Error al crear evento:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/eventos/:id
 * Actualiza un evento existente.
 */
router.put('/:id', (req, res) => {
  try {
    const { titulo, descripcion, fecha } = req.body;

    // Verificar que el evento pertenece al usuario
    const eventoExistente = db.prepare(
      'SELECT * FROM eventos WHERE id = ? AND usuario_id = ?'
    ).get(req.params.id, req.usuario.id);

    if (!eventoExistente) {
      return res.status(404).json({ error: 'Evento no encontrado.' });
    }

    db.prepare(`
      UPDATE eventos SET titulo = ?, descripcion = ?, fecha = ?
      WHERE id = ?
    `).run(
      titulo || eventoExistente.titulo,
      descripcion !== undefined ? descripcion : eventoExistente.descripcion,
      fecha || eventoExistente.fecha,
      req.params.id
    );

    const evento = db.prepare('SELECT * FROM eventos WHERE id = ?').get(req.params.id);

    res.json({
      mensaje: 'Evento actualizado correctamente.',
      evento
    });
  } catch (err) {
    console.error('Error al actualizar evento:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * DELETE /api/eventos/:id
 * Elimina un evento.
 */
router.delete('/:id', (req, res) => {
  try {
    // Verificar que el evento pertenece al usuario
    const evento = db.prepare(
      'SELECT * FROM eventos WHERE id = ? AND usuario_id = ?'
    ).get(req.params.id, req.usuario.id);

    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado.' });
    }

    db.prepare('DELETE FROM eventos WHERE id = ?').run(req.params.id);

    res.json({ mensaje: 'Evento eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar evento:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
