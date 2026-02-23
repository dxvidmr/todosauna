

create extension if not exists "pg_cron" with schema "pg_catalog";

create extension if not exists "moddatetime" with schema "extensions";

drop extension if exists "pg_net";


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."rpc_collaborator_login"("p_email_hash" "text") RETURNS TABLE("collaborator_id" "uuid", "display_name" "text", "nivel_estudios" "text", "disciplina" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_email_hash is null or length(trim(p_email_hash)) = 0 then
    return;
  end if;

  return query
  select
    c.collaborator_id,
    c.display_name,
    c.nivel_estudios,
    c.disciplina
  from public.colaboradores c
  where c.email_hash = trim(lower(p_email_hash))
  limit 1;
end;
$$;


ALTER FUNCTION "public"."rpc_collaborator_login"("p_email_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_collaborator_register"("p_email_hash" "text", "p_display_name" "text" DEFAULT NULL::"text", "p_nivel_estudios" "text" DEFAULT NULL::"text", "p_disciplina" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing public.colaboradores%rowtype;
  v_new public.colaboradores%rowtype;
  v_email_hash text;
begin
  v_email_hash := trim(lower(coalesce(p_email_hash, '')));

  if length(v_email_hash) = 0 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'invalid_email_hash'
    );
  end if;

  select *
  into v_existing
  from public.colaboradores
  where email_hash = v_email_hash
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'already_exists',
      'collaborator', jsonb_build_object(
        'collaborator_id', v_existing.collaborator_id,
        'display_name', v_existing.display_name,
        'nivel_estudios', v_existing.nivel_estudios,
        'disciplina', v_existing.disciplina
      )
    );
  end if;

  insert into public.colaboradores (
    email_hash,
    display_name,
    nivel_estudios,
    disciplina
  )
  values (
    v_email_hash,
    nullif(trim(coalesce(p_display_name, '')), ''),
    nullif(trim(coalesce(p_nivel_estudios, '')), ''),
    nullif(trim(coalesce(p_disciplina, '')), '')
  )
  returning *
  into v_new;

  return jsonb_build_object(
    'ok', true,
    'reason', 'created',
    'collaborator', jsonb_build_object(
      'collaborator_id', v_new.collaborator_id,
      'display_name', v_new.display_name,
      'nivel_estudios', v_new.nivel_estudios,
      'disciplina', v_new.disciplina
    )
  );
end;
$$;


ALTER FUNCTION "public"."rpc_collaborator_register"("p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_create_session"("p_es_colaborador" boolean, "p_collaborator_id" "uuid" DEFAULT NULL::"uuid", "p_nivel_estudios" "text" DEFAULT NULL::"text", "p_disciplina" "text" DEFAULT NULL::"text") RETURNS TABLE("session_id" "uuid", "es_colaborador" boolean, "collaborator_id" "uuid", "nivel_estudios" "text", "disciplina" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_session public.sesiones%rowtype;
begin
  if p_es_colaborador is true and p_collaborator_id is null then
    raise exception 'collaborator_id es obligatorio para sesiones de colaborador';
  end if;

  insert into public.sesiones (
    session_id,
    es_colaborador,
    collaborator_id,
    nivel_estudios,
    disciplina
  )
  values (
    gen_random_uuid(),
    coalesce(p_es_colaborador, false),
    p_collaborator_id,
    nullif(trim(coalesce(p_nivel_estudios, '')), ''),
    nullif(trim(coalesce(p_disciplina, '')), '')
  )
  returning *
  into v_session;

  return query
  select
    v_session.session_id,
    v_session.es_colaborador,
    v_session.collaborator_id,
    v_session.nivel_estudios,
    v_session.disciplina,
    v_session.created_at;
end;
$$;


ALTER FUNCTION "public"."rpc_create_session"("p_es_colaborador" boolean, "p_collaborator_id" "uuid", "p_nivel_estudios" "text", "p_disciplina" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_get_global_stats"() RETURNS TABLE("total_evaluaciones" bigint, "utiles" bigint, "mejorables" bigint, "total_sugerencias" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with evals as (
    select vote
    from public.evaluaciones
    where event_type = 'nota_eval'
  ),
  sugs as (
    select 1
    from public.evaluaciones
    where event_type = 'falta_nota'
  )
  select
    (select count(*)::bigint from evals) as total_evaluaciones,
    (select count(*)::bigint from evals where vote = 'up') as utiles,
    (select count(*)::bigint from evals where vote = 'down') as mejorables,
    (select count(*)::bigint from sugs) as total_sugerencias;
$$;


ALTER FUNCTION "public"."rpc_get_global_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_get_note_eval_counts"() RETURNS TABLE("nota_id" "text", "total" bigint, "utiles" bigint, "mejorables" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    e.nota_id,
    count(*)::bigint as total,
    count(*) filter (where e.vote = 'up')::bigint as utiles,
    count(*) filter (where e.vote = 'down')::bigint as mejorables
  from public.evaluaciones e
  where e.event_type = 'nota_eval'
    and e.nota_id is not null
  group by e.nota_id;
$$;


ALTER FUNCTION "public"."rpc_get_note_eval_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_get_session_evaluated_notes"("p_session_id" "uuid") RETURNS TABLE("nota_id" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select distinct e.nota_id
  from public.evaluaciones e
  where e.session_id = p_session_id
    and e.nota_id is not null;
$$;


ALTER FUNCTION "public"."rpc_get_session_evaluated_notes"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_get_session_stats"("p_session_id" "uuid") RETURNS TABLE("total_evaluaciones" bigint, "votos_up" bigint, "votos_down" bigint, "comentarios" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    count(*)::bigint as total_evaluaciones,
    count(*) filter (where vote = 'up')::bigint as votos_up,
    count(*) filter (where vote = 'down')::bigint as votos_down,
    count(*) filter (
      where comment is not null and length(trim(comment)) > 0
    )::bigint as comentarios
  from public.evaluaciones
  where session_id = p_session_id;
$$;


ALTER FUNCTION "public"."rpc_get_session_stats"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_submit_participation_event"("p_source" "text", "p_event_type" "text", "p_session_id" "uuid", "p_pasaje_id" integer DEFAULT NULL::integer, "p_nota_id" "text" DEFAULT NULL::"text", "p_nota_version" numeric DEFAULT NULL::numeric, "p_target_xmlid" "text" DEFAULT NULL::"text", "p_vote" "text" DEFAULT NULL::"text", "p_selected_text" "text" DEFAULT NULL::"text", "p_comment" "text" DEFAULT NULL::"text") RETURNS TABLE("id" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id integer;
  v_event text;
  v_vote text;
begin
  v_event := trim(lower(coalesce(p_event_type, '')));
  v_vote := trim(lower(coalesce(p_vote, '')));

  if p_session_id is null then
    raise exception 'session_id es obligatorio';
  end if;

  if v_event not in ('nota_eval', 'falta_nota') then
    raise exception 'event_type invalido: %', p_event_type;
  end if;

  if v_event = 'nota_eval' then
    if p_nota_id is null or length(trim(p_nota_id)) = 0 then
      raise exception 'nota_id es obligatorio para nota_eval';
    end if;
    if v_vote not in ('up', 'down') then
      raise exception 'vote invalido para nota_eval';
    end if;
  end if;

  insert into public.evaluaciones (
    timestamp,
    source,
    event_type,
    session_id,
    pasaje_id,
    nota_id,
    nota_version,
    target_xmlid,
    vote,
    selected_text,
    comment
  )
  values (
    now(),
    nullif(trim(coalesce(p_source, '')), ''),
    v_event,
    p_session_id,
    p_pasaje_id,
    nullif(trim(coalesce(p_nota_id, '')), ''),
    p_nota_version,
    nullif(trim(coalesce(p_target_xmlid, '')), ''),
    case when v_vote = '' then null else v_vote end,
    nullif(trim(coalesce(p_selected_text, '')), ''),
    nullif(trim(coalesce(p_comment, '')), '')
  )
  returning evaluaciones.id
  into v_id;

  return query
  select v_id;
end;
$$;


ALTER FUNCTION "public"."rpc_submit_participation_event"("p_source" "text", "p_event_type" "text", "p_session_id" "uuid", "p_pasaje_id" integer, "p_nota_id" "text", "p_nota_version" numeric, "p_target_xmlid" "text", "p_vote" "text", "p_selected_text" "text", "p_comment" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."colaboradores" (
    "collaborator_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_hash" "text" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "nivel_estudios" "text",
    "disciplina" "text"
);


ALTER TABLE "public"."colaboradores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evaluaciones" (
    "id" bigint NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "pasaje_id" integer,
    "nota_id" "text",
    "nota_version" numeric(3,1),
    "target_xmlid" "text",
    "vote" "text",
    "comment" "text",
    "selected_text" "text",
    CONSTRAINT "evaluaciones_event_type_check" CHECK (("event_type" = ANY (ARRAY['nota_eval'::"text", 'falta_nota'::"text"]))),
    CONSTRAINT "evaluaciones_source_check" CHECK (("source" = ANY (ARRAY['lectura'::"text", 'laboratorio'::"text"]))),
    CONSTRAINT "evaluaciones_vote_check" CHECK (("vote" = ANY (ARRAY['up'::"text", 'down'::"text"])))
);


ALTER TABLE "public"."evaluaciones" OWNER TO "postgres";


COMMENT ON COLUMN "public"."evaluaciones"."selected_text" IS 'Texto seleccionado por el usuario cuando sugiere que falta una nota. Null para event_type=nota_eval';



CREATE SEQUENCE IF NOT EXISTS "public"."evaluaciones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."evaluaciones_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."evaluaciones_id_seq" OWNED BY "public"."evaluaciones"."id";



CREATE TABLE IF NOT EXISTS "public"."notas" (
    "id" integer NOT NULL,
    "nota_id" "text" NOT NULL,
    "target" "text" NOT NULL,
    "version" numeric(3,1) DEFAULT 1.0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "type" "text" NOT NULL,
    "subtype" "text",
    "texto_nota" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."notas_activas" AS
 SELECT "id",
    "nota_id",
    "target",
    "version",
    "active",
    "type",
    "subtype",
    "texto_nota",
    "created_at"
   FROM "public"."notas"
  WHERE ("active" = true);


ALTER VIEW "public"."notas_activas" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notas_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notas_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notas_id_seq" OWNED BY "public"."notas"."id";



CREATE TABLE IF NOT EXISTS "public"."pasajes" (
    "id" integer NOT NULL,
    "orden" integer NOT NULL,
    "inicio_elemento" "text" NOT NULL,
    "inicio_xmlid" "text" NOT NULL,
    "fin_elemento" "text" NOT NULL,
    "fin_xmlid" "text" NOT NULL,
    "acto" smallint NOT NULL,
    "titulo" "text" NOT NULL,
    "descripcion" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "version" numeric(4,1) DEFAULT 1.0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "pasajes_fin_elemento_check" CHECK (("fin_elemento" = ANY (ARRAY['l'::"text", 'sp'::"text", 'stage'::"text"]))),
    CONSTRAINT "pasajes_inicio_elemento_check" CHECK (("inicio_elemento" = ANY (ARRAY['l'::"text", 'sp'::"text", 'stage'::"text"])))
);


ALTER TABLE "public"."pasajes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."pasajes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pasajes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pasajes_id_seq" OWNED BY "public"."pasajes"."id";



CREATE TABLE IF NOT EXISTS "public"."proyecto_activo" (
    "id" integer NOT NULL,
    "timestamp" timestamp without time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'activo'::"text"
);


ALTER TABLE "public"."proyecto_activo" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."proyecto_activo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."proyecto_activo_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."proyecto_activo_id_seq" OWNED BY "public"."proyecto_activo"."id";



CREATE TABLE IF NOT EXISTS "public"."sesiones" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "es_colaborador" boolean DEFAULT false NOT NULL,
    "collaborator_id" "uuid",
    "nivel_estudios" "text",
    "disciplina" "text"
);


ALTER TABLE "public"."sesiones" OWNER TO "postgres";


ALTER TABLE ONLY "public"."evaluaciones" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."evaluaciones_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."notas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."notas_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pasajes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pasajes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."proyecto_activo" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."proyecto_activo_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."colaboradores"
    ADD CONSTRAINT "colaboradores_email_hash_key" UNIQUE ("email_hash");



ALTER TABLE ONLY "public"."colaboradores"
    ADD CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("collaborator_id");



ALTER TABLE ONLY "public"."evaluaciones"
    ADD CONSTRAINT "evaluaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notas"
    ADD CONSTRAINT "notas_nota_id_version_key" UNIQUE ("nota_id", "version");



ALTER TABLE ONLY "public"."notas"
    ADD CONSTRAINT "notas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pasajes"
    ADD CONSTRAINT "pasajes_orden_key" UNIQUE ("orden");



ALTER TABLE ONLY "public"."pasajes"
    ADD CONSTRAINT "pasajes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proyecto_activo"
    ADD CONSTRAINT "proyecto_activo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sesiones"
    ADD CONSTRAINT "sesiones_pkey" PRIMARY KEY ("session_id");



CREATE INDEX "idx_colaboradores_email_hash" ON "public"."colaboradores" USING "btree" ("email_hash");



CREATE INDEX "idx_evaluaciones_event_type" ON "public"."evaluaciones" USING "btree" ("event_type");



CREATE INDEX "idx_evaluaciones_nota" ON "public"."evaluaciones" USING "btree" ("nota_id", "nota_version");



CREATE INDEX "idx_evaluaciones_nota_id" ON "public"."evaluaciones" USING "btree" ("nota_id");



CREATE INDEX "idx_evaluaciones_pasaje" ON "public"."evaluaciones" USING "btree" ("pasaje_id");



CREATE INDEX "idx_evaluaciones_selected_text" ON "public"."evaluaciones" USING "btree" ("selected_text") WHERE ("event_type" = 'falta_nota'::"text");



CREATE INDEX "idx_evaluaciones_session" ON "public"."evaluaciones" USING "btree" ("session_id");



CREATE INDEX "idx_evaluaciones_session_id" ON "public"."evaluaciones" USING "btree" ("session_id");



CREATE INDEX "idx_evaluaciones_timestamp" ON "public"."evaluaciones" USING "btree" ("timestamp");



CREATE INDEX "idx_notas_active" ON "public"."notas" USING "btree" ("active");



CREATE INDEX "idx_notas_nota_id" ON "public"."notas" USING "btree" ("nota_id");



CREATE INDEX "idx_notas_type" ON "public"."notas" USING "btree" ("type");



CREATE INDEX "idx_pasajes_active" ON "public"."pasajes" USING "btree" ("active") WHERE ("active" = true);



CREATE INDEX "idx_pasajes_acto" ON "public"."pasajes" USING "btree" ("acto");



CREATE INDEX "idx_pasajes_orden" ON "public"."pasajes" USING "btree" ("orden");



CREATE INDEX "idx_sesiones_collaborator_id" ON "public"."sesiones" USING "btree" ("collaborator_id");



CREATE INDEX "idx_sesiones_disciplina" ON "public"."sesiones" USING "btree" ("disciplina");



CREATE INDEX "idx_sesiones_es_colaborador" ON "public"."sesiones" USING "btree" ("es_colaborador");



CREATE INDEX "idx_sesiones_nivel_estudios" ON "public"."sesiones" USING "btree" ("nivel_estudios");



CREATE UNIQUE INDEX "pasajes_orden_active_unique" ON "public"."pasajes" USING "btree" ("orden") WHERE ("active" = true);



ALTER TABLE ONLY "public"."evaluaciones"
    ADD CONSTRAINT "evaluaciones_pasaje_id_fkey" FOREIGN KEY ("pasaje_id") REFERENCES "public"."pasajes"("id");



ALTER TABLE ONLY "public"."evaluaciones"
    ADD CONSTRAINT "evaluaciones_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sesiones"("session_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sesiones"
    ADD CONSTRAINT "sesiones_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."colaboradores"("collaborator_id") ON DELETE CASCADE;



CREATE POLICY "Allow public read notas" ON "public"."notas" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Permitir lectura pública de notas" ON "public"."notas" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."colaboradores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evaluaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pasajes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pasajes_public_select" ON "public"."pasajes" FOR SELECT TO "authenticated", "anon" USING ((COALESCE("active", true) = true));



ALTER TABLE "public"."proyecto_activo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sesiones" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_collaborator_login"("p_email_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_collaborator_login"("p_email_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_collaborator_login"("p_email_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_collaborator_login"("p_email_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_collaborator_register"("p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_collaborator_register"("p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_collaborator_register"("p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_collaborator_register"("p_email_hash" "text", "p_display_name" "text", "p_nivel_estudios" "text", "p_disciplina" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_create_session"("p_es_colaborador" boolean, "p_collaborator_id" "uuid", "p_nivel_estudios" "text", "p_disciplina" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_create_session"("p_es_colaborador" boolean, "p_collaborator_id" "uuid", "p_nivel_estudios" "text", "p_disciplina" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_create_session"("p_es_colaborador" boolean, "p_collaborator_id" "uuid", "p_nivel_estudios" "text", "p_disciplina" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_create_session"("p_es_colaborador" boolean, "p_collaborator_id" "uuid", "p_nivel_estudios" "text", "p_disciplina" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_get_global_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_get_global_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_get_global_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_get_global_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_get_note_eval_counts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_get_note_eval_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_get_note_eval_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_get_note_eval_counts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_get_session_evaluated_notes"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_get_session_evaluated_notes"("p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_get_session_evaluated_notes"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_get_session_evaluated_notes"("p_session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_get_session_stats"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_get_session_stats"("p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_get_session_stats"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_get_session_stats"("p_session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_submit_participation_event"("p_source" "text", "p_event_type" "text", "p_session_id" "uuid", "p_pasaje_id" integer, "p_nota_id" "text", "p_nota_version" numeric, "p_target_xmlid" "text", "p_vote" "text", "p_selected_text" "text", "p_comment" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_submit_participation_event"("p_source" "text", "p_event_type" "text", "p_session_id" "uuid", "p_pasaje_id" integer, "p_nota_id" "text", "p_nota_version" numeric, "p_target_xmlid" "text", "p_vote" "text", "p_selected_text" "text", "p_comment" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_submit_participation_event"("p_source" "text", "p_event_type" "text", "p_session_id" "uuid", "p_pasaje_id" integer, "p_nota_id" "text", "p_nota_version" numeric, "p_target_xmlid" "text", "p_vote" "text", "p_selected_text" "text", "p_comment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_submit_participation_event"("p_source" "text", "p_event_type" "text", "p_session_id" "uuid", "p_pasaje_id" integer, "p_nota_id" "text", "p_nota_version" numeric, "p_target_xmlid" "text", "p_vote" "text", "p_selected_text" "text", "p_comment" "text") TO "service_role";



GRANT ALL ON TABLE "public"."colaboradores" TO "service_role";



GRANT ALL ON TABLE "public"."evaluaciones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."evaluaciones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."evaluaciones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."evaluaciones_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notas" TO "anon";
GRANT ALL ON TABLE "public"."notas" TO "authenticated";
GRANT ALL ON TABLE "public"."notas" TO "service_role";



GRANT ALL ON TABLE "public"."notas_activas" TO "service_role";
GRANT SELECT ON TABLE "public"."notas_activas" TO "anon";
GRANT SELECT ON TABLE "public"."notas_activas" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."notas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pasajes" TO "service_role";
GRANT SELECT ON TABLE "public"."pasajes" TO "anon";
GRANT SELECT ON TABLE "public"."pasajes" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."pasajes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pasajes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pasajes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."proyecto_activo" TO "anon";
GRANT ALL ON TABLE "public"."proyecto_activo" TO "authenticated";
GRANT ALL ON TABLE "public"."proyecto_activo" TO "service_role";



GRANT ALL ON SEQUENCE "public"."proyecto_activo_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."proyecto_activo_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."proyecto_activo_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sesiones" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







-- ============================================
-- SECURITY HARDENING (SQUASHED FROM REMOTE DELTA)
-- ============================================

drop policy "pasajes_public_select" on "public"."pasajes";

revoke delete on table "public"."colaboradores" from "anon";

revoke insert on table "public"."colaboradores" from "anon";

revoke references on table "public"."colaboradores" from "anon";

revoke select on table "public"."colaboradores" from "anon";

revoke trigger on table "public"."colaboradores" from "anon";

revoke truncate on table "public"."colaboradores" from "anon";

revoke update on table "public"."colaboradores" from "anon";

revoke delete on table "public"."colaboradores" from "authenticated";

revoke insert on table "public"."colaboradores" from "authenticated";

revoke references on table "public"."colaboradores" from "authenticated";

revoke select on table "public"."colaboradores" from "authenticated";

revoke trigger on table "public"."colaboradores" from "authenticated";

revoke truncate on table "public"."colaboradores" from "authenticated";

revoke update on table "public"."colaboradores" from "authenticated";

revoke delete on table "public"."evaluaciones" from "anon";

revoke insert on table "public"."evaluaciones" from "anon";

revoke references on table "public"."evaluaciones" from "anon";

revoke select on table "public"."evaluaciones" from "anon";

revoke trigger on table "public"."evaluaciones" from "anon";

revoke truncate on table "public"."evaluaciones" from "anon";

revoke update on table "public"."evaluaciones" from "anon";

revoke delete on table "public"."evaluaciones" from "authenticated";

revoke insert on table "public"."evaluaciones" from "authenticated";

revoke references on table "public"."evaluaciones" from "authenticated";

revoke select on table "public"."evaluaciones" from "authenticated";

revoke trigger on table "public"."evaluaciones" from "authenticated";

revoke truncate on table "public"."evaluaciones" from "authenticated";

revoke update on table "public"."evaluaciones" from "authenticated";

revoke delete on table "public"."pasajes" from "anon";

revoke insert on table "public"."pasajes" from "anon";

revoke references on table "public"."pasajes" from "anon";

revoke trigger on table "public"."pasajes" from "anon";

revoke truncate on table "public"."pasajes" from "anon";

revoke update on table "public"."pasajes" from "anon";

revoke delete on table "public"."pasajes" from "authenticated";

revoke insert on table "public"."pasajes" from "authenticated";

revoke references on table "public"."pasajes" from "authenticated";

revoke trigger on table "public"."pasajes" from "authenticated";

revoke truncate on table "public"."pasajes" from "authenticated";

revoke update on table "public"."pasajes" from "authenticated";

revoke delete on table "public"."sesiones" from "anon";

revoke insert on table "public"."sesiones" from "anon";

revoke references on table "public"."sesiones" from "anon";

revoke select on table "public"."sesiones" from "anon";

revoke trigger on table "public"."sesiones" from "anon";

revoke truncate on table "public"."sesiones" from "anon";

revoke update on table "public"."sesiones" from "anon";

revoke delete on table "public"."sesiones" from "authenticated";

revoke insert on table "public"."sesiones" from "authenticated";

revoke references on table "public"."sesiones" from "authenticated";

revoke select on table "public"."sesiones" from "authenticated";

revoke trigger on table "public"."sesiones" from "authenticated";

revoke truncate on table "public"."sesiones" from "authenticated";

revoke update on table "public"."sesiones" from "authenticated";


  create policy "pasajes_public_select"
  on "public"."pasajes"
  as permissive
  for select
  to anon, authenticated
using ((COALESCE(active, true) = true));



