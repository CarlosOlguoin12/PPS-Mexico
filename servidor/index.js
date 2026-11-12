import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { backup } from 'node:sqlite'
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, unlink, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, carpetaDatos, mostrarProducto, mostrarPedido } from './db.js'
import './administrador-inicial.js'
import { enviarCorreo, correoConfigurado, ventas } from './correo.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '30kb' }))
app.use(cookieParser())

// El secreto no se incluye en el ZIP. Se genera en el primer arranque y persiste.
const archivoSecreto = path.join(carpetaDatos, '.jwt-secret')
const JWT_SECRETO = process.env.JWT_SECRETO || (() => {
  if (!existsSync(archivoSecreto)) writeFileSync(archivoSecreto, randomBytes(48).toString('hex'), { mode: 0o600, flag: 'wx' })
  return readFileSync(archivoSecreto, 'utf8').trim()
})()
const COOKIE = 'pss_sesion'
const opcionesCookie = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 86400000, path: '/' }
const publicoUsuario = (u) => ({ id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol })
const correoValido = (correo) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
const limpiar = (v, max = 200) => typeof v === 'string' ? v.trim().slice(0, max) : ''
const precioCentavos = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 10000000 && Math.abs(Math.round(n * 100) - n * 100) < 0.000001 ? Math.round(n * 100) : null
}
const peticiones = new Map()
function limitar(req, res, next) {
  const clave = `${req.ip}:${req.path}`
  const ahora = Date.now()
  const dato = peticiones.get(clave)
  const n = dato && dato.hasta > ahora ? dato.n + 1 : 1
  peticiones.set(clave, { n, hasta: dato && dato.hasta > ahora ? dato.hasta : ahora + 600000 })
  if (peticiones.size > 20000) peticiones.clear()
  if (n > 15) return res.status(429).json({ mensaje: 'Demasiados intentos. Intenta más tarde.' })
  next()
}
const hashCodigo = (id, codigo) => createHmac('sha256', JWT_SECRETO).update(`${id}:${codigo}`).digest('hex')
async function mandarCodigo(u) {
  const codigo = String(randomBytes(4).readUInt32BE(0) % 1000000).padStart(6, '0')
  const ahora = Date.now()
  db.prepare(`INSERT INTO verificaciones_correo (usuario_id,codigo_hash,vence_en,intentos,enviado_en)
    VALUES (?,?,?,?,?) ON CONFLICT(usuario_id) DO UPDATE SET codigo_hash=excluded.codigo_hash,
    vence_en=excluded.vence_en,intentos=0,enviado_en=excluded.enviado_en`)
    .run(u.id, hashCodigo(u.id, codigo), ahora + 600000, 0, ahora)
  try {
    await enviarCorreo({ para: u.correo, asunto: 'Confirma tu correo en PSS México',
      contenido: `Hola, ${u.nombre}.\n\nTu código de verificación es: ${codigo}\n\nVálido durante 10 minutos.` })
  } catch (e) {
    db.prepare('DELETE FROM verificaciones_correo WHERE usuario_id=?').run(u.id)
    throw e
  }
}
const productoSql = `SELECT p.*, c.nombre AS categoria FROM productos p JOIN categorias c ON c.id = p.categoria_id`

function iniciarSesion(res, u) {
  const token = jwt.sign({ id: u.id }, JWT_SECRETO, { expiresIn: '7d' })
  res.cookie(COOKIE, token, opcionesCookie)
}
function sesion(req, res, next) {
  try {
    const payload = jwt.verify(req.cookies[COOKIE], JWT_SECRETO)
    const usuario = db.prepare('SELECT id, nombre, correo, rol, correo_verificado FROM usuarios WHERE id=?').get(payload.id)
    if (!usuario || !usuario.correo_verificado) return res.status(401).json({ mensaje: 'Verifica tu correo e inicia sesión para continuar.' })
    req.usuario = usuario
    next()
  } catch { return res.status(401).json({ mensaje: 'Inicia sesión para continuar.' }) }
}
function admin(req, res, next) {
  if (req.usuario.rol !== 'admin') return res.status(403).json({ mensaje: 'Se requiere una cuenta administradora.' })
  next()
}
// Rechazar modificaciones de otro origen. Vite usa /api con proxy mismo-origen.
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('sec-fetch-site') === 'cross-site') {
    return res.status(403).json({ mensaje: 'Solicitud rechazada por seguridad.' })
  }
  next()
})

