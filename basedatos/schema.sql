-- Esquema SQLite para el proyecto e-commerce PSS México.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL COLLATE NOCASE UNIQUE,
  clave_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'cliente' CHECK (rol IN ('cliente', 'admin')),
  correo_verificado INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  nombre TEXT NOT NULL,
  marca TEXT NOT NULL DEFAULT '',
  detalle TEXT NOT NULL DEFAULT '',
  descripcion_larga TEXT NOT NULL DEFAULT '',
  galeria TEXT NOT NULL DEFAULT '[]',
  extra TEXT NOT NULL DEFAULT '',
  beneficio TEXT NOT NULL DEFAULT '',
  precio_centavos INTEGER NOT NULL CHECK(precio_centavos >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  imagen TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1)),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','pagado','enviado','entregado','cancelado')),
  metodo_pago TEXT NOT NULL CHECK(metodo_pago IN ('tarjeta','efectivo')),
  direccion_envio TEXT NOT NULL,
  total_centavos INTEGER NOT NULL CHECK(total_centavos >= 0)
);

CREATE TABLE IF NOT EXISTS detalle_pedido (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL CHECK(cantidad > 0),
  precio_unitario_centavos INTEGER NOT NULL CHECK(precio_unitario_centavos >= 0),
  UNIQUE(pedido_id, producto_id)
);

CREATE TABLE IF NOT EXISTS dudas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  respuesta TEXT NOT NULL DEFAULT '',
  correo_enviado INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','respondida')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cotizaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  telefono TEXT NOT NULL DEFAULT '',
  descripcion TEXT NOT NULL,
  respuesta TEXT NOT NULL DEFAULT '',
  precio_propuesto_centavos INTEGER,
  respondida_en TEXT,
  correo_enviado INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','enviada','aceptada','rechazada')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_detalle_pedido ON detalle_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_dudas_estado ON dudas(estado);

CREATE TABLE IF NOT EXISTS verificaciones_correo (
  usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_hash TEXT NOT NULL,
  vence_en INTEGER NOT NULL,
  intentos INTEGER NOT NULL DEFAULT 0,
  enviado_en INTEGER NOT NULL
);
