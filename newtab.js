"use strict";

/* ================= CONSTANTS ================= */
const ENGINES = {
  google:     { url: "https://www.google.com/search?q=", label: "Google", suffix: "'da" },
  bing:       { url: "https://www.bing.com/search?q=", label: "Bing", suffix: "'de" },
  duckduckgo: { url: "https://duckduckgo.com/?q=", label: "DuckDuckGo", suffix: "'da" },
  brave:      { url: "https://search.brave.com/search?q=", label: "Brave", suffix: "'de" },
  ecosia:     { url: "https://www.ecosia.org/search?q=", label: "Ecosia", suffix: "'da" }
};

const DEFAULTS = {
  theme: "system",
  engine: "google",
  showLogo: true,
  persistMoves: true,
  welcomed: false,
  language: "",
  avatarLetter: "G",
  maxLinks: 10,
  order: [],
  collapsed: [],
  hidden: []
};

let settings = { ...DEFAULTS };
let localTree = { folders: [], loose: [] };
let originalSnapshot = null; // Chrome's initial loaded state (for diff calculation)

/* ================= LOAD/SAVE SETTINGS ================= */
// Settings are kept in chrome.storage.sync -> automatically synced across
// all devices on the same Google account. Local settings from older
// versions are migrated to sync once (migration).
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get("settings", (syncRes) => {
      if (syncRes && syncRes.settings) {
        settings = { ...DEFAULTS, ...syncRes.settings };
        resolve();
        return;
      }
      // sync empty -> check for old local settings and migrate them
      chrome.storage.local.get("settings", (localRes) => {
        if (localRes && localRes.settings) {
          settings = { ...DEFAULTS, ...localRes.settings };
          chrome.storage.sync.set({ settings }); // migrate to sync
        } else {
          settings = { ...DEFAULTS };
        }
        resolve();
      });
    });
  });
}
function saveSettings() {
  chrome.storage.sync.set({ settings }, () => {
    if (chrome.runtime.lastError) {
      // fall back to local if sync quota is full or sync is disabled
      chrome.storage.local.set({ settings });
    }
  });
}

// Live-update this tab when settings change on another device
function initSyncListener() {
  if (!chrome.storage || !chrome.storage.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.settings) return;
    const incoming = changes.settings.newValue;
    if (!incoming) return;
    settings = { ...DEFAULTS, ...incoming };
    // Apply if the language changed on another device
    if (settings.language && settings.language !== currentLang) {
      setLang(settings.language);
      document.documentElement.lang = currentLang;
      applyDomTranslations();
      fillWelcomeText();
    }
    // Refresh the view according to the new settings
    applyTheme();
    updateLogo();
    updatePlaceholder();
    updateAvatar();
    renderAll();
    if (!document.getElementById("settings-overlay").hidden) syncPanel();
  });
}

/* ================= THEME ================= */
const media = window.matchMedia("(prefers-color-scheme: dark)");
function resolveTheme() {
  if (settings.theme === "system") return media.matches ? "dark" : "light";
  return settings.theme;
}
function applyTheme() {
  document.documentElement.setAttribute("data-theme", resolveTheme());
  updateLogo();
}

/* ================= AVATAR ================= */
// Fetching a photo from the email isn't possible in an extension; we show a letter + color instead.
const AVATAR_COLORS = [
  "#4285F4", "#EA4335", "#FBBC05", "#34A853",
  "#8E44AD", "#16A085", "#E67E22", "#2C3E50"
];
function updateAvatar() {
  const el = document.getElementById("avatar");
  if (!el) return;
  const letter = (settings.avatarLetter || "G").trim().slice(0, 2) || "G";
  el.textContent = letter.toUpperCase();
  // Pick a consistent color based on the letter
  let sum = 0;
  for (const ch of letter.toUpperCase()) sum += ch.charCodeAt(0);
  const color = AVATAR_COLORS[sum % AVATAR_COLORS.length];
  el.style.background = color;
}
media.addEventListener("change", () => { if (settings.theme === "system") applyTheme(); });

/* ================= LOGO / BRAND ================= */
// If Google is selected, show the Google logo; for other engines, show the engine name as text.
const LOGO_COLOR = "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png";

function updateLogo() {
  const wrap = document.querySelector(".logo-wrap");
  const img = document.getElementById("google-logo");
  const textLogo = document.getElementById("text-logo");

  if (!settings.showLogo) { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");

  const engine = settings.engine || "google";
  if (engine === "google") {
    // Google logo (image)
    textLogo.hidden = true;
    img.hidden = false;
    img.onerror = () => { img.style.visibility = "hidden"; };
    img.onload = () => { img.style.visibility = "visible"; };
    img.src = LOGO_COLOR;
  } else {
    // Other engines: show the name as text
    img.hidden = true;
    textLogo.hidden = false;
    textLogo.textContent = (ENGINES[engine] || ENGINES.google).label;
  }
}

// Sets the search box placeholder based on the selected engine
function updatePlaceholder() {
  const input = document.getElementById("search-input");
  if (!input) return;
  const e = ENGINES[settings.engine] || ENGINES.google;
  // In Turkish, a suffix is appended to the engine name (Google'da, Bing'de); other languages use the format from the dictionary.
  const engineName = currentLang === "tr" ? `${e.label}${e.suffix}` : e.label;
  input.placeholder = t("search_placeholder", { engine: engineName });
}

/* ================= SEARCH ================= */
const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  const looksLikeUrl = /^(https?:\/\/)/i.test(q) ||
    (/^[^\s]+\.[^\s]{2,}(\/|$)/.test(q) && !q.includes(" "));
  if (looksLikeUrl) {
    location.href = /^https?:\/\//i.test(q) ? q : "https://" + q;
  } else {
    const engine = ENGINES[settings.engine] || ENGINES.google;
    location.href = engine.url + encodeURIComponent(q);
  }
});

/* ================= FAVICON ================= */
function faviconUrl(pageUrl) {
  try {
    const u = new URL(chrome.runtime.getURL("/_favicon/"));
    u.searchParams.set("pageUrl", pageUrl);
    u.searchParams.set("size", "32");
    return u.toString();
  } catch { return ""; }
}
function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

/* ================= TREE PROCESSING ================= */
function directBookmarks(node) {
  return (node.children || []).filter((c) => c.url)
    .map((c) => ({ id: c.id, title: c.title, url: c.url, parentId: c.parentId }));
}

