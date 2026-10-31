// server.js
// Servidor principal del Sistema de Gestión Escolar
// Autor: Prof. Facundo Casciano

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const { verificarToken } = require('./middleware/auth');

// Inicializar la aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// ── Crear tablas adicionales necesarias ──
db.exec(`
  CREATE TABLE IF NOT EXISTS horario_general (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    dia TEXT,
    hora TEXT,
    materia TEXT
  );
`);

// ── Middlewares globales ──

// Habilitar CORS
app.use(cors());

// Parsear cuerpos de peticiones en formato JSON
app.use(express.json());

// Parsear cuerpos de peticiones con datos de formulario
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la carpeta /public
app.use(express.static(path.join(__dirname, 'public')));

// ── Importar rutas modulares ──
const authRoutes = require('./routes/auth');
const colegiosRoutes = require('./routes/colegios');
const cursosRoutes = require('./routes/cursos');
const estudiantesRoutes = require('./routes/estudiantes');
const asistenciaRoutes = require('./routes/asistencia');
const calificacionesRoutes = require('./routes/calificaciones');
const horariosRoutes = require('./routes/horarios');
const eventosRoutes = require('./routes/eventos');
const notificacionesRoutes = require('./routes/notificaciones');
const libroTemasRoutes = require('./routes/libro-temas');
const licenciasRoutes = require('./routes/licencias');

// Registrar las rutas bajo el prefijo /api
app.use('/api/auth', authRoutes);
app.use('/api/colegios', colegiosRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/estudiantes', estudiantesRoutes);
app.use('/api/asistencia', asistenciaRoutes);
app.use('/api/calificaciones', calificacionesRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/libro-temas', libroTemasRoutes);
app.use('/api/licencias', licenciasRoutes);

// ── Rutas directas para el frontend ──

// Horario general (grilla semanal editable)
app.get('/api/horario', verificarToken, (req, res) => {
  try {
    const filas = db.prepare('SELECT dia, hora, materia FROM horario_general WHERE usuario_id = ?').all(req.usuario.id);
    res.json(filas);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/horario', verificarToken, (req, res) => {
  try {
    const { dia, hora, materia } = req.body;
    db.prepare('DELETE FROM horario_general WHERE usuario_id = ? AND dia = ? AND hora = ?').run(req.usuario.id, dia, hora);
    if (materia) {
      db.prepare('INSERT INTO horario_general (usuario_id, dia, hora, materia) VALUES (?, ?, ?, ?)').run(req.usuario.id, dia, hora, materia);
    }
    res.json({ mensaje: 'Guardado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar celda de horario' });
  }
});

app.put('/api/horario', verificarToken, (req, res) => {
  try {
    const { horario } = req.body;
    const guardar = db.transaction(() => {
      db.prepare('DELETE FROM horario_general WHERE usuario_id = ?').run(req.usuario.id);
      const insert = db.prepare('INSERT INTO horario_general (usuario_id, dia, hora, materia) VALUES (?, ?, ?, ?)');
      if (Array.isArray(horario)) {
        for (const h of horario) {
          if (h.materia) {
            insert.run(req.usuario.id, h.dia, h.hora, h.materia);
          }
        }
      }
    });
    guardar();
    res.json({ mensaje: 'Horario completo guardado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar horario' });
  }
});

// Eventos de calendario
app.get('/api/calendario/eventos', verificarToken, (req, res) => {
  try {
    const eventos = db.prepare('SELECT * FROM eventos WHERE usuario_id = ? ORDER BY fecha ASC').all(req.usuario.id);
    res.json(eventos);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/calendario/eventos', verificarToken, (req, res) => {
  try {
    const { fecha, titulo, descripcion } = req.body;
    if (!titulo || !fecha) {
      return res.status(400).json({ error: 'Fecha y título requeridos.' });
    }
    const resultado = db.prepare('INSERT INTO eventos (titulo, descripcion, fecha, usuario_id) VALUES (?, ?, ?, ?)').run(
      titulo, descripcion || '', fecha, req.usuario.id
    );
    res.status(201).json({ id: resultado.lastInsertRowid, titulo, fecha });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

// Suscripción
app.get('/api/suscripcion', (req, res) => {
  res.json({
    plan: 'Plan Docente Pro (Activo)',
    estado: 'Vigente',
    vigencia: 'Sin vencimiento',
    maxColegios: 'Ilimitados',
    maxCursos: 'Ilimitados'
  });
});

// Novedades
app.get('/api/novedades', (req, res) => {
  res.json([
    {
      titulo: '🚀 Nueva versión del Sistema de Gestión Escolar',
      descripcion: 'Ahora puedes registrar colegios, cursos, asistencia, notas diarias y anuales sin límites.',
      fecha: '2026-10-30'
    },
    {
      titulo: '🌙 Modo Oscuro y soporte sin conexión',
      descripcion: 'Accede rápidamente desde cualquier dispositivo con interfaz adaptada y modo nocturno.',
      fecha: '2026-10-29'
    }
  ]);
});

// ── Ruta principal: servir el frontend ──
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Manejo de rutas no encontradas ──
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// ── Manejo global de errores ──
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// ── Iniciar el servidor ──
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Sistema de Gestión Escolar              ║');
  console.log('║   Prof. Facundo Casciano                  ║');
  console.log(`║   Servidor corriendo en puerto ${PORT}        ║`);
  console.log(`║   http://localhost:${PORT}                    ║`);
  console.log('╚════════════════════════════════════════════╝');
});

module.exports = app;
