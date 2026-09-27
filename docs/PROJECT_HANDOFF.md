# Entrevistas del Obispado — Handoff técnico para IA / desarrolladores

> **Última actualización de este documento:** 2026-09-27  
> **Repositorio:** `jorge2610luis-netizen/entrevistas-obispado`  
> **Rama de producción:** `main`  
> **Versión declarada actual:** `v4.2.0`
> **Sitio:** https://mientrevista.online  
> **Panel interno:** https://mientrevista.online/panel.html  
> **Backend:** Supabase, proyecto `gyyahvrkcjocqhhoslho`

---

## 1. Propósito del proyecto

Aplicación web para coordinar entrevistas de miembros con el Obispado.

El sistema ya NO es una agenda genérica de un solo barrio. Evolucionó a una arquitectura **multi-barrio / multi-unidad**, donde:

- Los miembros crean una cuenta con teléfono + contraseña.
- Cada miembro confirma su Barrio/Rama.
- Cada Barrio/Rama tiene su propio Obispo, Consejeros y Secretario.
- Los horarios pertenecen a un líder real **y** a una unidad real.
- Las solicitudes se enrutan a la unidad y líder correctos.
- El Secretario Administrador puede administrar múltiples barrios.
- Secretarios y líderes normales solo deben acceder a su ámbito autorizado.
- El sistema está preparándose para escalar a Chile y Bolivia.

La aplicación NO es un sitio oficial de La Iglesia de Jesucristo de los Santos de los Últimos Días. Mantener el aviso/disclaimer y no introducir logotipos oficiales protegidos salvo autorización.

---

## 2. Estado actual: leer antes de cambiar código

### Producción

`main` despliega automáticamente a GitHub Pages mediante:

`.github/workflows/pages.yml`

Flujo:

1. push a `main`
2. checkout
3. configure-pages
4. upload-pages-artifact
5. deploy-pages

**No existe actualmente una rama de staging integrada al flujo normal. Tratar `main` como producción.**

### Versión

Al momento de escribir este documento:

- `config.js`: **v4.2.0**
- `version.json`: **v4.2.0**
- etiquetas visibles de `index.html` / `panel.html`: **v4.2.0**
- los query strings de assets y enlaces internos están sincronizados con `v4.2.0`.

Antes de la próxima publicación conviene sincronizar TODOS los query strings de assets con la versión real.

### Snapshot de Supabase

Conteos al 2026-09-27:

| Tabla | Filas aprox. |
|---|---:|
| settings | 1 |
| leaders | 3 |
| interview_types | 6 |
| profiles | 5 |
| availability | 31 |
| appointments | 2 |
| appointment_history | 2 |
| member_profiles | 2 |
| church_units | 6 |
| church_meetinghouses | 31 |
| unit_staff_assignments | 2 |
| directory_regions | 25 |
| church_directory_places | 261 |
| church_directory_unit_index | 0 |

**NO asumir que Chile y Bolivia ya están cargados completamente.**  
Actualmente el índice de ciudades/regiones está mucho más adelantado que el catálogo final de barrios/ramas. `church_units` todavía tiene pocas unidades materializadas.

---

## 3. Arquitectura general

```text
Miembro
  │
  ├─ Supabase Auth (usuario visible = teléfono)
  │
  ├─ member_profiles
  │      └─ church_unit_id
  │
  ├─ selecciona Barrio/Rama
  │
  ├─ member_available_leaders()
  │      └─ unit_staff_assignments
  │
  ├─ availability
  │      ├─ church_unit_id
  │      ├─ assigned_profile_id
  │      └─ leader_id
  │
  └─ appointments
         ├─ church_unit_id
         ├─ assigned_profile_id
         ├─ member_user_id
         └─ status

Secretario Administrador
  │
  ├─ administra barrios
  ├─ crea/rota líderes
  ├─ asigna cargos + barrios
  ├─ filtra solicitudes
  └─ administra disponibilidad

Secretario de unidad
  └─ opera únicamente su unidad

Obispo / Consejeros
  └─ reciben únicamente entrevistas derivadas a su propia cuenta
```

---

