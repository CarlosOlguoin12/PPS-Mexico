import 'dotenv/config'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { db, carpetaDatos } from './db.js'

if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  throw new Error('Este comando solo funciona en la base local.')
}

const hash = readFileSync(path.join(carpetaDatos, '.admin-local-hash'), 'utf8').trim()
if (!/^\$2[aby]\$12\$/.test(hash)) throw new Error('No se encontró la configuración del administrador local.')

const porCorreo = db.prepare('SELECT id FROM usuarios WHERE correo=?').get('carlos@pss.local')
const porNombre = db.prepare("SELECT id FROM usuarios WHERE rol='admin' AND nombre='Carlos' COLLATE NOCASE ORDER BY id LIMIT 1").get()
const existente = porCorreo || porNombre

if (existente) {
  db.prepare("UPDATE usuarios SET nombre='Carlos', clave_hash=?, rol='admin' WHERE id=?").run(hash, existente.id)
} else {
  db.prepare("INSERT INTO usuarios(nombre,correo,clave_hash,rol) VALUES('Carlos','carlos@pss.local',?,'admin')").run(hash)
}
console.log('Administrador local Carlos actualizado. Ya puedes iniciar sesión.')
