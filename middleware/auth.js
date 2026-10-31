// middleware/auth.js
// Middleware de autenticación JWT para proteger rutas

const jwt = require('jsonwebtoken');

// Clave secreta para firmar los tokens JWT
const JWT_SECRET = process.env.JWT_SECRET || 'sistema_escolar_secret_key_2024';

/**
 * Middleware que verifica el token JWT en el header Authorization.
 * Si el token es válido, agrega los datos del usuario a req.usuario.
 * Si no es válido, responde con 401 o 403.
 */
function verificarToken(req, res, next) {
  // Obtener el header de autorización
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      error: 'Acceso denegado. No se proporcionó token de autenticación.'
    });
  }

  // El formato esperado es "Bearer <token>"
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    return res.status(401).json({
      error: 'Acceso denegado. Token vacío.'
    });
  }

  try {
    // Verificar y decodificar el token
    const decoded = jwt.verify(token, JWT_SECRET);
    // Agregar los datos del usuario al objeto request
    req.usuario = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'El token ha expirado. Inicie sesión nuevamente.'
      });
    }
    return res.status(403).json({
      error: 'Token inválido.'
    });
  }
}

module.exports = { verificarToken, JWT_SECRET };
