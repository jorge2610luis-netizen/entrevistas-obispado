# Entrevistas del Obispado — Handoff técnico

> Última actualización: 2026-09-27  
> Rama de producción: `main`  
> Versión: **v4.3.3**  
> Sitio: https://mientrevista.online  
> Panel: https://mientrevista.online/panel.html  
> Supabase: `gyyahvrkcjocqhhoslho`

## Corrección v4.3.3

Se restauraron los eventos del área de miembro que se habían eliminado accidentalmente al retirar el código geográfico:

- navegación Inicio / Mi barrio / Mis entrevistas / Nueva entrevista;
- abrir/cerrar menú móvil;
- iniciar sesión y crear cuenta;
- guardar barrio de Iquique;
- enviar solicitud de entrevista;
- cerrar sesión;
- botones de seguimiento posteriores a una solicitud.

No se reintrodujo GPS ni lógica multipaís.

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

Después de la limpieza v4.3.3:

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
Versión actual: `v4.3.3`.

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