// Converts a folder node into a {id, title, links, subfolders} tree (recursive).
// Skips empty folders that have no bookmarks/subfolders inside.
function buildFolderNode(node) {
  const links = directBookmarks(node);
  const subfolders = [];
  for (const child of node.children || []) {
    if (child.children && child.title) {
      const sub = buildFolderNode(child);
      if (sub) subfolders.push(sub);
    }
  }
  if (!links.length && !subfolders.length) return null; // empty folder
  return { id: node.id, title: node.title, links, subfolders };
}

// Collects the folders under the top-level containers (Bookmarks Bar, Other).
function collectTopFolders(node, acc) {
  for (const child of node.children || []) {
    if (child.children && child.title) {
      const folder = buildFolderNode(child);
      if (folder) acc.push(folder);
    }
  }
}

/* ================= LINK ITEM ================= */
function makeLink(node, folderId) {
  const a = document.createElement("a");
  a.className = "link";
  a.href = node.url;
  a.title = node.title || node.url;
  a.dataset.id = node.id;
  a.dataset.folder = folderId || "loose";
  a.draggable = false;

  const img = document.createElement("img");
  img.className = "fav";
  img.loading = "lazy";
  img.draggable = false;
  img.src = faviconUrl(node.url);
  img.alt = "";
  img.addEventListener("error", () => { img.style.visibility = "hidden"; });

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = node.title || hostnameOf(node.url);

  a.append(img, label);
  attachLinkDrag(a);
  return a;
}

/* ================= SORTING (folder cards) ================= */
function sortByOrder(folders) {
  const order = settings.order || [];
  const idx = new Map(order.map((id, i) => [id, i]));
  return [...folders].sort((a, b) => {
    const ai = idx.has(a.id) ? idx.get(a.id) : Infinity;
    const bi = idx.has(b.id) ? idx.get(b.id) : Infinity;
    return ai - bi;
  });
}

/* ================= RENDER ================= */
function renderAll() {
  renderFolders();
  renderLoose();
  const nothing = !localTree.folders.length && !localTree.loose.length;
  document.getElementById("empty").hidden = !nothing;
}

function renderFolders() {
  const container = document.getElementById("folders");
  container.innerHTML = "";
  const visible = localTree.folders.filter((f) => !(settings.hidden || []).includes(f.id));
  const ordered = sortByOrder(visible);

  for (const folder of ordered) {
    const card = document.createElement("div");
    card.className = "folder";
    card.dataset.id = folder.id;
    if ((settings.collapsed || []).includes(folder.id)) card.classList.add("collapsed");

    const head = document.createElement("div");
    head.className = "folder-head";

    const toggle = document.createElement("button");
    toggle.className = "folder-toggle";
    toggle.setAttribute("aria-label", t("folder_toggle"));
    toggle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      card.classList.toggle("collapsed");
      persistCollapsed(folder.id, card.classList.contains("collapsed"));
    });

    const h = document.createElement("h2");
    h.className = "folder-title";
    h.textContent = folder.title;

    head.append(toggle, h);

    // The card body: direct links + subfolders
    const body = document.createElement("div");
    body.className = "folder-body";

    const list = document.createElement("div");
    list.className = "folder-links";
    list.dataset.folder = folder.id;
    for (const b of folder.links) list.appendChild(makeLink(b, folder.id));
    body.appendChild(list);
    applyScrollIfNeeded(list, folder.links.length);

    // Subfolders (recursive)
    for (const sub of folder.subfolders || []) {
      body.appendChild(renderSubfolder(sub, 1));
    }

    card.append(head, body);
    attachCardDrag(card);
    container.appendChild(card);
  }
}

// Renders a subfolder recursively (accordion). depth: indentation level.
function renderSubfolder(folder, depth) {
  const wrap = document.createElement("div");
  wrap.className = "subfolder";
  wrap.dataset.id = folder.id;
  wrap.style.setProperty("--depth", depth);
  if ((settings.collapsed || []).includes(folder.id)) wrap.classList.add("collapsed");

  const head = document.createElement("div");
  head.className = "subfolder-head";
  head.addEventListener("click", () => {
    wrap.classList.toggle("collapsed");
    persistCollapsed(folder.id, wrap.classList.contains("collapsed"));
  });

  const chevron = document.createElement("span");
  chevron.className = "subfolder-chevron";
  chevron.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  const icon = document.createElement("span");
  icon.className = "subfolder-icon";
  icon.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>';

  const title = document.createElement("span");
  title.className = "subfolder-title";
  title.textContent = folder.title;

  const count = document.createElement("span");
  count.className = "subfolder-count";
  const totalLinks = countLinks(folder);
  count.textContent = totalLinks;

  head.append(chevron, icon, title, count);

  const body = document.createElement("div");
  body.className = "subfolder-body";

  const list = document.createElement("div");
  list.className = "folder-links";
  list.dataset.folder = folder.id;
  for (const b of folder.links) list.appendChild(makeLink(b, folder.id));
  body.appendChild(list);
  applyScrollIfNeeded(list, folder.links.length);

  // Deeper subfolders
  for (const sub of folder.subfolders || []) {
    body.appendChild(renderSubfolder(sub, depth + 1));
  }

  wrap.append(head, body);
  return wrap;
}

// Total link count in a folder (including subfolders)
function countLinks(folder) {
  let n = folder.links.length;
  for (const sub of folder.subfolders || []) n += countLinks(sub);
  return n;
}

// Save the collapsed state
function persistCollapsed(id, isCollapsed) {
  const set = new Set(settings.collapsed || []);
  if (isCollapsed) set.add(id);
  else set.delete(id);
  settings.collapsed = [...set];
  saveSettings();
}

/* ---- In-folder scroll + fade ---- */
const LINK_ROW_HEIGHT = 32; // px, approximate height of a link row (including padding)

function applyScrollIfNeeded(list, linkCount) {
  const max = settings.maxLinks || 10;
  if (linkCount <= max) return; // scroll not needed

  list.classList.add("scrollable");
  // Max height: show up to "max" rows
  list.style.maxHeight = (max * LINK_ROW_HEIGHT) + "px";

  // Update the fade state based on scroll position
  const updateFade = () => {
    const atTop = list.scrollTop <= 1;
    const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
    list.classList.toggle("fade-top", !atTop);
    list.classList.toggle("fade-bottom", !atBottom);
  };
  list.addEventListener("scroll", updateFade, { passive: true });
  // Initial state: bottom fade on (starts scrolled to top)
  requestAnimationFrame(updateFade);
}

