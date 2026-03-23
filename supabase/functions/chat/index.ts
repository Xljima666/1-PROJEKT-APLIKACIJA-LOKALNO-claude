// ============================================================
//  STELLAN — OpenAI GPT-4o handler (zamjena za Claude)
//  API endpoint  →  https://api.openai.com/v1/chat/completions
//  Model         →  gpt-4o
//  Vision        →  Podržano (slike se šalju kao image_url content)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BRAIN_FOLDER_NAME = "1 PROJEKT APLIKACIJA LOKALNO claude";
const BRAIN_PRIORITY_FILES = ["memory.md", "upute.md", "projekti.md"];
const BRAIN_MAX_TOTAL_CHARS = 30000;
const BRAIN_FULL_LOAD_FILES = ["memory.md"];
const UPSTREAM_TIMEOUT_MS = 120000;
const MEMORY_UPDATE_TIMEOUT_MS = 25000;
const BRAIN_PRIMARY_HINTS = ["mozak", "brain"];
const BRAIN_ARCHIVE_HINTS = ["staro", "old", "backup", "archive", "arhiv", "deprecated"];

// ─── OpenAI model ────────────────────────────────────────────
const OPENAI_MODEL = "gpt-4o";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MAX_TOKENS = 8096;

// ─── Helper funkcije (identične) ─────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getValidAccessToken(
  supabaseAdmin: any,
  userId: string,
  table: string = "google_tokens",
): Promise<string | null> {
  const { data: tokenRow } = await supabaseAdmin.from(table).select("*").eq("user_id", userId).single();
  if (!tokenRow) return null;
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (Date.now() < expiresAt - 60000) return tokenRow.access_token;
  const isBrain = table === "google_brain_tokens";
  const GOOGLE_CLIENT_ID = Deno.env.get(isBrain ? "GOOGLE_BRAIN_CLIENT_ID" : "GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get(isBrain ? "GOOGLE_BRAIN_CLIENT_SECRET" : "GOOGLE_CLIENT_SECRET");
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const tokens = await res.json();
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from(table)
    .update({ access_token: tokens.access_token, expires_at: newExpiry })
    .eq("user_id", userId);
  return tokens.access_token;
}

async function isAdminUser(supabaseAdmin: any, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}

async function hasTokenInTable(
  supabaseAdmin: any,
  userId: string,
  table: "google_brain_tokens" | "google_tokens",
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from(table).select("id").eq("user_id", userId).limit(1);
  if (error) return false;
  return !!(data && data.length > 0);
}

async function resolveBrainOwnerId(supabaseAdmin: any, currentUserId: string): Promise<string | null> {
  const currentUserIsAdmin = await isAdminUser(supabaseAdmin, currentUserId);
  if (currentUserIsAdmin) {
    const hasCurrent =
      (await hasTokenInTable(supabaseAdmin, currentUserId, "google_brain_tokens")) ||
      (await hasTokenInTable(supabaseAdmin, currentUserId, "google_tokens"));
    if (hasCurrent) return currentUserId;
  }
  const { data: admins } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .order("created_at", { ascending: true });
  for (const admin of admins || []) {
    if (await hasTokenInTable(supabaseAdmin, admin.user_id, "google_brain_tokens")) return admin.user_id;
  }
  for (const admin of admins || []) {
    if (await hasTokenInTable(supabaseAdmin, admin.user_id, "google_tokens")) return admin.user_id;
  }
  return null;
}

async function getOrCreateBrainFolder(accessToken: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(
      `name='${BRAIN_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,createdTime,parents)&pageSize=20&orderBy=createdTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const folders = data.files || [];
    if (folders.length === 0) {
      // Create new folder if none exist
      const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: BRAIN_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
      });
      if (!createRes.ok) return null;
      const folder = await createRes.json();
      return folder.id;
    }
    if (folders.length === 1) return folders[0].id;

    // Multiple folders found — prefer synced (non-root) folder over My Drive root folder
    // Google Drive for Desktop synced folders are nested inside "Computers" and have
    // a parent that is NOT the user's root "My Drive" folder.
    // Root "My Drive" folder ID can be fetched, but a simpler heuristic:
    // manually-created folders typically have parent = root, synced ones don't.
    try {
      const rootRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/root?fields=id`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (rootRes.ok) {
        const rootData = await rootRes.json();
        const rootId = rootData.id;
        // Prefer folder whose parent is NOT root (= synced from computer)
        const synced = folders.find((f: any) => f.parents && !f.parents.includes(rootId));
        if (synced) {
          console.log(`[Brain] Using synced folder: ${synced.id} (non-root parent)`);
          return synced.id;
        }
      }
    } catch { /* fallback below */ }

    // Fallback: pick most recently modified
    folders.sort((a: any, b: any) => 
      new Date(b.modifiedTime || 0).getTime() - new Date(a.modifiedTime || 0).getTime()
    );
    console.log(`[Brain] Fallback to most recently modified folder: ${folders[0].id}`);
    return folders[0].id;
  } catch {
    return null;
  }
}

async function uploadFileToBrain(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: string,
  mimeType: string = "text/markdown",
): Promise<boolean> {
  try {
    const q = encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!searchRes.ok) return false;
    const searchData = await searchRes.json();
    if (searchData.files?.length > 0) {
      const fileId = searchData.files[0].id;
      const updateRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": mimeType },
        body: content,
      });
      return updateRes.ok;
    } else {
      const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
      const boundary = "stellan_upload_boundary_" + Date.now();
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;
      const createRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      );
      return createRes.ok;
    }
  } catch {
    return false;
  }
}

function toTimestamp(value?: string): number {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function scoreBrainSource(source: string, depth: number): number {
  const s = source.toLowerCase();
  let score = 0;
  if (BRAIN_PRIMARY_HINTS.some((h) => s.includes(h))) score += 200;
  if (s.includes("razgovor")) score -= 60;
  if (BRAIN_ARCHIVE_HINTS.some((h) => s.includes(h))) score -= 300;
  if (s === "root") score -= 8;
  score -= depth * 2;
  return score;
}

async function listSubfolders(accessToken: string, parentId: string): Promise<any[]> {
  try {
    const q = encodeURIComponent(
      `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&pageSize=100&orderBy=name_natural`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      10000,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch {
    return [];
  }
}

async function downloadFileContent(
  accessToken: string,
  file: { id: string; name: string; mimeType?: string },
): Promise<string | null> {
  try {
    let text = "";
    if (file.mimeType === "application/vnd.google-apps.document") {
      const r = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        12000,
      );
      if (r.ok) text = await r.text();
    } else {
      const r = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        12000,
      );
      if (r.ok) text = await r.text();
    }
    return text || null;
  } catch {
    return null;
  }
}

async function loadBrainKnowledge(accessToken: string, folderId: string): Promise<string> {
  try {
    const level1 = await listSubfolders(accessToken, folderId);
    const level2ByParent = await Promise.all(
      level1.map(async (sf) => ({ parent: sf, children: await listSubfolders(accessToken, sf.id) })),
    );
    const scopes: { id: string; source: string; depth: number }[] = [
      { id: folderId, source: "root", depth: 0 },
      ...level1.map((sf) => ({ id: sf.id, source: sf.name, depth: 1 })),
      ...level2ByParent.flatMap(({ parent, children }) =>
        children.map((child) => ({ id: child.id, source: `${parent.name}/${child.name}`, depth: 2 })),
      ),
    ];
    const fileGroups = await Promise.all(
      scopes.map(async (scope) => {
        const q = encodeURIComponent(`'${scope.id}' in parents and trashed=false`);
        const res = await fetchWithTimeout(
          `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&pageSize=100&orderBy=modifiedTime desc`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
          15000,
        );
        if (!res.ok) return [] as any[];
        const data = await res.json();
        return (data.files || [])
          .filter((f: any) => f.mimeType !== "application/vnd.google-apps.folder")
          .map((f: any) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            modifiedTime: f.modifiedTime,
            source: scope.source,
            depth: scope.depth,
            parentId: scope.id,
          }));
      }),
    );
    const allFiles = fileGroups.flat();
    const fileMap = new Map<string, any>();
    for (const file of allFiles) {
      const existing = fileMap.get(file.name);
      if (!existing) {
        fileMap.set(file.name, file);
        continue;
      }
      const fs = scoreBrainSource(file.source, file.depth),
        es = scoreBrainSource(existing.source, existing.depth);
      const ft = toTimestamp(file.modifiedTime),
        et = toTimestamp(existing.modifiedTime);
      if (fs > es || (fs === es && ft > et) || (fs === es && ft === et && file.id > existing.id))
        fileMap.set(file.name, file);
    }
    const selectedFiles = BRAIN_PRIORITY_FILES.map((name) => fileMap.get(name)).filter(Boolean);
    if (selectedFiles.length === 0) return "";
    const otherFiles = selectedFiles.filter((f: any) => !BRAIN_FULL_LOAD_FILES.includes(f.name));
    const fileContents = await Promise.all(
      selectedFiles.map(async (file: any) => {
        const text = await downloadFileContent(accessToken, file);
        if (!text) return null;
        if (BRAIN_FULL_LOAD_FILES.includes(file.name))
          return `=== ${file.name} (${file.source}) — POTPUNI SADRŽAJ ===\n${text}`;
        const maxLen = Math.floor(BRAIN_MAX_TOTAL_CHARS / Math.max(otherFiles.length, 1));
        const wasTruncated = text.length > maxLen;
        const trimmed = text.slice(0, maxLen);
        const truncNote = wasTruncated
          ? `\n\n⚠️ [DATOTEKA SKRAĆENA — prikazano ${maxLen}/${text.length} znakova. Za POTPUN sadržaj pozovi alat read_brain_file s file_name="${file.name}"]`
          : "";
        return `=== ${file.name} (${file.source}) ===\n${trimmed}${truncNote}`;
      }),
    );
    return fileContents.filter(Boolean).join("\n\n");
  } catch (e) {
    console.error("Brain load error:", e);
    return "";
  }
}

