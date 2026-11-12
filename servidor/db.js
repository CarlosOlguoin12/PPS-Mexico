import { DatabaseSync } from 'node:sqlite'
import { readFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const carpeta = path.dirname(fileURLToPath(import.meta.url))
// Railway monta un volumen persistente para la base y las fotos del admin.
if (process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  throw new Error('Antes de iniciar en Railway, conecta un Volume persistente montado en /data.')
}
export const carpetaDatos = path.resolve(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(carpeta, 'data'))
mkdirSync(carpetaDatos, { recursive: true })
export const archivoDB = path.join(carpetaDatos, 'pss.sqlite')
export const db = new DatabaseSync(archivoDB)
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
db.exec(readFileSync(path.resolve(carpeta, '../basedatos/schema.sql'), 'utf8'))

function agregarColumna(tabla, nombre, definicion) {
  if (!db.prepare(`PRAGMA table_info(${tabla})`).all().some(col => col.name === nombre)) {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${definicion}`)
  }
}
agregarColumna('usuarios', 'correo_verificado', 'INTEGER NOT NULL DEFAULT 1')
agregarColumna('productos', 'descripcion_larga', "TEXT NOT NULL DEFAULT ''")
agregarColumna('productos', 'galeria', "TEXT NOT NULL DEFAULT '[]'")
agregarColumna('dudas', 'correo_enviado', 'INTEGER NOT NULL DEFAULT 0')
agregarColumna('cotizaciones', 'respuesta', "TEXT NOT NULL DEFAULT ''")
agregarColumna('cotizaciones', 'precio_propuesto_centavos', 'INTEGER')
agregarColumna('cotizaciones', 'respondida_en', 'TEXT')
agregarColumna('cotizaciones', 'correo_enviado', 'INTEGER NOT NULL DEFAULT 0')
db.exec(`CREATE TABLE IF NOT EXISTS verificaciones_correo (
 usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
 codigo_hash TEXT NOT NULL, vence_en INTEGER NOT NULL, intentos INTEGER NOT NULL DEFAULT 0,
 enviado_en INTEGER NOT NULL
)`)


if (db.prepare('SELECT COUNT(*) AS n FROM categorias').get().n === 0) {
  db.exec('BEGIN IMMEDIATE')
  try {
    db.exec(readFileSync(path.resolve(carpeta, '../basedatos/datos.sql'), 'utf8'))
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}


// Migración de imágenes iniciales: cambia sólo las rutas SVG originales.
// Las fotos personalizadas que eligió el administrador nunca se modifican.
const imagenesIniciales = [
  'camara-seguridad', 'alarma-hogar', 'sensor-movimiento',
  'cerradura-inteligente', 'grabador-dvr', 'kit-camaras',
]
const nombresIniciales = [
  'Cámara de seguridad', 'Alarma para el hogar', 'Sensor de movimiento',
  'Cerradura inteligente', 'Grabador DVR 8 canales', 'Kit de 4 cámaras',
]
const migrarImagen = db.prepare("UPDATE productos SET imagen=? WHERE nombre=? AND (imagen=? OR imagen='' OR imagen IS NULL)")
for (let i = 0; i < imagenesIniciales.length; i++) {
  const slug = imagenesIniciales[i]
  migrarImagen.run(`/productos/${slug}.jpg`, nombresIniciales[i], `/productos/${slug}.svg`)
}

export const mostrarProducto = (p) => p && ({
  ...p,
  galeria: (() => { try { const g = JSON.parse(p.galeria || '[]'); return Array.isArray(g) ? g : [] } catch { return [] } })(),
  precio: p.precio_centavos / 100,
  activo: Boolean(p.activo),
})
export const mostrarPedido = (p) => p && ({ ...p, total: p.total_centavos / 100 })
