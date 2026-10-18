# Seabell

[![CI](https://github.com/damkandev/seabell/actions/workflows/ci.yml/badge.svg)](https://github.com/damkandev/seabell/actions/workflows/ci.yml)
[![Licencia: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/licencia-PolyForm--Noncommercial--1.0.0-orange.svg)](LICENSE)
[![GitHub Project](https://img.shields.io/badge/GitHub%20Project-Seabell-2671E5?logo=github)](https://github.com/users/damkandev/projects/1)

Seabell es una aplicación de escritorio local-first para revisar, buscar y anotar documentos PDF, pensada para procuradores que trabajan con expedientes. No requiere cuenta y los documentos nunca salen del equipo.

> El proyecto está en desarrollo temprano (`0.1.0`). La estructura de los archivos `.abn` puede cambiar entre versiones.

## Descargar

Descarga la última versión para macOS o Windows en [dapan.es/seabell](https://dapan.es/seabell). Todas las versiones están en [GitHub Releases](https://github.com/damkandev/seabell/releases).

## Funcionalidades

- Importación y lectura de PDFs locales.
- Búsqueda de texto, selección, resaltados y notas.
- Organización de documentos en expedientes y carpetas.
- Persistencia local en el almacenamiento del webview (`localStorage` e IndexedDB).
- Exportación e importación de espacios de trabajo portables `.abn`.

## Privacidad y datos

Seabell funciona sin conexión: no tiene cuenta, no incluye analítica y no envía documentos a ningún servidor. Exporta un archivo `.abn` si necesitas conservar o compartir un espacio de trabajo: borrar los datos de la aplicación elimina los PDFs guardados localmente.

## Requisitos

- Node.js 20 o superior.
- pnpm 10 (la versión está fijada en `package.json`).
- Rust estable y los [requisitos de Tauri](https://tauri.app/start/prerequisites/) para tu sistema (en macOS, Xcode Command Line Tools).

## Desarrollo local

```bash
pnpm install
pnpm dev
```

`pnpm dev` levanta el frontend de Next.js y abre la ventana de escritorio de Tauri con recarga en caliente.

Comandos disponibles:

```bash
pnpm lint           # ESLint
pnpm typecheck      # TypeScript sin emitir archivos
pnpm test:unit      # pruebas unitarias
pnpm test:e2e       # pruebas end-to-end en Chromium, Firefox y WebKit sobre el export estático
pnpm build          # export estático del frontend en apps/web/out
pnpm build:desktop  # instalador de la app de escritorio
```

Para publicar una versión, sube la versión en `apps/desktop/src-tauri/tauri.conf.json` y pushea un tag con el mismo número (`git tag v0.2.0 && git push origin v0.2.0`). El workflow `Release` compila el `.dmg` universal de macOS y el instalador `.exe` de Windows y los sube al release.

Las apps instaladas revisan al abrir el `latest.json` del último release y ofrecen actualizarse. Ese archivo y los artefactos de actualización se firman con la clave del secret `TAURI_SIGNING_PRIVATE_KEY` (la pública está en `tauri.conf.json`). Guarda un respaldo de la clave privada: si se pierde, las instalaciones existentes no podrán actualizarse.

## Arquitectura

- `apps/web/`: frontend Next.js compilado como export estático (`output: "export"`), sin rutas de servidor.
- `apps/desktop/`: proyecto Tauri 2 que empaqueta `apps/web/out` como aplicación de escritorio.
- `package.json` y `pnpm-workspace.yaml`: comandos y configuración del monorepo.

La lectura y edición de PDFs usan APIs del navegador y viven en componentes cliente que corren dentro del webview de Tauri.

## Contribuir

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir un pull request. Para reportar una vulnerabilidad, sigue [SECURITY.md](SECURITY.md) y no la publiques en un issue.

## Aviso legal

Seabell es una herramienta de organización y consulta documental; no constituye asesoría jurídica.

## Licencia de uso

[PolyForm Noncommercial 1.0.0](LICENSE) © 2026 KeroKero.cl.

El código fuente es público y gratuito para usos no comerciales. No es una licencia Open Source aprobada por la OSI, porque las licencias Open Source no pueden prohibir el uso comercial. KeroKero.cl, como titular del copyright, conserva sus derechos para usar Seabell en sus propios productos y servicios; un tercero que quiera utilizarlo comercialmente necesita una autorización separada de KeroKero.cl.

### Evolución comercial

KeroKero.cl se reserva el derecho de crear en cualquier momento un producto comercial separado a partir del código del que sea titular o para el que tenga derechos comerciales. Si eso ocurre, este repositorio público puede recibir mantenimiento menos frecuente o quedar congelado. Esta licencia no promete soporte ni una frecuencia mínima de mantenimiento.

Las contribuciones de terceros solo podrán incorporarse a ese producto comercial si sus autores otorgan a KeroKero.cl los derechos comerciales correspondientes por separado.
