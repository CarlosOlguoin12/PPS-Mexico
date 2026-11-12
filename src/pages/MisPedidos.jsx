import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, pesos } from '../api'

export default function MisPedidos({ usuario, sesionLista, pedirLogin }) {
  const [pedidos, setPedidos] = useState([])
  const [error, setError] = useState('')
  const { state } = useLocation()
  useEffect(() => {
    if (!usuario) return
    let activa = true
    api('/mis-pedidos').then(d => { if (activa) setPedidos(d.pedidos) }).catch(e => { if (activa) setError(e.message) })
    return () => { activa = false }
  }, [usuario])
  return <section className="seccion-interna"><div className="contenedor">
    <h1 className="titulo-pagina">Mis pedidos</h1>
    {state?.mensaje && <p className="exito">{state.mensaje}</p>}
    {!sesionLista ? <p>Verificando sesión...</p> : !usuario ? <div className="panel-simple"><p>Necesitas iniciar sesión para consultar tus pedidos.</p><button className="btn btn-principal" onClick={pedirLogin}>Entrar</button></div> : <>
      {error && <p className="mensaje-error">{error}</p>}
      {!pedidos.length && !error && <p>Aún no tienes pedidos. <Link to="/productos">Ver productos</Link></p>}
      {pedidos.map(p => <article className="panel-simple" key={p.id}><h2>Pedido #{p.id} — {pesos(p.total)}</h2><p>Estado: <strong>{p.estado}</strong> · Fecha: {p.fecha} · Método: {p.metodo_pago}</p><ul>{p.detalle.map(d => <li key={d.producto_id}>{d.nombre}: {d.cantidad} × {pesos(d.precio_unitario)}</li>)}</ul></article>)}
    </>}
  </div></section>
}
