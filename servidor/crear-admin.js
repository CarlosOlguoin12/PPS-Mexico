import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { db } from './db.js'

// Permite crear o reparar la cuenta sin borrar SQLite ni los pedidos.
const cli = createInterface({ input: stdin, output: stdout })
try {
  const nombre = (process.env.ADMIN_NOMBRE || await cli.question('Nombre del administrador (ej. Carlos): ')).trim()
  const correo = (process.env.ADMIN_CORREO || await cli.question('Correo del administrador: ')).trim().toLowerCase()
  const clave = process.env.ADMIN_CLAVE || await cli.question('Nueva contraseña (mínimo 8 caracteres): ')

  if (!nombre || nombre.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || typeof clave !== 'string' || clave.length < 8 || clave.length > 72) {
    throw new Error('Revisa nombre, correo válido y contraseña de 8 a 72 caracteres.')
  }

  const porCorreo = db.prepare('SELECT id, rol FROM usuarios WHERE correo = ?').get(correo)
  if (porCorreo && porCorreo.rol !== 'admin') {
    throw new Error('Ese correo ya pertenece a un cliente; usa otro correo para el administrador.')
  }
  const porNombre = db.prepare("SELECT id FROM usuarios WHERE rol='admin' AND nombre=? COLLATE NOCASE ORDER BY id LIMIT 1").get(nombre)
  if (porCorreo && porNombre && porCorreo.id !== porNombre.id) {
    throw new Error('Ese nombre y ese correo corresponden a dos administradores diferentes. Usa el correo de la cuenta que quieres recuperar.')
  }

  const hash = await bcrypt.hash(clave, 12)
  const existente = porCorreo || porNombre
  if (existente) {
    db.prepare('UPDATE usuarios SET nombre=?, correo=?, clave_hash=? WHERE id=?').run(nombre, correo, hash, existente.id)
    console.log('Cuenta administradora recuperada. Ya puedes iniciar sesión con ese nombre o correo.')
  } else {
    db.prepare("INSERT INTO usuarios (nombre,correo,clave_hash,rol) VALUES (?,?,?,'admin')").run(nombre, correo, hash)
    console.log('Cuenta administradora creada. Ya puedes iniciar sesión con ese nombre o correo.')
  }
} catch (error) {
  console.error('No se pudo configurar el administrador:', error.message)
  process.exitCode = 1
} finally {
  cli.close()
}