## 4. Archivos principales del frontend

### `index.html`

Aplicación de miembros.

Contiene:

- Login / registro de miembro.
- Menú lateral del miembro.
- Inicio.
- Mi barrio y capilla.
- Mis entrevistas.
- Nueva entrevista.
- Búsqueda manual del directorio.
- GPS.
- Selección de líder / día / hora.

### `public.js`

Lógica del miembro.

Responsabilidades importantes:

- Auth independiente de miembros.
- Normalización de teléfonos.
- Mapeo del teléfono a un email técnico interno.
- GPS.
- Catálogo de ciudades y unidades.
- Confirmación de Barrio/Rama.
- Carga de líderes disponibles en la unidad.
- Carga de horarios libres.
- Creación y seguimiento de solicitudes.

### `panel.html`

Panel interno.

Roles:

- Secretario Administrador.
- Secretario.
- Obispo.
- Primer Consejero.
- Segundo Consejero.

UI actual:

- Menú lateral/hamburguesa.
- Resumen.
- Barrios y liderazgo.
- Directorio de personas.
- Solicitudes.
- Disponibilidad semanal.
- En escritorio, módulos secundarios se han ido convirtiendo en tarjetas/popup para evitar una página extremadamente larga.

### `panel.js`

Lógica del panel.

Responsabilidades:

- Auth de staff.
- Verificación de rol interno.
- Multi-barrio.
- Directorio de usuarios.
- Rotación cargo/barrio.
- Solicitudes.
- Horarios.
- Generación de disponibilidad.
- Filtros.
- Administración de catálogo de barrios.

### `styles.css`

Todo el estilo responsive.

**Historial importante de UX:**

- En móvil se evitó el panel vertical gigantesco.
- Se agregó menú lateral.
- En web se comenzaron a compactar botones excesivamente grandes.
- Directorio/Solicitudes/Disponibilidad se están moviendo a módulos/popup de escritorio.

### `config.js`

Configuración pública del frontend.

Contiene:

- URL Supabase.
- publishable key pública.
- timezone por defecto.
- claves separadas de localStorage para miembro/staff.
- versión.

**Nunca agregar `service_role`, claves secretas, passwords o tokens privados al repositorio.**

### `version.json`

Fuente ligera para detectar una versión nueva y evitar que el navegador siga usando una UI vieja.

---

## 5. Autenticación

### 5.1 Miembros

El miembro ve su teléfono como usuario.

Supabase Auth no usa SMS en el flujo actual.

Se utiliza un email técnico derivado del teléfono:

```text
m<solo_digitos>@members.expressdelivery.pro
```

Ejemplo conceptual:

`+56 9 1234 5678` → `m56912345678@members.expressdelivery.pro`

El miembro nunca necesita conocer este email técnico.

Razón histórica:

- Se evaluó Supabase Phone Auth.
- Requería proveedor SMS (Twilio, Vonage, etc.).
- Para evitar coste/dependencia de SMS, se implementó teléfono + contraseña sobre Email Auth.

**No volver a exponer el email técnico en la UI.**

### 5.2 Staff / líderes

Los líderes creados por correo pueden iniciar sesión con correo.

Los miembros que posteriormente reciben un cargo interno deben poder conservar su misma cuenta y entrar con su teléfono internacional + contraseña.

Storage keys separadas:

- miembro: `obispado-member-auth-v1`
- staff: `obispado-staff-auth-v1`

Esto evita que una sesión de miembro se mezcle con el panel interno.

---

## 6. Roles actuales

En `profiles.role`:

- `unassigned` → Miembro / sin cargo interno
- `secretary_admin` → Administrador global
- `secretary` → Secretario de unidad
- `bishop`
- `first_counselor`
- `second_counselor`

### Secretario Administrador

Puede:

- ver todas las unidades,
- buscar barrios,
- crear accesos,
- rotar cargos,
- asignar barrio,
- ver directorio,
- administrar horarios y solicitudes,
- ver perfiles internos.

### Secretario

Debe operar solo unidades donde exista una asignación activa en `unit_staff_assignments`.

### Obispo / Consejeros