// El admin puede subir imágenes propias (PNG, JPEG, WebP). Se guardan fuera del frontend.
const carpetaImagenes = path.join(carpetaDatos, 'uploads')
mkdirSync(carpetaImagenes, { recursive: true })
app.get('/api/imagenes/:nombre', (req, res) => {
  const nombre = req.params.nombre
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(nombre)) return res.sendStatus(404)
  const ruta = path.join(carpetaImagenes, nombre)
  if (!existsSync(ruta)) return res.sendStatus(404)
  res.set('X-Content-Type-Options', 'nosniff')
  res.type(nombre.endsWith('.png') ? 'png' : nombre.endsWith('.webp') ? 'webp' : 'jpeg')
  res.sendFile(ruta)
})
app.post('/api/admin/subir-imagen', sesion, admin, express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '2mb' }), (req, res) => {
  const contenido = req.body
  if (!Buffer.isBuffer(contenido) || contenido.length < 32) return res.status(400).json({ mensaje: 'Selecciona una imagen JPG, PNG o WebP de máximo 2 MB.' })
  const firma = contenido.subarray(0, 12)
  const png = firma.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  const jpg = firma[0] === 255 && firma[1] === 216 && firma[2] === 255
  const webp = firma.toString('ascii',0,4) === 'RIFF' && firma.toString('ascii',8,12) === 'WEBP'
  const tipo = req.get('content-type')?.split(';')[0]
  if (!((tipo === 'image/png' && png) || (tipo === 'image/jpeg' && jpg) || (tipo === 'image/webp' && webp))) return res.status(400).json({ mensaje: 'El archivo no es una imagen JPG, PNG o WebP válida.' })
  const ext = png ? 'png' : jpg ? 'jpg' : 'webp'
  const nombre = `${randomBytes(16).toString('hex')}.${ext}`
  writeFileSync(path.join(carpetaImagenes, nombre), contenido, { flag: 'wx', mode: 0o600 })
  res.status(201).json({ imagen: `/api/imagenes/${nombre}` })
})
app.get('/api/salud', (req, res) => res.json({ ok: true, baseDeDatos: 'SQLite', hora: new Date().toISOString() }))
app.get('/api/categorias', (req, res) => res.json({ categorias: db.prepare('SELECT * FROM categorias ORDER BY id').all() }))
app.get('/api/productos', (req, res) => {
  res.set('Cache-Control', 'no-store')
  const productos = db.prepare(`${productoSql} WHERE p.activo=1 ORDER BY p.id`).all().map(mostrarProducto)
  res.json({ productos })
})