/* ---- Nested folder traversal helpers ---- */
// Returns all folders (including nested) as a flat list
function allFolders(folders = localTree.folders, acc = []) {
  for (const f of folders) {
    acc.push(f);
    if (f.subfolders && f.subfolders.length) allFolders(f.subfolders, acc);
  }
  return acc;
}
// Finds a folder by id (including nested), along with its parent
function findFolderById(id, folders = localTree.folders, parent = null) {
  for (const f of folders) {
    if (f.id === id) return { folder: f, parentList: folders, parent };
    if (f.subfolders && f.subfolders.length) {
      const r = findFolderById(id, f.subfolders, f);
      if (r) return r;
    }
  }
  return null;
}

function renderLoose() {
  const section = document.getElementById("loose");
  const cols = document.getElementById("loose-columns");
  cols.innerHTML = "";
  cols.dataset.folder = "loose";
  if (!localTree.loose.length) { section.hidden = true; return; }
  section.hidden = false;
  for (const b of localTree.loose) cols.appendChild(makeLink(b, "loose"));
}

/* ================= FLIP ANIMATION ================= */
function flip(container, selector, mutate) {
  const els = [...container.querySelectorAll(selector)];
  const first = new Map(els.map((el) => [el, el.getBoundingClientRect()]));
  mutate();
  const elsAfter = [...container.querySelectorAll(selector)];

  // Collect the elements that moved (excluding the dragged element - it has its own effect)
  const movers = [];
  for (const el of elsAfter) {
    if (el.classList.contains("drag-source") || el.classList.contains("link-drag-source")) continue;
    const prev = first.get(el);
    if (!prev) continue;
    const now = el.getBoundingClientRect();
    const dx = prev.left - now.left;
    const dy = prev.top - now.top;
    if (dx || dy) movers.push({ el, dx, dy, dist: Math.hypot(dx, dy) });
  }
  if (!movers.length) return;

  // Stagger: elements closer to the source move first, farther ones move with a slight delay (wave effect)
  movers.sort((a, b) => a.dist - b.dist);
  const STEP = 18;   // ms, delay between elements
  const MAX_DELAY = 90; // ms, upper bound

  movers.forEach(({ el, dx, dy }, i) => {
    const delay = Math.min(i * STEP, MAX_DELAY);
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.transition = "transform 0s";
    requestAnimationFrame(() => {
      el.style.transition = `transform .26s cubic-bezier(.2,.7,.3,1) ${delay}ms`;
      el.style.transform = "";
    });
    el.addEventListener("transitionend", () => { el.style.transition = ""; }, { once: true });
  });
}

/* ================= POINTER-BASED DRAG-AND-DROP =================
   We use pointer events instead of native HTML5 drag. This lets other
   elements make room LIVE while dragging (Trello/Notion style).

   Logic:
   - pointerdown: record the starting point, don't start dragging yet
   - pointermove: once a threshold (5px) is crossed, start the drag; keep a
     "ghost" copy of the dragged element under the cursor; move the real
     element in the DOM based on the target underneath, and live-shift the
     elements in between using FLIP
   - pointerup: remove the ghost, save the order
================================================================= */

const DRAG_THRESHOLD = 5; // px

let dragState = null;
/* dragState = {
     type: "card" | "link",
     el, ghost, container, offsetX, offsetY,
     startX, startY, started, placeholderRect
   } */

function startPointerDrag(e, el, type) {
  // Left click / single finger only
  if (e.button !== undefined && e.button !== 0) return;

  const rect = el.getBoundingClientRect();
  dragState = {
    type,
    el,
    ghost: null,
    container: type === "card" ? document.getElementById("folders") : el.parentElement,
    originFolder: type === "link" ? el.dataset.folder : null,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    startX: e.clientX,
    startY: e.clientY,
    started: false,
    width: rect.width,
    height: rect.height
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp, { once: true });
  window.addEventListener("pointercancel", onPointerUp, { once: true });
}

function beginDrag() {
  const s = dragState;
  s.started = true;

  // Create the ghost (a visual copy of the dragged element that follows the cursor)
  const ghost = s.el.cloneNode(true);
  ghost.classList.add("drag-ghost");
  ghost.style.width = s.width + "px";
  ghost.style.height = s.height + "px";
  ghost.style.position = "fixed";
  ghost.style.left = "0";
  ghost.style.top = "0";
  ghost.style.margin = "0";
  ghost.style.pointerEvents = "none";
  ghost.style.zIndex = "1000";
  document.body.appendChild(ghost);
  s.ghost = ghost;

  // The original element stays in place but is dimmed as the "source"
  s.el.classList.add(s.type === "card" ? "drag-source" : "link-drag-source");

  document.body.classList.add("dragging-active");
  moveGhost(s.startX, s.startY);
}

function moveGhost(x, y) {
  const s = dragState;
  if (!s || !s.ghost) return;
  s.ghost.style.transform =
    `translate(${x - s.offsetX}px, ${y - s.offsetY}px) scale(1.03) rotate(1.2deg)`;
}

function onPointerMove(e) {
  const s = dragState;
  if (!s) return;

  if (!s.started) {
    const dist = Math.hypot(e.clientX - s.startX, e.clientY - s.startY);
    if (dist < DRAG_THRESHOLD) return;
    beginDrag();
  }

  e.preventDefault();
  moveGhost(e.clientX, e.clientY);

  if (s.type === "card") handleCardReorder(e);
  else handleLinkReorder(e);
}

/* ---- CARD reordering ---- */
function handleCardReorder(e) {
  const s = dragState;
  const container = s.container;
  const cards = [...container.querySelectorAll(".folder")].filter((c) => c !== s.el);

  // Find the card under the cursor
  let target = null;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom) {
      target = c;
      break;
    }
  }
  if (!target) return;

  const r = target.getBoundingClientRect();
  // Since it's a grid, check both horizontal and vertical position
  const after = (e.clientY - r.top) > r.height / 2 ||
                (Math.abs(e.clientY - (r.top + r.height/2)) < r.height/2 && e.clientX > r.left + r.width/2);

  flip(container, ".folder", () => {
    if (after) target.after(s.el);
    else target.before(s.el);
  });
}