function extractMarkdownHeadings(content: string): string[] {
  return content
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.startsWith("##"));
}

function isSafeMemoryReplacement(current: string, candidate: string): boolean {
  if (candidate.trim().length === 0) return false;
  if (current.trim().length > 800 && candidate.trim().length < current.trim().length * 0.7) return false;
  const ch = new Set(extractMarkdownHeadings(current));
  if (ch.size === 0) return true;
  const candH = new Set(extractMarkdownHeadings(candidate));
  let preserved = 0;
  for (const h of ch) if (candH.has(h)) preserved++;
  return preserved / ch.size >= 0.6;
}

async function initializeBrainIfEmpty(accessToken: string, folderId: string): Promise<boolean> {
  try {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.files?.length > 0) return false;
    const memoryContent = `# 🧠 Stellan Memory\n> Zadnje ažuriranje: ${new Date().toISOString()}\n\n## Korisnik\n- **Tvrtka:** GeoTerra Info\n- **Djelatnost:** Geodezija, katastar, prostorno planiranje\n\n## Ključna saznanja\n_Automatski se popunjava._\n\n## Česte teme\n_Automatski se puni._\n\n## Bilješke\n_Slobodni prostor._\n`;
    await Promise.all([
      uploadFileToBrain(accessToken, folderId, "memory.md", memoryContent),
      uploadFileToBrain(
        accessToken,
        folderId,
        "upute.md",
        "# 📋 Stellan Upute\n\n## Osobnost\n- Profesionalan ali prijateljski\n- Govori hrvatski\n",
      ),
      uploadFileToBrain(
        accessToken,
        folderId,
        "projekti.md",
        "# 📁 Projekti\n\n## Aktivni projekti\n_Automatski se popunjava._\n",
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function findFolderRecursive(
  accessToken: string,
  parentId: string,
  targetName: string,
  depth = 0,
): Promise<string | null> {
  if (depth > 2) return null;
  const subs = await listSubfolders(accessToken, parentId);
  for (const sf of subs) if (sf.name.toLowerCase().includes(targetName.toLowerCase())) return sf.id;
  for (const sf of subs) {
    const found = await findFolderRecursive(accessToken, sf.id, targetName, depth + 1);
    if (found) return found;
  }
  return null;
}

async function findFileInBrain(
  accessToken: string,
  brainFolderId: string,
  fileName: string,
): Promise<{ fileId: string; parentId: string } | null> {
  const level1 = await listSubfolders(accessToken, brainFolderId);
  const level2ByParent = await Promise.all(
    level1.map(async (sf) => ({ parent: sf, children: await listSubfolders(accessToken, sf.id) })),
  );
  const scopes = [
    { id: brainFolderId, source: "root", depth: 0 },
    ...level1.map((sf) => ({ id: sf.id, source: sf.name, depth: 1 })),
    ...level2ByParent.flatMap(({ parent, children }) =>
      children.map((child) => ({ id: child.id, source: `${parent.name}/${child.name}`, depth: 2 })),
    ),
  ];
  const matches = await Promise.all(
    scopes.map(async (scope) => {
      const q = encodeURIComponent(`name='${fileName}' and '${scope.id}' in parents and trashed=false`);
      const res = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,modifiedTime)&pageSize=20&orderBy=modifiedTime desc`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        10000,
      );
      if (!res.ok) return [] as any[];
      const data = await res.json();
      return (data.files || []).map((f: any) => ({
        fileId: f.id,
        parentId: scope.id,
        source: scope.source,
        depth: scope.depth,
        modifiedTime: f.modifiedTime,
      }));
    }),
  );
  const candidates = matches.flat();
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const sd = scoreBrainSource(b.source, b.depth) - scoreBrainSource(a.source, a.depth);
    if (sd !== 0) return sd;
    return toTimestamp(b.modifiedTime) - toTimestamp(a.modifiedTime);
  });
  return { fileId: candidates[0].fileId, parentId: candidates[0].parentId };
}

async function saveConversationToBrain(accessToken: string, folderId: string, messages: any[], conversationId: string) {
  try {
    const razgovoriId = (await findFolderRecursive(accessToken, folderId, "razgovor")) || folderId;
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `razgovor_${dateStr}_${conversationId?.slice(0, 8) || "auto"}.md`;
    let content = `# Razgovor - ${dateStr}\n\n`;
    for (const msg of messages) {
      const textContent = typeof msg.content === "string" ? msg.content : "[multimodal content]";
      content += `**${msg.role === "user" ? "Korisnik" : "Stellan"}:**\n${textContent}\n\n---\n\n`;
    }
    await uploadFileToBrain(accessToken, razgovoriId, fileName, content);
  } catch (e) {
    console.error("Save conversation error:", e);
  }
}

// ─── Memory update - koristi OpenAI ───────────────────────────
async function updateMemory(accessToken: string, folderId: string, messages: any[], openaiApiKey: string) {
  try {
    const found = await findFileInBrain(accessToken, folderId, "memory.md");
    if (!found) return;
    const dlRes = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files/${found.fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      MEMORY_UPDATE_TIMEOUT_MS,
    );
    if (!dlRes.ok) return;
    const currentMemory = await dlRes.text();
    const lastMessages = messages.slice(-6);
    const conversationSnippet = lastMessages.map((m: any) => {
      const text = typeof m.content === "string" ? m.content : "[multimodal]";
      return `${m.role}: ${text}`;
    }).join("\n");

    const memRes = await fetchWithTimeout(
      OPENAI_API_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 8000,
          messages: [
            {
              role: "system",
              content: `Ti si memorijski procesor za Stellana. Ažuriraj memory.md s novim saznanjima iz razgovora.

KRITIČNA PRAVILA:
- NIKAD ne briši, ne skraćuj ni ne mijenjaj postojeće sekcije osim ako razgovor eksplicitno traži promjenu
- Zadrži SVE postojeće podatke - svaki red, svaku sekciju
- Dodaj SAMO nova važna saznanja (ne trivijalne razgovore)
- Ako nema ništa novo, vrati IDENTIČAN sadržaj
- Ažuriraj "Zadnje ažuriranje" na: ${new Date().toISOString()}
- Odgovori SAMO s kompletnim ažuriranim sadržajem memory.md, ništa drugo`,
            },
            {
              role: "user",
              content: `TRENUTNA MEMORIJA:\n${currentMemory}\n\nNOVI RAZGOVOR:\n${conversationSnippet}`,
            },
          ],
        }),
      },
      MEMORY_UPDATE_TIMEOUT_MS,
    );

    if (!memRes.ok) return;
    const memData = await memRes.json();
    const updatedMemory = memData.choices?.[0]?.message?.content;
    if (updatedMemory && isSafeMemoryReplacement(currentMemory, updatedMemory)) {
      await uploadFileToBrain(accessToken, found.parentId, "memory.md", updatedMemory);
    }
  } catch (e) {
    console.error("Memory update error:", e);
  }
}

// ─── Tool funkcije (identične) ───────────────────────────────

async function searchTrello(query: string): Promise<string> {
  const TRELLO_API_KEY = Deno.env.get("TRELLO_API_KEY");
  const TRELLO_TOKEN = Deno.env.get("TRELLO_TOKEN");
  if (!TRELLO_API_KEY || !TRELLO_TOKEN)
    return JSON.stringify({ success: false, error: "Trello credentials not configured" });
  try {
    const params = new URLSearchParams({
      query,
      key: TRELLO_API_KEY,
      token: TRELLO_TOKEN,
      modelTypes: "cards,boards",
      cards_limit: "10",
      boards_limit: "5",
      card_fields: "name,desc,shortUrl,due,dateLastActivity,labels",
      board_fields: "name,shortUrl,desc",
      card_board: "true",
      card_list: "true",
    });
    const res = await fetchWithTimeout(
      `https://api.trello.com/1/search?${params.toString()}`,
      { method: "GET" },
      15000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `Trello API error: ${res.status}` });
    const data = await res.json();
    const cards = (data.cards || []).map((c: any) => ({
      name: c.name,
      description: c.desc?.slice(0, 200) || "",
      url: c.shortUrl,
      due: c.due,
      lastActivity: c.dateLastActivity,
      labels: c.labels?.map((l: any) => l.name).filter(Boolean) || [],
      board: c.board?.name || "",
      list: c.list?.name || "",
    }));
    const boards = (data.boards || []).map((b: any) => ({
      name: b.name,
      description: b.desc?.slice(0, 200) || "",
      url: b.shortUrl,
    }));
    return JSON.stringify({ success: true, cards, boards });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function scrapeWebsite(url: string): Promise<string> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) return JSON.stringify({ success: false, error: "Firecrawl API key not configured" });
  try {
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://"))
      formattedUrl = `https://${formattedUrl}`;
    const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: formattedUrl, formats: ["markdown"], onlyMainContent: true }),
      },
      30000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `Firecrawl error: ${res.status}` });
    const data = await res.json();
    const markdown = data.data?.markdown || data.markdown || "";
    const title = data.data?.metadata?.title || "";
    const trimmed = markdown.length > 8000 ? markdown.slice(0, 8000) + "\n\n... [skraćeno]" : markdown;
    return JSON.stringify({ success: true, title, content: trimmed, url: formattedUrl });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

