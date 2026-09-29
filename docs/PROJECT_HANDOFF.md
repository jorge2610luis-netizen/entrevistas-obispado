# Entrevistas del Obispado — Handoff técnico

> Última actualización: 2026-09-27  
> Rama de producción: `main`  
> Versión: **v4.4.2**  
> Sitio: https://mientrevista.online  
> Panel: https://mientrevista.online/panel.html  
> Supabase: `gyyahvrkcjocqhhoslho`

## Corrección v4.4.2

Se restauraron los eventos del área de miembro que se habían eliminado accidentalmente al retirar el código geográfico:

- navegación Inicio / Mi barrio / Mis entrevistas / Nueva entrevista;
- abrir/cerrar menú móvil;
- iniciar sesión y crear cuenta;
- guardar barrio de Iquique;
- enviar solicitud de entrevista;
- cerrar sesión;
- botones de seguimiento posteriores a una solicitud.

No se reintrodujo GPS ni lógica multipaís.

## Términos y Condiciones v4.4.2

Las cuentas nuevas de miembro deben aceptar los Términos y Condiciones versión `2026-09-27-v1` antes de registrarse.

La aceptación se guarda en `member_profiles.terms_version` y `member_profiles.terms_accepted_at` mediante el trigger de Auth. Los usuarios existentes no se marcan retroactivamente.

Los términos dejan explícito que la herramienta es local e independiente, no oficial, de uso voluntario y destinada únicamente a apoyar la coordinación de entrevistas.

## PWA, Web Push y guía v4.4.2

La aplicación vuelve a ser instalable como PWA.

Archivos:
- `manifest.webmanifest`
- `sw.js`
- `pwa.js`
- `icons/icon-192.png`
- `icons/icon-512.png`
- `supabase/functions/push-notifications/index.ts`

Push:
- `push_subscriptions` asocia un endpoint Push con un usuario.
- `push_events` crea un token aleatorio por evento de entrevista.
- Un trigger de `appointments` llama a `push-notifications` usando ese token.
- La función Edge genera VAPID P-256 si aún no existe y guarda la clave privada en Supabase Vault.
- Nunca guardar la clave privada VAPID en frontend o GitHub.

Eventos principales:
- solicitud creada: miembro + Secretaría + líder asignado;
- enviada al líder: miembro + líder asignado;
- aprobada por líder: miembro + Secretaría;
- demás cambios de estado: miembro.

La guía de uso es opcional y se ofrece una vez por usuario/dispositivo; siempre puede volver a abrirse desde “Guía de uso”.

## Corrección de horarios v4.4.2

El sistema de Iquique usa `America/Santiago`.

Se corrigió un error heredado de `America/La_Paz` que hacía que martes apareciera como lunes y domingo como sábado en algunos títulos, además de desplazar una hora durante el horario de verano chileno.

La administración de horarios permite:
- eliminar un horario libre individual;
- eliminar todos los horarios libres de un día;
- conservar automáticamente horarios ocupados/solicitados.

Los horarios futuros existentes de Iquique se reinterpretaron de La Paz a Santiago para conservar la hora de pared que el administrador había escrito.

## Corrección visual v4.4.2

Se corrigieron secuencias literales `\\n` que habían quedado dentro de `index.html` y `panel.html` al integrar la PWA. Esas secuencias se estaban renderizando como texto visible sobre el encabezado.

Se incrementó la versión a v4.4.2 para invalidar caché del navegador y del Service Worker.

## Zona fija v4.5.5

La aplicación queda temporalmente en modo **Iquique · Tarapacá · Chile**.

- `APP_CONFIG.fixedZone` fija `CL / Tarapacá / Iquique`.
- Los controles país/región/ciudad y la sincronización nacional están ocultos.
- La lógica de expansión se conserva en el código para una etapa futura.
- Las unidades fuera de Iquique quedan inactivas, no eliminadas.
- Las seis unidades de Iquique permanecen activas y se normalizan a región `Tarapacá`.

## 1. Alcance

El producto activo funciona **solo en Iquique**.

Un miembro puede:

1. registrarse o iniciar sesión con teléfono + contraseña;
2. abrir “Mi barrio”;
3. seleccionar uno de los seis barrios de Iquique;
4. ver los líderes asignados a ese barrio;
5. escoger día/hora disponible;
6. solicitar y seguir una entrevista.

No existe flujo activo de GPS, país, región, ciudad ni sincronización externa.

