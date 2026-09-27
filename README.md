# Entrevistas del Obispado

Aplicación web multi-barrio para solicitar, coordinar y dar seguimiento a entrevistas con el Obispado.

**Versión actual declarada:** v4.2.2
**Producción:** https://mientrevista.online  
**Backend:** Supabase  
**Deploy:** GitHub Pages desde `main`

## Antes de modificar el proyecto

Lee primero:

**[docs/PROJECT_HANDOFF.md](docs/PROJECT_HANDOFF.md)**

Ese documento contiene el contexto completo para IA/desarrolladores:

- arquitectura actual;
- autenticación de miembros y líderes;
- roles y permisos;
- multi-barrio;
- horarios;
- flujo de solicitudes;
- GPS/directorio de capillas;
- Chile/Bolivia;
- Supabase/RLS/RPC;
- Edge Functions;
- historial de decisiones;
- funciones eliminadas o reemplazadas;
- migraciones aplicadas;
- pendientes reales;
- problemas conocidos;
- checklist de publicación.

## Arquitectura resumida

```text
País
└─ Región / Departamento
   └─ Ciudad
      └─ Capilla
         └─ Barrio / Rama
            ├─ Obispo
            ├─ Consejeros
            ├─ Secretario(s)
            ├─ Miembros
            ├─ Horarios
            └─ Solicitudes
```

El sistema separa los datos por unidad mediante Supabase RLS y asignaciones explícitas de liderazgo.

## Seguridad

- Supabase Auth.
- RLS en las tablas de aplicación.
- La publishable key del frontend no es una clave secreta.
- **Nunca** agregar `service_role`, contraseñas ni tokens privados al repositorio.
- No almacenar motivos confidenciales de entrevistas ni coordenadas GPS precisas de miembros.

## Producción

El workflow `.github/workflows/pages.yml` despliega automáticamente cada push a `main`.

Por eso, antes de publicar cambios:

1. revisar el handoff;
2. incrementar la versión;
3. sincronizar query strings de assets;
4. probar miembro + panel interno;
5. revisar móvil y escritorio;
6. comprobar GitHub Pages;
7. ejecutar Supabase Security Advisor.

## Estado del directorio geográfico

Chile y Bolivia están en proceso de indexación/sincronización.

**No asumir que todos los barrios/ramas ya están cargados.**  
Consultar la sección “PENDIENTES / NO ASUMIR” del handoff antes de trabajar en cobertura geográfica.
