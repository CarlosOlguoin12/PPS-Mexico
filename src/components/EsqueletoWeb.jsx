import EsqueletoProductos from './EsqueletoProductos'

export default function EsqueletoWeb({ pathname }) {
  return (
    <div className="pagina pagina-esqueleto" aria-busy="true" role="status" aria-label="Cargando tienda">
      <span className="solo-lectores">Cargando la tienda PSS México...</span>
      <div className="barra-esqueleto" aria-hidden="true">
        <div className="esqueleto esqueleto-logo" />
        <div className="barra-esqueleto-menu">
          <div className="esqueleto esqueleto-nav" />
          <div className="esqueleto esqueleto-nav" />
          <div className="esqueleto esqueleto-nav" />
        </div>
      </div>
      {pathname === '/productos' ? (
        <main className="seccion-interna"><div className="contenedor">
          <div className="esqueleto esqueleto-titulo" aria-hidden="true" />
          <div className="esqueleto esqueleto-subtitulo" aria-hidden="true" />
          <EsqueletoProductos />
        </div></main>
      ) : (
        <main className="esqueleto-inicio" aria-hidden="true">
          <div className="esqueleto esqueleto-portada" />
          <div className="esqueleto-descripcion">
            <div className="esqueleto esqueleto-titulo" />
            <div className="esqueleto esqueleto-linea largo" />
            <div className="esqueleto esqueleto-linea largo" />
            <div className="esqueleto esqueleto-linea medio" />
            <div className="esqueleto esqueleto-linea largo" />
          </div>
        </main>
      )}
    </div>
  )
}