/* ---- LINK reordering / moving ---- */
function handleLinkReorder(e) {
  const s = dragState;

  // Find the list under the cursor (inside a folder or loose)
  const lists = [
    ...document.querySelectorAll(".folder-links"),
    document.getElementById("loose-columns")
  ].filter(Boolean);

  let targetList = null;
  for (const list of lists) {
    const r = list.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8) {
      targetList = list;
      break;
    }
  }
  if (!targetList) return;

  // Target list highlight: highlight if entering a list DIFFERENT from the source folder
  document.querySelectorAll(".list-drop-active").forEach((l) => l.classList.remove("list-drop-active"));
  const targetFolder = targetList.dataset.folder;
  if (targetFolder !== s.originFolder) targetList.classList.add("list-drop-active");

  // Find the target link in the list
  const links = [...targetList.querySelectorAll(".link")].filter((l) => l !== s.el);
  let target = null;
  for (const l of links) {
    const r = l.getBoundingClientRect();
    if (e.clientY >= r.top && e.clientY <= r.bottom &&
        e.clientX >= r.left && e.clientX <= r.right) {
      target = l;
      break;
    }
  }

  const container = targetList;
  if (target) {
    const r = target.getBoundingClientRect();
    const after = (e.clientY - r.top) > r.height / 2;
    flip(container, ".link", () => {
      if (after) target.after(s.el);
      else target.before(s.el);
    });
  } else if (!targetList.contains(s.el)) {
    // Drop into an empty list or at the end
    flip(container, ".link", () => { targetList.appendChild(s.el); });
  }
}

function onPointerUp() {
  const s = dragState;
  window.removeEventListener("pointermove", onPointerMove);
  if (!s) return;

  if (s.started && s.ghost) {
    // Smoothly settle the ghost from its last position to the real element's position
    const finalRect = s.el.getBoundingClientRect();
    s.ghost.style.transition = "transform .2s cubic-bezier(.2,.7,.3,1)";
    s.ghost.style.transform = `translate(${finalRect.left}px, ${finalRect.top}px) scale(1) rotate(0deg)`;
    const ghost = s.ghost;
    ghost.addEventListener("transitionend", () => ghost.remove(), { once: true });
    setTimeout(() => { if (ghost.parentElement) ghost.remove(); }, 260);
  }

  s.el.classList.remove("drag-source", "link-drag-source");
  document.body.classList.remove("dragging-active");
  document.querySelectorAll(".list-drop-active").forEach((l) => l.classList.remove("list-drop-active"));

  if (s.started) {
    if (s.type === "card") {
      persistCardOrder(document.getElementById("folders"));
    } else {
      // Was dragged -> block the next click (avoid accidentally navigating the link)
      s.el.dataset.wasDragged = "1";
      finalizeLinkMove(s.el);
    }
  }

  dragState = null;
}

/* ================= ATTACH POINTER DRAG TO ELEMENTS ================= */
function attachCardDrag(card) {
  const head = card.querySelector(".folder-head");
  const handle = head || card;
  handle.addEventListener("pointerdown", (e) => {
    // don't start dragging if the toggle button was clicked
    if (e.target.closest(".folder-toggle")) return;
    startPointerDrag(e, card, "card");
  });
}

function attachLinkDrag(a) {
  a.addEventListener("pointerdown", (e) => {
    startPointerDrag(e, a, "link");
  });
  // Block the click if it was a drag (avoid accidentally navigating the link)
  a.addEventListener("click", (e) => {
    if (a.dataset.wasDragged === "1") {
      e.preventDefault();
      a.dataset.wasDragged = "0";
    }
  });
}

function persistCardOrder(container) {
  const ids = [...container.querySelectorAll(".folder")].map((c) => c.dataset.id);
  settings.order = ids;
  saveSettings();
}

function finalizeLinkMove(a) {
  const toFolder = a.parentElement?.dataset.folder;
  if (!toFolder) return;
  a.dataset.folder = toFolder;
  rebuildModelFromDOM();
  if (settings.persistMoves) persistLinkToChrome(a, toFolder);
}

function rebuildModelFromDOM() {
  const byId = indexAllLinks();

  // Update each folder's (including nested) links from its corresponding DOM list.
  // The tree structure (subfolders) is preserved; only the links arrays are reordered/moved.
  const listsByFolder = new Map();
  document.querySelectorAll(".folder-links[data-folder]").forEach((list) => {
    const fid = list.dataset.folder;
    if (fid === "loose") return;
    const links = [...list.querySelectorAll(":scope > .link")]
      .map((el) => byId.get(el.dataset.id)).filter(Boolean);
    listsByFolder.set(fid, links);
  });

  // Update every folder's links in the model
  for (const f of allFolders()) {
    if (listsByFolder.has(f.id)) f.links = listsByFolder.get(f.id);
  }

  // Loose
  const looseCols = document.getElementById("loose-columns");
  const looseIds = [...looseCols.querySelectorAll(":scope > .link")].map((el) => el.dataset.id);
  localTree.loose = looseIds.map((id) => byId.get(id)).filter(Boolean);
}

function indexAllLinks() {
  const map = new Map();
  for (const f of allFolders()) for (const l of f.links) map.set(l.id, l);
  for (const l of localTree.loose) map.set(l.id, l);
  return map;
}

function persistLinkToChrome(a, toFolder) {
  const bookmarkId = a.dataset.id;
  const list = a.parentElement;
  const siblings = [...list.querySelectorAll(".link")];
  const index = siblings.indexOf(a);
  const dest = {};
  if (toFolder !== "loose") dest.parentId = toFolder;
  if (index >= 0) dest.index = index;
  try {
    chrome.bookmarks.move(bookmarkId, dest, () => {
      if (chrome.runtime.lastError) console.warn("Move failed:", chrome.runtime.lastError.message);
      a.dataset.folder = toFolder;
    });
  } catch (err) {
    console.warn("Move error:", err);
  }
}

/* ================= DELETE + UNDO ================= */
let pendingDelete = null; // { type, data, timer, restore }