app.post('/api/registro', limitar, async (req, res) => {
  const nombre = limpiar(req.body?.nombre, 150)
  const correo = limpiar(req.body?.correo, 255).toLowerCase()
  const clave = req.body?.clave
  if (!nombre || !correoValido(correo) || typeof clave !== 'string' || clave.length < 8 || clave.length > 72) {
    return res.status(400).json({ mensaje: 'Escribe nombre, correo válido y contraseña de 8 a 72 caracteres.' })
  }
  if (!correoConfigurado()) return res.status(503).json({ mensaje: 'El envío de correos aún no está configurado.' })
  if (db.prepare('SELECT id FROM usuarios WHERE correo=?').get(correo)) return res.status(409).json({ mensaje: 'Este correo ya está registrado.' })
  try {
    const hash = await bcrypt.hash(clave, 12)
    const id = Number(db.prepare("INSERT INTO usuarios (nombre,correo,clave_hash,rol,correo_verificado) VALUES (?,?,?,'cliente',0)").run(nombre, correo, hash).lastInsertRowid)
    try {
      await mandarCodigo({ id, nombre, correo })
    } catch (e) {
      db.prepare('DELETE FROM usuarios WHERE id=? AND correo_verificado=0').run(id)
      throw e
    }
    res.status(201).json({ verificacionPendiente: true, correo, mensaje: 'Te enviamos un código para confirmar tu correo.' })
  } catch (e) {
    if (e.code?.includes('CONSTRAINT')) return res.status(409).json({ mensaje: 'Este correo ya está registrado.' })
    res.status(503).json({ mensaje: e.message || 'No fue posible enviar el código.' })
  }
})
app.post('/api/reenviar-codigo', limitar, async (req, res) => {
  const correo = limpiar(req.body?.correo, 255).toLowerCase()
  const u = db.prepare('SELECT id,nombre,correo,correo_verificado FROM usuarios WHERE correo=?').get(correo)
  if (!u || u.correo_verificado) return res.json({ mensaje: 'Si la cuenta requiere verificación, recibirás un nuevo código.' })
  const anterior = db.prepare('SELECT enviado_en FROM verificaciones_correo WHERE usuario_id=?').get(u.id)
  if (anterior && Date.now() - anterior.enviado_en < 60000) {
    return res.status(429).json({ mensaje: 'Espera un minuto para solicitar otro código.' })
  }
  try {
    await mandarCodigo(u)
    res.json({ mensaje: 'Te enviamos un nuevo código.' })
  } catch (e) { res.status(503).json({ mensaje: e.message }) }
})
app.post('/api/verificar-correo', limitar, (req, res) => {
  const correo = limpiar(req.body?.correo, 255).toLowerCase()
  const codigo = limpiar(req.body?.codigo, 6)
  if (!/^\d{6}$/.test(codigo)) return res.status(400).json({ mensaje: 'Introduce el código de seis números.' })
  const u = db.prepare('SELECT id,nombre,correo,rol,correo_verificado FROM usuarios WHERE correo=?').get(correo)
  if (!u || u.correo_verificado) return res.status(400).json({ mensaje: 'La verificación no está disponible para ese correo.' })
  const verificacion = db.prepare('SELECT * FROM verificaciones_correo WHERE usuario_id=?').get(u.id)
  if (!verificacion || verificacion.vence_en < Date.now() || verificacion.intentos >= 5) {
    return res.status(400).json({ mensaje: 'El código venció o se agotaron los intentos. Solicita otro.' })
  }
  db.prepare('UPDATE verificaciones_correo SET intentos=intentos+1 WHERE usuario_id=?').run(u.id)
  const recibido = Buffer.from(hashCodigo(u.id, codigo), 'hex')
  const esperado = Buffer.from(verificacion.codigo_hash, 'hex')
  if (!timingSafeEqual(recibido, esperado)) return res.status(400).json({ mensaje: 'El código es incorrecto.' })
  db.prepare('UPDATE usuarios SET correo_verificado=1 WHERE id=?').run(u.id)
  db.prepare('DELETE FROM verificaciones_correo WHERE usuario_id=?').run(u.id)
  iniciarSesion(res, u)
  res.json({ usuario: publicoUsuario(u), mensaje: 'Correo verificado correctamente.' })
})
app.post('/api/login', async (req, res) => {
  const correo = limpiar(req.body?.correo, 255).toLowerCase()
  const clave = req.body?.clave
  // Clientes usan correo; el administrador también puede iniciar con su usuario (nombre).
  // Si una base anterior tenía dos administradores con el mismo nombre,
  // identificar la cuenta correcta por su contraseña, no por el primer ID.
  const candidatos = correo.includes('@')
    ? [db.prepare('SELECT * FROM usuarios WHERE correo=?').get(correo)].filter(Boolean)
    : db.prepare("SELECT * FROM usuarios WHERE rol='admin' AND nombre=? COLLATE NOCASE ORDER BY id").all(correo)
  let u = null
  if (typeof clave === 'string') {
    for (const candidato of candidatos) {
      if (await bcrypt.compare(clave, candidato.clave_hash)) { u = candidato; break }
    }
  }
  if (!u) return res.status(401).json({ mensaje: 'Usuario, correo o contraseña incorrectos.' })
  if (!u.correo_verificado) return res.status(403).json({ mensaje: 'Tu correo aún no está verificado. Introduce el código que te enviamos.' })
  iniciarSesion(res, u)
  res.json({ usuario: publicoUsuario(u) })
})
app.get('/api/yo', (req, res) => {
  try {
    const payload = jwt.verify(req.cookies[COOKIE], JWT_SECRETO)
    const u = db.prepare('SELECT id,nombre,correo,rol,correo_verificado FROM usuarios WHERE id=?').get(payload.id)
    res.json({ usuario: u?.correo_verificado ? publicoUsuario(u) : null })
  } catch { res.json({ usuario: null }) }
})
app.post('/api/salir', (req, res) => {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: opcionesCookie.secure, path: '/' })
  res.json({ ok: true })
})

