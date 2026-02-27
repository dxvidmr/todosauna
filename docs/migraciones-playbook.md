# Playbook de migraciones (local, staging, prod)

Este documento define el flujo operativo para trabajar migraciones de Supabase sin romper historial.

## Reglas base (obligatorias)

1. Nunca editar una migracion ya aplicada en remoto.
2. Cualquier correccion se hace con una migracion nueva y timestamp mayor.
3. Antes de push, validar siempre con `npx supabase db reset` en local.
4. Antes de `db push`, revisar sincronia con `npx supabase migration list`.

## Flujo local (desarrollo)

1. Crear migracion nueva:

```bash
npx supabase migration new <nombre_descriptivo>
```

2. Editar SQL en `supabase/migrations/<timestamp>_<nombre>.sql`.
3. Validar baseline completo:

```bash
npx supabase db reset
```

4. Revisar estado de migraciones:

```bash
npx supabase migration list
```

## Flujo staging/prod (aplicar cambios)

1. Confirmar branch limpio y migraciones versionadas en git.
2. Verificar sincronia local/remoto:

```bash
npx supabase migration list
```

3. Aplicar migraciones pendientes:

```bash
npx supabase db push
```

4. Validar post-deploy:
1. RPCs criticas responden (`rpc_bootstrap_session`, `rpc_submit_testimonio`, `rpc_submit_contribucion_archivo_staged`).
2. Edge Functions de upload operativas.
3. Workflow `cleanup-stale-uploads` en verde.

## Rollback operativo

No se hace rollback editando ni borrando migraciones aplicadas. El rollback es por migracion compensatoria.

### Procedimiento

1. Identificar cambio a revertir.
2. Crear migracion compensatoria:

```bash
npx supabase migration new rollback_<feature>_<yyyymmdd>
```

3. Incluir SQL inverso explicito (ejemplo: recrear columna, restaurar vista, ajustar grants).
4. Validar en local:

```bash
npx supabase db reset
```

5. Aplicar en remoto:

```bash
npx supabase db push
```

## Checklist rapido antes de merge

1. `npx supabase db reset` sin errores.
2. `npx supabase migration list` sin drift inesperado.
3. Documentacion de operacion actualizada si cambia un flujo.
4. Si hay cambio en upload/cleanup, actualizar `docs/incidencias-upload-cleanup.md`.