// Removes a DOM element with a collapse+fade animation, calls the callback when done
function animateRemove(el, done) {
  // Fix the max-height so the collapse animation works
  el.style.maxHeight = el.scrollHeight + "px";
  // trigger reflow
  void el.offsetHeight;
  el.classList.add("deleting");
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (el.parentElement) el.remove();
    if (done) done();
  };
  el.addEventListener("animationend", finish, { once: true });
  setTimeout(finish, 400); // safety net
}

// Delete bookmark
function deleteBookmark(linkEl) {
  const id = linkEl.dataset.id;
  const folderId = linkEl.dataset.folder;
  const title = linkEl.querySelector(".label")?.textContent || "Bookmark";

  // Find it in the model (save it for undo)
  const model = findLinkInModel(id);
  if (!model) return;

  animateRemove(linkEl, () => {
    removeLinkFromModel(id);
    renderAll();
  });

  scheduleDelete({
    label: t("bookmark_deleted", { name: title }),
    restore: () => { restoreLinkToModel(model.link, model.folderId, model.index); renderAll(); },
    commit: () => {
      if (settings.persistMoves) {
        try {
          chrome.bookmarks.remove(id, () => {
            if (chrome.runtime.lastError) console.warn("Delete error:", chrome.runtime.lastError.message);
          });
        } catch (err) { console.warn("Delete error:", err); }
      }
    }
  });
}

// Delete folder (including nested)
function deleteFolder(cardEl) {
  const id = cardEl.dataset.id;
  const found = findFolderById(id);
  if (!found) return;
  const { folder, parentList } = found;
  const index = parentList.indexOf(folder);
  const title = folder.title;

  animateRemove(cardEl, () => {
    const f = findFolderById(id);
    if (f) f.parentList.splice(f.parentList.indexOf(f.folder), 1);
    renderAll();
  });

  scheduleDelete({
    label: t("folder_deleted", { name: title }),
    restore: () => {
      if (!findFolderById(id)) {
        parentList.splice(Math.min(index, parentList.length), 0, folder);
      }
      renderAll();
    },
    commit: () => {
      if (settings.persistMoves) {
        try {
          chrome.bookmarks.removeTree(id, () => {
            if (chrome.runtime.lastError) console.warn("Folder delete error:", chrome.runtime.lastError.message);
          });
        } catch (err) { console.warn("Folder delete error:", err); }
      }
    }
  });
}

// Model helpers
function findLinkInModel(id) {
  for (const f of allFolders()) {
    const i = f.links.findIndex((l) => l.id === id);
    if (i >= 0) return { link: f.links[i], folderId: f.id, index: i };
  }
  const li = localTree.loose.findIndex((l) => l.id === id);
  if (li >= 0) return { link: localTree.loose[li], folderId: "loose", index: li };
  return null;
}
function removeLinkFromModel(id) {
  for (const f of allFolders()) f.links = f.links.filter((l) => l.id !== id);
  localTree.loose = localTree.loose.filter((l) => l.id !== id);
}
function restoreLinkToModel(link, folderId, index) {
  if (folderId === "loose") {
    localTree.loose.splice(Math.min(index, localTree.loose.length), 0, link);
  } else {
    const r = findFolderById(folderId);
    if (r) r.folder.links.splice(Math.min(index, r.folder.links.length), 0, link);
    else localTree.loose.push(link); // no folder -> loose
  }
}

// Delay the delete by 5s + show a toast
function scheduleDelete({ label, restore, commit }) {
  // If there's a previous pending delete, commit it immediately
  if (pendingDelete) commitPendingNow();

  const timer = setTimeout(() => {
    if (pendingDelete && pendingDelete.timer === timer) {
      pendingDelete.commit();
      pendingDelete = null;
      hideToast();
    }
  }, 5000);

  pendingDelete = { restore, commit, timer };
  showToast(label);
}

function commitPendingNow() {
  if (!pendingDelete) return;
  clearTimeout(pendingDelete.timer);
  pendingDelete.commit();
  pendingDelete = null;
  hideToast();
}

function undoPendingDelete() {
  if (!pendingDelete) return;
  clearTimeout(pendingDelete.timer);
  pendingDelete.restore();
  pendingDelete = null;
  hideToast();
}

/* ---- Toast ---- */
let toastTimer = null;
function showToast(text, autoHideMs) {
  const toast = document.getElementById("toast");
  const undoBtn = document.getElementById("toast-undo");
  document.getElementById("toast-text").textContent = text;
  // If autoHideMs is given, this is an informational notification -> hide Undo
  undoBtn.style.display = autoHideMs ? "none" : "";
  toast.hidden = false;
  void toast.offsetHeight;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  if (autoHideMs) {
    toastTimer = setTimeout(hideToast, autoHideMs);
  }
}
function hideToast() {
  const toast = document.getElementById("toast");
  toast.classList.remove("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 220);
}

/* ---- Right-click menu ---- */
let contextTarget = null;

function initContextMenu() {
  const linkMenu = document.getElementById("context-menu-link");
  const folderMenu = document.getElementById("context-menu-folder");

  document.addEventListener("contextmenu", (e) => {
    const link = e.target.closest(".link");
    const folderHead = e.target.closest(".folder-head");
    if (link) {
      e.preventDefault();
      contextTarget = { type: "link", el: link };
      showContextMenu(linkMenu, e.clientX, e.clientY);
    } else if (folderHead) {
      e.preventDefault();
      const card = folderHead.closest(".folder");
      contextTarget = { type: "folder", el: card };
      // Set the toggle label based on state
      const label = folderMenu.querySelector("[data-toggle-label]");
      label.textContent = card.classList.contains("collapsed") ? t("expand") : t("collapse");
      showContextMenu(folderMenu, e.clientX, e.clientY);
    } else {
      hideContextMenu();
    }
  });

  document.addEventListener("click", () => hideContextMenu());
  document.addEventListener("scroll", () => hideContextMenu(), true);
  window.addEventListener("blur", () => hideContextMenu());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideContextMenu(); });

  // --- Bookmark menu actions ---
  linkMenu.addEventListener("click", (e) => {
    const btn = e.target.closest(".context-item");
    if (!btn || !contextTarget) return;
    e.stopPropagation();
    const el = contextTarget.el;
    const url = el.href;
    const action = btn.dataset.action;

    if (action === "open-newtab") window.open(url, "_blank");
    else if (action === "open-newwindow") openInWindow(url, false);
    else if (action === "open-incognito") openInWindow(url, true);
    else if (action === "copy-link") copyToClipboard(url);
    else if (action === "edit-link") openEditDialog("link", el);
    else if (action === "delete") deleteBookmark(el);

    hideContextMenu();
  });

  // --- Folder menu actions ---
  folderMenu.addEventListener("click", (e) => {
    const btn = e.target.closest(".context-item");
    if (!btn || !contextTarget) return;
    e.stopPropagation();
    const card = contextTarget.el;
    const action = btn.dataset.action;

    if (action === "toggle-folder") toggleFolderCard(card);
    else if (action === "open-all") openAllInFolder(card);
    else if (action === "open-all-group") openAllAsGroup(card);
    else if (action === "rename-folder") openEditDialog("folder", card);
    else if (action === "hide-folder") hideFolderCard(card);
    else if (action === "delete-folder") deleteFolder(card);

    hideContextMenu();
  });

  // Toast undo
  document.getElementById("toast-undo").addEventListener("click", undoPendingDelete);

  initEditDialog();
}