app.post('/api/dudas', limitar, async (req, res) => {
  const nombre = limpiar(req.body?.nombre, 150), correo = limpiar(req.body?.correo, 255), mensaje = limpiar(req.body?.mensaje, 3000)
  if (!nombre || !correoValido(correo) || !mensaje) return res.status(400).json({ mensaje: 'Completa el formulario con un correo válido.' })
  if (!correoConfigurado() || !correoValido(ventas)) return res.status(503).json({ mensaje: 'El correo de contacto todavía no está configurado.' })
  const id = Number(db.prepare('INSERT INTO dudas (nombre,correo,mensaje) VALUES (?,?,?)').run(nombre, correo, mensaje).lastInsertRowid)
  try {
    await enviarCorreo({ para: ventas, asunto: 'Nueva consulta de PSS México',
      contenido: `Nombre: ${nombre}\nCorreo: ${correo}\n\nConsulta:\n${mensaje}`, responderA: correo })
    db.prepare('UPDATE dudas SET correo_enviado=1 WHERE id=?').run(id)
    res.status(201).json({ ok: true, mensaje: 'Tu consulta se envió correctamente.' })
  } catch (e) { res.status(503).json({ mensaje: e.message }) }
})
app.post('/api/cotizaciones', limitar, async (req, res) => {
  const nombre = limpiar(req.body?.nombre, 150), correo = limpiar(req.body?.correo, 255), telefono = limpiar(req.body?.telefono, 30), descripcion = limpiar(req.body?.descripcion, 3000)
  if (!nombre || !correoValido(correo) || !descripcion) return res.status(400).json({ mensaje: 'Completa nombre, correo y descripción.' })
  if (!correoConfigurado() || !correoValido(ventas)) return res.status(503).json({ mensaje: 'El correo de contacto todavía no está configurado.' })
  const id = Number(db.prepare('INSERT INTO cotizaciones (nombre,correo,telefono,descripcion) VALUES (?,?,?,?)').run(nombre, correo, telefono, descripcion).lastInsertRowid)
  try {
    await enviarCorreo({ para: ventas, asunto: 'Nueva solicitud de cotización',
      contenido: `Nombre: ${nombre}\nCorreo: ${correo}\nTeléfono: ${telefono}\n\nSolicitud:\n${descripcion}`, responderA: correo })
    db.prepare('UPDATE cotizaciones SET correo_enviado=1 WHERE id=?').run(id)
    res.status(201).json({ ok: true, mensaje: 'Tu solicitud se envió correctamente.' })
  } catch (e) { res.status(503).json({ mensaje: e.message }) }
})