function sanitizeAgentServerUrl(raw: string): string | null {
  const match = raw.trim().match(/https?:\/\/[^\s]+/i);
  if (!match?.[0]) return null;
  try {
    const parsed = new URL(match[0]);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function sanitizeAgentApiKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const k1 = trimmed.match(/AGENT_API_KEY\s*=\s*["']?([^"'\s]+)["']?/i)?.[1];
  if (k1) return k1;
  const k2 = trimmed.match(/X-API-Key\s*:\s*["']?([^"'\s]+)["']?/i)?.[1];
  if (k2) return k2;
  return (
    trimmed
      .replace(/^[`"']+|[`"']+$/g, "")
      .split(/\s+/)[0]
      ?.trim() || null
  );
}

const FALLBACK_AGENT_API_KEY = "promijeni-me-na-siguran-kljuc-123";

function getAgentApiKeyCandidates(raw: string | null): string[] {
  const candidates = new Set<string>();
  if (raw) {
    const s = sanitizeAgentApiKey(raw);
    if (s) candidates.add(s);
  }
  candidates.add(FALLBACK_AGENT_API_KEY);
  return Array.from(candidates);
}

function sanitizeAgentPaths(body: any): any {
  if (!body || typeof body !== "object") return body;
  const prefixes = ["D:\\Stellan Brain\\", "D:\\Stellan Brain/", "D:/Stellan Brain/", "D:/Stellan Brain\\"];
  const sanitizePath = (p: string): string => {
    if (!p) return p;
    const trimmed = p.replace(/[\\/]+$/, "");
    if (trimmed.toLowerCase() === "d:\\stellan brain" || trimmed.toLowerCase() === "d:/stellan brain") return ".";
    for (const prefix of prefixes)
      if (p.toLowerCase().startsWith(prefix.toLowerCase())) return p.slice(prefix.length) || ".";
    return p;
  };
  const result = { ...body };
  if (result.path) result.path = sanitizePath(result.path);
  if (result.cwd) result.cwd = sanitizePath(result.cwd);
  if (result.repo_path) result.repo_path = sanitizePath(result.repo_path);
  if (result.filename) result.filename = sanitizePath(result.filename);
  return result;
}

async function callAgent(endpoint: string, body: any): Promise<string> {
  const AGENT_SERVER_URL = Deno.env.get("AGENT_SERVER_URL");
  const AGENT_API_KEY = Deno.env.get("AGENT_API_KEY");
  const apiKeyCandidates = getAgentApiKeyCandidates(AGENT_API_KEY || null);
  if (!AGENT_SERVER_URL) return JSON.stringify({ success: false, error: "Agent server nije konfiguriran" });
  const baseUrl = sanitizeAgentServerUrl(AGENT_SERVER_URL);
  if (!baseUrl) return JSON.stringify({ success: false, error: "Agent server URL nije valjan" });
  const sanitizedBody = sanitizeAgentPaths(body);
  try {
    const safeEndpoint = endpoint.replace(/^\/+/, "");
    const url = new URL(safeEndpoint, `${baseUrl}/`).toString();
    for (const apiKey of apiKeyCandidates) {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "GeoTerraAgent/1.0",
          },
          body: JSON.stringify(sanitizedBody),
        },
        120000,
      );
      const rawText = await res.text();
      if (res.status === 401) continue;
      if (!res.ok)
        return JSON.stringify({ success: false, error: `Agent HTTP ${res.status}: ${rawText.slice(0, 300)}` });
      try {
        return JSON.stringify(JSON.parse(rawText));
      } catch {
        return JSON.stringify({ success: false, error: `Agent vratio nevažeći odgovor: ${rawText.slice(0, 200)}` });
      }
    }
    return JSON.stringify({ success: false, error: "Agent HTTP 401: Nevažeći API ključ" });
  } catch (e) {
    return JSON.stringify({ success: false, error: `Agent nedostupan: ${String(e)}` });
  }
}

async function lookupOib(oib: string): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/lookup-oib`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "x-internal-secret": Deno.env.get("CRON_SECRET") || "",
        },
        body: JSON.stringify({ oib }),
      },
      60000,
    );
    return await res.json().then((d) => JSON.stringify(d));
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function searchSdge(params: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/search-sdge`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "x-internal-secret": Deno.env.get("CRON_SECRET") || "",
        },
        body: JSON.stringify({ ...params, max_pages: params.max_pages || 10 }),
      },
      120000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `SDGE error: ${res.status}` });
    return await res.text();
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function downloadSdgePdf(params: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/download-sdge-pdf`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify(params),
      },
      120000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `SDGE PDF error: ${res.status}` });
    const data = await res.json();
    if (data.pdf_base64)
      return JSON.stringify({
        success: true,
        broj_predmeta: data.broj_predmeta,
        pdf_size: data.pdf_size,
        message: `PDF za predmet ${data.broj_predmeta} uspješno preuzet (${Math.round(data.pdf_size / 1024)} KB).`,
      });
    return JSON.stringify(data);
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function sdgePovratnice(params: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/sdge-povratnice`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "x-internal-secret": Deno.env.get("CRON_SECRET") || "",
        },
        body: JSON.stringify(params),
      },
      120000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `Povratnice error: ${res.status}` });
    return await res.text();
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function fillZahtjev(params: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let cardData = params;
    if (params.card_id) {
      const { data: card } = await sb.from("cards").select("*").eq("id", params.card_id).single();
      if (card) cardData = { ...card, ...params };
    }
    const { data: adminRoles } = await sb.from("user_roles").select("user_id").eq("role", "admin").limit(1);
    let companyData = null;
    if (adminRoles?.length) {
      const { data: company } = await sb
        .from("company_settings")
        .select("*")
        .eq("user_id", adminRoles[0].user_id)
        .single();
      companyData = company;
    }
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/fill-zahtjev`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ cardData, companyData }),
      },
      30000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `Fill zahtjev error: ${res.status}` });
    return JSON.stringify({ success: true, ...(await res.json()) });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function fillPdf(params: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const body: any = {};
    if (params.pdf_url) body.pdf_url = params.pdf_url;
    if (params.pdf_base64) body.pdf_base64 = params.pdf_base64;
    if (params.list_fields_only) body.list_fields_only = true;
    if (params.field_values) body.field_values = params.field_values;
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/fill-pdf`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify(body),
      },
      60000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `Fill PDF error: ${res.status}` });
    const result = await res.json();
    if (result.pdf_base64?.length > 1000)
      return JSON.stringify({
        ...result,
        pdf_base64: result.pdf_base64.substring(0, 100) + "...[TRUNCATED]",
        note: "PDF uspješno ispunjen.",
      });
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function searchOss(params: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/search-oss`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify(params),
      },
      60000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `OSS error: ${res.status}` });
    return await res.text();
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function searchGmail(query: string): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)
      return JSON.stringify({ success: false, error: "Google OAuth nije konfiguriran" });

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    // Resolve admin user for Gmail access
    const { data: adminRoles } = await sb.from("user_roles").select("user_id").eq("role", "admin").limit(1);
    if (!adminRoles?.length) return JSON.stringify({ success: false, error: "Nema admin korisnika" });
    const adminId = adminRoles[0].user_id;

    const { data: tokenData } = await sb.from("google_tokens").select("*").eq("user_id", adminId).single();
    if (!tokenData) return JSON.stringify({ success: false, error: "Gmail nije povezan" });

    let accessToken = tokenData.access_token;
    if (new Date(tokenData.expires_at) <= new Date()) {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: tokenData.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const refreshData = await refreshRes.json();
      if (!refreshRes.ok) return JSON.stringify({ success: false, error: "Gmail token istekao" });
      accessToken = refreshData.access_token;
      await sb.from("google_tokens").update({
        access_token: accessToken,
        expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
      }).eq("user_id", adminId);
    }

    const gmailQuery = encodeURIComponent(query);
    const listRes = await fetchWithTimeout(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${gmailQuery}&maxResults=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      15000,
    );
    const listData = await listRes.json();
    if (!listRes.ok || !listData.messages)
      return JSON.stringify({ success: true, emails: [], total: 0, query });

    const emails = await Promise.all(
      listData.messages.slice(0, 8).map(async (msg: { id: string }) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];
        const getH = (n: string) => headers.find((h: any) => h.name === n)?.value || "";
        return {
          id: msg.id,
          from: getH("From"),
          to: getH("To"),
          subject: getH("Subject"),
          date: getH("Date"),
          snippet: msgData.snippet || "",
        };
      }),
    );
    return JSON.stringify({ success: true, emails, total: listData.resultSizeEstimate || emails.length, query });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function searchSolo(params: { tip?: string; stranica?: number }): Promise<string> {
  const SOLO_API_TOKEN = Deno.env.get("SOLO_API_TOKEN");
  if (!SOLO_API_TOKEN) return JSON.stringify({ success: false, error: "Solo API token nije konfiguriran" });
  try {
    const tip = params.tip || "racun"; // "racun" or "ponuda"
    const endpoint = tip === "ponuda" ? "ponuda" : "racun";
    const urlParams = new URLSearchParams({ token: SOLO_API_TOKEN });
    if (params.stranica) urlParams.set("stranica", String(params.stranica));

    const res = await fetchWithTimeout(
      `https://api.solo.com.hr/${endpoint}?${urlParams.toString()}`,
      { method: "GET" },
      15000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `Solo API error: ${res.status}` });
    const data = await res.json();
    if (data.status !== 0) return JSON.stringify({ success: false, error: data.message || "Solo API greška" });

    // Parse response
    const items = data.racuni || data.ponude || (data.racun ? [data.racun] : data.ponuda ? [data.ponuda] : []);
    const mapped = items.slice(0, 20).map((item: any) => ({
      id: item.id,
      broj: item.broj_racuna || item.broj_ponude || "",
      kupac: item.kupac_naziv || "",
      oib: item.kupac_oib || "",
      datum: item.datum_racuna || item.datum_ponude || "",
      ukupno: item.ukupno || "",
      status: item.status_racuna || item.status_ponude || "",
      fiskaliziran: item.fiskaliziran || "",
      napomena: item.napomena || "",
    }));
    return JSON.stringify({ success: true, tip: endpoint, items: mapped, total: items.length });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

