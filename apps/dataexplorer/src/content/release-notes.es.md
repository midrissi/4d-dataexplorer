# Notas de versión

---

## 1.4.x

### Resumen

La versión `1.4.x` añade el **terminal ORDA** (modos REPL y Código con archivos snippet) en un dock inferior compartido con la Consola; añade **exportación REST** (colección Postman v2.1 y OpenAPI 3.1 desde el catálogo, el Cliente HTTP y el Ejecutor de métodos); publica las apps **iOS y Android**; mejora las vistas previas de red en la consola y el compartir/guardar imágenes; y pule la UX móvil (Cliente HTTP y dock).

### Funciones

#### Terminal ORDA

- **Dock inferior** — Consola y Terminal comparten un panel redimensionable con pestañas; el estado abierto y la pestaña activa se guardan por perfil.
- **REPL** — Ejecute expresiones `ds.*` con resaltado Monaco, autocompletado del catálogo (también dentro de `query("…")`) e historial ↑/↓.
- **Modo Código** — Edite snippets `.js` con nombre; Enter = nueva línea, Mayús+Enter (o Ejecutar) lanza el código; `⌘/Ctrl+Enter` siempre ejecuta.
- **Paquete de snippets** — Exportar/importar gzip (`.orda-snippets.gz`); `.load` / `.run` / `.rm` con completado de nombres.
- **Celdas de resultado** — Entidades y selecciones se abren en pestañas; binarios/imágenes con los visores existentes; el tráfico REST aparece en Consola → Red.
- **Comandos con punto** — `.help`, `.exit`, etc.; ayuda en render compacto.

#### Exportación REST

- **Pestaña Exportación REST** — Ábrala desde Herramientas o la paleta de comandos; un asistente en cuatro pasos (selección → categorías → variables → vista previa) genera una colección Postman v2.1 o una spec OpenAPI 3.1 a partir del catálogo.
- **Catálogo de peticiones** — Auth, catalog, info, CRUD, entity sets, funciones dataclass / entity / entitySelection y singletons. Los métodos no expuestos y el login de directorio están desactivados por defecto.
- **Vista previa** — Expanda o contraiga carpetas (incluido expandir / contraer todo), active o no los emojis, Mayús+clic para aplicar o quitar un emoji por categoría, y opcionalmente adjunte la documentación oficial REST 4D a cada petición.
- **Cliente HTTP y Ejecutor de métodos** — Exporte también la petición actual o los favoritos en Postman u OpenAPI.

#### Móvil

- **Apps iOS y Android** — Shells nativos con perfiles de conexión, HTTP sin CORS y layouts safe-area.
- **Dock táctil** — Consola/Terminal como overlay con objetivos más grandes; hoja de compartir / Descargas para exportaciones.
- **CI móvil** — GitHub Actions construye y publica artefactos móviles (incluida la firma Android).

#### Consola y medios

- **Vista previa de imagen de red** — Vista previa en línea de respuestas de imagen en el registro de red.
- **Compartir / guardar** — Comparta o descargue objetos binarios e imágenes por rutas nativas (corrige fallos de descarga WKWebView en iOS).

#### UX

- **Acerca de** — Diálogo de información desde el chrome móvil/escritorio.
- **Alturas de paneles** — La lista de entidades y paneles de petición recuerdan la altura; la altura de la consola se limita si el viewport es desconocido.
- **Cliente HTTP (móvil)** — Resumen de petición/respuesta adaptado a pantallas estrechas.

### Documentación

