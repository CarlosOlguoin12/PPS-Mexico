
Se dejo en blanco podructos para que se realicen las pruebas del proyecto
ADMIN
contraseña:Azul1234
usuario:Carlos
Terminal del servidor:

```bash
cd servidor
npm install
npm run dev
```

Terminal de React (desde `software`):

```bash
npm install
npm run dev
```

Web: http://localhost:5173 · Administrador: http://localhost:5173/admin






4. Reinicia el servidor. El registro enviará un código de seis dígitos, válido 10 minutos. Las dudas y cotizaciones se enviarán a `CORREO_VENTAS`, y las respuestas del administrador se enviarán al correo del cliente.

Sin esta configuración, los formularios que envían correos muestran un error y **no fingen haberlos enviado**. La aceptación del correo por Brevo no garantiza que el destinatario lo reciba: también depende de la entrega y de los filtros de spam.

## Productos

En Administración > Productos puedes escribir la descripción detallada y rutas de fotografías adicionales (una por línea). Guarda imágenes locales en `public/productos/` y usa rutas como `/productos/camara.png`.

