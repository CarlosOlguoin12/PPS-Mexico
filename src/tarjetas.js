export const TARJETA_VACIA = { nombre: '', numero: '', vencimiento: '', cvv: '' }
export const digitos = (s, limite = 19) => String(s).replace(/\D/g, '').slice(0, limite)

export function tipoTarjeta(numero) {
  const n = digitos(numero)
  if (/^4/.test(n)) return 'Visa'
  if (/^3[47]/.test(n)) return 'American Express'
  if (/^(5[1-5]|2(2[2-9]|[3-6][0-9]|7[01]|720))/.test(n)) return 'Mastercard'
  if (/^6(011|5|4[4-9])/.test(n)) return 'Discover'
  if (/^35/.test(n)) return 'JCB'
  if (/^3(0[0-5]|[68])/.test(n)) return 'Diners Club'
  return 'Tarjeta bancaria'
}

export function agruparNumero(valor) {
  const n = digitos(valor)
  if (/^3[47]/.test(n)) return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(' ')
  return n.replace(/(.{4})/g, '$1 ').trim()
}

export function formatearFecha(valor) {
  const n = digitos(valor, 4)
  return n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n
}

export function luhn(numero) {
  let suma = 0, doblar = false
  for (let i = numero.length - 1; i >= 0; i--) {
    let cifra = Number(numero[i])
    if (doblar) { cifra *= 2; if (cifra > 9) cifra -= 9 }
    suma += cifra
    doblar = !doblar
  }
  return suma % 10 === 0
}

export function comprobarTarjeta(tarjeta) {
  const numero = digitos(tarjeta.numero)
  if (tarjeta.nombre.trim().length < 3) return 'Escribe el nombre del titular.'
  if (numero.length < 13 || numero.length > 19 || /^(\d)\1+$/.test(numero) || !luhn(numero)) {
    return 'El número de tarjeta no es válido. Revisa los dígitos.'
  }
  if (!/^\d{2}\/\d{2}$/.test(tarjeta.vencimiento)) return 'Escribe el vencimiento en formato MM/AA.'
  const [mes, anio] = tarjeta.vencimiento.split('/').map(Number)
  const hoy = new Date()
  const anioCompleto = 2000 + anio
  if (mes < 1 || mes > 12 || anioCompleto < hoy.getFullYear() ||
    (anioCompleto === hoy.getFullYear() && mes < hoy.getMonth() + 1) || anioCompleto > hoy.getFullYear() + 25) {
    return 'La fecha de vencimiento no es válida.'
  }
  if (!/^\d{3,4}$/.test(tarjeta.cvv) || (tipoTarjeta(numero) === 'American Express' && tarjeta.cvv.length !== 4)) {
    return 'Revisa el código de seguridad (3 o 4 dígitos).'
  }
  return ''
}

