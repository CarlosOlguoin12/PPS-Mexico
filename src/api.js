export async function api(ruta, opciones = {}) {
  let respuesta
  try {
    respuesta = await fetch(`/api${ruta}`, {
      credentials: 'same-origin',
      ...opciones,
      headers: { ...(opciones.body ? { 'Content-Type': 'application/json' } : {}), ...opciones.headers },
    })
  } catch {
    throw new Error('No se pudo conectar al servidor. Asegúrate de iniciar la terminal del servidor (puerto 3000).')
  }
  const datos = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) throw new Error(datos.mensaje || `Error ${respuesta.status}`)
  return datos
}
export const pesos = n => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
