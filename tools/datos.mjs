#!/usr/bin/env node
// Datos del portal PMI: extrae, valida y guarda el bloque news-data de portal/index.html.
//
// Uso:
//   node tools/datos.mjs extraer portal/index.html datos.json   -> escribe el JSON actual
//   node tools/datos.mjs validar datos.json                       -> comprueba el esquema
//   node tools/datos.mjs guardar portal/index.html datos.json    -> valida y lo mete en la página

import { readFileSync, writeFileSync } from "node:fs";

const TEAMS = ["ENE", "INF", "RE", "COR", "STF", "LBO", "SPK"];
const SIGNALS = ["resultados", "liquidez", "mna", "licitacion", "insolvencia", "litigio", "regulatorio", "rating", "esg", "mercado", "macro"];
const SOURCE_TYPES = ["prensa", "agencia", "primaria", "sectorial", "analisis"];
const RELS = ["alta", "media", "baja"];
const GROUPS = ["Tipos", "Energía y materias primas", "Mercados"];
const MAX_PER_TEAM = 30;
const MAX_ARCHIVE = 30;
const BLOCK = /(<script type="application\/json" id="news-data">)([\s\S]*?)(<\/script>)/;

function fail(msg) { console.error("ERROR: " + msg); process.exit(1); }
function readData(html) {
  const m = html.match(BLOCK);
  if (!m) fail("no encuentro el bloque news-data en la página.");
  let d;
  try { d = JSON.parse(m[2]); } catch (e) { fail("el bloque news-data no es JSON válido."); }
  if (d && d.ct) fail("el bloque news-data está cifrado; esta versión de la web no usa cifrado.");
  return d;
}

const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isText = (s) => typeof s === "string" && s.trim().length > 0;

function validate(d) {
  const err = [];
  if (!d || typeof d !== "object") return { err: ["el JSON no es un objeto"], perTeam: {} };
  if (!isDate(d.updated)) err.push("updated debe ser AAAA-MM-DD");
  if (!isText(d.updatedLabel)) err.push("falta updatedLabel");
  if (!isText(d.scope)) err.push("falta scope");
  const s = d.summaries || {};
  ["ALL"].concat(TEAMS).forEach((t) => {
    const x = s[t];
    if (!x) { err.push("falta summaries." + t); return; }
    if (!isText(x.text)) err.push("summaries." + t + ".text vacío");
    if (!Array.isArray(x.points) || !x.points.length || !x.points.every(isText)) err.push("summaries." + t + ".points debe ser una lista de textos");
    if (t !== "ALL" && (!Array.isArray(x.detail) || !x.detail.length || !x.detail.every(isText))) err.push("summaries." + t + ".detail debe ser una lista de párrafos");
  });
  (d.indicators || []).forEach((x, n) => {
    if (!GROUPS.includes(x.group)) err.push("indicators[" + n + "].group no permitido: " + x.group);
    if (!isText(x.label) || !isText(x.value)) err.push("indicators[" + n + "] sin label o value");
    if (x.dir && !["up", "down", "flat"].includes(x.dir)) err.push("indicators[" + n + "].dir no permitido");
  });
  if ((d.agenda || []).length > 8) err.push("agenda tiene más de 8 hitos");
  (d.agenda || []).forEach((x, n) => { if (!isText(x.date) || !isText(x.text)) err.push("agenda[" + n + "] sin date o text"); });
  if (!Array.isArray(d.items) || !d.items.length) err.push("items vacío");
  const ids = new Set();
  const perTeam = Object.fromEntries(TEAMS.map((t) => [t, 0]));
  (d.items || []).forEach((i, n) => {
    const where = "items[" + n + "] (" + (i.id || "sin id") + ")";
    if (!isText(i.id)) err.push(where + ": falta id");
    else if (ids.has(i.id)) err.push(where + ": id repetido"); else ids.add(i.id);
    if (!isDate(i.date)) err.push(where + ": date debe ser AAAA-MM-DD");
    ["source", "title", "summary", "angle"].forEach((f) => { if (!isText(i[f])) err.push(where + ": falta " + f); });
    ["title", "summary", "angle", "source"].forEach((f) => { if (typeof i[f] === "string" && i[f].includes("**")) err.push(where + ": no uses ** en " + f); });
    if (!/^https?:\/\/\S+$/.test(i.url || "")) err.push(where + ": url no válida");
    if (!SOURCE_TYPES.includes(i.sourceType)) err.push(where + ": sourceType no permitido: " + i.sourceType);
    if (!SIGNALS.includes(i.signal)) err.push(where + ": signal no permitido: " + i.signal);
    const rel = i.rel || {};
    if (!Object.keys(rel).length) err.push(where + ": rel vacío");
    Object.keys(rel).forEach((t) => {
      if (!TEAMS.includes(t)) err.push(where + ": equipo no permitido en rel: " + t);
      else perTeam[t]++;
      if (!RELS.includes(rel[t])) err.push(where + ": relevancia no permitida: " + rel[t]);
    });
  });
  TEAMS.forEach((t) => { if (perTeam[t] > MAX_PER_TEAM) err.push("el equipo " + t + " tiene " + perTeam[t] + " noticias (máximo " + MAX_PER_TEAM + ")"); });
  if (!Array.isArray(d.archive)) err.push("archive debe ser una lista");
  else {
    if (d.archive.length > MAX_ARCHIVE) err.push("archive tiene más de " + MAX_ARCHIVE + " días");
    const dates = new Set();
    d.archive.forEach((a, n) => {
      if (!isDate(a.date)) err.push("archive[" + n + "].date no válido");
      else if (dates.has(a.date)) err.push("archive[" + n + "]: fecha repetida " + a.date); else dates.add(a.date);
      if (!a.summaries || !Array.isArray(a.items)) err.push("archive[" + n + "] sin summaries o items");
    });
  }
  return { err, perTeam };
}

