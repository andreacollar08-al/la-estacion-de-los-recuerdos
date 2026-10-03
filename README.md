# Campaña anterior suspendida

Este repositorio (`la-estacion-de-los-recuerdos`, sin sufijo `2026`) queda retirado del uso comercial desde el 2 de octubre de 2026.

La campaña actual de reservas tiene como destino `https://rubielphoto.com`.

## Comportamiento del repositorio retirado

- El servidor responde **HTTP 410 Gone** en todas las rutas, incluidos el registro VIP, reservas, pagos, administración y archivos estáticos.
- No carga la base SQLite, no recibe nuevos leads, no procesa pagos ni modifica los datos anteriores.
- Las entradas HTML antiguas se retiran para que tampoco se publique el formulario VIP mediante un hosting estático.
- No hay redirección automática: si el dominio aún apunta a este servidor, redirigir al mismo dominio causaría un bucle.
- La versión anterior se conserva en el historial de Git; los datos persistentes del servidor no se borran.

## Verificación

```sh
npm test
```

## Retirada de producción

Un commit en GitHub no cambia por sí solo un VPS sin despliegue automático. En el proveedor de hosting hay que publicar la aplicación de reservas vigente y configurar `rubielphoto.com` y `www.rubielphoto.com` para atenderla, conservando su base de datos y configuración de pagos.

Si este repositorio tiene GitHub Pages activado, despublicarlo en **Settings → Pages → Unpublish site**. Detener también cualquier proceso o publicación que use una copia anterior de este repositorio. No borrar bases de datos ni volúmenes de reservas durante la retirada.
