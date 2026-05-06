---
layout: laboratorio
title: Laboratorio de notas
permalink: /participa/laboratorio/
navbar_behavior: fixed
---

<!-- Pantalla de bienvenida -->
<div id="laboratorio-bienvenida" class="laboratorio-bienvenida">
  <section class="container-xl">
    <header class="py-2 py-md-3 mb-4 mb-md-5 text-center">
      <nav class="ui-eyebrow mb-2" aria-label="breadcrumb">
        <a class="breadcrumb-link" href="{{ '/participa/' | relative_url }}">Participa</a>
        <span aria-hidden="true"> · </span>
        <span aria-current="page">Laboratorio</span>
      </nav>
      <h1 class="display-5 fw-semibold mb-0">Laboratorio de notas</h1>
    </header>

    <div class="row g-3 g-lg-4 align-items-start">
      <div class="col-12 col-lg-8 d-grid gap-3">
        <img
          src="{{ '/assets/img/laboratorio.gif' | relative_url }}"
          alt="Demostración de uso del Laboratorio de notas"
          class="img-fluid w-100 d-block rounded-3"
          loading="eager"
          decoding="async">

        <article>
          <div>
            <h2 class="h5">¿Qué es?</h2>
            <p class="mb-0">Un espacio colaborativo donde puedes leer pasajes de <em>Fuenteovejuna</em> y evaluar si las notas explicativas te resultan útiles para entender la obra.</p>
          </div>
        </article>

        <article>
          <div>
            <h2 class="h5">¿Para qué?</h2>
            <p class="mb-0">Tu opinión ayuda a mejorar la experiencia de lectura para toda la comunidad. Con tus evaluaciones contribuyes a identificar qué notas funcionan mejor o dónde faltan.</p>
          </div>
        </article>

        <article>
          <div>
            <h2 class="h5">¿Cómo funciona?</h2>
            <ol class="mb-0">
              <li>Elige un modo de sesión (secuencial o aleatorio)</li>
              <li>Lee el pasaje y haz clic en el texto subrayado para ver las notas</li>
              <li>Evalúa cada nota como "útil" o "mejorable"</li>
              <li>También puedes seleccionar cualquier fragmento del texto y sugerir nuevas notas</li>
              <li>Continúa con el siguiente pasaje</li>
            </ol>
            <p class="mt-3 mb-0">
              Consulta la <a href="{{ '/participa/guia/' | relative_url }}">guía de participación</a> para ver toda la información.
            </p>
          </div>
        </article>
      </div>

      <div class="col-12 col-lg-4 d-grid gap-3">
        <article class="card card-soft ui-thin-border">
          <div class="card-body d-flex flex-column p-3">
            <h2 class="h5">Modo secuencial</h2>
            <p class="text-neutral-700 mb-3">Recorre los pasajes en orden cronológico de la obra</p>
            <button type="button" class="btn btn-dark align-self-start mt-auto" data-lab-start-mode data-modo="secuencial">Iniciar</button>
          </div>
        </article>

        <article class="card card-soft ui-thin-border">
          <div class="card-body d-flex flex-column p-3">
            <h2 class="h5">Modo aleatorio</h2>
            <p class="text-neutral-700 mb-3">Sorpréndete con un pasaje al azar de la obra</p>
            <button type="button" class="btn btn-dark align-self-start mt-auto" data-lab-start-mode data-modo="aleatorio">Iniciar</button>
          </div>
        </article>

        <div class="stats-globales stats-globales--parked bg-neutral-100">
          <div class="loading-stats-container">
            <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
            Cargando estadísticas...
          </div>
        </div>
      </div>
    </div>
  </section>
</div>
