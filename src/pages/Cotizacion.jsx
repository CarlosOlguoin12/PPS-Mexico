import { useState } from 'react'
import { api } from '../api'

export default function Cotizacion() {
  const [form, setForm] = useState({ nombre: '', correo: '', telefono: '', descripcion: '' })
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  async function enviar(e) {
    e.preventDefault(); setError(''); setMensaje(''); setCargando(true)
    try {
      const r = await api('/cotizaciones', { method: 'POST', body: JSON.stringify(form) })
      setMensaje(r.mensaje)
      setForm({ nombre: '', correo: '', telefono: '', descripcion: '' })
    } catch (e) { setError(e.message) } finally { setCargando(false) }
  }
  return <section className="seccion-interna"><div className="contenedor">
    <h1 className="titulo-pagina">Solicitar cotización</h1>
    <p className="subtitulo-pagina">Cuéntanos qué productos o servicios necesitas y te enviaremos una propuesta.</p>
    <form className="form-checkout" onSubmit={enviar}>
      <label>Nombre *<input value={form.nombre} required maxLength="150" onChange={e => setForm({ ...form, nombre: e.target.value })} /></label>
      <label>Correo *<input type="email" value={form.correo} required maxLength="255" onChange={e => setForm({ ...form, correo: e.target.value })} /></label>
      <label>Teléfono <input type="tel" value={form.telefono} maxLength="30" onChange={e => setForm({ ...form, telefono: e.target.value })} /></label>
      <label>¿Qué productos o servicios necesitas? *<textarea rows="5" maxLength="3000" required value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></label>
      <button className="btn btn-principal" disabled={cargando}>{cargando ? 'Enviando...' : 'Enviar cotización'}</button>
      {mensaje && <p className="exito">{mensaje}</p>}
      {error && <p className="mensaje-error" role="alert">{error}</p>}
    </form>
  </div></section>
}
