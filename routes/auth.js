// routes/auth.js
// Rutas de autenticación: login, cambio de contraseña, información del usuario

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { verificarToken, JWT_SECRET } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Inicia sesión con email y contraseña.
 * Retorna un token JWT si las credenciales son correctas.
 */
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar que se proporcionaron email y contraseña
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y contraseña son obligatorios.'
      });
    }

    // Buscar el usuario por email
    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);

    if (!usuario) {
      return res.status(401).json({
        error: 'Credenciales incorrectas.'
      });
    }

    // Verificar la contraseña con bcrypt
    const passwordValido = bcrypt.compareSync(password, usuario.password);

    if (!passwordValido) {
      return res.status(401).json({
        error: 'Credenciales incorrectas.'
      });
    }

    // Generar token JWT con validez de 24 horas
    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, email: usuario.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Responder con el token y datos del usuario (sin la contraseña)
    res.json({
      mensaje: 'Inicio de sesión exitoso.',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/auth/cambiar-password
 * Cambia la contraseña del usuario autenticado.
 * Requiere token JWT válido.
 */
router.post('/cambiar-password', verificarToken, (req, res) => {
  try {
    const { passwordActual, passwordNuevo } = req.body;

    // Validar que se proporcionaron ambas contraseñas
    if (!passwordActual || !passwordNuevo) {
      return res.status(400).json({
        error: 'La contraseña actual y la nueva son obligatorias.'
      });
    }

    // Validar longitud mínima de la nueva contraseña
    if (passwordNuevo.length < 6) {
      return res.status(400).json({
        error: 'La nueva contraseña debe tener al menos 6 caracteres.'
      });
    }

    // Obtener el usuario actual de la base de datos
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Verificar que la contraseña actual sea correcta
    const passwordValido = bcrypt.compareSync(passwordActual, usuario.password);

    if (!passwordValido) {
      return res.status(401).json({
        error: 'La contraseña actual es incorrecta.'
      });
    }

    // Hashear la nueva contraseña y actualizarla
    const nuevoHash = bcrypt.hashSync(passwordNuevo, 10);
    db.prepare('UPDATE usuarios SET password = ? WHERE id = ?').run(nuevoHash, req.usuario.id);

    res.json({ mensaje: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    console.error('Error al cambiar contraseña:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.post('/change-password', verificarToken, (req, res) => {
  try {
    const passwordActual = req.body.oldPassword || req.body.passwordActual;
    const passwordNuevo = req.body.newPassword || req.body.passwordNuevo;
    if (!passwordActual || !passwordNuevo) {
      return res.status(400).json({ error: 'Contraseña actual y nueva requeridas.' });
    }
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
    if (!usuario || !bcrypt.compareSync(passwordActual, usuario.password)) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }
    const nuevoHash = bcrypt.hashSync(passwordNuevo, 10);
    db.prepare('UPDATE usuarios SET password = ? WHERE id = ?').run(nuevoHash, req.usuario.id);
    res.json({ mensaje: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar contraseña.' });
  }
});

/**
 * GET /api/auth/me
 * Retorna la información del usuario autenticado.
 * Requiere token JWT válido.
 */
router.get('/me', verificarToken, (req, res) => {
  try {
    // Obtener datos actualizados del usuario (sin la contraseña)
    const usuario = db.prepare(
      'SELECT id, nombre, email, created_at FROM usuarios WHERE id = ?'
    ).get(req.usuario.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json({ usuario });
  } catch (err) {
    console.error('Error al obtener usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
