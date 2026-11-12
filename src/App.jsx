import { useEffect, useRef, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import logo from './assets/logo.png'
import { api } from './api'
import Inicio from './pages/Inicio'
import Productos from './pages/Productos'
import Carrito from './pages/Carrito'
import Dudas from './pages/Dudas'
import Admin from './pages/Admin'
import MisPedidos from './pages/MisPedidos'
import Cotizacion from './pages/Cotizacion'
import EsqueletoWeb from './components/EsqueletoWeb'

const datosContacto = [
  { titulo: 'Celular', texto: '810 050 4910' },
  { titulo: 'Correo', texto: 'ventas@pssmx.com' },
  { titulo: 'Dirección', texto: 'Consultar por correo' },
  { titulo: 'Horario', texto: 'Lunes a viernes, 9:00 a 18:00' },
]

function Ventana({ modo, cerrar, cambiarModo, alEntrar }) {
  const esRegistro = modo === 'registro'
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [mostrarClave, setMostrarClave] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pendiente, setPendiente] = useState('')
  const [codigo, setCodigo] = useState('')
  const [mensaje, setMensaje] = useState('')

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    setError('')
    setMensaje('')
    try {
      if (pendiente) {
        const datos = await api('/verificar-correo', { method: 'POST', body: JSON.stringify({ correo: pendiente, codigo }) })
        alEntrar(datos.usuario)
        cerrar()
        return
      }
      const datos = await api(esRegistro ? '/registro' : '/login', {
        method: 'POST', body: JSON.stringify({ nombre, correo, clave }),
      })
      if (datos.verificacionPendiente) {
        setPendiente(datos.correo)
        setClave('')
        setMensaje(datos.mensaje)
      } else {
        alEntrar(datos.usuario)
        cerrar()
      }
    } catch (e) {
      if (!esRegistro && e.message.includes('correo aún no está verificado') && correo.includes('@')) {
        setPendiente(correo.trim().toLowerCase())
      }
      setError(e.message)
    } finally { setEnviando(false) }
  }

  async function reenviar() {
    setError(''); setMensaje(''); setEnviando(true)
    try {
      const r = await api('/reenviar-codigo', { method: 'POST', body: JSON.stringify({ correo: pendiente }) })
      setMensaje(r.mensaje)
    } catch (e) { setError(e.message) } finally { setEnviando(false) }
  }

  return (
    <div className="fondo-ventana" onClick={cerrar}>
      <div className="ventana" role="dialog" aria-modal="true" aria-label={pendiente ? 'Verificar correo' : esRegistro ? 'Crear cuenta' : 'Iniciar sesión'} onClick={e => e.stopPropagation()}>
        <button type="button" className="cerrar" onClick={cerrar} aria-label="Cerrar">×</button>
        <h2>{pendiente ? 'Verificar correo' : esRegistro ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
        {pendiente ? (
          <form onSubmit={enviar}>
            <p>Escribe el código que enviamos a <strong>{pendiente}</strong>.</p>
            <input aria-label="Código de verificación" placeholder="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" maxLength="6" required pattern="[0-9]{6}" value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))} />
            <button disabled={enviando} type="submit" className="btn btn-principal">{enviando ? 'Verificando...' : 'Confirmar correo'}</button>
            <button disabled={enviando} type="button" className="enlace-cambio" onClick={reenviar}>Reenviar código</button>
          </form>
        ) : (
          <form onSubmit={enviar}>
            {esRegistro && <input placeholder="Nombre" aria-label="Nombre" autoComplete="name" required maxLength="150" value={nombre} onChange={e => setNombre(e.target.value)} />}
            <input type={esRegistro ? 'email' : 'text'} placeholder={esRegistro ? 'Correo' : 'Correo o usuario'} aria-label={esRegistro ? 'Correo' : 'Correo o usuario'} autoComplete="username" required value={correo} onChange={e => setCorreo(e.target.value)} />
            <input type={mostrarClave ? 'text' : 'password'} placeholder="Contraseña" aria-label="Contraseña" autoComplete={esRegistro ? 'new-password' : 'current-password'} minLength={esRegistro ? 8 : undefined} required value={clave} onChange={e => setClave(e.target.value)} />
            <label className="mostrar-clave"><input type="checkbox" checked={mostrarClave} onChange={e => setMostrarClave(e.target.checked)} />Mostrar contraseña</label>
            <button disabled={enviando} type="submit" className="btn btn-principal">{enviando ? 'Enviando...' : esRegistro ? 'Crear cuenta' : 'Entrar'}</button>
          </form>
        )}
        {mensaje && <p className="exito" role="status">{mensaje}</p>}
        {error && <p className="mensaje-error" role="alert">{error}</p>}
        {!pendiente && <p>{esRegistro ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
          <button type="button" className="enlace-cambio" onClick={cambiarModo}>{esRegistro ? 'Inicia sesión' : 'Créala aquí'}</button>
        </p>}
      </div>
    </div>
  )
}

