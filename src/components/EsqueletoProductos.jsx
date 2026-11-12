export default function EsqueletoProductos({ cantidad = 6 }) {
  return (
    <div className="productos-grid" aria-busy="true" role="status" aria-label="Cargando productos">
      <span className="solo-lectores">Cargando catálogo de productos...</span>
      {Array.from({ length: cantidad }, (_, i) => (
        <article className="card-producto esqueleto-tarjeta" key={i} aria-hidden="true">
          <div className="esqueleto esqueleto-foto" />
          <div className="card-cuerpo">
            <div className="esqueleto esqueleto-linea largo" />
            <div className="esqueleto esqueleto-linea medio" />
            <div className="esqueleto esqueleto-linea largo" />
            <div className="esqueleto esqueleto-linea corto" />
            <div className="esqueleto esqueleto-precio" />
            <div className="esqueleto esqueleto-boton" />
          </div>
        </article>
      ))}
    </div>
  )
}
