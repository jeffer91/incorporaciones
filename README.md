# Incorporaciones · ITSQMET

Encuesta de preferencia de sede (Quito / Manta), conectada al proyecto Firebase `utet-4387a`. Interfaz institucional adaptable a móvil, con el logo proporcionado.

## Enlaces

- Estudiantes: https://jeffer91.github.io/incorporaciones/
- Administrador: https://jeffer91.github.io/incorporaciones/admin.html
- PIN de administración: **5626**.

## Acceso libre y primera apertura

1. Compartir el enlace de estudiantes. No se necesita sincronizar el padrón ni abrir manualmente un período.
2. Cualquier cédula presente en `Estudiante` y no marcada como eliminada puede consultar sus datos, elegir Quito o Manta y confirmar.
3. El período se asigna internamente: se prioriza el período más reciente con matrícula o padrón para esa cédula; sin coincidencias, se elige un período abierto como referencia o el período más reciente disponible. El estudiante nunca ve este dato.
4. Al confirmar se guarda la respuesta y se crea/actualiza el registro correspondiente en el padrón, incluso sin matrícula activa o sincronización previa.
5. El panel incluye las respuestas de estudiantes que no habían sido sincronizados o cuyo registro quedó inactivo posteriormente.

Cada combinación período/cédula admite una sola respuesta. Se utiliza una transacción de Firestore para impedir respuestas duplicadas. Tras confirmar, el estudiante ve «Elegiste la sede Quito/Manta»; si vuelve a consultar su cédula, se muestra «Tu sede es Quito/Manta» sin permitir una segunda elección. El administrador puede usar «Borrar elección» en la fila del estudiante, con confirmación previa, para eliminar exclusivamente esa respuesta. El estudiante permanece en el listado como pendiente y puede volver a elegir. No se modifican las colecciones institucionales.

Sincronizar el padrón desde administración es **opcional**: sirve para mostrar y contactar estudiantes pendientes, no para habilitar ni bloquear su participación. Las estadísticas muestran tanto el padrón activo como los estudiantes que ya respondieron. El administrador puede buscar, filtrar, exportar resultados a CSV y utilizar comunicaciones por WhatsApp y Outlook.

## Datos

Lecturas institucionales: `periodos`, `Estudiante`, `matriculas`. Se usa la carrera de la matrícula del período, no necesariamente la carrera actual del estudiante. No se modifica ninguna colección institucional existente.

Colecciones propias:
- `incorporaciones_config/{periodoId}`: estado administrativo legado y fecha de sincronización; la apertura no limita las respuestas.
- `incorporaciones_padron/{periodoId}__{cedula}`: nombre, cédula, carrera, período, sede de origen, activo.
- `incorporaciones_respuestas/{periodoId}__{cedula}`: datos mínimos del padrón, sede elegida, consentimiento y fechas del servidor.

No se sube el respaldo de estudiantes al repositorio ni se incorporan datos personales en el código. La sincronización se ejecuta desde el navegador del administrador conectado a Firebase. La sincronización del padrón no bloquea nuevas elecciones. Los estudiantes con una cédula institucional vigente pueden responder aunque no estén sincronizados. Se conservan y muestran respuestas incluso cuando un registro de padrón se deshabilita.

## Modelo de acceso solicitado

Los estudiantes ingresan **solo con la cédula**, sin Firebase Authentication. El administrador entra **solo con el PIN 5626**, validado en el navegador; la sesión dura la pestaña. No hay contraseña secreta de servidor, rol autenticado ni protección real de los datos por PIN. Conocer una cédula permite consultar ese registro y responder por él. La validación y unicidad de la aplicación se pueden eludir si se escribe directamente a Firestore con reglas abiertas.

La aplicación utiliza las reglas públicas mostradas por el propietario. **No se despliegan ni cambian reglas de Firestore.** Estas reglas permiten leer, modificar o borrar datos fuera de la interfaz. El PIN es visible en el código público y no cambia esa condición. Para proteger realmente la base en el futuro será necesario cambiar el modelo de acceso y coordinar reglas con las otras aplicaciones del proyecto UTET.

## Desarrollo y publicación

No requiere compilación ni dependencias npm. Firebase SDK modular fijado en 11.10.0, cargado desde gstatic.

```sh
npm run check
npm test
npm run dev
```

GitHub Pages debe usar Source: GitHub Actions (como en la captura proporcionada). El workflow publica exclusivamente `public/` después de las validaciones. La configuración web pública de Firebase no es una clave de servicio. No se necesitan secretos en GitHub para este modelo.

## Archivos

- `public/index.html`: página de estudiantes.
- `public/admin.html`: página de administración.
- `public/app.js`: conexión Firebase y flujos.
- `public/domain.js`: padrón, validaciones, filtros y CSV.
- `public/styles.css`: presentación responsive.
- `public/assets/logo-itsqmet.webp`: identidad institucional.
- `tests/domain.test.js`: pruebas de las reglas de selección y exportación.
- `.github/workflows/pages.yml`: publicación automática.

La consulta se inicia automáticamente al completar los 10 dígitos (también permite pulsar Consultar). Primero recupera nombre y carrera desde `Estudiante/{cedula}`. La elección se ofrece a todas las cédulas institucionales existentes no eliminadas, independientemente del padrón y de la apertura administrativa. Los cambios de cédula invalidan consultas anteriores para no mostrar datos de otra búsqueda.

## Administrador organizado por páginas

- **Estudiantes**: búsqueda y filtros, paginación de 25/50/100, WhatsApp y Outlook individuales, y **Borrar elección** en las filas con sede registrada. El borrado exige confirmación, afecta solo a la respuesta de ese período y permite que el estudiante seleccione de nuevo. La exportación incluye todas las filas filtradas, no solo la página visible.
- **Comunicaciones**: mensaje y asunto editables, grupos (todos / pendientes / respondieron / Quito / Manta), filtro por carrera. Botón global para el período seleccionado y grupo completo. Usa ambos correos, deduplica y omite direcciones inválidas; muestra los estudiantes sin correo válido. Permite elegir Outlook institucional (Microsoft 365) o personal (Outlook.com).
- **Estadísticas**: conteos, porcentaje de respuesta y desglose por carrera de todo el padrón activo del período.
- **Configuración**: sincronización opcional. El selector de período del administrador aplica a todas las páginas. El botón de apertura/cierre se oculta, ya que el acceso del estudiante es libre.

Los contactos se leen desde `Estudiante` al actualizar el administrador y permanecen en memoria; no se añaden al padrón ni a las respuestas. WhatsApp usa números de Ecuador normalizados y números internacionales explícitos. Los mensajes individuales incluyen nombre, carrera y período; la pantalla del estudiante sigue sin mostrar período.

Los enlaces solo abren el editor de WhatsApp u Outlook. **No envían mensajes automáticamente ni registran como enviado un mensaje por abrir un enlace**. El correo global utiliza CCO. Si el enlace supera 1.800 caracteres, se abre el editor de Outlook con asunto y se ofrecen direcciones y mensaje completos para copiar manualmente. No se truncan ni se omiten destinatarios para acortar el enlace. Outlook puede requerir iniciar sesión o seleccionar la cuenta; revisar siempre el borrador antes de enviar.

La encuesta anuncia **Elección de sede para la incorporación**, del **14 al 16 de diciembre de 2026**, con fecha exacta por comunicar.

Archivos nuevos: `public/admin-ui.js` (navegación, tablas y comunicaciones) y `public/communications.js` (contactos, enlaces, paginación y estadísticas). Las pruebas usan datos ficticios y no envían mensajes ni escriben respuestas reales.