app.post('/api/pedidos', sesion, (req, res) => {
  const productos = req.body?.productos, metodo = req.body?.metodo_pago, direccion = limpiar(req.body?.direccion_envio, 500)
  if (!Array.isArray(productos) || !productos.length || productos.length > 100 || !['efectivo','tarjeta'].includes(metodo) || direccion.length < 5) {
    return res.status(400).json({ mensaje: 'Completa tu pedido, la dirección y el método de pago.' })
  }
  // Nunca recibir ni almacenar números de tarjeta ni CVV en nuestro servidor.
  if (['numero', 'cvv', 'vencimiento', 'titular', 'tarjeta', 'cardNumber'].some(campo => Object.hasOwn(req.body, campo))) {
    return res.status(400).json({ mensaje: 'Los datos bancarios no deben enviarse al servidor.' })
  }
  const ids = new Set()
  for (const item of productos) {
    if (!Number.isSafeInteger(item.id) || item.id < 1 || !Number.isSafeInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > 100 || ids.has(item.id)) {
      return res.status(400).json({ mensaje: 'Los productos o cantidades no son válidos.' })
    }
    ids.add(item.id)
  }
  db.exec('BEGIN IMMEDIATE')
  try {
    const items = productos.map(({ id, cantidad }) => {
      const p = db.prepare('SELECT id,nombre,precio_centavos,stock,activo FROM productos WHERE id=?').get(id)
      if (!p || !p.activo) throw new Error('Uno de los productos ya no está disponible.')
      if (p.stock < cantidad) throw new Error(`Solo quedan ${p.stock} unidades de ${p.nombre}.`)
      return { ...p, cantidad }
    })
    const total = items.reduce((sum, p) => sum + p.precio_centavos * p.cantidad, 0)
    const pedidoId = Number(db.prepare('INSERT INTO pedidos (usuario_id,metodo_pago,direccion_envio,total_centavos) VALUES (?,?,?,?)').run(req.usuario.id, metodo, direccion, total).lastInsertRowid)
    for (const p of items) {
      db.prepare('INSERT INTO detalle_pedido (pedido_id,producto_id,cantidad,precio_unitario_centavos) VALUES (?,?,?,?)').run(pedidoId, p.id, p.cantidad, p.precio_centavos)
      db.prepare('UPDATE productos SET stock=stock-? WHERE id=?').run(p.cantidad, p.id)
    }
    db.exec('COMMIT')
    res.status(201).json({ mensaje: 'Pedido registrado. Pago pendiente.', pedido: { id: pedidoId, total: total / 100, estado: 'pendiente' } })
  } catch (e) {
    db.exec('ROLLBACK')
    res.status(400).json({ mensaje: e.message || 'No se pudo registrar el pedido.' })
  }
})
app.get('/api/mis-pedidos', sesion, (req, res) => {
  const pedidos = db.prepare('SELECT * FROM pedidos WHERE usuario_id=? ORDER BY id DESC').all(req.usuario.id).map(p => {
    const detalle = db.prepare(`SELECT d.producto_id, d.cantidad, d.precio_unitario_centavos / 100.0 AS precio_unitario, p.nombre FROM detalle_pedido d JOIN productos p ON p.id=d.producto_id WHERE d.pedido_id=?`).all(p.id)
    return { ...mostrarPedido(p), detalle }
  })
  res.json({ pedidos })
})