Deben ver solo:

- su unidad,
- sus horarios,
- entrevistas que Secretaría ya derivó a su cuenta.

### Miembro

No debe poder entrar al panel interno si no tiene un cargo interno activo.

---

## 7. Multi-barrio

Tabla clave:

`unit_staff_assignments`

Relaciona:

```text
church_unit_id
profile_id
role
is_active
```

Invariantes importantes:

1. Un cargo de liderazgo pertenece a una unidad.
2. Un Obispo/Primer Consejero/Segundo Consejero activo es único dentro de una unidad.
3. Una persona tiene una sola asignación interna activa principal.
4. Cuando alguien cambia de cargo/barrio:
   - se desactiva la asignación anterior,
   - se cierran horarios futuros libres de la asignación anterior,
   - se conserva la cuenta,
   - NO se borra su historial.
5. Si vuelve a `unassigned`, conserva su cuenta de miembro y pierde acceso interno.

RPC principal:

`admin_rotate_user(...)`

Usarlo para rotaciones; no editar manualmente varias tablas desde el frontend.

---

## 8. Horarios / disponibilidad

Tabla:

`availability`

Campos esenciales:

- `leader_id`
- `church_unit_id`
- `assigned_profile_id`
- `start_at`
- `end_at`
- `is_active`
- `is_booked`

### Cambio importante

Antes se usó un `upsert` directo desde el navegador.

Eso produjo el error:

`there is no unique or exclusion constraint matching the ON CONFLICT specification`

Se corrigió creando índice único compatible y luego se migró a generación server-side.

RPC actual recomendado:

`create_availability_slots(p_slots jsonb)`

Esta función:

- valida permisos,
- valida unidad/líder,
- rechaza horas pasadas,
- evita duplicados,
- devuelve cuántos horarios creó.

**No volver al upsert directo desde el frontend salvo que exista una razón fuerte.**

### UX esperada

Orden del generador:

```text
Barrio/Rama
→ Líder del barrio
→ Semana
→ Día(s)
→ Desde / Hasta
→ Duración
→ Generar
```

Después de generar, el panel debe consultar la semana y mostrar los horarios inmediatamente.

---

## 9. Solicitudes / entrevistas

Tabla:

`appointments`

Campos importantes:

- `member_user_id`
- `church_unit_id`
- `assigned_profile_id`
- `availability_id`
- `interview_type_id`
- `status`

Estados:

1. `pending_secretary`
2. `contacted`
3. `pending_leader`
4. `approved`
5. `rejected`
6. `reschedule`
7. `completed`
8. `cancelled`

### Flujo previsto

```text
Miembro solicita
→ Secretaría revisa
→ Secretaría marca contactado
→ Secretaría deriva al líder
→ Líder aprueba / rechaza / reprograma
→ Entrevista
→ Completada
```

### Regla de privacidad

NO pedir una explicación detallada/confidencial del motivo.

Guardar solo datos de coordinación:

- nombre,
- teléfono,
- unidad,
- líder,
- fecha/hora,
- estado.

---

## 10. Tipos de entrevista

Históricamente existía:

- “Entrevista con el Obispo”
- “Otra entrevista”

Por decisión de producto se desactivó **“Otra entrevista”**.

La selección del líder determina el tipo apropiado.

**No reintroducir un selector “Otra entrevista” sin una nueva decisión explícita.**

---

## 11. Directorio de capillas / barrios / ramas

### Fuente

La integración actual utiliza el directorio público oficial de la Iglesia mediante la Edge Function:

`church-directory`

Estado actual de la función:

- slug: `church-directory`
- ACTIVE
- versión desplegada: **5**
- `verify_jwt: true`

### Tablas

- `church_meetinghouses`
- `church_units`
- `directory_regions`
- `church_directory_places`
- `church_directory_unit_index`

### Países prioritarios

#### Bolivia

Departamentos cargados en `directory_regions`:

- Beni
- Chuquisaca
- Cochabamba
- La Paz
- Oruro
- Pando
- Potosí
- Santa Cruz
- Tarija

#### Chile

Regiones cargadas:

