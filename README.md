# Incorporaciones · ITSQMET

Encuesta de preferencia de sede (Quito / Manta), conectada al proyecto Firebase `utet-4387a`. Interfaz institucional adaptable a móvil, con el logo proporcionado.

## Enlaces

- Estudiantes: https://jeffer91.github.io/incorporaciones/
- Administrador: https://jeffer91.github.io/incorporaciones/admin.html
- PIN de administración: **5626**.

## Primera apertura

1. Entrar al enlace de administrador e introducir el PIN.
2. Seleccionar el período académico.
3. Pulsar **Sincronizar estudiantes**. Se copian al padrón únicamente los datos mínimos de estudiantes no eliminados con matrícula ACTIVO, no retirada y no eliminada en ese período.
4. Revisar el número de habilitados y pulsar **Abrir encuesta**.
5. Compartir el enlace de estudiantes. Ingresan únicamente su cédula, revisan nombre y carrera, eligen Quito o Manta y confirman. El período no se muestra: se resuelve internamente entre los períodos abiertos con padrón activo. Si hay varias matrículas habilitadas, se utiliza la más reciente por ID de período.

Cada combinación período/cédula admite una respuesta. Una transacción evita sobrescrituras concurrentes desde la aplicación. Al volver a consultar, se muestra la sede ya registrada. Los cambios posteriores se gestionan con Titulación; esta versión no tiene edición de respuestas en el panel.

El administrador puede abrir/cerrar por período, actualizar el padrón, ver conteos Quito/Manta/pendientes, buscar, filtrar carrera/sede/estado y exportar los resultados filtrados a CSV compatible con Excel. Al importar CSV en Excel, seleccionar el tipo Texto para cédula, a fin de conservar ceros iniciales.

## Datos

Lecturas institucionales: `periodos`, `Estudiante`, `matriculas`. Se usa la carrera de la matrícula del período, no necesariamente la carrera actual del estudiante. No se modifica ninguna colección institucional existente.

Colecciones propias:
- `incorporaciones_config/{periodoId}`: apertura y fecha de sincronización.
- `incorporaciones_padron/{periodoId}__{cedula}`: nombre, cédula, carrera, período, sede de origen, activo.
- `incorporaciones_respuestas/{periodoId}__{cedula}`: datos mínimos del padrón, sede elegida, consentimiento y fechas del servidor.

No se sube el respaldo de estudiantes al repositorio ni se incorporan datos personales en el código. La sincronización se ejecuta desde el navegador del administrador conectado a Firebase. Para evitar respuestas durante una sincronización parcial, se cierra temporalmente la encuesta. Si una sincronización falla, queda cerrada hasta que se complete correctamente. Los registros retirados se deshabilitan y sus respuestas históricas se conservan; las estadísticas muestran solo el padrón activo.

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

La consulta se inicia automáticamente al completar los 10 dígitos (también permite pulsar Consultar). Primero recupera nombre y carrera desde `Estudiante/{cedula}`, incluso sin encuesta abierta o padrón sincronizado. La elección de sede se habilita solo cuando existe un registro activo en una encuesta abierta. Los cambios de cédula invalidan consultas anteriores para no mostrar datos de otra búsqueda.
