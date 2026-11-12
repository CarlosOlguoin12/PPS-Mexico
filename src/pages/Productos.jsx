import { useEffect, useState } from 'react'
import { api, pesos } from '../api'
import FotoProducto from '../components/FotoProducto'
import EsqueletoProductos from '../components/EsqueletoProductos'

function DetalleProducto({ producto, cerrar, agregar }) {
  const imagenes = [...new Set([producto.imagen, ...(producto.galeria || [])].filter(Boolean))]
  const [imagen, setImagen] = useState(0)
  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const cerrarEsc = e => { if (e.key === 'Escape') cerrar() }
    window.addEventListener('keydown', cerrarEsc)
    return () => { document.body.style.overflow = anterior; window.removeEventListener('keydown', cerrarEsc) }
  }, [cerrar])
  return <div className="producto-modal-fondo" onMouseDown={e => { if (e.target === e.currentTarget) cerrar() }}>
    <section className="producto-modal" role="dialog" aria-modal="true" aria-label={`Detalles de ${producto.nombre}`}>
      <button className="producto-modal-cerrar" aria-label="Cerrar detalles" type="button" onClick={cerrar}>×</button>
      <div className="producto-modal-galeria">
        <FotoProducto key={imagenes[imagen] || producto.id} className="producto-modal-foto" src={imagenes[imagen]} nombre={producto.nombre} />
        {imagenes.length > 1 && <div className="producto-miniaturas">{imagenes.map((src, i) => (
          <button key={`${src}-${i}`} type="button" aria-label={`Ver imagen ${i + 1}`} aria-pressed={imagen === i} className={imagen === i ? 'activo' : ''} onClick={() => setImagen(i)}><img src={src} alt={`Vista ${i + 1} de ${producto.nombre}`} /></button>
        ))}</div>}
      </div>
      <div className="producto-modal-info">
        <span className="producto-modal-categoria">{producto.categoria} {producto.marca ? `· ${producto.marca}` : ''}</span>
        <h2>{producto.nombre}</h2>
        <p className="producto-modal-precio">{pesos(producto.precio)}</p>
        <p>{producto.detalle}</p>
        {producto.descripcion_larga && <div className="producto-descripcion-larga">{producto.descripcion_larga}</div>}
        {(producto.extra || producto.beneficio) && <div className="producto-atributos">{producto.extra && <p><strong>Características:</strong> {producto.extra}</p>}{producto.beneficio && <p><strong>Ventajas:</strong> {producto.beneficio}</p>}</div>}
        <p className="stock-info">{producto.stock > 0 ? `${producto.stock} disponibles` : 'Agotado'}</p>
        <button type="button" className="btn btn-principal" disabled={!producto.stock} onClick={() => { agregar(producto); cerrar() }}>{producto.stock ? 'Agregar al carrito' : 'Sin existencias'}</button>
      </div>
    </section>
  </div>
}

function Productos({ agregar, catalogoVersion }) {
  const [productos, setProductos] = useState([])
  const [aviso, setAviso] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [versionImagen] = useState(() => Date.now())

  useEffect(() => {
    let activo = true
    api('/productos', { cache: 'no-store' })
      .then(datos => { if (activo) setProductos(datos.productos) })
      .catch(e => { if (activo) setError(e.message) })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [catalogoVersion])

  function comprar(producto) {
    if (producto.stock === 0) return
    agregar(producto)
    setAviso(`✓ ${producto.nombre} se agregó al carrito`)
  }

  return (
    <section className="seccion-interna"><div className="contenedor">
      <h1 className="titulo-pagina">Productos</h1>
      <p className="subtitulo-pagina">Sistemas de seguridad para tu hogar o negocio.</p>
      {aviso && <p className="aviso-agregado">{aviso}</p>}
      {error && <p className="mensaje-error" role="alert">{error}</p>}
      {cargando ? <EsqueletoProductos /> : !error && productos.length === 0 ? (
        <p>Por ahora no hay productos disponibles.</p>
      ) : (
        <div className="productos-grid">
          {productos.map(p => (
            <article className="card-producto" key={p.id}>
              <button type="button" className="producto-foto-boton" onClick={() => setSeleccionado(p)} aria-label={`Ver información de ${p.nombre}`}>
                <FotoProducto key={`${p.id}-${p.imagen}-${catalogoVersion}`} src={p.imagen} nombre={p.nombre} version={`${versionImagen}-${catalogoVersion}`} />
              </button>
              <div className="card-cuerpo">
                <div className="card-encabezado"><div><h3><button type="button" className="producto-titulo-boton" onClick={() => setSeleccionado(p)}>{p.nombre}</button></h3><p className="card-sub">{p.marca} · {p.categoria}</p></div></div>
                <p className="card-detalle">{p.detalle}</p>
                <button type="button" className="producto-ver-detalles" onClick={() => setSeleccionado(p)}>Ver descripción e imágenes</button>
                <hr className="card-linea" />
                <div className="card-pie"><div>
                  <div className="card-precio">{pesos(p.precio)}</div>
                  <p className="card-extra">{p.extra}</p>
                  <p className="card-ok">✓ {p.beneficio}</p>
                  <p className="stock-info">{p.stock > 0 ? `Disponibles: ${p.stock}` : 'Agotado'}</p>
                </div><button className="btn-negro" disabled={p.stock === 0} onClick={() => comprar(p)}>{p.stock === 0 ? 'Agotado' : 'Agregar'}</button></div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>{seleccionado && <DetalleProducto key={seleccionado.id} producto={seleccionado} agregar={comprar} cerrar={() => setSeleccionado(null)} />}</section>
  )
}
export default Productos
