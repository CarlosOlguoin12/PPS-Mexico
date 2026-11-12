const soluciones = [
  {
    titulo: 'Videovigilancia',
    descripcion: 'Cámaras y grabadores para observar espacios y accesos.',
  },
  {
    titulo: 'Alarmas y sensores',
    descripcion: 'Equipos para detectar movimientos y recibir alertas.',
  },
  {
    titulo: 'Control de acceso',
    descripcion: 'Cerraduras y soluciones para gestionar entradas.',
  },
]

function Inicio() {
  return (
    <main className="contenido">
      <section className="izquierda" aria-labelledby="titulo-inicio">
        <div className="hero">
          <span className="hero-etiqueta">Soluciones de seguridad electrónica</span>
          <h1 id="titulo-inicio">Seguridad para los espacios que más importan</h1>
          <p className="hero-descripcion">
            Conoce opciones de videovigilancia, alarmas y control de acceso
            para hogares, comercios y oficinas. Encuentra equipos y solicita
            asesoría para elegir la solución adecuada.
          </p>
          <div className="hero-soluciones" aria-label="Nuestras soluciones">
            {soluciones.map((solucion) => (
              <article className="hero-solucion" key={solucion.titulo}>
                <span className="hero-solucion-marca" aria-hidden="true" />
                <div>
                  <h2>{solucion.titulo}</h2>
                  <p>{solucion.descripcion}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="hero-pie">Tecnología, protección y atención personalizada.</p>
        </div>
      </section>

      <section className="derecha">
        <div className="info-empresa">
          <h2>Información de la empresa</h2>
          <p>
            <strong>Misión</strong>
            Brindar calidad en la seguridad, con una organización eficaz y
            flexible, teniendo una posición sólida y competitiva en la
            industria mexicana, garantizando la satisfacción del cliente, con
            profesionales detrás de las soluciones de seguridad electrónica.
          </p>
          <p>
            <strong>Valores</strong>
            Una empresa integradora de soluciones de seguridad electrónica
            honesta, confiable y responsable, que ofrece productos
            profesionales, innovadores y de alta calidad, basados en rapidez
            y honestidad, asegurando con ello la completa satisfacción de
            nuestros clientes.
          </p>
          <p>
            <strong>Visión</strong>
            Ser la empresa número uno en México, con precios accesibles y
            competitivos, contando con profesionales en el área de la
            tecnología y siendo la mejor opción para quienes busquen las
            características que ofrecemos, dando seguridad y tranquilidad a
            nuestros clientes.
          </p>
        </div>
      </section>
    </main>
  )
}

export default Inicio