function App() {
  const pieRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [ventana, setVentana] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [sesionLista, setSesionLista] = useState(false)
  const [carrito, setCarrito] = useState(() => {
    try { const datos = JSON.parse(localStorage.getItem('pss_carrito')); return Array.isArray(datos) ? datos : [] } catch { return [] }
  })
  const [catalogoVersion, setCatalogoVersion] = useState(0)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    api('/yo').then(datos => setUsuario(datos.usuario)).catch(() => {}).finally(() => setSesionLista(true))
  }, [])
  useEffect(() => { localStorage.setItem('pss_carrito', JSON.stringify(carrito)) }, [carrito])

  function agregar(producto) {
    setCarrito(actual => {
      const encontrado = actual.find(p => p.id === producto.id)
      if (encontrado) return actual.map(p => p.id === producto.id ? { ...p, cantidad: Math.min(p.cantidad + 1, 100) } : p)
      return [...actual, { id: producto.id, nombre: producto.nombre, precio: producto.precio, imagen: producto.imagen, cantidad: 1 }]
    })
  }
  function cambiarCantidad(id, cambio) {
    setCarrito(actual => actual.map(p => p.id === id ? { ...p, cantidad: Math.max(0, Math.min(100, p.cantidad + cambio)) } : p).filter(p => p.cantidad > 0))
  }
  function quitar(id) { setCarrito(actual => actual.filter(p => p.id !== id)) }
  const cantidadTotal = carrito.reduce((suma, p) => suma + p.cantidad, 0)
  async function salir() {
    try { await api('/salir', { method: 'POST' }) } finally { setUsuario(null); navigate('/') }
  }

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  useEffect(() => {
    const tecla = e => { if (e.key === 'Escape') setVentana(null) }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])
  useEffect(() => {
    document.body.style.overflow = ventana ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [ventana])
  useEffect(() => {
    if (!pieRef.current) return
    const observador = new IntersectionObserver(([entrada]) => { if (entrada.isIntersecting) { setVisible(true); observador.disconnect() } }, { threshold: 0.2 })
    observador.observe(pieRef.current)
    return () => observador.disconnect()
  }, [sesionLista])

  if (!sesionLista) return <EsqueletoWeb pathname={pathname} />

  return <div className="pagina">
    <header className="navbar">
      <Link to="/"><img src={logo} alt="Logo de la empresa" className="logo-img" /></Link>
      <nav className="menu">
        <Link to="/productos" className="enlace-nav">Productos</Link>
        <Link to="/dudas" className="enlace-nav">Dudas</Link>
        <Link to="/cotizacion" className="enlace-nav">Cotizar</Link>
        <Link to="/carrito" className="enlace-nav">Carrito ({cantidadTotal})</Link>
        {usuario ? <>
          <Link to="/mis-pedidos" className="enlace-nav">Mis pedidos</Link>
          {usuario.rol === 'admin' && <Link to="/admin" className="enlace-nav">Administración</Link>}
          <span className="usuario-nav">Hola, {usuario.nombre}</span>
          <button className="enlace-nav" onClick={salir}>Salir</button>
        </> : <>
          <button className="btn btn-principal" onClick={() => setVentana('registro')}>Crear cuenta</button>
          <button className="enlace-nav" onClick={() => setVentana('entrar')}>Entrar</button>
        </>}
      </nav>
    </header>

    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/productos" element={<Productos agregar={agregar} catalogoVersion={catalogoVersion} />} />
      <Route path="/carrito" element={<Carrito carrito={carrito} cambiarCantidad={cambiarCantidad} quitar={quitar} usuario={usuario} pedirLogin={() => setVentana('entrar')} alComprar={() => { setCarrito([]); setCatalogoVersion(n => n + 1) }} />} />
      <Route path="/dudas" element={<Dudas />} />
      <Route path="/cotizacion" element={<Cotizacion />} />
      <Route path="/mis-pedidos" element={<MisPedidos usuario={usuario} sesionLista={sesionLista} pedirLogin={() => setVentana('entrar')} />} />
      <Route path="/admin" element={<Admin usuario={usuario} sesionLista={sesionLista} actualizarCatalogo={() => setCatalogoVersion(n => n + 1)} />} />
    </Routes>

    <footer id="contacto" ref={pieRef} className={`pie-web ${visible ? 'visible' : ''}`}>
      <div className="pie-contenido">
        <h2 className="pie-titulo">Permítenos contactarte</h2>
        <div className="pie-datos">{datosContacto.map((dato, i) => <div className="dato" key={dato.titulo} style={{ '--retraso': `${0.2 + i * 0.15}s` }}><h3>{dato.titulo}</h3><p>{dato.texto}</p></div>)}</div>
        <a href="mailto:ventas@pssmx.com" className="btn btn-principal pie-boton" style={{ '--retraso': '0.9s' }}>Escríbenos</a>
      </div>
      <div className="pie-final">© 2026 PSS México. Todos los derechos reservados.</div>
    </footer>
    {ventana && <Ventana key={ventana} modo={ventana} cerrar={() => setVentana(null)} cambiarModo={() => setVentana(ventana === 'registro' ? 'entrar' : 'registro')} alEntrar={setUsuario} />}
  </div>
}
export default App