function showContextMenu(menu, x, y) {
  // close the other one
  document.querySelectorAll(".context-menu").forEach((m) => { if (m !== menu) m.hidden = true; });
  menu.hidden = false;
  const rect = menu.getBoundingClientRect();
  const px = Math.min(x, window.innerWidth - rect.width - 8);
  const py = Math.min(y, window.innerHeight - rect.height - 8);
  menu.style.left = px + "px";
  menu.style.top = py + "px";
}
function hideContextMenu() {
  document.querySelectorAll(".context-menu").forEach((m) => m.hidden = true);
  contextTarget = null;
}

/* ---- Action helpers ---- */
function openInWindow(url, incognito) {
  try {
    chrome.windows.create({ url, incognito }, () => {
      if (chrome.runtime.lastError) {
        // permission/incognito might be disabled - fall back to a new tab
        window.open(url, "_blank");
      }
    });
  } catch {
    window.open(url, "_blank");
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => showToast(t("link_copied"), 2500),
      () => fallbackCopy(text)
    );
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); showToast(t("link_copied"), 2500); } catch {}
  ta.remove();
}

function openAllInFolder(card) {
  const links = [...card.querySelectorAll(".link")];
  if (!links.length) return;
  if (links.length > 8 &&
      !confirm(t("confirm_open_tabs", { count: links.length }))) return;
  for (const a of links) {
    try { chrome.tabs.create({ url: a.href, active: false }); }
    catch { window.open(a.href, "_blank"); }
  }
}

// Chrome tab group colors
const TAB_GROUP_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];

function openAllAsGroup(card) {
  const links = [...card.querySelectorAll(".link")];
  if (!links.length) return;
  if (links.length > 8 &&
      !confirm(t("confirm_open_group", { count: links.length }))) return;

  const folderTitle = card.querySelector(".folder-title")?.textContent || "Group";
  const folderId = card.dataset.id;

  // fall back to normal opening if the tabGroups API isn't available (unsupported)
  if (!chrome.tabs || !chrome.tabs.group) {
    openAllInFolder(card);
    return;
  }

  // First create all tabs, collect their ids, then group them
  const urls = links.map((a) => a.href);
  const tabIds = [];
  let remaining = urls.length;

  urls.forEach((url) => {
    try {
      chrome.tabs.create({ url, active: false }, (tab) => {
        if (tab && tab.id != null) tabIds.push(tab.id);
        if (--remaining === 0) groupTabs(tabIds, folderTitle, folderId);
      });
    } catch {
      window.open(url, "_blank");
      if (--remaining === 0) groupTabs(tabIds, folderTitle, folderId);
    }
  });
}

function groupTabs(tabIds, title, folderId) {
  if (!tabIds.length) return;
  try {
    chrome.tabs.group({ tabIds }, (groupId) => {
      if (chrome.runtime.lastError || groupId == null) {
        console.warn("Grouping error:", chrome.runtime.lastError && chrome.runtime.lastError.message);
        return;
      }
      // Give the group the folder name and a consistent color
      let sum = 0;
      for (const ch of (folderId || title)) sum += ch.charCodeAt(0);
      const color = TAB_GROUP_COLORS[sum % TAB_GROUP_COLORS.length];
      try {
        chrome.tabGroups.update(groupId, { title, color }, () => {
          if (chrome.runtime.lastError) console.warn("Group update error:", chrome.runtime.lastError.message);
        });
      } catch (err) { console.warn(err); }
    });
  } catch (err) {
    console.warn("Grouping error:", err);
  }
}

function toggleFolderCard(card) {
  const id = card.dataset.id;
  card.classList.toggle("collapsed");
  const set = new Set(settings.collapsed || []);
  if (card.classList.contains("collapsed")) set.add(id);
  else set.delete(id);
  settings.collapsed = [...set];
  saveSettings();
}

function hideFolderCard(card) {
  const id = card.dataset.id;
  const set = new Set(settings.hidden || []);
  set.add(id);
  settings.hidden = [...set];
  saveSettings();
  renderFolders();
}

/* ================= EDIT / RENAME ================= */
let editTarget = null;

function initEditDialog() {
  const overlay = document.getElementById("edit-overlay");
  const panel = overlay.querySelector(".edit-panel");
  const close = () => { overlay.hidden = true; editTarget = null; };

  document.getElementById("edit-close").addEventListener("click", close);
  document.getElementById("edit-cancel").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (!panel.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) close(); });

  document.getElementById("edit-save").addEventListener("click", saveEdit);
  document.getElementById("edit-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveEdit();
  });
  document.getElementById("edit-url").addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveEdit();
  });
}

function openEditDialog(type, el) {
  const overlay = document.getElementById("edit-overlay");
  const nameInput = document.getElementById("edit-name");
  const urlInput = document.getElementById("edit-url");
  const urlWrap = document.getElementById("edit-url-wrap");
  const title = document.getElementById("edit-title");

  if (type === "link") {
    editTarget = { type, id: el.dataset.id, el };
    title.textContent = t("edit_bookmark");
    nameInput.value = el.querySelector(".label")?.textContent || "";
    urlInput.value = el.href;
    urlWrap.style.display = "";
  } else {
    editTarget = { type, id: el.dataset.id, el };
    title.textContent = t("rename_folder");
    nameInput.value = el.querySelector(".folder-title")?.textContent || "";
    urlWrap.style.display = "none";
  }

  overlay.hidden = false;
  setTimeout(() => { nameInput.focus(); nameInput.select(); }, 30);
}