- Arica y Parinacota
- Tarapacá
- Antofagasta
- Atacama
- Coquimbo
- Valparaíso
- Metropolitana de Santiago
- Libertador General Bernardo O’Higgins
- Maule
- Ñuble
- Biobío
- La Araucanía
- Los Ríos
- Los Lagos
- Aysén del General Carlos Ibáñez del Campo
- Magallanes y de la Antártica Chilena

### IMPORTANTE: estado incompleto

El objetivo es:

```text
País
→ Región / Departamento
→ Ciudad
→ Capilla
→ Barrio / Rama
→ cobertura sí/no
```

Pero al momento de este handoff:

- `church_directory_places`: 261 filas
- `church_meetinghouses`: 31
- `church_units`: 6
- `church_directory_unit_index`: 0

Por tanto **NO está materializado todavía el 100% de barrios/ramas de Chile y Bolivia**.

Otra IA debe continuar el sincronizador progresivo, no fingir cobertura total.

### Cobertura

Una unidad existe aunque no tenga líderes del sistema.

Estados conceptuales:

- `covered` → tiene liderazgo asignado
- `partial` → cobertura parcial
- `no_coverage` → unidad conocida pero sin liderazgo del sistema

En miembro, una unidad sin liderazgo debe mostrar un mensaje como:

> “Todavía no tenemos cobertura de líderes en este barrio.”

No ocultar la unidad solo por no tener líderes.

---

## 12. GPS y asignación de unidad

Objetivo:

1. pedir ubicación al miembro,
2. usar coordenadas solo durante la búsqueda,
3. NO guardar las coordenadas precisas del miembro,
4. resolver capillas/unidades cercanas,
5. permitir confirmar Barrio/Rama,
6. fallback manual por país/ciudad/barrio.

Privacidad visible al usuario:

> La ubicación exacta se usa solamente durante la búsqueda y no se guarda en su perfil.

### Evolución

Se descartó depender únicamente de abrir el mapa oficial externo.

El sistema debe resolver dentro de la aplicación usando:

- catálogo local,
- Edge Function,
- directorio oficial público,
- fallback manual.

---

## 13. Funciones RPC relevantes

### Públicas/autenticadas

- `can_access_internal_panel()`
- `staff_accessible_units()`
- `staff_unit_team(p_unit_id)`
- `staff_dashboard_counts(p_unit_id)`
- `member_available_leaders()`
- `member_set_church_unit(...)`
- `admin_assign_unit_staff(...)`
- `admin_unassign_unit_staff(...)`
- `admin_rotate_user(...)`
- `secretary_admin_assign_role(...)`
- `secretary_admin_update_profile(...)`
- `create_availability_slots(p_slots)`
- `admin_people_directory(...)`
- `admin_appointments_page(...)`
- `search_church_catalog(...)`
- `search_church_catalog_v2(...)`

Las implementaciones privilegiadas viven en schema `private`.

Patrón preferido:

```text
public wrapper SECURITY INVOKER
→ private function con validaciones
```

No exponer nuevas funciones `SECURITY DEFINER` directamente en `public`.

---

## 14. Tablas principales

### `profiles`

Cuenta interna y rol.

### `member_profiles`

Perfil de miembro.

Incluye vínculo de Barrio/Rama mediante `church_unit_id`.

### `unit_staff_assignments`

Asignación de líder/secretario a unidad.

### `leaders`

Catálogo lógico:

- bishop
- first_counselor
- second_counselor

No representa una persona concreta.

### `availability`

Slots reales por persona + unidad.

### `appointments`

Solicitudes.

### `appointment_history`

Auditoría.

### `church_meetinghouses`

Edificios/capillas.

### `church_units`

Barrios/Ramas.

### `directory_regions`

Regiones/departamentos.

### `church_directory_places`

Índice de ciudades/localidades oficiales detectadas.

### `church_directory_unit_index`

Cache server-side de URLs de barrios/ramas. Actualmente vacío.

---

## 15. Seguridad / RLS

RLS está activado en todas las tablas públicas importantes.

### Regla fundamental

No confiar en ocultar botones en JavaScript.

