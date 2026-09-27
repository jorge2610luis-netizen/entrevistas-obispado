# Entrevistas del Obispado — v2 Supabase

Aplicación para solicitar y gestionar entrevistas: formulario público, revisión del secretario, decisión final del líder y administración de horarios.

## Seguridad

- Usa Supabase Auth para el acceso interno.
- La clave de `config.js` es una clave pública para frontend.
- No agregues claves `service_role` ni claves secretas al repositorio.
- Las reglas RLS de Supabase controlan los datos y acciones por rol.

## Roles

- `secretary`: revisa solicitudes y administra horarios de todos los líderes.
- `bishop`, `first_counselor`, `second_counselor`: revisan sus propias solicitudes y horarios.

## Publicación

En GitHub: **Settings → Pages → Deploy from a branch → main → /(root) → Save**.

Después crea los usuarios internos en Supabase Authentication y asígnales su rol en la tabla `profiles`.


## v2.1.0

- Nuevo rol `secretary_admin`.
- El Secretario Administrador puede crear accesos internos desde el panel.
- Roles disponibles: Secretario Administrador, Secretario, Obispo, Primer Consejero y Segundo Consejero.
- Nuevo generador semanal de disponibilidad por mes, semana, días, rango horario y duración.
- El flujo del Secretario exige marcar primero al miembro como contactado antes de derivarlo al líder.
