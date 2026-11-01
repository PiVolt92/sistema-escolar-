// database.js
// Configuración e inicialización de la base de datos SQLite

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Ruta del archivo de base de datos (soporta variables de entorno para la nube o local)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'escuela.db');

// Crear conexión a la base de datos con better-sqlite3 (compatible con todas las versiones de Node)
const db = new Database(DB_PATH);

// Habilitar claves foráneas para integridad referencial
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Inicializa la base de datos creando todas las tablas necesarias
 * e insertando datos de ejemplo si no existen.
 */
function inicializarDB() {
  // ── Tabla de usuarios (sistema de login) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── Tabla de colegios ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS colegios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      usuario_id INTEGER,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  // ── Tabla de cursos (vinculados a colegios) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS cursos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      colegio_id INTEGER,
      anio TEXT,
      division TEXT,
      turno TEXT DEFAULT 'Mañana',
      clases_dictadas INTEGER DEFAULT NULL,
      FOREIGN KEY (colegio_id) REFERENCES colegios(id)
    )
  `);

  // ── Tabla de estudiantes ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS estudiantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      dni TEXT,
      curso_id INTEGER,
      FOREIGN KEY (curso_id) REFERENCES cursos(id)
    )
  `);

  // ── Tabla de asistencia ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS asistencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id INTEGER,
      curso_id INTEGER,
      fecha DATE NOT NULL,
      estado TEXT CHECK(estado IN ('presente','ausente','tarde','justificado')) DEFAULT 'presente',
      FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id),
      FOREIGN KEY (curso_id) REFERENCES cursos(id)
    )
  `);

  // ── Tabla de calificaciones ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS calificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id INTEGER,
      curso_id INTEGER,
      tipo TEXT CHECK(tipo IN ('diaria','anual')) DEFAULT 'diaria',
      nota REAL,
      descripcion TEXT,
      fecha DATE NOT NULL,
      trimestre INTEGER DEFAULT 1,
      FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id),
      FOREIGN KEY (curso_id) REFERENCES cursos(id)
    )
  `);

  // ── Tabla de horarios ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS horarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      curso_id INTEGER,
      dia TEXT CHECK(dia IN ('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado')),
      hora_inicio TEXT,
      hora_fin TEXT,
      materia TEXT,
      FOREIGN KEY (curso_id) REFERENCES cursos(id)
    )
  `);

  // ── Tabla de eventos de calendario ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      fecha DATE NOT NULL,
      usuario_id INTEGER,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  // ── Tabla de notificaciones ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS notificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      curso_id INTEGER,
      mensaje TEXT NOT NULL,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      leida INTEGER DEFAULT 0,
      FOREIGN KEY (curso_id) REFERENCES cursos(id)
    )
  `);

  // ── Tabla de libro de temas ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS libro_temas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      curso_id INTEGER,
      fecha DATE NOT NULL,
      tema TEXT NOT NULL,
      observaciones TEXT,
      FOREIGN KEY (curso_id) REFERENCES cursos(id)
    )
  `);

  // ── Tabla de licencias, feriados y días sin clases del docente ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS licencias_docente (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha DATE NOT NULL,
      motivo TEXT NOT NULL,
      descripcion TEXT,
      curso_id INTEGER,
      usuario_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (curso_id) REFERENCES cursos(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  // ── Insertar datos iniciales si no existen ──
  insertarDatosIniciales();
}

/**
 * Inserta el usuario por defecto, colegios de ejemplo y cursos de ejemplo
 * solo si la tabla de usuarios está vacía.
 */
function insertarDatosIniciales() {
  // Verificar si ya existen usuarios
  const usuarioExistente = db.prepare('SELECT COUNT(*) as total FROM usuarios').get();

  if (usuarioExistente.total === 0) {
    // Crear contraseña hasheada con bcrypt
    const passwordHash = bcrypt.hashSync('admin123', 10);

    // Insertar usuario por defecto: Prof. Facundo Casciano
    const insertUsuario = db.prepare(`
      INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)
    `);
    const resultado = insertUsuario.run('Prof. Facundo Casciano', 'facundo@escuela.com', passwordHash);
    const usuarioId = resultado.lastInsertRowid;

    console.log('✅ Usuario por defecto creado: facundo@escuela.com / admin123');

    // Insertar colegios de ejemplo
    const insertColegio = db.prepare(`
      INSERT INTO colegios (nombre, usuario_id) VALUES (?, ?)
    `);

    const colegio1 = insertColegio.run('Tecnica N° 1 045', usuarioId);
    const colegio2 = insertColegio.run('Tecnica N° 2 135', usuarioId);
    const colegio3 = insertColegio.run('Tecnica N° 5 045', usuarioId);

    console.log('✅ Colegios de ejemplo creados');

    // Insertar cursos de ejemplo para Tecnica N° 1 045
    const insertCurso = db.prepare(`
      INSERT INTO cursos (nombre, colegio_id, anio, division, turno) VALUES (?, ?, ?, ?, ?)
    `);

    insertCurso.run('4° 1 ANALÓGICA GB', colegio1.lastInsertRowid, '4°', '1', 'Mañana');
    insertCurso.run('4° 1 MONTAJE GB', colegio1.lastInsertRowid, '4°', '1', 'Mañana');

    console.log('✅ Cursos de ejemplo creados para Tecnica N° 1 045');
  }
}

// Inicializar la base de datos al importar el módulo
inicializarDB();

// Exportar la instancia de la base de datos
module.exports = db;