- Páginas de la guía [Consola](https://midrissi.github.io/4d-dataexplorer/guide/console.html), [Terminal ORDA](https://midrissi.github.io/4d-dataexplorer/guide/terminal.html), [Exportación REST](https://midrissi.github.io/4d-dataexplorer/guide/rest-export.html) y [Apps móviles](https://midrissi.github.io/4d-dataexplorer/guide/mobile.html).

### Correcciones

- **Descargas iOS** — Las exportaciones de snippets y ajustes usan la ruta nativa en lugar de `<a download>` (NSURLError -3000).
- **Restauración de pestaña** — Recargar con el Terminal abierto ya no fuerza la Consola.
- **Revelar entidad** — Abrir una entidad desde el terminal usa la clave primaria en lugar de `$filter` sobre `__KEY`.
- **Parámetros de consulta vacíos** — La exportación Postman desactiva por defecto `$filter` / `$orderby` / `$attributes` vacíos para que no se envíen hasta rellenarlos.
- **Respuestas OpenAPI** — Las specs exportadas listan los estados REST 4D conocidos (200, 401, 402, 404, 500).
- **Pestaña Docs de Postman** — La documentación de cada petición incluye el markdown oficial de 4D REST, no solo un resumen.

## 1.3.x

### Resumen

La versión `1.3.x` introduce Data Explorer Desktop (Tauri + React) con perfiles de conexión persistentes, integración nativa de ventana y actualizaciones automáticas en la app; añade un Ejecutor de métodos para seleccionar y ejecutar métodos ORDA expuestos con argumentos tipados y vistas de resultado especializadas; añade un Cliente HTTP para componer y reenviar solicitudes REST; añade un panel Consola redimensionable que registra mensajes de la aplicación y cada solicitud HTTP; mejora el manejo de conexiones multiplataforma con soporte HTTP fetch; amplía el tratamiento de datos binarios con carga diferida de BLOB; optimiza el renderizado del grafo de estructura para esquemas grandes; y refina la retroalimentación del asistente y la accesibilidad en superficies clave de navegación.

### Funcionalidades

#### Aplicación de escritorio

- **Data Explorer Desktop** - Nueva aplicación de escritorio construida con Tauri y React.
- **Conexiones guardadas** - Cree, edite y reutilice perfiles de conexión desde una pantalla de conexión dedicada en escritorio.
- **Ventana y tema** - Mejor comportamiento de inicio en escritorio con sincronización mejorada del estado de ventana y tema.
- **Actualizador automático** - Detección de actualizaciones y gestión del proceso en la app con notificaciones.
- **Pipeline de lanzamiento macOS** - El flujo de GitHub Actions ahora empaqueta y sube artefactos de escritorio para macOS.

#### Ejecutor de métodos

- **Pestaña Ejecutor de métodos** - Configure y ejecute métodos 4D expuestos desde una pestaña dedicada; ábrala desde la paleta de comandos, las vistas de clase de datos y entidad, o el asistente.
- **Llamadas según el alcance** - Llame métodos de datastore, clase de datos, entidad y selección de entidades con expresiones al estilo ORDA (`ds.method`, `ds.Table.method`, `ds.Table.entity(key).method`, `ds.Table.sel(key).method`).
- **Argumentos de ejecución** - Construya argumentos posicionales como valores personalizados, referencias de entidad o selecciones de entidades; reordene, duplique y valide antes de ejecutar.
- **Historial de ejecuciones** - Vuelva a abrir ejecuciones correctas recientes; ⌘/Ctrl+clic en las claves del historial para abrir la entidad o selección relacionada.
- **Vistas de resultado** - Inspeccione resultados JSON, o abra automáticamente vistas previas especializadas de entidad y selección de entidades.

#### Panel Consola

- **Consola acoplada** - Abra un panel inferior redimensionable desde la barra de estado o la paleta de comandos para inspeccionar registros mientras navega.
- **Registro de red** - Cada solicitud HTTP se registra con método, URL, estado, duración y tamaño de respuesta; expanda una entrada para inspeccionar cabeceras y cuerpos (secretos redactados).
- **Abrir en el Cliente HTTP** - Reproduzca una entrada de red capturada en el Cliente HTTP con método, URL, cabeceras y cuerpo saneados cuando estén disponibles.
- **Filtros y controles** - Filtre por nivel (todos, log, info, advertencia, error, red), contraiga todas las filas expandidas y limpie el búfer en memoria; los contadores de errores y advertencias aparecen en el botón Consola del pie de página.

#### Cliente HTTP

- **Pestaña Cliente HTTP** - Compose y envíe solicitudes HTTP desde Herramientas o la paleta de comandos hacia el servidor actual o un origen personalizado.
- **Editor de solicitud** - Autocompletado de método, servidor y ruta; Params, Headers, Body (ninguno / formulario / urlencoded / raw / binario) y Settings.
- **Inspector de respuesta** - Estado, tiempo, tamaño, cabeceras, cookies y cuerpo tras Enviar (⌘/Ctrl+Enter).
- **Opciones de escritorio** - Control de cookies de sesión, timeouts, límites de redirección y omisión TLS opcional en builds de escritorio.

#### Conectividad y carga de datos

- **Soporte HTTP fetch** - Los flujos de conexión se actualizaron para admitir llamadas HTTP basadas en fetch en distintos entornos.
- **Carga diferida de BLOB** - Se mejora la carga de objetos binarios con recuperación de BLOB bajo demanda en el visor de entidades.

#### Grafo de estructura e interfaz

- **Respuesta del grafo** - El renderizado del grafo de clases de datos ahora usa estimación de dimensiones de tarjeta y comparaciones optimizadas de resaltado de nodos.
- **Retroalimentación de actividad del asistente** - El chatbot ahora muestra estados de carga más claros y un indicador animado de destellos.
- **Mejoras de accesibilidad** - Barra lateral, barra de pestañas, paleta de comandos y vistas relacionadas recibieron mejoras de accesibilidad y refinamiento semántico de clases.

### Correcciones

- **Renderizado de objetos binarios** - Mejora de las rutas de manejo binario diferido en el visor de entidades.
- **Estabilidad en edición de conexiones** - Se estabilizaron los flujos de edición y actualización de conexiones en escritorio.
- **Diseño HTML de cobertura** - Se ajustó el padding en la salida HTML de cobertura generada para una visualización más limpia.

## 1.2.x

### Resumen

La versión `1.2.x` añade un gestor visual de campos para los atributos mostrados (incluidas rutas de relación anidadas), la carga bajo demanda de entidades relacionadas, un panel de metadatos agrupado, un visor de objetos binarios, asistencia del lenguaje ORDA en el generador de consultas, un asistente IA con herramientas configurables, un constructor de esquema JSON, editores de código basados en Monaco, gestión de conjuntos de entidades en el generador de consultas, el editor de metadatos del asistente, mutaciones de entidades en lote, autenticación por clave de acceso, mejoras en el grafo de estructura incluido el ajuste a la vista, estados de carga y error del visor de entidades y mejoras de interfaz en el asistente y el generador de consultas.

### Funcionalidades

#### Campos mostrados

- **Gestor de campos** — Elija y reordene los atributos mostrados en columnas de tabla y tarjetas desde un único panel; la selección se conserva por pestaña.
- **Atributos anidados** — Profundice en las relaciones para seleccionar atributos anidados (p. ej. `company.name`, y más profundo) tanto para la vista de tabla como de tarjetas.
- **Selección por vista** — Mantenga listas de atributos independientes para la vista de tabla y de tarjetas; arrastre para reordenar.
- **Guardar como predeterminado** — Guarde la selección actual como predeterminada para una clase de datos, o restablezca los valores predeterminados.

#### Visor de entidades

- **Relaciones diferidas** — Cargue entidades y conjuntos de entidades relacionados bajo demanda, en línea en las vistas de formulario y árbol.
- **Tabla compartida para relaciones** — Los conjuntos de entidades relacionados se muestran en la misma cuadrícula de datos que la vista de tabla.
- **Panel de metadatos** — Los atributos de sistema de 4D (`__KEY`, `__STAMP`, `__TIMESTAMP`, …) se agrupan en un panel de metadatos plegable.
- **Todos los atributos en el detalle** — La vista de detalle siempre muestra todos los atributos, incluso cuando el gestor de campos limita las columnas o campos en la lista.
- **Campos de tarjeta expandibles** — Las tarjetas muestran una vista previa de los primeros campos con un botón Mostrar más / Mostrar menos.
- **Visor de objetos binarios** — Previsualice objetos binarios privados de 4D (blobs e imágenes) directamente en el formulario y el visor de entidades.
- **Indicadores de carga** — Los datos de entidad muestran un estado de carga durante la obtención, incluidas las entidades y conjuntos de entidades relacionados.
- **Recuperación ante errores** — Cuando las entidades no se pueden cargar, un panel integrado permite reintentar, restablecer la consulta o cerrar la pestaña.
- **Imágenes diferidas** — Los atributos de imagen se cargan bajo demanda en las celdas de la tabla y el visor de entidades.
- **Tooltips de celda** — Pase el cursor sobre celdas truncadas de la tabla para ver el valor completo.
- **Ordenación de columnas** — Ordene las tablas de entidades por columna, incluidas las tablas de entidades relacionadas.

#### Editor de metadatos del asistente

- **Pestaña Editor de metadatos** — Documente clases de datos, atributos, métodos, singletons y métodos de catálogo para el asistente IA; abrir desde Herramientas, la paleta de comandos o la barra del asistente.
- **Generación de descripciones con IA** — Genere descripciones por campo o en lote para todas las entradas faltantes; generación opcional de esquema JSON para parámetros de método.
- **Indicadores de descripciones faltantes** — Resalte elementos sin documentación; filtre la barra lateral para mostrar solo entradas faltantes.
- **Editor JSON** — Edite el objeto de metadatos completo directamente; exporte el esquema como archivo JSON.

#### Asistente IA

- **Panel del asistente** — Panel de chat IA con herramientas para consultar datos, navegar entre pestañas, ejecutar comandos y controlar la interfaz.
- **Herramientas configurables** — Active o desactive espacios de nombres e herramientas individuales del asistente en Ajustes.
- **Modo pantalla completa** — Expanda el panel del asistente a pantalla completa; pulse Escape para salir.
- **Copiar traza** — Copie la traza de actividad del asistente al portapapeles desde el panel de actividad.
- **Diagramas Mermaid** — Renderizado y manejo de errores mejorados para gráficos Mermaid en las respuestas del asistente.

#### Operaciones de datos

- **Creación/actualización de entidades en lote** — Cree o actualice varias entidades en una llamada mediante la API y las herramientas datastore del asistente.

#### Constructor de esquema JSON

- **Pestaña Constructor de esquema** — Editor visual para construir esquemas JSON; abrir desde el menú Herramientas en el pie.
- **Editor de objetos** — Expandir o contraer objetos anidados y configurar atributos del esquema.

#### Editor de código

- **Editor Monaco** — Editores de código y JSON con autocompletado de esquema en toda la aplicación.
- **Preferencias del editor** — Configure tamaño de fuente, ajuste de línea y barra de herramientas en Ajustes; se aplica a formularios de entidades, el constructor de esquema y otros editores.

#### Consultas y conjuntos de entidades

- **Asistencia del lenguaje ORDA** — Autocompletado, información al pasar el cursor y ayuda de firmas para expresiones de consulta ORDA, con resolución de tipos basada en el catálogo.
- **Operaciones con conjuntos de entidades** — Combine conjuntos de entidades (`AND` / `OR` / `EXCEPT` / `INTERSECT`) y libere conjuntos de entidades mediante la API y las herramientas del asistente.
- **Vinculación de conjuntos** — Vincule pestañas de clases de datos a ID de conjuntos de entidades del servidor existentes; cargue, copie y edite ID en el generador de consultas.
- **Caché de conjuntos** — Los conjuntos de entidades del servidor se almacenan en caché y se liberan al cerrar pestañas.
- **Parámetros de filtro** — Defina parámetros de filtro tipados para expresiones de filtro parametrizadas en el generador de consultas.

#### Perfiles y apariencia

- **Cambio rápido de perfil** — Cambie de perfil desde el pie sin abrir Ajustes; el icono y color del perfil se muestran en la barra de estado.
- **Apariencia por perfil** — Personalice cada perfil con un icono y un color.
- **Tema Qodly** — Nuevo tema Qodly en modos claro y oscuro (tipografía Roboto, acento violeta).

#### Grafo de estructura

- **Firmas de métodos** — Firmas de métodos resaltadas en el grafo de estructura.
- **Indicadores de atributos** — Atributos expuestos y conexiones de relación resaltados visualmente en los nodos de clases de datos.
- **Navegación estable** — Los clics repetidos en una clase de datos ya no vacían el grafo; la ventana gráfica se valida y la selección de nodos se conserva.
- **Ajustar a la vista** — Recentre y haga zoom en el grafo de estructura para mostrar todos los nodos visibles.

#### Autenticación e internacionalización

- **Inicio de sesión con clave de acceso** — Inicie sesión con una clave de acceso REST cuando el servidor requiera autenticación.
- **Internacionalización** — Traducciones ampliadas en la interfaz del asistente, el generador de consultas y otros componentes.

### Correcciones

- **Estado de pestañas** — El estado por pestaña se mantiene coherente al cambiar de pestaña (sincronización de la pestaña activa); el ID de la pestaña activa se valida antes de cerrar pestañas o establecer ID de conjuntos de entidades.
- **Atajos de perfil** — Los atajos se fusionan con los valores predeterminados al cargar perfiles, evitando que una lista vacía borre los atajos configurados.
- **Ventana del grafo de estructura** — El desplazamiento/zoom programático ya no corrompe el estado guardado de la ventana.
- **Edición en vista de lista** — Edición en tabla desactivada en vista de lista para evitar cambios accidentales.
- **Orden de activación de pestañas** — Cerrar una pestaña ahora activa la pestaña usada más recientemente en lugar de la adyacente.

---

## 1.1.x

### Resumen

La versión `1.1.x` ofrece un 4D REST Explorer refinado para explorar clases de datos y entidades, con gestión de perfiles, barra de búsqueda global, modos rápidos de la paleta de comandos, mejoras en atajos de teclado, selección de idioma y un conjunto de capacidades centradas en la visualización y edición de datos.

### Funcionalidades

#### Inicio y navegación

- **Pantalla de bienvenida** — Resumen de tu base de datos: estadísticas, número de entidades y gráficos (`bar` y `pie`)
- **Barra de búsqueda global** — Barra de búsqueda en la cabecera; haz clic o enfoca para abrir la paleta de comandos.
- **Paleta de comandos** — Abrir entidades por ID, abrir una clase de datos o buscar clases desde un solo lugar
- **Comandos recientes** — Los comandos usados recientemente aparecen arriba en la paleta con un icono de reloj; el historial se guarda por perfil.
- **Modos rápidos** — Desde la búsqueda de la paleta, escribe `:` para ir a una entidad por índice, `>` para elegir una clase (vista estructura), `/` para abrir los datos de una clase, o `@` para cambiar de pestaña.
- **Atajos de teclado** — Atajos personalizados para acciones habituales (`paleta de comandos`, `ajustes`, `tema`, `estructura`, etc.)
- **Interfaz con pestañas** — Fijar pestañas, cerrar otras o reordenar arrastrando
- **Pestaña Notas de versión** — Abrir las notas de versión desde la barra de estado (pie); el contenido se muestra en una pestaña dedicada
- **Idioma** — Elegir el idioma de la app (inglés, francés, español) desde la barra de estado (pie); las notas de versión y la interfaz siguen el idioma seleccionado.

#### Clase de datos y entidades

- **Navegador de clases** — Trabajar con varias clases de datos en pestañas y cambiar entre disposición en tarjetas y tabla
- **Constructor de consultas** — Filtro, ordenación, selección de campos y límite; panel de consulta colapsable
- **Lista de entidades** — Lista paginada en un panel redimensionable con badges del número de entidades
- **Visor de entidad** — Inspeccionar el `JSON` de la entidad y crear, editar o eliminar entidades (salvo si el modo solo lectura está activado)
- **Ir a entidad** — Abrir una entidad por ID desde la paleta de comandos

#### Estructura y visualización

- **Grafo de estructura** — Diagrama de clases de datos y sus enlaces; resaltar una clase desde el menú contextual de la pestaña
- **Aspecto de clases** — Colores e iconos por clase en Ajustes

#### Perfiles y ajustes

- **Gestión de perfiles** — Crear, renombrar, duplicar y eliminar perfiles en Ajustes. Cada perfil tiene su propio tema, atajos, ancho de la barra lateral y otras preferencias.
- **Importar / exportar** — Exportar todos los ajustes o perfiles seleccionados a un archivo JSON, e importar ajustes o perfiles desde un archivo (con la opción de elegir qué perfiles importar).

#### Ajustes y apariencia

- **Apariencia** — Varios temas de color (`Slate`, `Tangerine`, `Violet Bloom`, `Graphite`, `Aurora`, etc.)
- **Modo claro / oscuro** — Seguir el sistema o cambiar manualmente
- **Vistas por defecto** — Elegir disposición por defecto (`tarjetas` o `tabla`) y tamaño de página para nuevas pestañas de clase
- **Atajos de teclado** — Activar o desactivar atajos y ver la lista completa en Ajustes
- **Aspecto de clases** — Definir colores e iconos para cada clase en la barra lateral y las pestañas

#### Atajos de teclado

- **Modal de atajos** — La sección «Vista» se muestra ahora en dos columnas para un diseño más compacto.
- **Grabar como acorde** — La opción «Grabar como acorde (secuencia de dos teclas)» está ahora en el modal de grabación de atajo, para poder elegir el modo acorde al grabar un atajo.
- **Visualización de atajos** — Los botones de atajo en Ajustes usan un estilo más ligero, solo con borde (sin fondo) para las teclas.

#### Seguridad y modos

- **Modo solo lectura** — Interruptor en la cabecera para desactivar crear/editar/eliminar y navegar con seguridad
- **Modo edición** — Crear, actualizar y eliminar entidades cuando está activado

### Técnico

- **API REST 4D** — Comunicación con tu servidor 4D por REST y soporte de parámetros de consulta estándar
- **Estado persistente** — Pestañas, ancho de la barra lateral y ajustes almacenados por base (`BASEID`)
