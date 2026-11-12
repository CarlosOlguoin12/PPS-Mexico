import { useState } from 'react'
import { api } from '../api'

const preguntas = [
  { p: '¿Qué formas de pago aceptan?', r: 'Puedes consultar las opciones disponibles al finalizar tu pedido.' },
  { p: '¿Hacen instalación de los equipos?', r: 'Consulta la disponibilidad de instalación con el equipo de ventas.' },
  { p: '¿Cuánto tarda el envío?', r: 'Solicita una estimación al equipo de ventas.' },
  { p: '¿Los productos tienen garantía?', r: 'Depende del producto; consulta su ficha.' },
]

function Dudas() {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [duda, setDuda] = useState('')
  const [enviado, setEnviado] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar(e) {
    e.preventDefault(); setError(''); setEnviado(''); setCargando(true)
    try {
      const datos = await api('/dudas', { method: 'POST', body: JSON.stringify({ nombre, correo, mensaje: duda }) })
      setNombre(''); setCorreo(''); setDuda(''); setEnviado(datos.mensaje)
    } catch (e) { setError(e.message) } finally { setCargando(false) }
  }

  return <section className="seccion-interna"><div className="contenedor">
    <h1 className="titulo-pagina">Dudas</h1><p className="subtitulo-pagina">Resuelve tus preguntas o envíanos la tuya.</p>
    <div className="dudas-grid"><div>{preguntas.map(item => <details className="faq" key={item.p}><summary>{item.p}</summary><p>{item.r}</p></details>)}</div>
      <form className="form-duda" onSubmit={enviar}>
        <h2>¿No encontraste tu respuesta?</h2>
        <input placeholder="Nombre" aria-label="Nombre" maxLength={150} value={nombre} onChange={e => setNombre(e.target.value)} required />
        <input type="email" placeholder="Correo" aria-label="Correo" maxLength={255} value={correo} onChange={e => setCorreo(e.target.value)} required />
        <textarea rows="4" placeholder="Escribe tu duda" aria-label="Escribe tu duda" maxLength={3000} value={duda} onChange={e => setDuda(e.target.value)} required />
        <button disabled={cargando} type="submit" className="btn btn-principal">{cargando ? 'Enviando...' : 'Enviar duda'}</button>
        {enviado && <p className="exito" role="status">{enviado}</p>}
        {error && <p className="mensaje-error" role="alert">{error}</p>}
      </form>
    </div>
  </div></section>
}
export default Dudas
