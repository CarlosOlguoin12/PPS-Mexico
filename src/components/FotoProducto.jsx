import { useState } from 'react'

// Si el archivo en public/productos/ es PNG en vez de JPG (o viceversa),
// se intenta encontrar la extensión disponible sin cambiar el diseño.
function rutasDisponibles(src) {
  if (!src) return []
  const ruta = src.trim()
  const coincidencia = ruta.match(/^(\/productos\/[^?#]+)\.(jpg|jpeg|png|webp)(\?[^#]*)?$/i)
  if (!coincidencia) return [ruta]
  const [, base, extension] = coincidencia
  const extensiones = [extension.toLowerCase(), 'png', 'jpg', 'jpeg', 'webp']
  return [...new Set(extensiones)].map(ext => `${base}.${ext}`)
}

export default function FotoProducto({ src, nombre, className = 'card-foto', version = '' }) {
  const opciones = rutasDisponibles(src)
  const [indice, setIndice] = useState(0)
  const [estado, setEstado] = useState(opciones.length ? 'cargando' : 'sin-foto')
  const ruta = opciones[indice]
  // Evita que el navegador conserve una foto antigua con el mismo nombre.
  const conVersion = ruta && version && ruta.startsWith('/')
    ? `${ruta}${ruta.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`
    : ruta

  function fallo() {
    if (indice + 1 < opciones.length) {
      setIndice(indice + 1)
      setEstado('cargando')
    } else {
      setEstado('sin-foto')
    }
  }

  return (
    <div className={`${className} foto-producto ${estado === 'cargando' ? 'foto-cargando' : ''}`}>
      {estado === 'cargando' && <span className="foto-esqueleto esqueleto" aria-hidden="true" />}
      {estado === 'sin-foto' && <span className="foto-sin-imagen">Imagen pendiente</span>}
      {ruta && estado !== 'sin-foto' && (
        <img
          src={conVersion}
          alt={nombre}
          loading="lazy"
          decoding="async"
          style={{ opacity: estado === 'lista' ? 1 : 0 }}
          onLoad={() => setEstado('lista')}
          onError={fallo}
        />
      )}
    </div>
  )
}
