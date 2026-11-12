const remitente = (process.env.CORREO_REMITENTE || '').trim()
const clave = (process.env.BREVO_API_KEY || '').trim()
export const ventas = (process.env.CORREO_VENTAS || '').trim()
export const correoConfigurado = () => Boolean(clave && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(remitente))

export async function enviarCorreo({ para, asunto, contenido, responderA }) {
  if (!correoConfigurado()) throw new Error('El servicio de correo no está configurado. Revisa BREVO_API_KEY y CORREO_REMITENTE.')
  const envio = {
    sender: { name: 'PSS México', email: remitente },
    to: [{ email: para }],
    subject: asunto,
    textContent: contenido,
  }
  if (responderA) envio.replyTo = { email: responderA }
  let respuesta
  try {
    respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': clave, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(envio),
      signal: AbortSignal.timeout(12000),
    })
  } catch (error) {
    console.error('Error de conexión al servicio de correo:', error?.code || error?.name)
    throw new Error('No fue posible contactar al servicio de correo. Intenta de nuevo.')
  }
  if (!respuesta.ok) {
    console.error('Servicio de correo rechazó el envío:', respuesta.status)
    throw new Error('El servicio de correo rechazó el envío. Revisa el remitente verificado y la clave del servicio.')
  }
  return true
}