function driveLink(file: any): string {
  const id = file.id;
  if (!id) return "";
  if (file.mimeType === DRIVE_FOLDER_MIME) return `https://drive.google.com/drive/folders/${id}`;
  if (file.mimeType === "application/vnd.google-apps.document") return `https://docs.google.com/document/d/${id}/edit`;
  if (file.mimeType === "application/vnd.google-apps.spreadsheet") return `https://docs.google.com/spreadsheets/d/${id}/edit`;
  if (file.mimeType === "application/vnd.google-apps.presentation") return `https://docs.google.com/presentation/d/${id}/edit`;
  if (file.mimeType === "application/vnd.google-apps.form") return `https://docs.google.com/forms/d/${id}/edit`;
  return file.webViewLink || `https://drive.google.com/file/d/${id}/view`;
}

function normalizeDriveText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function mapDriveItem(file: any) {
  return {
    id: file.id,
    name: file.name,
    type: file.mimeType,
    modified: file.modifiedTime,
    link: driveLink(file),
    isFolder: file.mimeType === DRIVE_FOLDER_MIME,
  };
}

function scoreDriveItem(file: any, normalizedQuery: string, queryTerms: string[]): number {
  const normalizedName = normalizeDriveText(file.name || "");
  let score = file.mimeType === DRIVE_FOLDER_MIME ? 100 : 0;
  if (normalizedQuery && normalizedName.includes(normalizedQuery)) score += 50;
  for (const term of queryTerms) {
    if (normalizedName.includes(term)) score += 12;
  }
  return score;
}

async function fetchDriveItems(accessToken: string, driveQuery: string, pageSize = 20): Promise<any[]> {
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&fields=files(id,name,mimeType,modifiedTime,webViewLink,size)&pageSize=${pageSize}&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    15000,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

async function fetchDriveFolderChildren(accessToken: string, folderId: string, pageSize = 50): Promise<any[]> {
  const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false`;
  return fetchDriveItems(accessToken, q, pageSize);
}

async function searchGoogleDrive(accessToken: string, query: string): Promise<string> {
  try {
    const allFiles: any[] = [];
    const seenKeys = new Set<string>();
    const addFiles = (files: any[]) => {
      for (const f of files) {
        const key = f.id || f.name;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allFiles.push(f);
        }
      }
    };

    const escaped = query.replace(/'/g, "\\'");
    addFiles(await fetchDriveItems(accessToken, `fullText contains '${escaped}' and trashed=false`));
    addFiles(await fetchDriveItems(accessToken, `name contains '${escaped}' and trashed=false`));

    const normalizedQuery = normalizeDriveText(query);
    const queryTerms = normalizedQuery.split(/[\s,/-]+/).filter((w) => w.length >= 2);
    if (queryTerms.length > 1) {
      for (const kw of queryTerms.slice(0, 5)) {
        const safeKw = kw.replace(/'/g, "\\'");
        addFiles(await fetchDriveItems(accessToken, `name contains '${safeKw}' and trashed=false`));
      }
    }

    const ranked = allFiles
      .slice()
      .sort((a, b) => scoreDriveItem(b, normalizedQuery, queryTerms) - scoreDriveItem(a, normalizedQuery, queryTerms));

    const folders = ranked.filter((item) => item.mimeType === DRIVE_FOLDER_MIME).slice(0, 6);
    const foldersWithSubfolders = await Promise.all(
      folders.map(async (folder) => {
        const children = await fetchDriveFolderChildren(accessToken, folder.id, 50);
        const subfolders = children
          .filter((child) => child.mimeType === DRIVE_FOLDER_MIME)
          .map(mapDriveItem)
          .sort((a, b) => a.name.localeCompare(b.name, "hr"));

        return {
          ...mapDriveItem(folder),
          subfolders,
        };
      }),
    );

    const files = foldersWithSubfolders.length === 0
      ? ranked.filter((item) => item.mimeType !== DRIVE_FOLDER_MIME).slice(0, 10).map(mapDriveItem)
      : [];

    return JSON.stringify({
      success: true,
      query,
      folders: foldersWithSubfolders,
      files,
      totalFolders: foldersWithSubfolders.length,
      totalFiles: files.length,
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function listDriveFolder(accessToken: string, folderId: string): Promise<string> {
  try {
    const items = (await fetchDriveFolderChildren(accessToken, folderId, 50)).map((f: any) => ({
      ...mapDriveItem(f),
      size: f.size ? parseInt(f.size) : null,
    }));
    return JSON.stringify({ success: true, items, total: items.length, folderId });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function searchGeoterraApp(query: string): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/).filter((w) => w.length >= 2);
    const terms = words.length > 0 ? words : [q];
    const orConds = terms.flatMap((t) => [
      `title.ilike.%${t}%`,
      `description.ilike.%${t}%`,
      `narucitelj_ime.ilike.%${t}%`,
      `katastarska_opcina.ilike.%${t}%`,
      `katastarska_cestica.ilike.%${t}%`,
      `adresa_cestice.ilike.%${t}%`,
      `narucitelj_oib.ilike.%${t}%`,
      `kontakt.ilike.%${t}%`,
    ]);
    const { data: cards } = await sb
      .from("cards")
      .select(
        "id, title, description, status, narucitelj_ime, narucitelj_oib, kontakt, katastarska_opcina, katastarska_cestica, adresa_cestice, vrsta_posla, due_date, column_id, created_at",
      )
      .or(orConds.join(","))
      .order("created_at", { ascending: false })
      .limit(20);
    const { data: boards } = await sb
      .from("boards")
      .select("id, title, description, created_at")
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(10);
    const columnIds = [...new Set((cards || []).map((c: any) => c.column_id))];
    let columnMap: Record<string, any> = {};
    if (columnIds.length > 0) {
      const { data: cols } = await sb.from("columns").select("id, title, board_id").in("id", columnIds);
      for (const col of cols || []) columnMap[col.id] = { title: col.title, board_id: col.board_id };
    }
    const boardIds = [...new Set(Object.values(columnMap).map((c: any) => c.board_id))];
    let boardMap: Record<string, string> = {};
    if (boardIds.length > 0) {
      const { data: bds } = await sb.from("boards").select("id, title").in("id", boardIds);
      for (const b of bds || []) boardMap[b.id] = b.title;
    }
    const enrichedCards = (cards || []).map((c: any) => {
      const col = columnMap[c.column_id];
      return {
        id: c.id,
        title: c.title,
        description: c.description?.slice(0, 200) || "",
        status: c.status,
        narucitelj: c.narucitelj_ime,
        kat_opcina: c.katastarska_opcina,
        kat_cestica: c.katastarska_cestica,
        adresa: c.adresa_cestice,
        vrsta_posla: c.vrsta_posla,
        due_date: c.due_date,
        board: col ? boardMap[col.board_id] || "" : "",
        column: col?.title || "",
      };
    });
    return JSON.stringify({
      success: true,
      cards: enrichedCards,
      boards: (boards || []).map((b: any) => ({ id: b.id, title: b.title, description: b.description?.slice(0, 200) })),
      total_cards: enrichedCards.length,
      total_boards: (boards || []).length,
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function updateGeoterraCard(args: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { card_id, ...updates } = args;
    if (!card_id) return JSON.stringify({ success: false, error: "card_id is required" });
    const cleanUpdates: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) if (v !== undefined && v !== null) cleanUpdates[k] = v;
    if (Object.keys(cleanUpdates).length === 0) return JSON.stringify({ success: false, error: "No fields to update" });
    cleanUpdates.updated_at = new Date().toISOString();
    const { data, error } = await sb
      .from("cards")
      .update(cleanUpdates)
      .eq("id", card_id)
      .select("id, title, status")
      .single();
    if (error) return JSON.stringify({ success: false, error: error.message });
    return JSON.stringify({ success: true, card: data });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// Drive tools
async function getFolderIdByName(
  accessToken: string,
  parentFolderId: string,
  folderName: string,
): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${folderName.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()).files?.[0]?.id || null;
}

async function findItemInFolder(accessToken: string, parentFolderId: string, itemName: string): Promise<any | null> {
  const q = encodeURIComponent(
    `name='${itemName.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and trashed=false`,
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,parents,webViewLink)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;
  return (await res.json()).files?.[0] || null;
}

