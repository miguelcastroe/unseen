# Unseen · Gemini app

Versión full-stack de Unseen preparada para Google AI Studio Build Mode y su Starter Tier.

## Qué hace

- Recibe entre 80 y 6,000 caracteres.
- Usa una sola solicitud a Gemini por lectura.
- Devuelve JSON estructurado con evidencia, interpretación, hipótesis, tensión, oportunidad y una pregunta para continuar.
- No usa grounding, búsquedas, imágenes ni servicios pagos.
- Mantiene `GEMINI_API_KEY` únicamente en el servidor.
- Incluye límites básicos por IP y no guarda el material enviado.

## Publicar gratis desde Google AI Studio

1. Abre Google AI Studio y entra a **Build**.
2. Elige **Import from GitHub**.
3. Importa `miguelcastroe/unseen` y pide que use la carpeta `/app` como aplicación full-stack.
4. Verifica en **Secrets** que exista `GEMINI_API_KEY`.
5. Ejecuta la vista previa y prueba una lectura.
6. Pulsa **Publish** y elige **Starter Tier**. No actives billing.
7. Elige un subdominio bajo `ai.studio`, por ejemplo `unseen-mce.ai.studio`.

El Starter Tier permite publicar hasta dos aplicaciones full-stack sin configurar billing cuando la cuenta es elegible.

## Prompt para AI Studio

Usa la carpeta `/app` como raíz de la aplicación. Conserva la interfaz y el copy de `public/index.html`. Ejecuta `server.mjs` como backend Node.js. Mantén `GEMINI_API_KEY` como secreto exclusivo del servidor. Usa una sola llamada a Gemini por lectura. No actives Google Search grounding, Maps, imágenes, archivos, bases de datos ni servicios pagos. Mantén el esquema JSON, las reglas metodológicas, el límite de 6,000 caracteres y el rate limit. Corrige únicamente incompatibilidades reales del runtime. Después de verificar una lectura completa, deja la aplicación lista para publicar con Starter Tier, sin billing.

## Variables

- `GEMINI_API_KEY`: requerida.
- `GEMINI_MODEL`: por defecto `gemini-2.5-flash`.
- `PORT`: por defecto `8080`.
- `ALLOWED_ORIGINS`: lista separada por comas.
- `MAX_REQUESTS_PER_DAY_PER_IP`: por defecto `20`.
- `MAX_REQUESTS_PER_10_MIN_PER_IP`: por defecto `5`.

## Nota sobre cuotas

Las cuotas del nivel gratuito dependen del modelo y del proyecto y pueden cambiar. Unseen no activa herramientas con tarifas independientes. Cuando Gemini devuelve un error de cuota, la interfaz informa que la lectura debe intentarse más tarde.
