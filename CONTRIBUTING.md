# Contribuir a Seabell

Gracias por tu interés en contribuir.

## Antes de empezar

1. Busca issues existentes antes de abrir uno nuevo.
2. Para cambios grandes, abre primero un issue para acordar el alcance.
3. No incluyas PDFs reales, datos personales, credenciales ni archivos `.env` en commits o reportes.

## Desarrollo

```bash
pnpm install
pnpm dev
```

Antes de enviar un pull request, ejecuta:

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

Los cambios de interfaz también deberían verificarse con `pnpm test:e2e` cuando corresponda.

## Pull requests

- Explica qué cambió y por qué.
- Mantén el cambio enfocado y evita dependencias nuevas sin una razón clara.
- Añade o actualiza pruebas cuando cambie un comportamiento.
- No mezcles formateos masivos o cambios no relacionados.
- No envíes código que esperes que KeroKero.cl pueda usar comercialmente sin acordar esos derechos por escrito.

## Estilo

Usa TypeScript estricto, componentes de servidor cuando sea posible y APIs nativas del navegador antes que nuevas librerías. El código y los comentarios pueden estar en español o inglés, pero los nombres deben ser claros y consistentes con el código existente.