async function executeDriveTool(
  accessToken: string,
  brainFolderId: string,
  toolName: string,
  args: any,
): Promise<string> {
  switch (toolName) {
    case "create_drive_folder": {
      const q = encodeURIComponent(
        `name='${args.folder_name}' and '${brainFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      );
      const sr = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (sr.ok) {
        const sd = await sr.json();
        if (sd.files?.length > 0)
          return JSON.stringify({
            success: true,
            action: "existing",
            folder_id: sd.files[0].id,
            name: args.folder_name,
          });
      }
      const cr = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: args.folder_name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [brainFolderId],
        }),
      });
      if (!cr.ok) return JSON.stringify({ success: false, error: `Create folder failed: ${cr.status}` });
      const folder = await cr.json();
      return JSON.stringify({
        success: true,
        action: "created",
        folder_id: folder.id,
        name: args.folder_name,
        link: folder.webViewLink,
      });
    }
    case "create_drive_file": {
      let targetFolderId = brainFolderId;
      if (args.subfolder_name) {
        const r = JSON.parse(
          await executeDriveTool(accessToken, brainFolderId, "create_drive_folder", {
            folder_name: args.subfolder_name,
          }),
        );
        if (!r.success) return JSON.stringify({ success: false, error: `Subfolder error: ${r.error}` });
        targetFolderId = r.folder_id;
      }
      const ok = await uploadFileToBrain(accessToken, targetFolderId, args.file_name, args.content);
      return JSON.stringify(
        ok
          ? { success: true, file_name: args.file_name, folder_id: targetFolderId }
          : { success: false, error: "Upload failed" },
      );
    }
    case "list_drive_files": {
      const q = encodeURIComponent(`'${brainFolderId}' in parents and trashed=false`);
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime,webViewLink,parents)&pageSize=50&orderBy=name`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return JSON.stringify({ success: false, error: `API error: ${res.status}` });
      return JSON.stringify({ success: true, files: (await res.json()).files || [] });
    }
    case "read_brain_file": {
      const found = await findFileInBrain(accessToken, brainFolderId, args.file_name);
      if (!found) return JSON.stringify({ success: false, error: `Datoteka '${args.file_name}' nije pronađena` });
      const text = await downloadFileContent(accessToken, { id: found.fileId, name: args.file_name });
      if (!text) return JSON.stringify({ success: false, error: `Nije moguće pročitati '${args.file_name}'` });
      return JSON.stringify({ success: true, file_name: args.file_name, content: text, chars: text.length });
    }
    case "rename_drive_item": {
      const sourceFolderId = args.source_folder_name
        ? await getFolderIdByName(accessToken, brainFolderId, args.source_folder_name)
        : brainFolderId;
      if (!sourceFolderId)
        return JSON.stringify({ success: false, error: `Folder '${args.source_folder_name}' nije pronađen` });
      const item = await findItemInFolder(accessToken, sourceFolderId, args.current_name);
      if (!item) return JSON.stringify({ success: false, error: `Stavka '${args.current_name}' nije pronađena` });
      const pr = await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}?fields=id,name,webViewLink`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: args.new_name }),
      });
      if (!pr.ok) return JSON.stringify({ success: false, error: `Rename failed: ${pr.status}` });
      const updated = await pr.json();
      return JSON.stringify({ success: true, action: "renamed", old_name: args.current_name, new_name: updated.name });
    }
    case "move_drive_item": {
      const sourceFolderId = args.source_folder_name
        ? await getFolderIdByName(accessToken, brainFolderId, args.source_folder_name)
        : brainFolderId;
      if (!sourceFolderId) return JSON.stringify({ success: false, error: `Izvorni folder nije pronađen` });
      const targetFolderId =
        !args.target_folder_name || args.target_folder_name.toLowerCase() === "root"
          ? brainFolderId
          : await getFolderIdByName(accessToken, brainFolderId, args.target_folder_name);
      if (!targetFolderId)
        return JSON.stringify({ success: false, error: `Ciljni folder '${args.target_folder_name}' nije pronađen` });
      const item = await findItemInFolder(accessToken, sourceFolderId, args.item_name);
      if (!item) return JSON.stringify({ success: false, error: `Stavka '${args.item_name}' nije pronađena` });
      const removeParents = Array.isArray(item.parents) ? item.parents.join(",") : sourceFolderId;
      const mr = await fetch(
        `https://www.googleapis.com/drive/v3/files/${item.id}?addParents=${encodeURIComponent(targetFolderId)}&removeParents=${encodeURIComponent(removeParents)}&fields=id,name`,
        { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!mr.ok) return JSON.stringify({ success: false, error: `Move failed: ${mr.status}` });
      return JSON.stringify({
        success: true,
        action: "moved",
        name: args.item_name,
        to_folder: args.target_folder_name,
      });
    }
    case "copy_drive_file": {
      const sourceFolderId = args.source_folder_name
        ? await getFolderIdByName(accessToken, brainFolderId, args.source_folder_name)
        : brainFolderId;
      if (!sourceFolderId) return JSON.stringify({ success: false, error: "Izvorni folder nije pronađen" });
      const targetFolderId = await getFolderIdByName(accessToken, brainFolderId, args.target_folder_name);
      if (!targetFolderId) return JSON.stringify({ success: false, error: `Ciljni folder nije pronađen` });
      const item = await findItemInFolder(accessToken, sourceFolderId, args.file_name);
      if (!item) return JSON.stringify({ success: false, error: `Datoteka '${args.file_name}' nije pronađena` });
      const cr = await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}/copy?fields=id,name,webViewLink`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: args.new_file_name || args.file_name, parents: [targetFolderId] }),
      });
      if (!cr.ok) return JSON.stringify({ success: false, error: `Copy failed: ${cr.status}` });
      const copied = await cr.json();
      return JSON.stringify({
        success: true,
        action: "copied",
        new_name: copied.name,
        to_folder: args.target_folder_name,
      });
    }
    default:
      return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
  }
}

function shouldEnableDriveTools(messages: any[]): boolean {
  const lastMsg =
    [...messages]
      .reverse()
      .find((m) => m.role === "user")
      ?.content;
  const text = typeof lastMsg === "string" ? lastMsg.toLowerCase() : "";
  return [
    "spremi", "snimi", "datotek", "file", "folder", "map", "drive",
    "izlist", "lista", "dokument", "napravi fajl", "kreiraj",
    "preimenuj", "rename", "premjesti", "move", "kopiraj", "copy",
    "pročitaj", "procitaj", "read", "memory.md", "upute.md",
    "projekti.md", "cijeli kod", "cijeli sadržaj", "sadržaj datoteke",
  ].some((kw) => text.includes(kw));
}

// ─────────────────────────────────────────────────────────────
//  OPENAI TOOL DEFINITIONS (function calling format)
// ─────────────────────────────────────────────────────────────

function buildTools(opts: {
  enableDriveTools: boolean;
  hasTrello: boolean;
  hasFirecrawl: boolean;
  hasGeoterraDrive: boolean;
  hasAgent: boolean;
}) {
  const tools: any[] = [];

  const fn = (name: string, description: string, parameters: any) => ({
    type: "function",
    function: { name, description, parameters },
  });

  if (opts.enableDriveTools) {
    tools.push(
      fn("create_drive_folder", "Stvori novi folder u Stellan Brain folderu.", {
        type: "object",
        properties: { folder_name: { type: "string", description: "Ime foldera" } },
        required: ["folder_name"],
      }),
      fn("create_drive_file", "Stvori ili ažuriraj datoteku u Stellan Brain folderu.", {
        type: "object",
        properties: {
          file_name: { type: "string" },
          content: { type: "string" },
          subfolder_name: { type: "string" },
        },
        required: ["file_name", "content"],
      }),
      fn("list_drive_files", "Izlistaj datoteke u Stellan Brain folderu.", {
        type: "object",
        properties: {},
      }),
      fn("read_brain_file", "Pročitaj CIJELI sadržaj datoteke iz Stellan Brain foldera (bez skraćivanja). OBAVEZNO koristi kad korisnik traži da pročitaš memory.md, upute.md ili bilo koju drugu datoteku.", {
        type: "object",
        properties: { file_name: { type: "string" }, subfolder_name: { type: "string" } },
        required: ["file_name"],
      }),
      fn("rename_drive_item", "Preimenuj datoteku ili folder u Stellan Brain folderu.", {
        type: "object",
        properties: {
          current_name: { type: "string" },
          new_name: { type: "string" },
          source_folder_name: { type: "string" },
        },
        required: ["current_name", "new_name"],
      }),
      fn("move_drive_item", "Premjesti datoteku ili folder u Stellan Brain folderu.", {
        type: "object",
        properties: {
          item_name: { type: "string" },
          target_folder_name: { type: "string" },
          source_folder_name: { type: "string" },
        },
        required: ["item_name", "target_folder_name"],
      }),
      fn("copy_drive_file", "Kopiraj datoteku unutar Stellan Brain foldera.", {
        type: "object",
        properties: {
          file_name: { type: "string" },
          target_folder_name: { type: "string" },
          source_folder_name: { type: "string" },
          new_file_name: { type: "string" },
        },
        required: ["file_name", "target_folder_name"],
      }),
    );
  }

  if (opts.hasTrello)
    tools.push(fn("search_trello", "Pretraži Trello ploče i kartice.", {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    }));
  if (opts.hasFirecrawl)
    tools.push(fn("scrape_website", "Dohvati sadržaj web stranice po URL-u.", {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    }));
  if (opts.hasGeoterraDrive) {
    tools.push(fn("search_drive", "Pretraži Google Drive (geoterra@geoterrainfo.net) po ključnim riječima. Rezultati sadrže ID foldera koje možeš koristiti s list_drive_folder.", {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    }));
    tools.push(fn("list_drive_folder", "Ispiši sadržaj (podfoldere i datoteke) određenog Google Drive foldera po ID-u. Koristi kad korisnik traži podfoldere ili sadržaj nekog foldera.", {
      type: "object",
      properties: { folder_id: { type: "string", description: "Google Drive folder ID" } },
      required: ["folder_id"],
    }));
  }

  tools.push(
    fn("search_sdge", "Pretraži SDGE sustav (predmeti, elaborati).", {
      type: "object",
      properties: {
        naziv: { type: "string" },
        godina: { type: "string" },
        status: { type: "string" },
        kat_opcina: { type: "string" },
        interni_broj: { type: "string" },
        izradio: { type: "string" },
        max_pages: { type: "number" },
      },
    }),
    fn("download_sdge_pdf", "Preuzmi PDF iz SDGE-a.", {
      type: "object",
      properties: { broj_predmeta: { type: "string" } },
      required: ["broj_predmeta"],
    }),
    fn("sdge_povratnice", "Dohvati popis povratnica iz SDGE-a.", {
      type: "object",
      properties: {
        broj_predmeta: { type: "string" },
        interni_broj: { type: "string" },
        max_pages: { type: "number" },
        discover_only: { type: "boolean" },
        tab_sheet_id: { type: "string" },
        tab_index: { type: "string" },
        pager_next_id: { type: "string" },
        data_communicator_id: { type: "string" },
      },
    }),
    fn("search_geoterra_app", "Pretraži GeoTerra aplikaciju (Kanban ploče i kartice).", {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    }),
    fn("update_geoterra_card", "Ažuriraj karticu u GeoTerra aplikaciji.", {
      type: "object",
      properties: {
        card_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        narucitelj_ime: { type: "string" },
        narucitelj_oib: { type: "string" },
        narucitelj_adresa: { type: "string" },
        kontakt: { type: "string" },
        katastarska_opcina: { type: "string" },
        katastarska_cestica: { type: "string" },
        adresa_cestice: { type: "string" },
        postanski_broj: { type: "string" },
        vrsta_posla: { type: "array", items: { type: "string" } },
        due_date: { type: "string" },
      },
      required: ["card_id"],
    }),
    fn("search_oss", "Pretraži OSS portal (oss.uredjenazemlja.hr) za katastarske čestice i ZK izvadke.", {
      type: "object",
      properties: { cestica: { type: "string" }, katastarska_opcina: { type: "string" } },
    }),
    fn("lookup_oib", "Provjeri podatke o tvrtki ili osobi po OIB-u.", {
      type: "object",
      properties: { oib: { type: "string" } },
      required: ["oib"],
    }),
    fn("search_gmail", "Pretraži Gmail inbox (admin račun). Koristi Gmail search operatore (from:, subject:, has:attachment, itd.).", {
      type: "object",
      properties: { query: { type: "string", description: "Gmail search query" } },
      required: ["query"],
    }),
    fn("search_solo", "Pretraži Solo.com.hr račune ili ponude. Solo je servis za fakturiranje.", {
      type: "object",
      properties: {
        tip: { type: "string", enum: ["racun", "ponuda"], description: "Tip dokumenta: 'racun' ili 'ponuda'" },
        stranica: { type: "number", description: "Broj stranice (1000 rezultata po stranici)" },
      },
    }),
    fn("fill_zahtjev", "Ispuni obrazac Zahtjev za izdavanje potvrde.", {
      type: "object",
      properties: {
        card_id: { type: "string" },
        title: { type: "string" },
        katastarska_opcina: { type: "string" },
        katastarska_cestica: { type: "string" },
        adresa_cestice: { type: "string" },
        postanski_broj: { type: "string" },
        vrsta_posla: { type: "array", items: { type: "string" } },
        narucitelj_ime: { type: "string" },
        narucitelj_adresa: { type: "string" },
        narucitelj_oib: { type: "string" },
        kontakt: { type: "string" },
        description: { type: "string" },
      },
    }),
    fn("fill_pdf", "Ispuni PDF obrazac s form poljima.", {
      type: "object",
      properties: {
        pdf_url: { type: "string" },
        pdf_base64: { type: "string" },
        list_fields_only: { type: "boolean" },
        field_values: { type: "object" },
      },
    }),
  );

  if (opts.hasAgent) {
    tools.push(
      fn("run_python", "Pokreni Python skriptu na lokalnom računalu. Označi s 🖥️ **Lokalni agent**.", {
        type: "object",
        properties: {
          code: { type: "string" },
          filename: { type: "string" },
          args: { type: "array", items: { type: "string" } },
          timeout: { type: "number" },
        },
        required: ["code"],
      }),
      fn("run_shell", "Izvrši shell komandu na lokalnom računalu.", {
        type: "object",
        properties: { command: { type: "string" }, cwd: { type: "string" }, timeout: { type: "number" } },
        required: ["command"],
      }),
      fn("agent_read_file", "Pročitaj datoteku s lokalnog računala.", {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      }),
      fn("agent_write_file", "Zapiši datoteku na lokalno računalo.", {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      }),
      fn("agent_list_files", "Izlistaj datoteke u workspace-u.", {
        type: "object",
        properties: { path: { type: "string" }, recursive: { type: "boolean" } },
      }),
      fn("git_push", "Git add, commit i push.", {
        type: "object",
        properties: {
          repo_path: { type: "string" },
          message: { type: "string" },
          files: { type: "array", items: { type: "string" } },
        },
      }),
      fn("pip_install", "Instaliraj Python pakete.", {
        type: "object",
        properties: { packages: { type: "array", items: { type: "string" } } },
        required: ["packages"],
      }),
      fn("playwright", "Kontroliraj web browser (Playwright). Akcije: navigate, screenshot, click, fill, extract, evaluate, pdf, select, get_html, wait, close. Označi s 🌐 **Playwright**.", {
        type: "object",
        properties: {
          action: { type: "string" },
          url: { type: "string" },
          selector: { type: "string" },
          value: { type: "string" },
          script: { type: "string" },
          timeout: { type: "number" },
          wait_for: { type: "string" },
          full_page: { type: "boolean" },
        },
        required: ["action"],
      }),
    );
  }

  return tools;
}

// ─────────────────────────────────────────────────────────────
//  IZVRŠAVANJE TOOL CALLOVA
// ─────────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  args: any,
  ctx: {
    accessToken: string | null;
    brainFolderId: string | null;
    geoterraToken: string | null;
    enableDriveTools: boolean;
  },
): Promise<string> {
  const { accessToken, brainFolderId, geoterraToken } = ctx;

  if (ctx.enableDriveTools && accessToken && brainFolderId) {
    const driveToolNames = [
      "create_drive_folder", "create_drive_file", "list_drive_files",
      "read_brain_file", "rename_drive_item", "move_drive_item", "copy_drive_file",
    ];
    if (driveToolNames.includes(toolName)) return executeDriveTool(accessToken, brainFolderId, toolName, args);
  }

  switch (toolName) {
    case "search_trello":
      return searchTrello(args.query || "");
    case "scrape_website":
      return scrapeWebsite(args.url || "");
    case "search_drive":
      return geoterraToken
        ? searchGoogleDrive(geoterraToken, args.query || "")
        : JSON.stringify({ success: false, error: "Drive token not available" });
    case "list_drive_folder":
      return geoterraToken
        ? listDriveFolder(geoterraToken, args.folder_id || "")
        : JSON.stringify({ success: false, error: "Drive token not available" });
    case "search_sdge":
      return searchSdge(args);
    case "download_sdge_pdf":
      return downloadSdgePdf(args);
    case "sdge_povratnice":
      return sdgePovratnice(args);
    case "search_geoterra_app":
      return searchGeoterraApp(args.query || "");
    case "update_geoterra_card":
      return updateGeoterraCard(args);
    case "search_oss":
      return searchOss(args);
    case "lookup_oib":
      return lookupOib(args.oib || "");
    case "search_gmail":
      return searchGmail(args.query || "");
    case "search_solo":
      return searchSolo(args);
    case "fill_zahtjev":
      return fillZahtjev(args);
    case "fill_pdf":
      return fillPdf(args);
    case "run_python":
      return callAgent("run_python", args);
    case "run_shell":
      return callAgent("run_shell", args);
    case "agent_read_file":
      return callAgent("read_file", args);
    case "agent_write_file":
      return callAgent("write_file", args);
    case "agent_list_files":
      return callAgent("list_files", args);
    case "git_push":
      return callAgent("git_push", args);
    case "pip_install":
      return callAgent("pip_install", args);
    case "playwright":
      return callAgent("playwright", args);
    default:
      return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
  }
}

// ─────────────────────────────────────────────────────────────
//  OPENAI STREAMING SA TOOL USE AGENTIC LOOP
// ─────────────────────────────────────────────────────────────

// Convert messages to OpenAI format, extracting inline base64 images for vision
function convertMessagesToOpenAI(messages: any[]): any[] {
  return messages.map((m: any) => {
    if (m.role !== "user" || typeof m.content !== "string") {
      return { role: m.role, content: m.content };
    }

    // Check for base64 images in markdown format: ![alt](data:image/...;base64,...)
    const imageRegex = /!\[([^\]]*)\]\((data:image\/([^;]+);base64,([^)]+))\)/g;
    const images: { alt: string; dataUrl: string }[] = [];
    let match;
    while ((match = imageRegex.exec(m.content)) !== null) {
      images.push({ alt: match[1], dataUrl: match[2] });
    }

    if (images.length === 0) {
      return { role: "user", content: m.content };
    }

    // Build multimodal content array for OpenAI vision
    const textContent = m.content.replace(imageRegex, "").trim();
    const contentParts: any[] = [];

    if (textContent) {
      contentParts.push({ type: "text", text: textContent });
    }

    for (const img of images) {
      contentParts.push({
        type: "image_url",
        image_url: { url: img.dataUrl, detail: "auto" },
      });
    }

    return { role: "user", content: contentParts };
  });
}

async function runOpenAIWithTools(
  openaiApiKey: string,
  systemPrompt: string,
  messages: any[],
  tools: any[],
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  ctx: {
    accessToken: string | null;
    brainFolderId: string | null;
    geoterraToken: string | null;
    enableDriveTools: boolean;
  },
): Promise<string> {
  let fullResponse = "";
  // Convert messages to OpenAI format with vision support
  let openaiMessages: any[] = [
    { role: "system", content: systemPrompt },
    ...convertMessagesToOpenAI(messages),
  ];

  const streamDelta = async (text: string) => {
    if (!text) return;
    const sseData = JSON.stringify({ choices: [{ delta: { content: text } }] });
    await writer.write(encoder.encode(`data: ${sseData}\n\n`));
  };

  // Agentic loop
  for (let iteration = 0; iteration < 10; iteration++) {
    const requestBody: any = {
      model: OPENAI_MODEL,
      max_tokens: OPENAI_MAX_TOKENS,
      messages: openaiMessages,
      stream: true,
    };
    if (tools.length > 0) requestBody.tools = tools;

    const res = await fetchWithTimeout(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI API error:", res.status, errText);
      const errMsg = "⚠️ Stellan trenutno nije dostupan. Pokušaj ponovo.";
      await streamDelta(errMsg);
      fullResponse += errMsg;
      break;
    }

    // Parse OpenAI SSE stream
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let iterationText = "";
    const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
    let finishReason = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;
        try {
          const ev = JSON.parse(jsonStr);
          const choice = ev.choices?.[0];
          if (!choice) continue;

          // Finish reason
          if (choice.finish_reason) finishReason = choice.finish_reason;

          const delta = choice.delta;
          if (!delta) continue;

          // Text content
          if (delta.content) {
            iterationText += delta.content;
            await streamDelta(delta.content);
          }

          // Tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCalls.has(idx)) {
                toolCalls.set(idx, { id: tc.id || "", name: tc.function?.name || "", arguments: "" });
              }
              const existing = toolCalls.get(idx)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            }
          }
        } catch {
          /* skip invalid JSON */
        }
      }
    }

    fullResponse += iterationText;

    // If no tool calls - done
    if (toolCalls.size === 0 || finishReason === "stop") break;

    // Execute tool calls
    const toolCallsList = Array.from(toolCalls.values());
    console.log(
      `[OpenAI Tools] Executing ${toolCallsList.length} tool(s): ${toolCallsList.map((t) => t.name).join(", ")}`,
    );
    await streamDelta("\n\n🔍 *Pretražujem...*\n\n");

    // Add assistant message with tool_calls
    const assistantMsg: any = { role: "assistant", content: iterationText || null };
    assistantMsg.tool_calls = toolCallsList.map((tc) => ({
      id: tc.id,
      type: "function",
      function: { name: tc.name, arguments: tc.arguments },
    }));
    openaiMessages.push(assistantMsg);

    // Execute tools and add results
    for (const tc of toolCallsList) {
      let args = {};
      try {
        args = JSON.parse(tc.arguments || "{}");
      } catch {
        args = {};
      }
      const result = await executeTool(tc.name, args, ctx);
      console.log(`[OpenAI Tools] ${tc.name} result: ${result.slice(0, 200)}`);
      openaiMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  return fullResponse;
}

// ─────────────────────────────────────────────────────────────
//  GLAVNI SERVE HANDLER
// ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── JWT auth ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user_id = claimsData.claims.sub as string;

    // ── Dohvati OpenAI API key ────────────────────────────────
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY nije konfiguriran!");

    const { messages, conversation_id } = await req.json();

    // ── Brain/Drive setup ─────────────────────────────────────
    let brainKnowledge = "";
    let accessToken: string | null = null;
    let brainFolderId: string | null = null;
    let geoterraToken: string | null = null;
    let brainOwnerId: string | null = null;
    let isBrainOwner = false;

    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    brainOwnerId = await resolveBrainOwnerId(supabaseAdmin, user_id);
    isBrainOwner = !!brainOwnerId && user_id === brainOwnerId;

    if (brainOwnerId) {
      accessToken = await getValidAccessToken(supabaseAdmin, brainOwnerId, "google_brain_tokens");
      if (!accessToken) accessToken = await getValidAccessToken(supabaseAdmin, brainOwnerId, "google_tokens");
    }

    if (accessToken) {
      brainFolderId = await getOrCreateBrainFolder(accessToken);
      if (brainFolderId) {
        if (isBrainOwner) await initializeBrainIfEmpty(accessToken, brainFolderId);
        brainKnowledge = await loadBrainKnowledge(accessToken, brainFolderId);
        console.log("[Brain] Knowledge loaded, chars:", brainKnowledge.length);
      }
    }

    let geoToken = await getValidAccessToken(supabaseAdmin, user_id, "google_tokens");
    if (!geoToken && brainOwnerId && !isBrainOwner)
      geoToken = await getValidAccessToken(supabaseAdmin, brainOwnerId, "google_tokens");
    if (geoToken) geoterraToken = geoToken;

    const hasBrain = !!(accessToken && brainFolderId);
    const enableDriveTools = hasBrain && isBrainOwner && shouldEnableDriveTools(messages || []);
    const hasTrello = !!(Deno.env.get("TRELLO_API_KEY") && Deno.env.get("TRELLO_TOKEN"));
    const hasFirecrawl = !!Deno.env.get("FIRECRAWL_API_KEY");
    const hasGeoterraDrive = !!geoterraToken;
    const hasAgent = !!(Deno.env.get("AGENT_SERVER_URL") && sanitizeAgentServerUrl(Deno.env.get("AGENT_SERVER_URL")!));

    // ── System prompt ─────────────────────────────────────────
    const systemPrompt = `Ti si Stellan — osobni AI asistent geodetske tvrtke GeoTerra Info d.o.o. iz Hrvatske. Pametan si, konkretan i uvijek fokusiran na to da stvarno pomogneš — ne daješ prazne odgovore.

## TKO SI TI
Stellan je interni asistent GeoTerra Info tima. Poznaješ geodetsku struku, hrvatske zakone i propise vezane uz katastar, SDGE portal, prostorno planiranje i GIS. Govoriš kao kolega iz tima — prijateljski, direktno, bez nepotrebnog formalizma. Kad nešto ne znaš — kažeš to jasno umjesto da izmišljaš.

## TVOJI ALATI (koristi ih ODMAH bez pitanja kad je kontekst jasan)

### 🔍 PRETRAGA — kad korisnik traži projekt, osobu, dokument, parcelu ili bilo što:
- **search_sdge** → pretraži SDGE portal (službeni geodetski podaci, zahtjevi, elaborati)
- **search_geoterra_app** → pretraži internu GeoTerra aplikaciju (projekti, kartice, klijenti)
- **search_drive** → pretraži firmeni Google Drive (dokumenti, elaborati, ugovori)
- **search_gmail** → pretraži Gmail (prepiske, obavijesti, privitak)
- **search_trello** → pretraži Trello ploče (zadaci, rokovi, statusi)
- **search_solo** → pretraži Solo.com.hr (računi, ponude, plaćanja)
- **search_oss** → pretraži OSS portal oss.uredjenazemlja.hr
- **lookup_oib** → provjeri OIB osobe ili tvrtke

⚡ **PRAVILO PRETRAGE**: Kad korisnik traži bilo što (projekt, osobu, dokument) — ODMAH pozovi relevantne alate BEZ dugih uvoda. Rezultate prikaži u čitljivom formatu s linkovima.

### 📄 SDGE PORTAL
- **search_sdge** → pretraži zahtjeve i elaborate
- **download_sdge_pdf** → preuzmi PDF dokumenta
- **sdge_povratnice** → dohvati povratnice/potvrde

### 📁 GOOGLE DRIVE (${hasGeoterraDrive ? "AKTIVAN ✅" : "NIJE SPOJEN ❌"})
- **search_drive** → pretraži firmeni Drive
${enableDriveTools ? `- **list_drive_files** → izlistaj datoteke u folderu
- **read_brain_file** → pročitaj datoteku iz Stellan Braina
- **create_drive_folder/file** → kreiraj folder ili datoteku
- **rename_drive_item / move_drive_item / copy_drive_file** → upravljaj datotekama` : ""}

### 📧 GMAIL (${hasGeoterraDrive ? "AKTIVAN ✅" : "NIJE SPOJEN ❌"})
- **search_gmail** → pretraži inbox. Podržava: from:, to:, subject:, has:attachment, after:, before:

### 🧾 FAKTURIRANJE
- **search_solo** → pretraži račune i ponude na Solo.com.hr

### 📝 FILL ALATI
- **fill_zahtjev** → ispuni geodetski zahtjev/obrazac automatski
- **fill_pdf** → ispuni PDF obrazac

${hasTrello ? `### 📌 TRELLO
- **search_trello** → pretraži ploče, liste i kartice` : ""}

${hasFirecrawl ? `### 🌐 WEB SCRAPING
- **scrape_website** → dohvati sadržaj bilo koje web stranice` : ""}

${hasAgent ? `### 💻 LOKALNI AGENT (${hasAgent ? "ONLINE ✅" : "OFFLINE ❌"})
- **run_python** → pokreni Python skriptu
- **run_shell** → pokreni shell naredbu
- **agent_read_file / agent_write_file / agent_list_files** → čitaj/piši datoteke
- **git_push** → deploy na GitHub → Netlify
- **pip_install** → instaliraj Python pakete
- **playwright** → automatizacija preglednika` : ""}

### 🧠 MOZAK — Stellan Brain (${hasBrain ? "AKTIVAN ✅" : "NIJE SPOJEN ❌"})
Google Drive folder "Stellan Brain" — tu su memory.md, upute.md, projekti.md. Pamtiš sve važno između razgovora.

## KAKO ODGOVARAŠ

**Format odgovora:**
- Kratki odgovori za kratka pitanja — ne piši eseje kad je dovoljna jedna rečenica
- Koristiti **bold** za važne informacije, tablice za usporedbe, bullet liste za korake
- Linkove uvijek prikazuj kao klikabilne: [Naziv](url)
- Kod uvijek u code bloku s jezikom
- Emoji koristi umjereno — samo kad pomaže razumijevanju

**Rezultati pretrage:**
- Prikaži kao tablicu ili numerirani popis s: Naziv | Status | Link | Datum
- Uvijek uključi direktne linkove ako postoje
- Ako nema rezultata — jasno reci i predloži alternativu

**Drive rezultati:**
- Foldere prikazuj s hijerarhijom: 📁 [Naziv](link)
  - └ 📂 [Podfolder](link)
- Datoteke pokazuj samo ako nema folder pogodaka ili korisnik eksplicitno traži datoteke

**Greške:**
- Ako alat vrati grešku — odmah reci korisniku što se desilo i predloži rješenje
- Ne skrivaj greške i ne izmišljaj da je nešto uspjelo

## STROGO ZABRANJENO
- ❌ NIKAD ne tvrdi da si nešto napravio bez da si pozvao alat i dobio "success": true
- ❌ NIKAD ne izmišljaj podatke o projektima, parcelama, OIB-ovima ili dokumentima
- ❌ NIKAD ne govori "prilagodio sam", "napravio sam", "pokrenuo sam" bez stvarnog poziva alata
- ❌ Ne odgovaraj na jeziku koji nije hrvatski osim ako korisnik ne piše na drugom jeziku
- ❌ Kad korisnik traži promjenu tvojeg koda ili pravila — jasno reci: "To zahtijeva developersku izmjenu."

## GEODETSKO ZNANJE
Poznaješ: katastarski premjer, elaborat o promjeni, etažni plan, geodetski elaborat, NIPP, DKP (digitalna katastarska mapa), ZK (zemljišna knjiga), GUP/PPUO, UPU, SDGE portal, eNekretnine, OSS portal, čestice, posjedovni list, ZK izvadak, ARKOD, JOPPD, OIB, k.č., k.o.

${brainKnowledge ? `\n====== STELLAN BRAIN — MEMORIJA I ZNANJE ======\n${brainKnowledge}\n====== KRAJ MOZGA ======` : ""}`;

    // ── Tools ─────────────────────────────────────────────────
    const tools = buildTools({ enableDriveTools, hasTrello, hasFirecrawl, hasGeoterraDrive, hasAgent });

    // ── Streaming response ────────────────────────────────────
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const shared = { fullResponse: "" };

    const streamWork = (async () => {
      try {
        shared.fullResponse = await runOpenAIWithTools(
          OPENAI_API_KEY,
          systemPrompt,
          messages,
          tools,
          writer,
          encoder,
          { accessToken, brainFolderId, geoterraToken, enableDriveTools },
        );
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("Stream error:", e);
        try {
          const errMsg = "⚠️ Greška pri obradi. Pokušaj ponovo.";
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: errMsg } }] })}\n\n`),
          );
          await writer.write(encoder.encode("data: [DONE]\n\n"));
        } catch {
          /* already closed */
        }
      } finally {
        try {
          await writer.close();
        } catch {
          /* already closed */
        }
      }
    })();

    // ── Post-conversation persistence (background) ────────────
    streamWork
      .then(async () => {
        // Token logging
        try {
          const inputText = messages.map((m: any) => {
            if (typeof m.content === "string") return m.content;
            return "[multimodal]";
          }).join(" ");
          const outputText = shared.fullResponse || "";
          const inputTokens = Math.ceil(inputText.split(/\s+/).length * 1.3);
          const outputTokens = Math.ceil(outputText.split(/\s+/).length * 1.3);
          await supabaseAdmin
            .from("token_usage")
            .insert({
              user_id,
              conversation_id: conversation_id || null,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              total_tokens: inputTokens + outputTokens,
              model: OPENAI_MODEL,
            });
        } catch (e) {
          console.error("Token logging error:", e);
        }

        // Brain persistence
        if (accessToken && brainFolderId && shared.fullResponse && isBrainOwner) {
          const allMessages = [...messages, { role: "assistant", content: shared.fullResponse }];
          await Promise.allSettled([
            saveConversationToBrain(accessToken, brainFolderId, allMessages, conversation_id || "auto"),
            updateMemory(accessToken, brainFolderId, allMessages, OPENAI_API_KEY),
          ]);
        }
      })
      .catch((e) => console.error("Persistence error:", e));

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Handler error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Nepoznata greška" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
