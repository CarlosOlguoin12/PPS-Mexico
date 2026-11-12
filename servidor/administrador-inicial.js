// Crear un primer administrador únicamente cuando se configura desde el hosting.
// No se guardan contraseñas en el código ni se restablecen en cada despliegue.
import bcrypt from 'bcryptjs'
import { db } from './db.js'

const existe = db.prepare("SELECT id FROM usuarios WHERE rol='admin' LIMIT 1").get()
if (!existe) {
  const nombre = (process.env.ADMIN_NOMBRE || 'Carlos').trim()
  const correo = (process.env.ADMIN_CORREO || '').trim().toLowerCase()
  const clave = process.env.ADMIN_CLAVE || ''
  if (nombre && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) && clave.length >= 12 && clave.length <= 72) {
    const tomado = db.prepare('SELECT id FROM usuarios WHERE correo=?').get(correo)
    if (tomado) throw new Error('ADMIN_CORREO ya se utiliza: cambia el correo del administrador.')
    const hash = await bcrypt.hash(clave, 12)
    db.prepare("INSERT INTO usuarios (nombre,correo,clave_hash,rol) VALUES (?,?,?,'admin')").run(nombre, correo, hash)
    console.log(`Administrador inicial creado: ${nombre}`)
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('No hay administrador. Configura ADMIN_NOMBRE, ADMIN_CORREO y ADMIN_CLAVE (mínimo 12 caracteres) en Railway y vuelve a desplegar.')
  }
}