function saveEdit() {
  if (!editTarget) return;
  const name = document.getElementById("edit-name").value.trim();
  const url = document.getElementById("edit-url").value.trim();
  if (!name) return;

  const id = editTarget.id;

  if (editTarget.type === "link") {
    // Update the model
    const found = findLinkInModel(id);
    if (found) { found.link.title = name; found.link.url = url || found.link.url; }
    // In persistent mode, update the actual bookmark
    if (settings.persistMoves) {
      try {
        chrome.bookmarks.update(id, { title: name, url: url || undefined }, () => {
          if (chrome.runtime.lastError) console.warn("Update error:", chrome.runtime.lastError.message);
        });
      } catch (err) { console.warn(err); }
    }
  } else {
    // Folder name (including nested)
    const r = findFolderById(id);
    if (r) r.folder.title = name;
    if (settings.persistMoves) {
      try {
        chrome.bookmarks.update(id, { title: name }, () => {
          if (chrome.runtime.lastError) console.warn("Update error:", chrome.runtime.lastError.message);
        });
      } catch (err) { console.warn(err); }
    }
  }

  document.getElementById("edit-overlay").hidden = true;
  editTarget = null;
  renderAll();
}

/* ================= SETTINGS PANEL ================= */
/* ================= PERSISTENT MODE: DIFF CALCULATION AND APPLY ================= */
// Compares the current state of localTree with originalSnapshot.
function computeDiff() {
  const moves = [];   // { id, parentId, index }  - move/reorder
  const updates = [];  // { id, title, url }        - rename/edit
  const deletes = [];  // { id, isFolder }          - deleted items

  if (!originalSnapshot) return { moves, updates, deletes };

  // Convert the current state into snapshot format (including nested folders)
  const current = snapshotTree(localTree.folders, localTree.loose);
  const currentBookmarks = current.bookmarks;
  const currentFolders = current.folders;

  const orig = originalSnapshot;

  // DELETIONS: existed in the original but not anymore
  for (const [id, o] of orig.bookmarks) {
    if (!currentBookmarks.has(id)) deletes.push({ id, isFolder: false });
  }
  for (const [id] of orig.folders) {
    if (!currentFolders.has(id)) deletes.push({ id, isFolder: true });
  }

  // MOVE + EDIT: for every existing bookmark
  for (const [id, c] of currentBookmarks) {
    const o = orig.bookmarks.get(id);
    if (!o) continue; // newly added (doesn't happen in this app)
    // if parent or index changed -> move
    if (c.parentId !== o.parentId || c.index !== o.index) {
      moves.push({ id, parentId: c.parentId, index: c.index });
    }
    // if title or url changed -> update
    if (c.title !== o.title || c.url !== o.url) {
      updates.push({ id, title: c.title, url: c.url });
    }
  }
  // Folder name change
  for (const [id, c] of currentFolders) {
    const o = orig.folders.get(id);
    if (o && c.title !== o.title) updates.push({ id, title: c.title });
  }

  return { moves, updates, deletes };
}

function promptApplyChanges(diff, total) {
  const parts = [];
  if (diff.moves.length) parts.push(t("confirm_apply_moves", { count: diff.moves.length }));
  if (diff.updates.length) parts.push(t("confirm_apply_edits", { count: diff.updates.length }));
  if (diff.deletes.length) parts.push(t("confirm_apply_deletes", { count: diff.deletes.length }));
  const msg = t("confirm_apply_title") + "\n\n" +
    "• " + parts.join("\n• ") + "\n\n" +
    t("confirm_apply_question");

  if (confirm(msg)) {
    applyDiffToChrome(diff);
  }
}

// Apply the diff to Chrome: deletions first, then updates, then moves
function applyDiffToChrome(diff) {
  // 1) Deletions
  for (const d of diff.deletes) {
    try {
      if (d.isFolder) chrome.bookmarks.removeTree(d.id, checkErr);
      else chrome.bookmarks.remove(d.id, checkErr);
    } catch (e) { console.warn(e); }
  }
  // 2) Updates (name/url)
  for (const u of diff.updates) {
    const changes = {};
    if (u.title !== undefined) changes.title = u.title;
    if (u.url !== undefined) changes.url = u.url;
    try { chrome.bookmarks.update(u.id, changes, checkErr); } catch (e) { console.warn(e); }
  }
  // 3) Moves: apply in index order (for correct placement)
  const moves = [...diff.moves].sort((a, b) => a.index - b.index);
  for (const m of moves) {
    const dest = { index: m.index };
    if (m.parentId !== "loose") dest.parentId = m.parentId;
    try { chrome.bookmarks.move(m.id, dest, checkErr); } catch (e) { console.warn(e); }
  }
  // Update the snapshot after applying (this is now the new "original")
  setTimeout(() => {
    originalSnapshot = snapshotTree(localTree.folders, localTree.loose);
    showToast(t("changes_applied"), 2500);
  }, 300);
}

function checkErr() {
  if (chrome.runtime.lastError) console.warn("Apply error:", chrome.runtime.lastError.message);
}

