import { useCallback, useEffect, useState } from 'react'
import { api, pesos } from '../api'

const VACIO = { nombre: '', categoria_id: '1', marca: '', detalle: '', descripcion_larga: '', galeria: '', extra: '', beneficio: '', precio: '', stock: '0', imagen: '', activo: true }
const secciones = ['productos', 'pedidos', 'dudas', 'cotizaciones', 'usuarios']
const nombres = { productos: 'Productos', pedidos: 'Pedidos', dudas: 'Dudas', cotizaciones: 'Cotizaciones', usuarios: 'Usuarios' }
const csv = ['productos', 'pedidos', 'detalle_pedido', 'dudas', 'cotizaciones', 'usuarios']

function VistaPreviaImagen({ src }) {
  const [fallo, setFallo] = useState(false)
  return (
    <div className="admin-preview">
      {!fallo ? (
        <img src={src} alt="Vista previa del producto" onError={() => setFallo(true)} />
      ) : (
        <p className="mensaje-error">No se encuentra esta imagen. Revisa la ruta y la extensión (.png, .jpg o .webp).</p>
      )}
    </div>
  )
}

function Admin({ usuario, sesionLista, actualizarCatalogo }) {
  const [seccion, setSeccion] = useState('productos')
  const [datos, setDatos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [resumen, setResumen] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [editando, setEditando] = useState(null)
  const [respuesta, setRespuesta] = useState({})
  const [precios, setPrecios] = useState({})
  const [estadosCotizacion, setEstadosCotizacion] = useState({})
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [subiendoImagen, setSubiendoImagen] = useState(false)

  const recargar = useCallback(async (nombre = seccion) => {
    try {
      const [listado, estadisticas] = await Promise.all([api(`/admin/${nombre}`), api('/admin/resumen')])
      setDatos(listado[nombre] || [])
      setResumen(estadisticas)
    } catch (e) { setError(e.message) }
  }, [seccion])

  useEffect(() => {
    if (usuario?.rol !== 'admin') return
    let activo = true
    api('/categorias').then(d => { if (activo) setCategorias(d.categorias) }).catch(() => {})
    return () => { activo = false }
  }, [usuario])
  useEffect(() => {
    if (usuario?.rol !== 'admin') return
    let activo = true
    Promise.all([api(`/admin/${seccion}`), api('/admin/resumen')]).then(([listado, estadisticas]) => {
      if (activo) { setDatos(listado[seccion] || []); setResumen(estadisticas) }
    }).catch(e => { if (activo) setError(e.message) })
    return () => { activo = false }
  }, [usuario, seccion])

  function editar(p) {
    setForm({ nombre: p.nombre, categoria_id: String(p.categoria_id), marca: p.marca, detalle: p.detalle, descripcion_larga: p.descripcion_larga || '', galeria: (p.galeria || []).join('\n'), extra: p.extra, beneficio: p.beneficio, precio: String(p.precio), stock: String(p.stock), imagen: p.imagen, activo: p.activo })
    setEditando(p.id)
    setMensaje('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function limpiar() { setEditando(null); setForm(VACIO) }
  async function guardarProducto(e) {
    e.preventDefault(); setGuardando(true); setMensaje(''); setError('')
    try {
      const nuevo = { ...form, galeria: form.galeria.split(/\r?\n/).map(r => r.trim()).filter(Boolean), categoria_id: Number(form.categoria_id), precio: Number(form.precio), stock: Number(form.stock) }
      await api(editando ? `/admin/productos/${editando}` : '/admin/productos', { method: editando ? 'PUT' : 'POST', body: JSON.stringify(nuevo) })
      setMensaje('La información se guardó correctamente.')
      limpiar(); await recargar(); actualizarCatalogo()
    } catch (e) { setError(e.message) } finally { setGuardando(false) }
  }
  async function subirImagen(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    e.target.value = ''
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivo.type) || archivo.size > 2 * 1024 * 1024) {
      setError('La imagen debe ser JPG, PNG o WebP y pesar máximo 2 MB.'); return
    }
    setSubiendoImagen(true); setError(''); setMensaje('')
    try {
      const datos = await api('/admin/subir-imagen', { method: 'POST', body: archivo, headers: { 'Content-Type': archivo.type } })
      setForm(actual => ({ ...actual, imagen: datos.imagen }))
      if (editando !== null) {
        // Para un producto existente, se aplica y publica sin otro clic.
        await api(`/admin/productos/${editando}/imagen`, {
          method: 'PATCH',
          body: JSON.stringify({ imagen: datos.imagen }),
        })
        await recargar('productos')
        actualizarCatalogo()
        setMensaje('La imagen se guardó correctamente.')
      } else {
        setMensaje('Imagen lista. Guarda el producto para finalizar.')
      }
    } catch (error) { setError(error.message) } finally { setSubiendoImagen(false) }
  }
  async function ocultar(p) {
    if (!window.confirm(`¿Ocultar "${p.nombre}" del catálogo? Se conservarán sus pedidos anteriores.`)) return
    try {
      await api(`/admin/productos/${p.id}`, { method: 'DELETE' })
      setMensaje('La información se guardó correctamente.'); await recargar(); actualizarCatalogo()
    } catch (e) { setError(e.message) }
  }
  async function actualizarPedido(id, estado) {
    try { await api(`/admin/pedidos/${id}`, { method: 'PATCH', body: JSON.stringify({ estado }) }); setMensaje('La información se guardó correctamente.'); await recargar() }
    catch (e) { setError(e.message) }
  }
  async function responderDuda(id) {
    const texto = respuesta[id] ?? datos.find(d => d.id === id)?.respuesta ?? ''
    try {
      const r = await api(`/admin/dudas/${id}`, { method: 'PATCH', body: JSON.stringify({ respuesta: texto }) })
      setMensaje(r.mensaje); setError(''); await recargar()
    } catch (e) { setError(e.message) }
  }
  async function responderCotizacion(c) {
    const texto = respuesta[`cot-${c.id}`] ?? c.respuesta ?? ''
    const precio = precios[c.id] ?? (c.precio_propuesto_centavos == null ? '' : String(c.precio_propuesto_centavos / 100))
    const estado = estadosCotizacion[c.id] ?? 'enviada'
    try {
      const r = await api(`/admin/cotizaciones/${c.id}`, { method: 'PATCH', body: JSON.stringify({ respuesta: texto, precio, estado }) })
      setMensaje(r.mensaje); setError(''); await recargar()
    } catch (e) { setError(e.message) }
  }

  if (!sesionLista) return <section className="seccion-interna"><div className="contenedor">Verificando sesión...</div></section>
  if (usuario?.rol !== 'admin') return <section className="seccion-interna"><div className="contenedor"><h1>Acceso restringido</h1><p>Esta sección está disponible sólo para cuentas administradoras.</p></div></section>

  return <section className="seccion-interna"><div className="contenedor admin-page">
    <h1 className="titulo-pagina">Panel de administración</h1>
    <p className="subtitulo-pagina">Los cambios se guardan en SQLite y se reflejan en el catálogo.</p>
    {resumen && <div className="admin-resumen">{Object.entries(resumen).map(([clave, valor]) => <div key={clave}><strong>{valor}</strong><span>{nombres[clave]}</span></div>)}</div>}
    <div className="admin-export"><h2>Exportar base de datos</h2>
      <p>Descarga una copia completa de SQLite para abrirla con DB Browser for SQLite. Contiene información de usuarios y pedidos: compártela solamente con el profesor.</p>
      <a className="btn btn-principal" href="/api/admin/exportar/sqlite">Descargar .sqlite</a>
      <div className="admin-csv">{csv.map(t => <a key={t} href={`/api/admin/exportar/csv/${t}`}>CSV: {t}</a>)}</div>
    </div>
    <div className="admin-tabs">{secciones.map(s => <button key={s} className={seccion === s ? 'activo' : ''} onClick={() => { setSeccion(s); setMensaje(''); limpiar() }}>{nombres[s]}</button>)}</div>
    {mensaje && <p className="exito" role="status">{mensaje}</p>}
    {error && <p className="mensaje-error" role="alert">{error}</p>}

    {seccion === 'productos' && <>
      <form className="admin-form" onSubmit={guardarProducto}>
        <h2>{editando ? `Editar producto #${editando}` : 'Agregar producto'}</h2>
        <div className="admin-fields">
          <label>Nombre* <input required maxLength={150} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label>
          <label>Categoría* <select value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value })}>{categorias.map(c => <option value={c.id} key={c.id}>{c.nombre}</option>)}</select></label>
          <label>Precio (MXN)* <input type="number" required min="0" max="10000000" step="0.01" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} /></label>
          <label>Stock* <input type="number" required min="0" max="100000" step="1" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></label>
          <label>Marca <input value={form.marca} maxLength={100} onChange={e => setForm({ ...form, marca: e.target.value })} /></label>
          <label>Descripción breve <input value={form.detalle} maxLength={500} onChange={e => setForm({ ...form, detalle: e.target.value })} /></label>
          <label className="campo-ancho">Descripción detallada <textarea rows="5" maxLength={5000} value={form.descripcion_larga} onChange={e => setForm({ ...form, descripcion_larga: e.target.value })} /></label>
          <label>Extra <input value={form.extra} maxLength={150} onChange={e => setForm({ ...form, extra: e.target.value })} /></label>
          <label>Beneficio <input value={form.beneficio} maxLength={150} onChange={e => setForm({ ...form, beneficio: e.target.value })} /></label>
          <label className="campo-ancho">Imagen del producto (ruta local o URL)
            <input placeholder="/productos/mi-foto.png" value={form.imagen} maxLength={400} onChange={e => setForm({ ...form, imagen: e.target.value })} />
          </label>
          <label className="campo-ancho">Más fotografías (una ruta por línea)<textarea rows="3" placeholder="/productos/camara-lateral.png" value={form.galeria} onChange={e => setForm({ ...form, galeria: e.target.value })} /></label>
         
          <label className="campo-ancho admin-subir-imagen">Subir una fotografía desde tu computadora (JPG, PNG o WebP; máximo 2 MB)
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={subiendoImagen} onChange={subirImagen} />
            {subiendoImagen && <small>Subiendo fotografía...</small>}
          </label>
          {form.imagen && <VistaPreviaImagen key={form.imagen} src={form.imagen} />}
          <label className="admin-check"><input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} /> Visible en la tienda</label>
        </div>
        <div className="admin-botones"><button type="submit" disabled={guardando} className="btn btn-principal">{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar a la tienda'}</button>{editando && <button type="button" className="btn" onClick={limpiar}>Cancelar edición</button>}</div>
      </form>
      <div className="admin-tabla"><table><thead><tr><th>ID</th><th>Foto</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Visible</th><th>Acciones</th></tr></thead><tbody>{datos.map(p => <tr key={p.id}><td>{p.id}</td><td><img className="admin-miniatura" src={p.imagen || ''} alt="" onError={e => { e.currentTarget.style.opacity = '0.2' }} /></td><td>{p.nombre}</td><td>{p.categoria}</td><td>{pesos(p.precio)}</td><td>{p.stock}</td><td>{p.activo ? 'Sí' : 'No'}</td><td><button onClick={() => editar(p)}>Editar</button> <button disabled={!p.activo} onClick={() => ocultar(p)}>Ocultar</button></td></tr>)}</tbody></table></div>
    </>}
    {seccion === 'pedidos' && <div className="admin-tabla"><table><thead><tr><th>ID</th><th>Cliente</th><th>Fecha</th><th>Pago</th><th>Total</th><th>Estado</th></tr></thead><tbody>{datos.map(p => <tr key={p.id}><td>#{p.id}</td><td>{p.cliente} ({p.correo})</td><td>{p.fecha}</td><td>{p.metodo_pago}</td><td>{pesos(p.total)}</td><td><select aria-label={`Estado pedido ${p.id}`} value={p.estado} onChange={e => actualizarPedido(p.id, e.target.value)}>{['pendiente','pagado','enviado','entregado','cancelado'].map(s => <option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table></div>}
    {seccion === 'dudas' && <div className="admin-tarjetas">{datos.map(d => <article key={d.id} className="panel-simple">
      <h3>Consulta de {d.nombre}</h3><p>{d.correo} · {d.creado_en}</p><p>{d.mensaje}</p>
      <label>Respuesta por correo<textarea rows="4" value={respuesta[d.id] ?? d.respuesta} onChange={e => setRespuesta({ ...respuesta, [d.id]: e.target.value })} /></label>
      <button className="btn btn-principal" onClick={() => responderDuda(d.id)}>Enviar respuesta</button>
    </article>)}{!datos.length && <p>No hay consultas recibidas.</p>}</div>}
    {seccion === 'cotizaciones' && <div className="admin-tarjetas">{datos.map(c => <article key={c.id} className="panel-simple">
      <h3>Cotización de {c.nombre}</h3><p>{c.correo} · {c.telefono}</p><p><strong>Solicitud:</strong> {c.descripcion}</p>
      <label>Respuesta al cliente<textarea rows="5" value={respuesta[`cot-${c.id}`] ?? c.respuesta ?? ''} onChange={e => setRespuesta({ ...respuesta, [`cot-${c.id}`]: e.target.value })} /></label>
      <label>Precio propuesto (MXN)<input type="number" min="0" step="0.01" placeholder="Opcional" value={precios[c.id] ?? (c.precio_propuesto_centavos == null ? '' : String(c.precio_propuesto_centavos / 100))} onChange={e => setPrecios({ ...precios, [c.id]: e.target.value })} /></label>
      <label>Estado<select value={estadosCotizacion[c.id] ?? 'enviada'} onChange={e => setEstadosCotizacion({ ...estadosCotizacion, [c.id]: e.target.value })}><option value="enviada">Enviada</option><option value="aceptada">Aceptada</option><option value="rechazada">Rechazada</option></select></label>
      <button className="btn btn-principal" onClick={() => responderCotizacion(c)}>Enviar cotización</button>
    </article>)}{!datos.length && <p>No hay cotizaciones recibidas.</p>}</div>}
    {seccion === 'usuarios' && <div className="admin-tabla"><table><thead><tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Registro</th></tr></thead><tbody>{datos.map(u => <tr key={u.id}><td>{u.id}</td><td>{u.nombre}</td><td>{u.correo}</td><td>{u.rol}</td><td>{u.creado_en}</td></tr>)}</tbody></table></div>}
  </div></section>
}
export default Admin
