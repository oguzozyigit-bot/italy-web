// /js/api.js
// ITALKY API helper (single source of truth)

import { BASE_DOMAIN } from "./config.js";

const API_TOKEN_KEY = "italky_api_token";

function getApiToken() {
  return (localStorage.getItem(API_TOKEN_KEY) || "").trim();
}

function getGoogleIdToken() {
  return (localStorage.getItem("google_id_token") || "").trim();
}

function buildHeaders(extra = {}) {
  const h = {
    "Content-Type": "application/json",
    ...extra
  };

  const apiToken = getApiToken();
  const googleIdToken = getGoogleIdToken();

  // Backend hangi header'ı bekliyorsa yakalasın diye 2'sini de veriyoruz
  if (apiToken) h["Authorization"] = `Bearer ${apiToken}`;
  if (apiToken) h["X-Api-Token"] = apiToken;

  if (googleIdToken) h["X-Google-Id-Token"] = googleIdToken;
  if (googleIdToken) h["X-Id-Token"] = googleIdToken;

  return h;
}

async function readTextSafe(res) {
  try { return await res.text(); } catch { return ""; }
}

export async function apiGET(path, { headers = {}, raw = false } = {}) {
  const url = `${BASE_DOMAIN}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: buildHeaders(headers),
  });

  if (raw) return res;

  const txt = await readTextSafe(res);
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch {}

  if (!res.ok) {
    const msg = (data?.detail || data?.message || txt || `HTTP ${res.status}`).toString();
    throw new Error(msg);
  }

  return data;
}

export async function apiPOST(path, body = {}, { headers = {}, raw = false } = {}) {
  const url = `${BASE_DOMAIN}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(headers),
    body: JSON.stringify(body ?? {}),
  });

  if (raw) return res;

  const txt = await readTextSafe(res);
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch {}

  if (!res.ok) {
    const msg = (data?.detail || data?.message || txt || `HTTP ${res.status}`).toString();
    throw new Error(msg);
  }

  return data;
}

// Bazı sayfalar PUT/DELETE isterse diye hazır dursun
export async function apiPUT(path, body = {}, opts = {}) {
  return apiPOST(path, body, { ...opts, headers: { ...(opts.headers || {}), "X-HTTP-Method-Override": "PUT" } });
}
