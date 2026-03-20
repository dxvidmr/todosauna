---
layout: page
title: Datos abiertos
permalink: /datos/
---

<section class="py-2 py-md-3">
  <div class="row justify-content-center mb-4 mb-md-5">
    <div class="col-lg-10 text-center">
      <h1 class="display-5 fw-semibold mb-3">Datos abiertos</h1>
      <p class="lead mb-0">
        Descarga y reutiliza los datos de <i>Todos a una</i>. Aprende sobre ciencia abierta y participativa
      </p>
      <a class="btn btn-lg btn-primary mt-4" href="#datos-descargas-grid">Descargas</a>
    </div>
  </div>

  <div class="row justify-content-center mb-4 mb-md-5">
    <div class="col-lg-10">
      <div class="vstack gap-3">
        <div class="text-dark">
          <p class="mb-0">
            En <i>Todos a una</i> queremos que los materiales generados por la investigación puedan consultarse, descargarse y reutilizarse.
            Por eso, en esta página encontrarás enlaces para descargar el archivo XML-TEI que alimenta la edición digital y la colección
            de metadatos del archivo documental en CSV. Compartir estos recursos forma parte de una manera de investigar que apuesta por
            la transparencia, la circulación del conocimiento y la posibilidad de que otras personas vuelvan a trabajar con estos datos.
          </p>
        </div>

        <div class="card card-soft ui-thin-border bg-neutral-50 text-dark">
          <div class="card-body">
            <h2 class="h4 mb-2">Qué es la ciencia abierta</h2>
            <p class="mb-3">
              La ciencia abierta promueve una forma de investigación más accesible, en la que los resultados, los datos y los métodos
              puedan ponerse a disposición de otras personas. En humanidades digitales, esto incluye los archivos que generan las ediciones,
              el contenido de bases de datos en formatos reutilizables y recursos que permiten comprender cómo se ha construido un proyecto.
            </p>
            <button class="btn btn-sm btn-outline-dark" type="button" data-bs-toggle="collapse" data-bs-target="#datos-ciencia-abierta-mas" aria-expanded="false" aria-controls="datos-ciencia-abierta-mas">
              Leer más
            </button>
            <div class="collapse mt-3" id="datos-ciencia-abierta-mas">
              <p>
                Poner estos materiales en abierto favorece la consulta, la revisión y la reutilización. También ayuda a que el conocimiento
                circule más allá del marco inmediato en el que fue producido y a que pueda integrarse en nuevas investigaciones,
                proyectos docentes o desarrollos digitales.
              </p>
              <p class="mb-0">
                Este enfoque ha sido impulsado por marcos internacionales como la
                <a href="https://www.unesco.org/en/legal-affairs/recommendation-open-science" target="_blank" rel="noopener noreferrer">Recomendación de la UNESCO sobre la Ciencia Abierta (2021)</a>.
                En la misma línea, los principios FAIR proponen que los datos sean localizables, accesibles, interoperables y reutilizables.
              </p>
            </div>
          </div>
        </div>

        <div class="card card-soft ui-thin-border bg-neutral-100 text-dark">
          <div class="card-body">
            <h2 class="h4 mb-2">¿Y la ciencia ciudadana?</h2>
            <p class="mb-3">
              La ciencia ciudadana parte de la idea de que la sociedad puede participar también en la producción de conocimiento.
              En proyectos culturales y humanísticos, esta participación puede tomar formas diversas: compartir testimonios,
              aportar materiales o contribuir a ampliar la información disponible sobre una obra, un archivo o una tradición cultural.
            </p>
            <button class="btn btn-sm btn-outline-dark" type="button" data-bs-toggle="collapse" data-bs-target="#datos-ciencia-ciudadana-mas" aria-expanded="false" aria-controls="datos-ciencia-ciudadana-mas">
              Leer más
            </button>
            <div class="collapse mt-3" id="datos-ciencia-ciudadana-mas">
              <p>
                En este contexto, la participación tiene un valor especial cuando el objeto de estudio cuenta con una trayectoria amplia
                de circulación y recepción, como ocurre con <i>Fuenteovejuna</i>. La historia de una obra no se conserva solo en sus testimonios
                textuales o en su bibliografía académica: también permanece en programas, fotografías, noticias, adaptaciones, recuerdos
                de espectadores, experiencias escolares y usos comunitarios.
              </p>
              <p class="mb-0">
                La ciencia ciudadana permite incorporar esa dimensión social al trabajo de investigación, abriendo el proyecto a formas
                de colaboración que enriquecen el archivo y amplían la mirada sobre la obra.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="row justify-content-center mb-3">
    <div class="col-lg-10">
      <h2 class="h3 fw-semibold mb-0">Datos reutilizables y descargas</h2>
    </div>
  </div>

  {% assign datos_cards = site.data.datos_cards %}
  <div id="datos-descargas-grid" class="ta-grid">
    {% for card in datos_cards %}
      {% include cards/ta-card.html card=card context="grid" %}
    {% endfor %}
  </div>
</section>
