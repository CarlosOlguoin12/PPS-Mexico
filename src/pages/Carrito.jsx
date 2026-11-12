import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, pesos } from '../api'
import FotoProducto from '../components/FotoProducto'

import { TARJETA_VACIA, digitos, tipoTarjeta, agruparNumero, formatearFecha, comprobarTarjeta } from '../tarjetas'

function FormularioTarjeta({ tarjeta, onChange }) {
  const cambiar = (campo, valor) => onChange({ ...tarjeta, [campo]: valor })
  const ultimos = digitos(tarjeta.numero).slice(-4)
  const visual = ultimos ? `•••• •••• •••• ${ultimos}` : '•••• •••• •••• ••••'
  return <div className="checkout-tarjeta">
    <div className="tarjeta-visual" aria-hidden="true">
      <div className="tarjeta-visual-arriba">
        <span className="tarjeta-contactless" aria-hidden="true">
          <svg width="30" height="25" viewBox="0 0 30 25" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 10c2.7 2.7 2.7 5.3 0 8M10 7c4.3 4.3 4.3 9.7 0 14M16 4c6 6 6 14 0 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" transform="translate(-2 -1) scale(.82)" />
          </svg>
        </span>
        <span className="tarjeta-banco">{tipoTarjeta(tarjeta.numero)}</span>
      </div>
      <div className="tarjeta-chip"><span /></div>
      <div className="tarjeta-numero">{visual}</div>
      <div className="tarjeta-visual-abajo"><div><small>TITULAR</small><strong>{tarjeta.nombre.trim().slice(0, 24).toUpperCase() || 'NOMBRE DEL TITULAR'}</strong></div><div><small>VENCE</small><strong>{tarjeta.vencimiento || 'MM/AA'}</strong></div></div>
    </div>
    <div className="tarjeta-campos">
      <label>Nombre del titular
        <input autoComplete="cc-name" required maxLength={70} value={tarjeta.nombre} onChange={e => cambiar('nombre', e.target.value)} placeholder="Nombre como aparece en la tarjeta" />
      </label>
      <label>Número de tarjeta
        <input autoComplete="off" inputMode="numeric" required maxLength={23} value={tarjeta.numero} onChange={e => cambiar('numero', agruparNumero(e.target.value))} placeholder="Número de tarjeta" />
      </label>
      <div className="tarjeta-campos-fila">
        <label>Vencimiento
          <input autoComplete="off" inputMode="numeric" required maxLength={5} value={tarjeta.vencimiento} onChange={e => cambiar('vencimiento', formatearFecha(e.target.value))} placeholder="MM/AA" />
        </label>
        <label>CVV
          <input autoComplete="off" inputMode="numeric" type="password" required maxLength={4} value={tarjeta.cvv} onChange={e => cambiar('cvv', digitos(e.target.value, 4))} placeholder="3 o 4 dígitos" />
        </label>
      </div>
    </div>
  </div>
}

