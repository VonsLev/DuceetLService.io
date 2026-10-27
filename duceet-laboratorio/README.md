# DUCEET Laboratorio funcional v1.1

## Ejecutar
1. Extrae el ZIP.
2. Abre `laboratorio.html` en Chrome o Edge. No requiere instalar paquetes.

## Funciones implementadas
- 8 fichas iniciales de Plenos Casatorios Civiles, con clasificación, sumilla, resumen y enlaces a catálogos oficiales del Poder Judicial.
- 16 modelos base con campos editables y descarga `.doc` compatible con Microsoft Word. Los modelos requieren revisión jurídica individual antes de su uso real.
- MiniBiblioteca que construye búsquedas externas en ALICIA, SciELO, LA Referencia, Google Scholar y el repositorio CONCYTEC. Los resultados se consultan en las fuentes; esta versión estática no scrapea ni simula resultados.
- Directorio de portales oficiales de convocatorias y búsqueda guiada por términos. No se inventan vacantes ni fechas; el feed automático requiere un servidor/conectores.
- Módulo Legalmente Creativos con tres guiones educativos y reproducción mediante voz sintetizada del navegador, no grabaciones de estudio.

## Limitaciones conocidas
- La búsqueda bibliográfica abre portales externos; no devuelve resultados federados dentro de la página porque se requiere backend/API y permisos de cada repositorio.
- Las convocatorias se consultan en portales oficiales; no hay sincronización automática ni clasificación automática de vigencia.
- Las fichas jurisprudenciales iniciales se centran en Plenos Casatorios Civiles y contienen sumillas/resúmenes de orientación, no transcripciones de las sentencias. Revisar la fuente original y el alcance vinculante antes de citar.
- Los documentos Word son plantillas base, no asesoría legal ni escritos listos para presentar.


## Versión 1.2 — correcciones de la revisión

- `plantillas_word/` contiene 16 archivos `.docx` editables con encabezado de expediente, especialista, cuaderno, número de escrito, sumilla, base legal, petitorio, hechos, fundamentos, medios probatorios, anexos y firma. Son plantillas base y requieren revisión por procedimiento antes de usarse.
- La descarga directa `.docx` se distingue del borrador generado dinámicamente `.doc`.
- El archivo acumulativo de referencias se conserva en el almacenamiento local del navegador y permite exportar/importar JSON y evitar duplicados por URL/título. No es sincronización en la nube ni un crawler.
- Se añadieron dos convocatorias de prácticas profesionales de Derecho de OSITRAN verificadas en sus bases oficiales el 08/10/2026, con cierres previstos el 13 y 16 de octubre de 2026. Verificar eventuales fe de erratas y cambios antes de postular.
- La clasificación de jurisprudencia se conserva con estado de verificación explícito: ser un Pleno Casatorio no autoriza a etiquetar sin revisión el alcance de cada regla. La verificación de publicación y del extremo vinculante debe realizarse contra la resolución y la fuente oficial pertinente.
- OCR: esta versión aún no realiza OCR automático ni rastreo masivo de repositorios. Para ello se requiere un servicio de ingesta independiente (PDF de texto + OCR para PDF escaneado), índice persistente y conectores de fuentes.

### Lector PDF y OCR incremental (herramienta local inicial)

1. Instala Python 3.10 o superior.
2. Coloca PDFs que hayas obtenido legítimamente en `PDF_PARA_INDEXAR`. Para conservar la fuente web, crea junto al PDF un archivo con el mismo nombre y extensión `.url.txt` y pega el enlace original.
3. Ejecuta `iniciar_lector_pdf.bat` para extraer texto de PDFs digitales e indexarlos en `archivo_documental.sqlite3`.
4. Para documentos escaneados, instala además Tesseract OCR para Windows con el paquete de idioma español y ejecuta `python ingest_pdf.py --folder PDF_PARA_INDEXAR --ocr --lang spa`.
5. Busca en el archivo con `python ingest_pdf.py --search "precedente vinculante"`.

El índice utiliza hash SHA-256 para no volver a procesar archivos idénticos y FTS5 para búsqueda local. Esta herramienta todavía no rastrea repositorios en Internet ni determina por sí sola si una decisión es vinculante: esa validación exige revisar el texto, la publicación y la norma aplicable.


## Versión 1.3 — fundamentos jurídicos y MiniBiblioteca

- Las 16 plantillas Word ahora desarrollan la sección de fundamentos jurídicos en pasos: norma/artículo aplicable, regla, aplicación a los hechos, jurisprudencia/doctrina pertinente y requisitos especiales de la vía. No se inventan números de artículos; cada modelo exige completar la norma específica verificada. El art. 424.7 del Código Procesal Civil contempla la fundamentación jurídica del petitorio como requisito de la demanda civil; no debe extrapolarse mecánicamente a cualquier escrito o procedimiento. Fuente de consulta: https://www.pj.gob.pe/wps/wcm/connect/2e6fa4004d90af10858bf5db524a342a/C%C3%B3digo%2BProcesal%2BCivil.pdf?MOD=AJPERES
- MiniBiblioteca consulta Crossref y OpenAlex cuando hay conexión, presenta fichas dentro de la página con título, autoría, año, fuente y enlace a la publicación/landing page, deduplica resultados y permite filtros temporales y por tipo aproximado. Se mantienen enlaces de búsqueda de ALICIA, SciELO, LA Referencia y Google Scholar como fuentes complementarias.
- Generador de referencias con formatos modelo APA 7, Chicago autor-fecha, Vancouver, MLA 9, Harvard, ISO 690 e IEEE. Es un asistente de formato: revisar reglas institucionales, edición y metadatos antes de entregar.
- Lector PDF del navegador intenta extraer metadatos PDF y texto de las primeras páginas para prellenar título/autor/año. Si no hay capa de texto (PDF escaneado), usar el indexador OCR local con Tesseract instalado; los datos detectados no se consideran verificados automáticamente.
- Limitaciones honestas: no todos los repositorios ofrecen API pública ni todos los libros/tesis aparecerán en Crossref/OpenAlex; por ello los resultados se complementan con enlaces de consulta. Esta versión no descarga automáticamente el contenido de los repositorios ni elude controles de acceso.


## Versión 1.4 — esquema jurisprudencial multi-rama

- Se amplió `esquema_jurisprudencia.json` para incluir 23 ramas jurídicas y categorías diferenciadas, entre ellas precedente vinculante, doctrina jurisprudencial, doctrina relevante, pleno casatorio, acuerdo plenario, precedentes administrativos y criterios de observancia obligatoria.
- La interfaz de jurisprudencia permite filtrar por rama y categoría y muestra un mapa de cobertura que distingue fichas cargadas de ramas pendientes de ingesta.
- No se crean casos ficticios para simular cobertura nacional: el conjunto inicial contiene 8 fichas de Plenos Casatorios Civiles; sus enlaces pueden llevar a catálogos institucionales generales y el alcance vinculante individual sigue pendiente de comprobación.
- Criterio obligatorio de calidad: solo marcar como precedente vinculante tras verificar la resolución individual, la regla jurídica expresa, el órgano competente y la norma aplicable. La categoría formal de una resolución no determina por sí sola que todo su contenido sea vinculante.
- Este cambio prepara la estructura de datos y la interfaz para ampliar la jurisprudencia a todas las ramas principales; no equivale todavía a una base nacional completa ni a un rastreador automático.