app.get('/api/admin/resumen', sesion, admin, (req, res) => {
  const count = table => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n
  res.json({ usuarios: count('usuarios'), productos: count('productos'), pedidos: count('pedidos'), dudas: count('dudas'), cotizaciones: count('cotizaciones') })
})
app.get('/api/admin/productos', sesion, admin, (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ productos: db.prepare(`${productoSql} ORDER BY p.id DESC`).all().map(mostrarProducto) })
})
function validarProducto(entrada) {
  const nombre = limpiar(entrada?.nombre, 150), marca = limpiar(entrada?.marca, 100), detalle = limpiar(entrada?.detalle, 500)
  const extra = limpiar(entrada?.extra, 150), beneficio = limpiar(entrada?.beneficio, 150), imagen = limpiar(entrada?.imagen, 400)
  const descripcion_larga = limpiar(entrada?.descripcion_larga, 5000)
  const galeria = Array.isArray(entrada?.galeria) ? entrada.galeria.map(r => limpiar(r, 400)).filter(Boolean).slice(0, 8) : []
  if (galeria.some(r => !/^https?:\/\//.test(r) && !r.startsWith('/'))) throw new Error('Revisa las rutas de las fotografías.')
  const categoria_id = Number(entrada?.categoria_id), stock = Number(entrada?.stock), centavos = precioCentavos(entrada?.precio)
  const activo = entrada?.activo === false || entrada?.activo === 0 ? 0 : 1
  if (!nombre || !Number.isSafeInteger(categoria_id) || !db.prepare('SELECT id FROM categorias WHERE id=?').get(categoria_id) || !Number.isSafeInteger(stock) || stock < 0 || stock > 100000 || centavos === null || (imagen && !/^https?:\/\//.test(imagen) && !/^\//.test(imagen))) {
    throw new Error('Revisa nombre, categoría, precio, stock o URL de imagen.')
  }
  return { nombre, marca, detalle, descripcion_larga, galeria: JSON.stringify(galeria), extra, beneficio, imagen, categoria_id, stock, centavos, activo }
}
app.post('/api/admin/productos', sesion, admin, (req, res) => {
  try {
    const p = validarProducto(req.body)
    const id = Number(db.prepare('INSERT INTO productos (categoria_id,nombre,marca,detalle,descripcion_larga,galeria,extra,beneficio,precio_centavos,stock,imagen,activo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(p.categoria_id,p.nombre,p.marca,p.detalle,p.descripcion_larga,p.galeria,p.extra,p.beneficio,p.centavos,p.stock,p.imagen,p.activo).lastInsertRowid)
    res.status(201).json({ producto: mostrarProducto(db.prepare(`${productoSql} WHERE p.id=?`).get(id)) })
  } catch (e) { res.status(400).json({ mensaje: e.message }) }
})
app.put('/api/admin/productos/:id', sesion, admin, (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || !db.prepare('SELECT id FROM productos WHERE id=?').get(id)) return res.status(404).json({ mensaje: 'Producto no encontrado.' })
  try {
    const p = validarProducto(req.body)
    db.prepare('UPDATE productos SET categoria_id=?,nombre=?,marca=?,detalle=?,descripcion_larga=?,galeria=?,extra=?,beneficio=?,precio_centavos=?,stock=?,imagen=?,activo=? WHERE id=?').run(p.categoria_id,p.nombre,p.marca,p.detalle,p.descripcion_larga,p.galeria,p.extra,p.beneficio,p.centavos,p.stock,p.imagen,p.activo,id)
    res.json({ producto: mostrarProducto(db.prepare(`${productoSql} WHERE p.id=?`).get(id)) })
  } catch (e) { res.status(400).json({ mensaje: e.message }) }
})
// Al subir una foto de un producto existente, se guarda la imagen de inmediato.
// Evita que el administrador tenga que volver a pulsar «Guardar cambios».
app.patch('/api/admin/productos/:id/imagen', sesion, admin, (req, res) => {
  const id = Number(req.params.id)
  const imagen = limpiar(req.body?.imagen, 400)
  const nombreArchivo = imagen.match(/^\/api\/imagenes\/([a-f0-9]{32}\.(?:png|jpg|webp))$/)?.[1]
  if (!Number.isSafeInteger(id) || id < 1 || !db.prepare('SELECT id FROM productos WHERE id=?').get(id)) {
    return res.status(404).json({ mensaje: 'Producto no encontrado.' })
  }
  if (!nombreArchivo || !existsSync(path.join(carpetaImagenes, nombreArchivo))) {
    return res.status(400).json({ mensaje: 'La imagen subida no existe.' })
  }
  db.prepare('UPDATE productos SET imagen=? WHERE id=?').run(imagen, id)
  res.json({ producto: mostrarProducto(db.prepare(`${productoSql} WHERE p.id=?`).get(id)) })
})
app.delete('/api/admin/productos/:id', sesion, admin, (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id)) return res.status(400).json({ mensaje: 'ID incorrecto.' })
  const result = db.prepare('UPDATE productos SET activo=0 WHERE id=?').run(id)
  if (!result.changes) return res.status(404).json({ mensaje: 'Producto no encontrado.' })
  res.json({ ok: true, mensaje: 'Producto ocultado; se conservó el historial de pedidos.' })
})
app.get('/api/admin/usuarios', sesion, admin, (req, res) => res.json({ usuarios: db.prepare('SELECT id,nombre,correo,rol,creado_en FROM usuarios ORDER BY id DESC').all() }))
app.get('/api/admin/pedidos', sesion, admin, (req, res) => res.json({ pedidos: db.prepare('SELECT p.*,u.nombre AS cliente,u.correo FROM pedidos p JOIN usuarios u ON u.id=p.usuario_id ORDER BY p.id DESC').all().map(mostrarPedido) }))
app.patch('/api/admin/pedidos/:id', sesion, admin, (req, res) => {
  const estados = ['pendiente','pagado','enviado','entregado','cancelado']
  if (!estados.includes(req.body?.estado)) return res.status(400).json({ mensaje: 'Estado inválido.' })
  const result = db.prepare('UPDATE pedidos SET estado=? WHERE id=?').run(req.body.estado, Number(req.params.id))
  res.status(result.changes ? 200 : 404).json(result.changes ? { ok: true } : { mensaje: 'Pedido no encontrado.' })
})
app.get('/api/admin/dudas', sesion, admin, (req, res) => res.json({ dudas: db.prepare('SELECT * FROM dudas ORDER BY id DESC').all() }))
app.patch('/api/admin/dudas/:id', sesion, admin, limitar, async (req, res) => {
  const id = Number(req.params.id)
  const respuesta = limpiar(req.body?.respuesta, 3000)
  if (!respuesta) return res.status(400).json({ mensaje: 'Escribe una respuesta.' })
  const duda = db.prepare('SELECT * FROM dudas WHERE id=?').get(id)
  if (!duda) return res.status(404).json({ mensaje: 'Consulta no encontrada.' })
  try {
    await enviarCorreo({ para: duda.correo, asunto: 'Respuesta a tu consulta — PSS México',
      contenido: `Hola, ${duda.nombre}.\n\nTu consulta:\n${duda.mensaje}\n\nNuestra respuesta:\n${respuesta}` })
    db.prepare("UPDATE dudas SET respuesta=?, estado='respondida' WHERE id=?").run(respuesta, id)
    res.json({ ok: true, mensaje: 'La respuesta se envió correctamente.' })
  } catch (e) { res.status(503).json({ mensaje: e.message }) }
})
app.get('/api/admin/cotizaciones', sesion, admin, (req, res) => res.json({ cotizaciones: db.prepare('SELECT * FROM cotizaciones ORDER BY id DESC').all() }))
app.patch('/api/admin/cotizaciones/:id', sesion, admin, limitar, async (req, res) => {
  const id = Number(req.params.id)
  const cotizacion = db.prepare('SELECT * FROM cotizaciones WHERE id=?').get(id)
  if (!cotizacion) return res.status(404).json({ mensaje: 'Cotización no encontrada.' })
  const respuesta = limpiar(req.body?.respuesta, 3000)
  const estado = limpiar(req.body?.estado, 20)
  const centavos = req.body?.precio === '' || req.body?.precio == null ? null : precioCentavos(req.body.precio)
  if (!respuesta || centavos === null && req.body?.precio !== '' && req.body?.precio != null || !['enviada','aceptada','rechazada'].includes(estado)) {
    return res.status(400).json({ mensaje: 'Escribe una respuesta, un estado válido y revisa el precio.' })
  }
  const precioTexto = centavos === null ? 'A confirmar' : (centavos / 100).toLocaleString('es-MX',{style:'currency',currency:'MXN'})
  try {
    await enviarCorreo({ para: cotizacion.correo, asunto: 'Tu cotización de PSS México',
      contenido: `Hola, ${cotizacion.nombre}.\n\nSolicitud:\n${cotizacion.descripcion}\n\nPropuesta:\n${respuesta}\n\nImporte estimado: ${precioTexto}\nEstado: ${estado}` })
    db.prepare("UPDATE cotizaciones SET respuesta=?,precio_propuesto_centavos=?,estado=?,respondida_en=datetime('now') WHERE id=?")
      .run(respuesta, centavos, estado, id)
    res.json({ ok: true, mensaje: 'La cotización se envió correctamente.' })
  } catch (e) { res.status(503).json({ mensaje: e.message }) }
})

// Sólo el admin puede descargar una COPIA CONSISTENTE; no se copia el archivo WAL en caliente.
app.get('/api/admin/exportar/sqlite', sesion, admin, async (req, res) => {
  const destino = path.join(tmpdir(), `pss-copia-${randomBytes(12).toString('hex')}.sqlite`)
  try {
    await backup(db, destino)
    res.download(destino, 'pss-base-de-datos.sqlite', error => {
      unlink(destino, () => {})
      if (error && !res.headersSent) res.status(500).json({ mensaje: 'No fue posible descargar la copia.' })
    })
  } catch (error) {
    unlink(destino, () => {})
    console.error(error)
    res.status(500).json({ mensaje: 'No se pudo exportar la base de datos.' })
  }
})
const exportables = {
  productos: 'SELECT p.id,p.nombre,c.nombre AS categoria,p.marca,p.detalle,p.precio_centavos / 100.0 AS precio,p.stock,p.activo FROM productos p JOIN categorias c ON c.id=p.categoria_id',
  usuarios: 'SELECT id,nombre,correo,rol,creado_en FROM usuarios',
  pedidos: 'SELECT id,usuario_id,fecha,estado,metodo_pago,direccion_envio,total_centavos / 100.0 AS total FROM pedidos',
  detalle_pedido: 'SELECT id,pedido_id,producto_id,cantidad,precio_unitario_centavos / 100.0 AS precio_unitario FROM detalle_pedido',
  dudas: 'SELECT * FROM dudas',
  cotizaciones: 'SELECT * FROM cotizaciones',
}
app.get('/api/admin/exportar/csv/:tabla', sesion, admin, (req, res) => {
  const consulta = exportables[req.params.tabla]
  if (!consulta) return res.status(404).json({ mensaje: 'Tabla no disponible.' })
  const datos = db.prepare(consulta).all()
  const columnas = datos.length ? Object.keys(datos[0]) : db.prepare(consulta).columns().map(c => c.name)
  const celda = v => {
    const s = String(v ?? '')
    // Evita interpretar contenido libre como fórmulas al abrir CSV en Excel.
    const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
    return `"${seguro.replaceAll('"', '""')}"`
  }
  const csv = '\uFEFF' + [columnas.map(celda).join(','), ...datos.map(d => columnas.map(k => celda(d[k])).join(','))].join('\r\n')
  res.set('Content-Type', 'text/csv; charset=utf-8')
  res.set('Content-Disposition', `attachment; filename="pss-${req.params.tabla}.csv"`)
  res.send(csv)
})

// En producción, el mismo servidor puede mostrar la web compilada.
if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
  app.use(express.static(dist))
  app.get('/{*ruta}', (req, res) => res.sendFile(path.join(dist, 'index.html')))
}
const puerto = Number(process.env.PORT || process.env.PUERTO || 3000)
app.listen(puerto, '0.0.0.0', () => console.log(`Servidor PSS escuchando en puerto ${puerto}`))