Toda separación crítica debe ser aplicada por RLS/RPC.

### Advisor actual

Pendientes reales:

1. **WARN:** Leaked Password Protection desactivado en Supabase Auth.
2. **INFO:** `church_directory_unit_index` tiene RLS habilitado pero todavía sin policy.
3. Performance Advisor marca varias políticas SELECT permisivas duplicadas.
4. Muchos índices figuran “unused” porque la base todavía tiene poco tráfico/datos; no borrarlos automáticamente solo por ese aviso.

Antes de endurecer políticas, comprobar:

- miembro sigue viendo su propia información,
- Secretario Administrador ve todo,
- Secretario solo su unidad,
- líder solo lo asignado,
- Edge Function puede escribir el cache que necesita.

---

## 16. Escalabilidad

El sistema se está moviendo a consultas paginadas/server-side.

Funciones agregadas:

### `admin_people_directory`

Filtros:

- líderes/miembros,
- unidad,
- rol,
- texto,
- limit,
- offset.

### `admin_appointments_page`

Filtros:

- unidad,
- líder,
- estado,
- búsqueda,
- limit,
- offset.

### `staff_dashboard_counts`

Obtiene totales sin cargar todas las filas al navegador.

**Objetivo:** nunca renderizar 1.000–10.000 solicitudes o usuarios completos en una sola carga.

Tamaño de página sugerido: 25.

---

## 17. UX actual y decisiones de diseño

### Miembro

Menú lateral:

- Inicio
- Mi barrio y capilla
- Mis entrevistas
- Nueva entrevista
- Cerrar sesión

### Panel interno móvil

Hamburguesa en el encabezado.

Secciones principales:

- Resumen
- Barrios y liderazgo
- Usuarios
- Solicitudes
- Horarios

### Escritorio

El usuario pidió mantener visible el resumen y administración general, pero compactar módulos secundarios.

Última dirección UX:

- Directorio → botón/tarjeta → popup
- Solicitudes → botón/tarjeta → popup
- Disponibilidad semanal → botón/tarjeta → popup
- Crear usuario → popup
- Crear líder para barrio → popup
- Botones web mucho más pequeños que los botones móviles full-width.

Esta compactación aparece en commits v4.0.1.

---

## 18. Cambios históricos / cosas reemplazadas

### Reemplazado: booking público sin cuenta

Ahora el miembro debe autenticarse para poder tener seguimiento.

### Reemplazado: Supabase Phone Auth + SMS

Se evitó proveedor SMS. Se usa teléfono visible + Email Auth técnico.

### Reemplazado: líderes globales

Antes “Obispo” era genérico.

Ahora:

```text
Barrio X + persona concreta + rol concreto
```

### Reemplazado: Secretario único global

Ahora existe:

- `secretary_admin`: global
- `secretary`: por unidad

### Reemplazado: horarios sin unidad

Ahora deben incluir `church_unit_id` y `assigned_profile_id`.

### Reemplazado: upsert directo de horarios

Ahora se usa `create_availability_slots`.

### Eliminado de UI: “Otra entrevista”

Desactivado por decisión del usuario.

### Reemplazado: página móvil interminable

Se añadió navegación lateral y vistas por sección.

### En proceso de reemplazo: escritorio con todos los módulos desplegados

Se está convirtiendo Directorio/Solicitudes/Disponibilidad en popups/tarjetas compactas.

---

## 19. Línea de tiempo resumida

### v2.x

- Supabase.
- Auth interno.
- Secretario Administrador.
- Creación/edición de usuarios.
- Cuenta de miembro con teléfono.
- Seguimiento.
- GPS / Barrio-Rama.
- Separación estricta miembro vs panel interno.
- “Otra entrevista” deshabilitada.

### v3.0.0

Arquitectura multi-barrio.

- `unit_staff_assignments`
- horarios por unidad/persona,
- entrevistas por unidad,
- RLS por unidad.

### v3.1.0

Menú lateral móvil del panel.

### v3.2.0

Rotación de cargos y barrios.

Miembro ↔ líder sin crear una cuenta nueva.

### v3.3.x