function Carrito({ carrito, cambiarCantidad, quitar, usuario, pedirLogin, alComprar }) {
  const [aviso, setAviso] = useState('')
  const [direccion, setDireccion] = useState('')
  const [metodo, setMetodo] = useState('efectivo')
  const [tarjeta, setTarjeta] = useState(TARJETA_VACIA)
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()
  const total = carrito.reduce((suma, p) => suma + p.precio * p.cantidad, 0)

  async function finalizar(e) {
    e.preventDefault()
    if (cargando) return
    if (!usuario) { pedirLogin(); return }
    setAviso('')
    if (metodo === 'tarjeta') {
      const errorTarjeta = comprobarTarjeta(tarjeta)
      if (errorTarjeta) { setAviso(errorTarjeta); return }
    }
    setCargando(true)
    try {
      const pedido = api('/pedidos', {
        method: 'POST',
        body: JSON.stringify({
          productos: carrito.map(({ id, cantidad }) => ({ id, cantidad })),
          metodo_pago: metodo,
          direccion_envio: direccion,
        }),
      })
      await Promise.all([pedido, new Promise(resolve => setTimeout(resolve, 700))])
      setTarjeta(TARJETA_VACIA)
      alComprar()
      navigate('/mis-pedidos', { state: { mensaje: 'Tu pedido se registró correctamente. Estado de pago: pendiente.' } })
    } catch (e) { setAviso(e.message) } finally { setCargando(false) }
  }

  if (carrito.length === 0) return <section className="seccion-interna"><div className="contenedor"><h1 className="titulo-pagina">Carrito</h1><div className="vacio"><p>Tu carrito está vacío.</p><Link to="/productos" className="btn btn-principal">Ver productos</Link></div></div></section>

  return <section className="seccion-interna"><div className="contenedor">
    <h1 className="titulo-pagina">Tu carrito</h1>
    <p className="subtitulo-pagina">Revisa tus productos y completa los datos de tu pedido.</p>
    <div className="carrito-lista">{carrito.map(p => <div className="fila-carrito" key={p.id}>
      <FotoProducto key={`${p.id}-${p.imagen}`} className="carrito-miniatura" src={p.imagen} nombre={p.nombre} />
      <div className="fila-nombre"><strong>{p.nombre}</strong><span>{pesos(p.precio)} c/u</span></div>
      <div className="cantidad"><button type="button" disabled={cargando} onClick={() => cambiarCantidad(p.id, -1)} aria-label={`Restar ${p.nombre}`}>−</button><span>{p.cantidad}</span><button type="button" disabled={cargando} onClick={() => cambiarCantidad(p.id, 1)} aria-label={`Sumar ${p.nombre}`}>+</button></div>
      <div className="fila-subtotal">{pesos(p.precio * p.cantidad)}</div>
      <button type="button" className="quitar" disabled={cargando} onClick={() => quitar(p.id)}>Quitar</button>
    </div>)}</div>
    <div className="checkout-grid">
      <form onSubmit={finalizar} className="form-checkout">
        <h2>Finalizar compra</h2>
        <p>Elige cómo quieres pagar y confirma tu pedido.</p>
        <label>Dirección de entrega
          <textarea required minLength={5} maxLength={500} rows={3} value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, número, colonia, ciudad y código postal" />
        </label>
        <fieldset className="metodos-pago"><legend>Método de pago</legend>
          <label className={`metodo-pago ${metodo === 'tarjeta' ? 'seleccionado' : ''}`}><input type="radio" name="metodo" value="tarjeta" checked={metodo === 'tarjeta'} disabled={cargando} onChange={() => setMetodo('tarjeta')} /><span><strong>Tarjeta bancaria</strong><small>Crédito o débito</small></span></label>
          <label className={`metodo-pago ${metodo === 'efectivo' ? 'seleccionado' : ''}`}><input type="radio" name="metodo" value="efectivo" checked={metodo === 'efectivo'} disabled={cargando} onChange={() => { setMetodo('efectivo'); setTarjeta(TARJETA_VACIA) }} /><span><strong>Efectivo</strong><small>Al recibir el pedido</small></span></label>
        </fieldset>
        {metodo === 'tarjeta' && <FormularioTarjeta tarjeta={tarjeta} onChange={setTarjeta} />}
        {metodo === 'efectivo' && <div className="pago-efectivo-aviso"><strong>Pago en efectivo</strong><p>El pago queda pendiente hasta la entrega.</p></div>}
        <button disabled={cargando} type="submit" className="btn btn-principal checkout-submit" aria-busy={cargando}>{cargando ? 'Registrando pedido...'  : usuario ? `Confirmar pedido · ${pesos(total)}` : 'Inicia sesión para confirmar'}</button>
        {aviso && <p className="mensaje-error" role="alert">{aviso}</p>}
      </form>
      <aside className="checkout-resumen"><h2>Resumen del pedido</h2><div className="checkout-resumen-items">{carrito.map(p => <div key={p.id}><span>{p.nombre} <small>× {p.cantidad}</small></span><strong>{pesos(p.precio * p.cantidad)}</strong></div>)}</div><div className="checkout-resumen-envio"><span>Envío</span><span>Por confirmar</span></div><div className="checkout-resumen-total"><span>Total de productos</span><strong>{pesos(total)}</strong></div></aside>
    </div>
  </div></section>
}
export default Carrito
