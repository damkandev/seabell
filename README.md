# Seabell

Seabell es un espacio de trabajo local-first para revisar, buscar y anotar documentos PDF. Está pensado para trabajar con expedientes y mantener los documentos en el navegador, sin cuenta ni base de datos propia.

> El proyecto está en desarrollo temprano (`0.1.0`). La estructura de los archivos `.abn` puede cambiar entre versiones.

## Funcionalidades

- Importación y lectura de PDFs locales.
- Búsqueda de texto, selección, resaltados y notas.
- Organización de documentos en expedientes y carpetas.
- Persistencia local en `localStorage` e IndexedDB.
- Exportación e importación de espacios de trabajo portables `.abn`.
- Detección de referencias a leyes y decretos chilenos.
- Consulta opcional de la norma citada desde fuentes externas.

## Privacidad y datos

Los PDFs permanecen en el navegador y no se suben a un servidor de Seabell. La aplicación no requiere autenticación, no incluye analítica y no mantiene una base de datos de usuarios.

La consulta de una referencia legal sí usa servicios externos y envía el tipo y número de la norma. Las fuentes utilizadas son [LeyChile](https://www.bcn.cl/leychile/) y [leyes.pisanvs.cl](https://leyes.pisanvs.cl/). Exporta un archivo `.abn` si necesitas conservar o compartir un espacio de trabajo: borrar los datos del navegador puede eliminar los PDFs guardados localmente.

## API privada y proyecto LeyChile

Seabell utiliza una API privada proporcionada por el proyecto open source [ley-chile](https://github.com/pisanvs/ley-chile), disponible a través de [leyes.pisanvs.cl](https://leyes.pisanvs.cl/). El acceso privado está autorizado únicamente para KeroKero.cl, que participa como sponsor del proyecto; las credenciales y el acceso no forman parte de este repositorio.

Para revisar la implementación, reportar problemas o consultar el acceso al servicio, revisa el repositorio de [ley-chile](https://github.com/pisanvs/ley-chile) o contacta a su propietario, [Max Morel](https://github.com/pisanvs).

## Requisitos

- Node.js 20 o superior.
- pnpm 10 (la versión está fijada en `package.json`).

## Desarrollo local

```bash
pnpm install
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000).

Comandos disponibles:

```bash
pnpm lint       # ESLint
pnpm typecheck  # TypeScript sin emitir archivos
pnpm test:unit  # pruebas unitarias
pnpm test:e2e   # pruebas end-to-end en Chromium, Firefox y WebKit
pnpm build      # build de producción
pnpm start      # servidor de producción
```

## Arquitectura

- `apps/web/`: aplicación web Next.js, sus rutas API, componentes y pruebas.
- `apps/api/`: espacio reservado para el backend independiente; se incorporará cuando exista el primer endpoint que no deba vivir en Next.js.
- `scripts/legacy/`: utilitarios históricos de desarrollo, fuera del runtime.
- `package.json` y `pnpm-workspace.yaml`: comandos y configuración del monorepo.

Actualmente, las rutas API pequeñas siguen en `apps/web/src/app/api/`. No se añade un servidor backend vacío hasta definir su primer contrato.

La interfaz usa Server Components cuando es posible; la lectura y edición de PDFs necesitan APIs del navegador y viven en componentes cliente.

## Contribuir

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir un pull request. Para reportar una vulnerabilidad, sigue [SECURITY.md](SECURITY.md) y no la publiques en un issue.

## Aviso legal

Seabell es una herramienta de organización y consulta documental. El contenido legal se obtiene de servicios externos y puede estar incompleto o desactualizado; no constituye asesoría jurídica.

## Licencia de uso

[PolyForm Noncommercial 1.0.0](LICENSE) © 2026 KeroKero.cl.

El código fuente es público y gratuito para usos no comerciales. No es una licencia Open Source aprobada por la OSI, porque las licencias Open Source no pueden prohibir el uso comercial. KeroKero.cl, como titular del copyright, conserva sus derechos para usar Seabell en sus propios productos y servicios; un tercero que quiera utilizarlo comercialmente necesita una autorización separada de KeroKero.cl.

### Evolución comercial

KeroKero.cl se reserva el derecho de crear en cualquier momento un producto comercial separado a partir del código del que sea titular o para el que tenga derechos comerciales. Si eso ocurre, este repositorio público puede recibir mantenimiento menos frecuente o quedar congelado. Esta licencia no promete soporte ni una frecuencia mínima de mantenimiento.

Las contribuciones de terceros solo podrán incorporarse a ese producto comercial si sus autores otorgan a KeroKero.cl los derechos comerciales correspondientes por separado.