- filtro Barrio → Líder en horarios,
- reparación de constraint de disponibilidad,
- generación server-side de horarios,
- recarga inmediata de horarios,
- detección de versión.

### v4.0.x

Escalabilidad + UX compacta.

- país/región/departamento,
- cobertura,
- directorio paginado,
- solicitudes paginadas,
- índices de búsqueda,
- popups web,
- botones web compactos.

### v4.1.0

Directorio/GPS BO/CL.

Commits recientes relevantes:

- `feat: publicar directorio BO/CL y GPS v4.1.0`
- `fix: no ocultar ciudad seleccionada por filtro de región`
- `fix: conservar barrios ya sincronizados`

---

## 20. Migraciones aplicadas

Orden cronológico registrado en producción:

1. `initial_interview_booking_schema`
2. `fix_appointment_update_policy`
3. `optimize_indexes_and_public_slots`
4. `harden_public_availability`
5. `restrict_leader_visibility_after_secretary`
6. `restrict_availability_client_columns`
7. `add_secretary_admin_role`
8. `secretary_admin_role_assignment_rpc`
9. `harden_secretary_admin_role_rpc`
10. `restrict_profile_list_to_secretary_admin`
11. `add_secretary_admin_user_editing`
12. `member_phone_accounts_and_tracking`
13. `harden_member_account_roles`
14. `member_location_and_church_unit_assignment`
15. `member_phone_username_via_email_auth`
16. `church_meetinghouse_catalog_and_iquique_seed`
17. `church_catalog_upsert_keys`
18. `strict_internal_panel_access`
19. `disable_other_interview_types`
20. `multi_unit_core_schema_v3`
21. `multi_unit_routing_functions_v3`
22. `multi_unit_security_routing_v3`
23. `multi_unit_profile_role_consistency_v3`
24. `multi_unit_compatibility_v3`
25. `multi_unit_assignment_hardening_v3`
26. `multi_unit_appointment_update_compatibility_v3`
27. `rotatable_roles_and_units_v32`
28. `fix_availability_upsert_constraint_v331`
29. `server_side_schedule_generation_v334`
30. `scalable_country_region_directory_v40`
31. `scalable_people_directory_v40`
32. `scalable_dashboard_counts_v40`
33. `accessible_units_region_v40b`
34. `scalable_search_indexes_v40`
35. `location_directory_resolver_v41`
36. `location_resolver_security_v410`
37. `location_directory_resolver_v41`
38. `directory_unit_index_v41`
39. `location_resolver_security_reapply_v410`

No editar migrations históricas. Crear una migration nueva para cada cambio de DDL/policies/functions.

---

## 21. PENDIENTES / NO ASUMIR

Esta sección es crítica para otra IA.

### P0 — versión/cache

Sincronizar query strings de assets:

- `styles.css?v=...`
- `config.js?v=...`
- `panel.js?v=...`
- `public.js?v=...`
- links entre `index.html` y `panel.html`

con `v4.1.0` o la siguiente versión.

### P0 — directorio Chile/Bolivia completo

Todavía NO están materializados todos los barrios/ramas.

Continuar Edge Function y cache progresivo.

No generar barrios ficticios.

Verificación de producción del 2026-09-27: `unit-index` descubrió **563** URLs oficiales de barrios/ramas para Chile. Se procesó una primera tanda de **12** unidades sin errores; continuar con `sync-unit-batch` en tandas y comprobar los conteos y errores entre tandas. Bolivia aún debe indexarse por separado. No generar barrios ficticios.

### P1 — `church_directory_unit_index`

La tabla contiene la cola de importación de Chile y mantiene RLS activo sin policy pública. La Edge Function usa service role; el frontend no consulta la tabla directamente.

Definir si:

- solo Edge Function escribe/lee con service role y frontend no accede,
- o crear policy mínima de lectura autenticada si realmente hace falta.

### P1 — timezone por unidad

Hoy el frontend usa `America/La_Paz` como timezone base.

Eso sirve para Bolivia, pero Chile cambia por DST.

Antes de escala real Chile/Bolivia:

- agregar timezone a `church_units`,
- usarlo para generar/mostrar slots,
- no hardcodear `-04:00`.

### P1 — completar v4 de administración

Objetivo solicitado:

- resumen visible,
- administración multi-barrio visible,
- Directorio en popup,
- Solicitudes en popup,
- Disponibilidad semanal en popup,
- crear usuario en popup,
- filtros por barrio,
- paginación real.

Hay commits de esta migración, pero hacer QA completo desktop + móvil.

### P1 — cobertura

Si un barrio existe pero no tiene líderes:

- debe aparecer en búsqueda,
- mostrar “Sin cobertura”,
- no ofrecer reserva,
- no ocultarlo.

### P2 — performance/RLS

Consolidar políticas permisivas duplicadas solo después de pruebas de permisos.

---

## 22. Checklist antes de cada release

1. Leer `config.js` y `version.json`.
2. Bump de versión.
3. Sincronizar versión visible y query strings.
4. Validar sintaxis de `panel.js` y `public.js`.
5. Revisar IDs HTML usados por JavaScript.
6. No dejar IDs duplicados.
7. Probar:
   - miembro login,
   - miembro logout,
   - barrio,
   - líder,
   - horario,
   - crear entrevista,
   - secretario,
   - líder,
   - completar flujo.
8. Probar móvil.
9. Probar desktop.
10. Ejecutar Security Advisor.
11. Revisar GitHub Pages deployment final.
12. Confirmar dominio `mientrevista.online`.
13. Actualizar este documento si cambia arquitectura.

---

## 23. Reglas para otra IA

### Hacer

- Leer este archivo antes de modificar el proyecto.
- Inspeccionar el código actual antes de asumir nombres/IDs.
- Hacer cambios pequeños y versionados.
- Usar migrations para DDL.
- Mantener RLS.
- Mantener separación miembro/staff.
- Probar producción después de deploy.
- Mantener compatibilidad móvil.

### No hacer

- No crear otra app paralela.
- No romper multi-barrio.
- No convertir el publishable key en una falsa “clave secreta”.
- No poner `service_role` en frontend.
- No almacenar contraseñas.
- No pedir motivos confidenciales de entrevista.
- No volver a mostrar “Otra entrevista” sin pedido explícito.
- No asumir que una capilla equivale a un solo barrio.
- No inventar barrios/unidades que no provengan de catálogo oficial o confirmación administrativa.
- No hacer que un miembro normal pueda abrir el panel interno.
- No asignar líderes a barrios arbitrariamente.
- No borrar historial al rotar un cargo.
- No volver al sistema global de “un solo Obispo para toda la app”.

---

## 24. Fuente de verdad

Orden recomendado:

1. **Supabase schema/RLS/RPC** para seguridad y datos.
2. **Código de `main`** para comportamiento actual.
3. **Este documento** para contexto y decisiones.
4. README solo como introducción.

Si existe conflicto entre este documento y el código/schema, comprobar primero producción y actualizar este documento después.

---

## 25. Nota sobre datos personales

El repositorio/documentación no debe contener:

- contraseñas,
- service role key,
- tokens privados,
- datos confidenciales de entrevistas,
- ubicaciones GPS precisas de miembros,
- notas pastorales/confidenciales.

Los nombres/cuentas reales deben administrarse en Supabase, no documentarse aquí.

---

## 26. Objetivo final

La arquitectura deseada es:

```text
Chile / Bolivia
  └─ Región / Departamento
      └─ Ciudad
          └─ Capilla
              └─ Barrio / Rama
                  ├─ Obispo
                  ├─ Primer Consejero
                  ├─ Segundo Consejero
                  ├─ Secretario(s)
                  ├─ Miembros
                  ├─ Horarios
                  └─ Solicitudes
```

Cada unidad puede existir sin cobertura.

Al agregar liderazgo, la unidad pasa a tener cobertura y sus miembros pueden reservar.

El sistema debe mantenerse usable tanto con 2 solicitudes como con miles.

---

**Cuando otra IA tome el proyecto: empezar por PENDIENTES / NO ASUMIR y luego revisar los últimos commits de `main`.**
