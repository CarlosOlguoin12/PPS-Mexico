-- Datos iniciales de demostración. Se insertan SOLO si el catálogo está vacío.
INSERT INTO categorias (nombre, descripcion) VALUES
 ('Cámaras','Cámaras de seguridad para interior y exterior'),
 ('Alarmas','Sistemas de alarma'),
 ('Sensores','Sensores de seguridad'),
 ('Control de acceso','Cerraduras y dispositivos de acceso'),
 ('Grabación','Grabadores de video'),
 ('Kits','Paquetes de seguridad');

INSERT INTO productos (categoria_id,nombre,marca,detalle,extra,beneficio,precio_centavos,stock,imagen) VALUES
 (1,'Cámara de seguridad','Marca:','Visión nocturna · 1080p · Exterior','Instalación disponible','Garantía de 1 año',89900,20,'/productos/camara-seguridad.jpg'),
 (2,'Alarma para el hogar','Marca:','Sirena 110 dB · 4 sensores · App móvil','Instalación disponible','Garantía de 1 año',129900,15,'/productos/alarma-hogar.jpg'),
 (3,'Sensor de movimiento','Marca:','Inalámbrico · Bajo consumo · Interior','Envío a todo México','Garantía de 6 meses',34900,35,'/productos/sensor-movimiento.jpg'),
 (4,'Cerradura inteligente','Marca:','Código · Tarjeta · App móvil','Instalación disponible','Garantía de 2 años',249900,10,'/productos/cerradura-inteligente.jpg'),
 (5,'Grabador DVR 8 canales','Marca:','Hasta 30 días · Acceso remoto','Envío a todo México','Garantía de 1 año',189900,12,'/productos/grabador-dvr.jpg'),
 (6,'Kit de 4 cámaras','Marca:','4 cámaras · DVR · Cableado incluido','Instalación disponible','Garantía de 1 año',399900,8,'/productos/kit-camaras.jpg');