function initSettingsPanel() {
  const overlay = document.getElementById("settings-overlay");
  const openBtn = document.getElementById("open-settings");
  const closeBtn = document.getElementById("close-settings");
  const panel = overlay.querySelector(".settings-panel");

  const open = () => { syncPanel(); overlay.hidden = false; document.body.style.overflow = "hidden"; };
  const close = () => { overlay.hidden = true; document.body.style.overflow = ""; };

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", (e) => { e.stopPropagation(); close(); });
  overlay.addEventListener("click", (e) => { if (!panel.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) close(); });

  document.getElementById("theme-seg").querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      settings.theme = btn.dataset.theme;
      saveSettings(); applyTheme(); syncPanel();
    });
  });

  const engineSel = document.getElementById("engine-select");
  engineSel.addEventListener("change", () => {
    settings.engine = engineSel.value;
    saveSettings();
    updateLogo();
    updatePlaceholder();
  });

  populateLangSelect();
  const langSel = document.getElementById("lang-select");
  langSel.addEventListener("change", () => {
    changeLanguage(langSel.value);
    populateLangSelect(); // update the selected language
  });

  const showLogo = document.getElementById("show-logo");
  showLogo.addEventListener("change", () => { settings.showLogo = showLogo.checked; saveSettings(); updateLogo(); });

  const persist = document.getElementById("persist-moves");
  persist.addEventListener("change", () => {
    const turningOn = persist.checked;
    settings.persistMoves = turningOn;
    saveSettings();
    if (turningOn && originalSnapshot) {
      // Persistent mode turned on: ask about pending changes
      const diff = computeDiff();
      const total = diff.moves.length + diff.updates.length + diff.deletes.length;
      if (total > 0) promptApplyChanges(diff, total);
    } else if (!turningOn) {
      // Persistent mode turned off: pin the snapshot to now so accumulation starts from here
      originalSnapshot = snapshotTree(localTree.folders, localTree.loose);
    }
  });

  const avatarLetter = document.getElementById("avatar-letter");
  avatarLetter.addEventListener("input", () => {
    settings.avatarLetter = avatarLetter.value || "G";
    saveSettings();
    updateAvatar();
  });

  const maxLinks = document.getElementById("max-links");
  const maxLinksValue = document.getElementById("max-links-value");
  maxLinks.addEventListener("input", () => {
    settings.maxLinks = parseInt(maxLinks.value, 10) || 10;
    maxLinksValue.textContent = settings.maxLinks;
    saveSettings();
    renderFolders(); // reapply scroll/fade based on the new limit
  });

  document.getElementById("reset-order").addEventListener("click", () => {
    settings.order = []; saveSettings(); renderAll();
  });
}

function syncPanel() {
  document.querySelectorAll("#theme-seg button").forEach((b) => {
    b.classList.toggle("active", b.dataset.theme === settings.theme);
  });
  document.getElementById("engine-select").value = settings.engine;
  document.getElementById("show-logo").checked = settings.showLogo;
  document.getElementById("persist-moves").checked = settings.persistMoves;
  document.getElementById("avatar-letter").value = settings.avatarLetter || "G";
  const langSel = document.getElementById("lang-select");
  if (langSel) langSel.value = currentLang;
  const ml = settings.maxLinks || 10;
  document.getElementById("max-links").value = ml;
  document.getElementById("max-links-value").textContent = ml;
  renderHiddenList();
}

function renderHiddenList() {
  const box = document.getElementById("folder-visibility");
  if (!box) return;
  box.innerHTML = "";
  if (!localTree.folders.length) {
    box.innerHTML = `<p class="hint">${t("no_folders")}</p>`;
    return;
  }
  for (const f of localTree.folders) {
    const row = document.createElement("label");
    row.className = "vis-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !(settings.hidden || []).includes(f.id);
    cb.addEventListener("change", () => {
      const set = new Set(settings.hidden || []);
      if (cb.checked) set.delete(f.id);
      else set.add(f.id);
      settings.hidden = [...set];
      saveSettings();
      renderFolders();
    });
    const span = document.createElement("span");
    span.textContent = f.title;
    row.append(cb, span);
    box.appendChild(row);
  }
}

/* ================= LOAD ================= */
function load() {
  chrome.bookmarks.getTree((tree) => {
    const root = tree[0];
    const folders = [];
    const looseLinks = [];
    for (const top of root.children || []) {
      looseLinks.push(...directBookmarks(top));
      collectTopFolders(top, folders);
    }
    localTree.folders = folders;
    localTree.loose = looseLinks;
    // A copy of Chrome's original state (to compute the diff when persistent mode is turned on)
    originalSnapshot = snapshotTree(folders, looseLinks);
    renderAll();
  });
}

// Converts localTree into a flat structure for comparison (including nested)
function snapshotTree(folders, loose) {
  const map = new Map(); // bookmarkId -> {title, url, parentId, index}
  const folderMeta = new Map(); // folderId -> {title}
  function walk(list) {
    for (const f of list) {
      folderMeta.set(f.id, { title: f.title });
      f.links.forEach((l, i) => {
        map.set(l.id, { title: l.title, url: l.url, parentId: f.id, index: i });
      });
      if (f.subfolders && f.subfolders.length) walk(f.subfolders);
    }
  }
  walk(folders);
  loose.forEach((l, i) => {
    map.set(l.id, { title: l.title, url: l.url, parentId: "loose", index: i });
  });
  return { bookmarks: map, folders: folderMeta };
}

/* ================= FIRST-LAUNCH WELCOME ================= */
function maybeShowWelcome() {
  if (settings.welcomed) return;
  const overlay = document.getElementById("welcome-overlay");
  const closeBtn = document.getElementById("welcome-close");
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  const close = () => {
    overlay.hidden = true;
    document.body.style.overflow = "";
    settings.welcomed = true;
    saveSettings();
  };
  closeBtn.addEventListener("click", close, { once: true });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
}

// Safely fill the welcome box's list item texts as pre + <strong> + post
function fillWelcomeText() {
  for (let i = 1; i <= 4; i++) {
    const li = document.getElementById("welcome-" + i);
    if (!li) continue;
    li.textContent = "";
    const pre = document.createTextNode(t(`welcome_${i}_pre`));
    const strong = document.createElement("strong");
    strong.textContent = t(`welcome_${i}_strong`);
    const post = document.createTextNode(t(`welcome_${i}_post`));
    li.append(pre, strong, post);
  }
}

// Change the language and refresh the whole view
function changeLanguage(lang) {
  setLang(lang);
  settings.language = lang;
  saveSettings();
  document.documentElement.lang = currentLang;
  applyDomTranslations();
  fillWelcomeText();
  updatePlaceholder();
  renderAll();
}

// Populate the language menu in settings
function populateLangSelect() {
  const sel = document.getElementById("lang-select");
  if (!sel) return;
  sel.innerHTML = "";
  for (const code of SUPPORTED_LANGS) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = I18N[code].lang_name;
    sel.appendChild(opt);
  }
  sel.value = currentLang;
}

/* ================= INIT ================= */
async function init() {
  await loadSettings();
  // Language: use the saved preference if present, otherwise the browser language
  setLang(settings.language || detectLang());
  document.documentElement.lang = currentLang;
  applyDomTranslations();
  fillWelcomeText();
  applyTheme();
  updateLogo();
  updatePlaceholder();
  updateAvatar();
  initSettingsPanel();
  initContextMenu();
  initSyncListener();
  maybeShowWelcome();
  load();
}
document.addEventListener("DOMContentLoaded", init);
