# Entrevistas del Obispado

Aplicación web para solicitar, coordinar y dar seguimiento a entrevistas con el Obispado en **Iquique, Chile**.

**Versión actual:** v4.4.1  
**Producción:** https://mientrevista.online  
**Backend:** Supabase  
**Deploy:** GitHub Pages desde `main`

## Alcance actual

El sistema trabaja únicamente con estos seis barrios de Iquique:

- Barrio de Bilbao
- Barrio de Gomez Carreño
- Barrio de Lynch
- Barrio de Playa Brava
- Barrio de Renacimiento
- Barrio de Zegers

El miembro inicia sesión, selecciona su barrio, ve los líderes disponibles y solicita una entrevista.

El panel interno permite administrar liderazgo, horarios y solicitudes de esos barrios.

## Importante

- No hay GPS ni detección automática de barrio.
- No hay selección de país, región o ciudad.
- No hay importación ni sincronización de directorios externos.
- No agregar unidades fuera de Iquique sin una decisión explícita de producto.
- No borrar usuarios, entrevistas, horarios ni asignaciones reales de Iquique.

## Seguridad

- Supabase Auth.
- RLS para separación de datos.
- La clave publicada en frontend es una publishable key, no `service_role`.
- Nunca guardar secretos, contraseñas ni tokens privados en el repositorio.

## Publicación

Cada push a `main` ejecuta `.github/workflows/pages.yml` y publica GitHub Pages.

Antes de publicar:

1. validar `public.js` y `panel.js`;
2. comprobar selección de barrio del miembro;
3. comprobar panel interno;
4. mantener sincronizada la versión en `config.js`, `version.json`, HTML y assets;
5. revisar Supabase Security Advisor.


## PWA y notificaciones v4.4.1

- Instalable como PWA desde navegadores compatibles.
- Service Worker con soporte offline básico del shell.
- Web Push asociado a cada cuenta y dispositivo.
- Notificaciones automáticas por creación y cambios de estado de entrevistas.
- Guía interactiva y opcional para miembros y panel interno.
- La clave privada VAPID se genera en servidor y se guarda en Supabase Vault; no se publica en GitHub.


## Corrección de horarios v4.4.1

- Zona horaria oficial del sistema: `America/Santiago`.
- Las fechas seleccionadas ya no se muestran un día antes.
- La creación de horarios respeta el horario de verano de Chile.
- Se puede eliminar un horario libre individual o todos los horarios libres de un día.
- Los horarios ocupados no se eliminan desde estas acciones.