## 2. Barrios activos

Los únicos registros que deben estar activos en `church_units` son:

- Barrio de Bilbao
- Barrio de Gomez Carreño
- Barrio de Lynch
- Barrio de Playa Brava
- Barrio de Renacimiento
- Barrio de Zegers

Todos tienen:

- `city = Iquique`
- `region = Tarapacá`
- `country_code = CL`

Gómez Carreño conserva los datos reales actualmente usados por miembros/liderazgo.

## 3. Base de datos actual

Después de la limpieza v4.4.2:

- `church_units`: 6
- `church_meetinghouses`: 5
- `church_directory_places`: 1
- `church_directory_unit_index`: 0
- `directory_regions`: 1
- `member_profiles`: 2
- `unit_staff_assignments`: 2
- `availability`: 31
- `appointments`: 2

No reintroducir unidades fuera de Iquique de forma automática.

## 4. Archivos principales

### `index.html`
Aplicación del miembro.

La vista “Mi barrio” contiene un selector directo de unidades de Iquique (`iquiqueUnitSelect`) y el botón `saveIquiqueUnit`.

### `public.js`
Lógica del miembro.

Funciones clave del barrio:

- `loadIquiqueUnits()`
- `saveIquiqueUnit()`
- `renderMemberUnit()`
- `loadLeaders()`

`loadIquiqueUnits()` llama `search_church_catalog_v2` fijando:

- país: CL
- ciudad: Iquique
- límite: 20

Luego vuelve a filtrar el resultado por Iquique/CL antes de mostrarlo.

### `panel.html`
Panel interno.

“Barrios y liderazgo” no muestra país/región/ciudad. Solo permite buscar los barrios de Iquique y filtrar cobertura.

### `panel.js`
`searchAdminUnits()` está fijada a:

- `p_country_code = CL`
- `p_city = Iquique`

El Secretario Administrador puede administrar las seis unidades activas.

### `config.js` / `version.json`
Versión actual: `v4.4.2`.

## 5. Autenticación

### Miembros

La interfaz usa teléfono + contraseña.

Internamente se deriva un email técnico para Supabase Auth:

`m<solo_digitos>@members.expressdelivery.pro`

El miembro no necesita conocerlo.

### Staff

Roles actuales:

- `secretary_admin`
- `secretary`
- `bishop`
- `first_counselor`
- `second_counselor`

Los permisos críticos se aplican en Supabase/RLS/RPC, no solo ocultando botones.

## 6. Unidad del miembro

El selector devuelve un `unit_id` real de `church_units`.

Al guardar se llama:

`member_set_church_unit(...)`

con:

- `p_city = Iquique`
- `p_country_code = CL`
- `p_church_unit_id` de una unidad válida.

Después se recargan los líderes mediante `member_available_leaders()`.

## 7. Horarios y entrevistas

La arquitectura por unidad se mantiene porque Iquique tiene seis barrios.

No confundir esto con expansión geográfica: cada barrio conserva su liderazgo, horarios y solicitudes de forma independiente.

Las entrevistas siguen ligadas a:

- miembro;
- barrio;
- líder;
- disponibilidad;
- estado.

No borrar estas relaciones al simplificar UI.

## 8. Datos que no deben perderse

Conservar siempre:

- usuarios de Auth;
- `member_profiles`;
- `profiles`;
- `unit_staff_assignments`;
- `availability`;
- `appointments`;
- `appointment_history`;
- las seis unidades de Iquique.

## 9. Deploy

`main` despliega automáticamente por GitHub Pages usando:

`.github/workflows/pages.yml`

Antes de fusionar cambios:

1. validar sintaxis de `public.js` y `panel.js`;
2. comprobar que los IDs usados por eventos existen en HTML;
3. probar selección de barrio;
4. probar panel;
5. actualizar versión/cache si corresponde.

## 10. Seguridad pendiente conocida

El último Security Advisor mostró:

- Leaked Password Protection de Supabase Auth desactivado.
- `church_directory_unit_index` tiene RLS sin policy, pero la tabla está vacía y no participa del flujo activo.

No resolver advertencias de seguridad eliminando RLS ni exponiendo tablas públicamente.

## 11. Regla para próximos cambios

El alcance actual es **Iquique solamente**.

No agregar GPS, importaciones externas, país/región/ciudad ni nuevas comunas salvo instrucción explícita del propietario del proyecto.