const [cmd, a, b] = process.argv.slice(2);

if (cmd === "extraer") {
  if (!a || !b) fail("uso: extraer portal/index.html datos.json");
  const data = readData(readFileSync(a, "utf8"));
  writeFileSync(b, JSON.stringify(data, null, 1) + "\n");
  console.log("OK: datos en " + b + " (" + data.items.length + " noticias, " + (data.archive || []).length + " días en la hemeroteca)");
} else if (cmd === "validar") {
  if (!a) fail("uso: validar datos.json");
  const { err, perTeam } = validate(JSON.parse(readFileSync(a, "utf8")));
  if (err.length) { err.forEach((e) => console.error(" - " + e)); fail(err.length + " problemas en " + a); }
  console.log("OK: esquema válido. Noticias por equipo: " + JSON.stringify(perTeam));
} else if (cmd === "guardar") {
  if (!a || !b) fail("uso: guardar portal/index.html datos.json");
  const html = readFileSync(a, "utf8");
  readData(html);
  const data = JSON.parse(readFileSync(b, "utf8"));
  const { err, perTeam } = validate(data);
  if (err.length) { err.forEach((e) => console.error(" - " + e)); fail("no se guarda: " + err.length + " problemas en " + b); }
  // "<\/" evita que un texto cierre el <script> antes de tiempo.
  const body = JSON.stringify(data).replace(/<\//g, "<\\/");
  const out = html.replace(BLOCK, (m, open, x, close) => open + "\n" + body + "\n" + close);
  if (JSON.stringify(readData(out)) !== JSON.stringify(data)) fail("la comprobación de los datos guardados ha fallado.");
  writeFileSync(a, out);
  console.log("OK: datos guardados en " + a + ". Noticias por equipo: " + JSON.stringify(perTeam));
} else {
  fail("orden desconocida. Usa extraer, validar o guardar.");
}
