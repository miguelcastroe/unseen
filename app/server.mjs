import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = Number(process.env.PORT || 8080);
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_INPUT_CHARS = 6000;
const MIN_INPUT_CHARS = 80;
const DAILY_LIMIT = Number(process.env.MAX_REQUESTS_PER_DAY_PER_IP || 20);
const WINDOW_LIMIT = Number(process.env.MAX_REQUESTS_PER_10_MIN_PER_IP || 5);
const TEN_MINUTES = 10 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is not set. /api/unseen will return a configuration error.");
}

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  }
}));

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "https://miguelcastroe.github.io")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const usage = new Map();

function getClientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : String(forwarded || req.ip || "unknown").split(",")[0].trim();
  return ip.slice(0, 128);
}

function rateLimit(req, res, next) {
  const now = Date.now();
  const key = getClientKey(req);
  const record = usage.get(key) || { daily: [], window: [] };

  record.daily = record.daily.filter((time) => now - time < ONE_DAY);
  record.window = record.window.filter((time) => now - time < TEN_MINUTES);

  if (record.window.length >= WINDOW_LIMIT || record.daily.length >= DAILY_LIMIT) {
    const retryAfterMs = record.window.length >= WINDOW_LIMIT
      ? TEN_MINUTES - (now - record.window[0])
      : ONE_DAY - (now - record.daily[0]);
    res.setHeader("Retry-After", Math.max(60, Math.ceil(retryAfterMs / 1000)));
    return res.status(429).json({
      error: "Has alcanzado el límite temporal de lecturas. Inténtalo más tarde."
    });
  }

  record.daily.push(now);
  record.window.push(now);
  usage.set(key, record);
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of usage.entries()) {
    if (!record.daily.some((time) => now - time < ONE_DAY)) usage.delete(key);
  }
}, 60 * 60 * 1000).unref();

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    evidence: {
      type: "string",
      description: "What is explicitly present in the material. No interpretation, invented context, or conclusions."
    },
    interpretation: {
      type: "string",
      description: "The most useful reading of the patterns in the evidence, clearly framed as interpretation rather than fact."
    },
    hypothesis: {
      type: "string",
      description: "One falsifiable hypothesis worth validating, including what would confirm or weaken it."
    },
    tension: {
      type: "string",
      description: "One precise contradiction or pressure revealed by the material. Avoid slogans and generic oppositions."
    },
    opportunity: {
      type: "string",
      description: "A direction worth exploring. It must not be a finished idea, campaign, product concept, or execution."
    },
    question: {
      type: "string",
      description: "One direct question the user should answer before moving forward."
    }
  },
  required: ["evidence", "interpretation", "hypothesis", "tension", "opportunity", "question"]
};

const systemPrompt = `
Eres Unseen, una herramienta de lectura creada a partir del método de Miguel Castro.
Tu trabajo no es producir una idea final. Tu trabajo es ayudar a ver qué contiene realmente un material, qué se está suponiendo y dónde podría existir una oportunidad todavía invisible.

REGLAS DE MÉTODO
1. Separa con rigor evidencia e interpretación.
2. No inventes contexto, datos, intenciones, audiencias ni causas que no estén en el texto.
3. Cuando el material no alcance para sostener una lectura, dilo con precisión.
4. Busca lo normalizado, lo que no encaja, lo que se da por sentado y la contradicción que organiza el problema.
5. Formula una sola tensión central. No acumules varias para parecer profundo.
6. La oportunidad debe ser una dirección de exploración, no una campaña, un concepto creativo, un producto terminado, un nombre, un titular ni una lista de ejecuciones.
7. Evita lenguaje corporativo inflado, moralejas, frases redondas, tríadas decorativas y fórmulas como "no es X, sino Y".
8. Escribe en español neutral. Usa frases concretas, naturales y breves.
9. Cada campo debe aportar algo distinto. No repitas la misma idea con otras palabras.
10. Cierra con una pregunta incómoda pero útil, basada únicamente en el material.

CRITERIOS DE SALIDA
- Evidencia: 2 a 4 observaciones explícitas del texto.
- Interpretación: una lectura provisional de lo que esas observaciones podrían indicar.
- Hipótesis: una afirmación verificable y qué evidencia permitiría validarla o descartarla.
- Tensión: una contradicción específica, humana u operativa, expresada sin eslogan.
- Oportunidad: qué convendría investigar, cambiar de uso, revelar o poner a prueba.
- Pregunta: una sola pregunta para continuar.
`;

function buildPrompt(text) {
  return `${systemPrompt}\n\nMATERIAL A LEER\n---\n${text}\n---\n\nDevuelve únicamente el objeto JSON solicitado.`;
}

function validateOutput(value) {
  const fields = ["evidence", "interpretation", "hypothesis", "tension", "opportunity", "question"];
  if (!value || typeof value !== "object") return false;
  return fields.every((field) => typeof value[field] === "string" && value[field].trim().length > 0);
}

async function generateReading(text) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildPrompt(text),
    config: {
      temperature: 0.45,
      maxOutputTokens: 1800,
      responseMimeType: "application/json",
      responseJsonSchema: responseSchema
    }
  });
  return response.text || "";
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, configured: Boolean(ai) });
});

app.post("/api/unseen", rateLimit, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (!ai) {
    return res.status(503).json({
      error: "Unseen todavía no tiene configurada su conexión con Gemini."
    });
  }

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (text.length < MIN_INPUT_CHARS) {
    return res.status(400).json({
      error: `Incluye al menos ${MIN_INPUT_CHARS} caracteres para poder hacer una lectura útil.`
    });
  }
  if (text.length > MAX_INPUT_CHARS) {
    return res.status(400).json({
      error: `El material supera el máximo de ${MAX_INPUT_CHARS} caracteres.`
    });
  }

  try {
    const raw = await generateReading(text);
    const parsed = JSON.parse(raw);
    if (!validateOutput(parsed)) throw new Error("La respuesta no coincide con el formato de Unseen.");
    return res.json(parsed);
  } catch (error) {
    console.error("Unseen generation failed", error);
    const message = String(error?.message || "");
    if (/429|resource_exhausted|quota/i.test(message)) {
      return res.status(429).json({
        error: "Unseen alcanzó el límite disponible de Gemini. Inténtalo nuevamente más tarde."
      });
    }
    return res.status(502).json({
      error: "La lectura no pudo completarse. Inténtalo de nuevo."
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Unseen listening on port ${PORT} with ${MODEL}`);
});
