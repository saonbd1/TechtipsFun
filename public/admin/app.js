/*!
 * Tech Tips Admin — a small AdminLTE 4 front-end over the GitHub Contents API.
 *
 * There is no server: this page is served as a static asset from the same
 * Astro build that publishes the blog, and it talks straight to api.github.com
 * with a fine-grained personal access token that the operator pastes in.
 * Every write is a normal commit on the configured branch, so the existing
 * Cloudflare auto-deploy and GitHub Actions pipelines keep working untouched.
 *
 * Scope: writing/editing posts + managing the publish queue. Reels, LinkedIn
 * and IndexNow stay in .github/workflows — this page only links to them.
 */
(function () {
  'use strict';

  /* ── Configuration ──────────────────────────────────────────────────── */
  var API = 'https://api.github.com';
  var SITE_ORIGIN = 'https://www.techtips.fun';
  var DEFAULT_REPO = 'saonbd1/astro-blog-starter-template';
  var DEFAULT_BRANCH = 'main';

  var BLOG_DIR = 'src/content/blog';
  var PENDING_DIR = 'pending-posts';
  var ORDER_FILE = PENDING_DIR + '/.order';
  var MEDIA_DIR = 'public/article-media';
  var OG_DIR = 'public/og';

  var LS_CONFIG = 'ttadmin.config';
  var SS_TOKEN = 'ttadmin.token';
  var LS_TOKEN = 'ttadmin.token.remember';

  /* The blog collection schema — src/content.config.ts. Keep in sync.
     The order here is the order fields are written back to disk, chosen to
     match what the existing posts in src/content/blog already use. */
  var SCHEMA_KEYS = [
    'title',
    'description',
    'heroImage',
    'pubDate',
    'updatedDate',
    'category',
    'tags'
  ];

  /* ── State ──────────────────────────────────────────────────────────── */
  var state = {
    token: null,
    user: null,
    repo: DEFAULT_REPO,
    repoInfo: null,
    branch: DEFAULT_BRANCH,
    branchFromConfig: false,
    posts: [],
    pendingFiles: [],
    order: [],
    orderSha: null,
    media: [],
    categories: [],
    loaded: { posts: false, queue: false, media: false }
  };

  /* ── Tiny DOM helpers ───────────────────────────────────────────────── */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Everything this file builds is markup, so attribute values go through the
     same escaper as text. It exists as its own name to make the intent clear at
     the call site. */
  function attr(value) {
    return esc(value);
  }

  function bytes(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  /* ── Feedback ───────────────────────────────────────────────────────── */
  var TOAST_ICONS = {
    success: 'check-circle',
    danger: 'exclamation-octagon',
    warning: 'exclamation-triangle',
    info: 'info-circle'
  };

  function toast(message, kind) {
    kind = kind || 'info';
    var host = $('#toasts');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'alert alert-' + kind + ' alert-dismissible fade show shadow-sm mb-0';
    el.setAttribute('role', 'alert');
    el.innerHTML =
      '<i class="bi bi-' +
      (TOAST_ICONS[kind] || 'info-circle') +
      ' me-2"></i>' +
      esc(message) +
      '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';
    host.appendChild(el);
    setTimeout(
      function () {
        if (el.parentNode) {
          try {
            window.bootstrap.Alert.getOrCreateInstance(el).close();
          } catch (e) {
            el.remove();
          }
        }
      },
      kind === 'danger' ? 9000 : 4500
    );
  }

  function confirmDialog(title, bodyHtml, okLabel) {
    return new Promise(function (resolve) {
      var modalEl = $('#confirm-modal');
      $('#confirm-title').textContent = title;
      $('#confirm-body').innerHTML = bodyHtml;
      var ok = $('#confirm-ok');
      ok.textContent = okLabel || 'Confirm';
      var modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
      var settled = false;
      function done(value) {
        if (settled) return;
        settled = true;
        ok.removeEventListener('click', onOk);
        modalEl.removeEventListener('hidden.bs.modal', onHide);
        resolve(value);
      }
      function onOk() {
        modal.hide();
        done(true);
      }
      function onHide() {
        done(false);
      }
      ok.addEventListener('click', onOk);
      modalEl.addEventListener('hidden.bs.modal', onHide);
      modal.show();
    });
  }

  /* ── GitHub client ──────────────────────────────────────────────────── */
  function GhError(status, payload) {
    this.name = 'GhError';
    this.status = status;
    this.payload = payload || {};
    this.message = this.payload.message || 'GitHub request failed (' + status + ')';
    if (this.payload.errors && this.payload.errors.length) {
      var first = this.payload.errors[0];
      if (first && (first.message || first.code)) {
        this.message += ' — ' + (first.message || first.code);
      }
    }
  }
  GhError.prototype = Object.create(Error.prototype);

  function gh(path, options) {
    options = options || {};
    var headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    var init = { method: options.method || 'GET', headers: headers, cache: 'no-store' };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    return fetch(API + path, init).then(function (res) {
      if (res.status === 204) return null;
      return res.text().then(function (text) {
        var data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            data = { message: text.slice(0, 200) };
          }
        }
        if (!res.ok) {
          if (res.status === 401) {
            throw new GhError(401, { message: 'Token rejected or expired. Sign in again.' });
          }
          if (res.status === 403) {
            throw new GhError(403, {
              message:
                'GitHub refused the request (403). The token may lack "Contents: Read and write", or the API rate limit was hit.'
            });
          }
          throw new GhError(res.status, data || {});
        }
        return data;
      });
    });
  }

  function repoPath() {
    return '/repos/' + state.repo;
  }

  /* ── Base64 (UTF-8 safe) ────────────────────────────────────────────── */
  function utf8ToBase64(str) {
    var raw = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < raw.length; i++) bin += String.fromCharCode(raw[i]);
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    var bin = atob(String(b64).replace(/\s+/g, ''));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(out);
  }

  function arrayBufferToBase64(buf) {
    var out = new Uint8Array(buf);
    var bin = '';
    var CHUNK = 0x8000;
    for (var i = 0; i < out.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, out.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  /* ── Contents API wrappers ──────────────────────────────────────────── */
  function listDir(dir) {
    var url = repoPath() + '/contents/' + dir + '?ref=' + encodeURIComponent(state.branch);
    return gh(url).then(function (data) {
      if (!Array.isArray(data)) return [];
      return data
        .filter(function (entry) {
          return entry && entry.type === 'file';
        })
        .map(function (entry) {
          return { name: entry.name, path: entry.path, sha: entry.sha, size: entry.size };
        });
    });
  }

  function readFile(path) {
    var url = repoPath() + '/contents/' + path + '?ref=' + encodeURIComponent(state.branch);
    return gh(url).then(function (data) {
      if (!data || data.type !== 'file') return null;
      return {
        path: data.path,
        name: data.name,
        sha: data.sha,
        size: data.size,
        text: base64ToUtf8(data.content || '')
      };
    });
  }

  function writeFile(path, content, message, sha, alreadyBase64) {
    var body = {
      message: message,
      content: alreadyBase64 ? content : utf8ToBase64(content),
      branch: state.branch
    };
    if (sha) body.sha = sha;
    return gh(repoPath() + '/contents/' + path, { method: 'PUT', body: body });
  }

  function deleteFile(path, message, sha) {
    return gh(repoPath() + '/contents/' + path, {
      method: 'DELETE',
      body: { message: message, sha: sha, branch: state.branch }
    });
  }

  function slugify(name) {
    return String(name)
      .replace(/\.(md|mdx)$/i, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9 _-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /* ── Frontmatter ────────────────────────────────────────────────────────
     A deliberately small YAML reader: enough for the frontmatter this blog
     actually uses (scalars, inline arrays, block arrays). Anything it cannot
     attribute to a known schema key is preserved verbatim and written back
     untouched, so editing a post never silently drops a field. */
  function unquote(value) {
    var s = String(value).trim();
    if (s.length >= 2 && s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') {
      try {
        return JSON.parse(s);
      } catch (e) {
        return s.slice(1, -1);
      }
    }
    if (s.length >= 2 && s.charAt(0) === "'" && s.charAt(s.length - 1) === "'") {
      return s.slice(1, -1).replace(/''/g, "'");
    }
    return s;
  }

  function parseFrontmatterEntries(raw) {
    var lines = raw.split(/\r?\n/);
    var entries = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim() || /^\s*#/.test(line)) {
        i++;
        continue;
      }
      var m = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
      if (!m) {
        i++;
        continue;
      }
      var key = m[1];
      var rest = m[2].trim();
      var rawLines = [line];
      var value;
      if (rest === '') {
        var items = [];
        var j = i + 1;
        while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
          rawLines.push(lines[j]);
          items.push(unquote(lines[j].replace(/^\s*-\s+/, '')));
          j++;
        }
        if (items.length) {
          value = items;
          i = j;
        } else {
          value = '';
          i++;
        }
      } else if (rest.charAt(0) === '[' && rest.charAt(rest.length - 1) === ']') {
        value = rest
          .slice(1, -1)
          .split(',')
          .map(function (part) {
            return unquote(part);
          })
          .filter(function (part) {
            return part !== '';
          });
        i++;
      } else {
        value = unquote(rest);
        i++;
      }
      entries.push({ key: key, value: value, raw: rawLines.join('\n') });
    }
    return entries;
  }

  function parseFrontmatter(text) {
    var source = String(text).replace(/\r\n?/g, '\n');
    var m = /^---\n([\s\S]*?)\n---[ \t]*\n?/.exec(source);
    if (!m) return { fields: {}, extras: [], body: source, hasFrontmatter: false };
    var entries = parseFrontmatterEntries(m[1]);
    var fields = {};
    var extras = [];
    entries.forEach(function (entry) {
      if (SCHEMA_KEYS.indexOf(entry.key) !== -1) fields[entry.key] = entry.value;
      else extras.push(entry);
    });
    return { fields: fields, extras: extras, body: source.slice(m[0].length), hasFrontmatter: true };
  }

  function yamlScalar(value) {
    return JSON.stringify(String(value));
  }

  function buildFrontmatter(fields, extras) {
    var out = ['---'];
    SCHEMA_KEYS.forEach(function (key) {
      if (key === 'tags') {
        var tags = Array.isArray(fields.tags) ? fields.tags : [];
        if (tags.length) {
          out.push(
            'tags: [' +
              tags
                .map(function (tag) {
                  return yamlScalar(tag);
                })
                .join(', ') +
              ']'
          );
        }
        return;
      }
      var value = fields[key];
      if (value === undefined || value === null || value === '') return;
      out.push(key + ': ' + yamlScalar(value));
    });
    (extras || []).forEach(function (entry) {
      out.push(entry.raw);
    });
    out.push('---');
    return out.join('\n');
  }

  /* ── Dates ──────────────────────────────────────────────────────────────
     The site's posts use the "Jul 17 2026" shape, which is also exactly what
     schedule-posts.yml stamps with `date +"%b %d %Y"` when it publishes a
     queued post — so writing dates in the same shape keeps frontmatter diffs
     predictable. z.coerce.date() in the content schema parses it fine. */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function toInputDate(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  function fromInputDate(value) {
    if (!value) return '';
    var parts = String(value).split('-');
    if (parts.length !== 3) return '';
    return MONTHS[Number(parts[1]) - 1] + ' ' + parts[2] + ' ' + parts[0];
  }

  function todayStamp() {
    var d = new Date();
    return (
      MONTHS[d.getMonth()] +
      ' ' +
      String(d.getDate()).padStart(2, '0') +
      ' ' +
      d.getFullYear()
    );
  }

  function prettyDate(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value || '');
    return (
      MONTHS[d.getUTCMonth()] + ' ' + String(d.getUTCDate()).padStart(2, '0') + ' ' + d.getUTCFullYear()
    );
  }

  /* ── Markdown preview ───────────────────────────────────────────────────
     A small renderer for the subset of Markdown these posts actually use.
     Everything is HTML-escaped before any markup is generated, so a post
     containing raw HTML cannot inject anything into this page. */
  function inlineMd(text) {
    var s = esc(text);
    var codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, code) {
      codes.push(code);
      return '\u0000' + (codes.length - 1) + '\u0000';
    });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, src) {
      return '<img src="' + src + '" alt="' + alt + '" loading="lazy">';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, href) {
      return '<a href="' + href + '" target="_blank" rel="noopener">' + label + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    s = s.replace(/\u0000(\d+)\u0000/g, function (_, n) {
      return '<code>' + codes[Number(n)] + '</code>';
    });
    return s;
  }

  function isTableSeparator(line) {
    return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.indexOf('-') !== -1;
  }

  function renderMarkdown(src) {
    var lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
    var html = [];
    var list = null;
    var i = 0;

    function closeList() {
      if (list) {
        html.push('</' + list + '>');
        list = null;
      }
    }

    while (i < lines.length) {
      var line = lines[i];

      /* Fenced code block */
      var fence = /^\s*(```|~~~)\s*([A-Za-z0-9+#._-]*)\s*$/.exec(line);
      if (fence) {
        closeList();
        var code = [];
        i++;
        while (i < lines.length && !/^\s*(```|~~~)\s*$/.test(lines[i])) {
          code.push(lines[i]);
          i++;
        }
        i++;
        html.push(
          '<pre><code' +
            (fence[2] ? ' class="language-' + esc(fence[2]) + '"' : '') +
            '>' +
            esc(code.join('\n')) +
            '</code></pre>'
        );
        continue;
      }

      /* Blank line */
      if (!line.trim()) {
        closeList();
        i++;
        continue;
      }

      /* Horizontal rule */
      if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
        closeList();
        html.push('<hr>');
        i++;
        continue;
      }

      /* Heading */
      var heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        closeList();
        var level = heading[1].length;
        html.push('<h' + level + '>' + inlineMd(heading[2].replace(/\s*#+\s*$/, '')) + '</h' + level + '>');
        i++;
        continue;
      }

      /* Table */
      if (line.indexOf('|') !== -1 && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        closeList();
        var cells = function (row) {
          return row
            .replace(/^\s*\|/, '')
            .replace(/\|\s*$/, '')
            .split('|')
            .map(function (cell) {
              return cell.trim();
            });
        };
        var head = cells(line);
        i += 2;
        var body = [];
        while (i < lines.length && lines[i].trim() && lines[i].indexOf('|') !== -1) {
          body.push(cells(lines[i]));
          i++;
        }
        html.push('<table><thead><tr>');
        head.forEach(function (cell) {
          html.push('<th>' + inlineMd(cell) + '</th>');
        });
        html.push('</tr></thead><tbody>');
        body.forEach(function (row) {
          html.push('<tr>');
          row.forEach(function (cell) {
            html.push('<td>' + inlineMd(cell) + '</td>');
          });
          html.push('</tr>');
        });
        html.push('</tbody></table>');
        continue;
      }

      /* Blockquote */
      if (/^\s*>\s?/.test(line)) {
        closeList();
        var quote = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        html.push('<blockquote>' + inlineMd(quote.join(' ')) + '</blockquote>');
        continue;
      }

      /* Lists */
      var bullet = /^\s*([-*+])\s+(.*)$/.exec(line);
      var ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if (bullet || ordered) {
        var wanted = bullet ? 'ul' : 'ol';
        if (list !== wanted) {
          closeList();
          html.push('<' + wanted + '>');
          list = wanted;
        }
        html.push('<li>' + inlineMd(bullet ? bullet[2] : ordered[1]) + '</li>');
        i++;
        continue;
      }

      /* Paragraph */
      closeList();
      var para = [line.trim()];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^\s*(#{1,6}\s|>|```|~~~|[-*+]\s|\d+[.)]\s)/.test(lines[i]) &&
        !/^\s*([-*_])\s*(\1\s*){2,}$/.test(lines[i])
      ) {
        para.push(lines[i].trim());
        i++;
      }
      html.push('<p>' + inlineMd(para.join(' ')) + '</p>');
    }

    closeList();
    return html.join('\n');
  }

  /* ── Session & config ───────────────────────────────────────────────── */
  function readConfig() {
    var cfg = { repo: DEFAULT_REPO, branch: '', remember: false };
    try {
      var raw = localStorage.getItem(LS_CONFIG);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed.repo === 'string' && /^[^/]+\/[^/]+$/.test(parsed.repo)) {
          cfg.repo = parsed.repo;
        }
        if (parsed && typeof parsed.branch === 'string') cfg.branch = parsed.branch;
      }
    } catch (e) {
      /* ignore corrupt config */
    }
    return cfg;
  }

  function saveConfig() {
    try {
      localStorage.setItem(LS_CONFIG, JSON.stringify({ repo: state.repo, branch: state.branch }));
    } catch (e) {
      /* storage may be unavailable */
    }
  }

  function safeStore(store, key, value) {
    try {
      if (value === null) store.removeItem(key);
      else store.setItem(key, value);
    } catch (e) {
      /* ignore */
    }
  }

  function storedToken() {
    var remembered = '';
    try {
      remembered = localStorage.getItem(LS_TOKEN) || '';
    } catch (e) {
      remembered = '';
    }
    var session = '';
    try {
      session = sessionStorage.getItem(SS_TOKEN) || '';
    } catch (e) {
      session = '';
    }
    return remembered || session;
  }

  function storeToken(token, remember) {
    if (remember) {
      safeStore(localStorage, LS_TOKEN, token);
      safeStore(sessionStorage, SS_TOKEN, null);
    } else {
      safeStore(sessionStorage, SS_TOKEN, token);
      safeStore(localStorage, LS_TOKEN, null);
    }
  }

  function clearToken() {
    safeStore(localStorage, LS_TOKEN, null);
    safeStore(sessionStorage, SS_TOKEN, null);
  }

  function signIn(token, remember) {
    var previous = state.token;
    state.token = token;
    return gh('/user')
      .then(function (user) {
        return gh(repoPath()).then(function (repo) {
          return { user: user, repo: repo };
        });
      })
      .then(function (info) {
        state.user = info.user;
        if (!state.branchFromConfig && info.repo && info.repo.default_branch) {
          state.branch = info.repo.default_branch;
        }
        storeToken(token, remember);
        return info;
      })
      .catch(function (err) {
        state.token = previous;
        throw err;
      });
  }

  function signOut() {
    clearToken();
    state.token = null;
    state.user = null;
    state.loaded = { posts: false, queue: false, media: false };
    state.posts = [];
    state.pendingFiles = [];
    state.order = [];
    state.media = [];
    showGate();
  }

  /* ── Chrome (page title, breadcrumb, nav state, counts) ─────────────── */
  function setPage(title, crumbs) {
    $('#page-title').textContent = title;
    var html = '<li class="breadcrumb-item"><a href="#/dashboard">Admin</a></li>';
    (crumbs || []).forEach(function (crumb, index) {
      if (index === (crumbs.length - 1) || !crumb.href) {
        html += '<li class="breadcrumb-item active" aria-current="page">' + esc(crumb.label) + '</li>';
      } else {
        html += '<li class="breadcrumb-item"><a href="' + attr(crumb.href) + '">' + esc(crumb.label) + '</a></li>';
      }
    });
    $('#breadcrumb').innerHTML = html;
  }

  function setActiveNav(section) {
    $$('.sidebar-menu .nav-link').forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('data-nav') === section);
    });
  }

  function setCounts() {
    var postsBadge = $('#nav-posts-count');
    var queueBadge = $('#nav-queue-count');
    if (postsBadge) postsBadge.textContent = state.loaded.posts ? String(state.posts.length) : '–';
    if (queueBadge) queueBadge.textContent = state.loaded.queue ? String(state.order.length) : '–';
    var footer = $('#footer-repo');
    if (footer) footer.textContent = state.repo + ' · ' + state.branch;
  }

  function view(html) {
    $('#view').innerHTML = html;
  }

  function spinner(label) {
    return (
      '<div class="text-center text-body-secondary py-5">' +
      '<i class="bi bi-arrow-repeat spin fs-3 d-block mb-2"></i>' +
      esc(label || 'Loading…') +
      '</div>'
    );
  }

  function errorPanel(err, retryHash) {
    var message = err && err.message ? err.message : String(err);
    var extra = '';
    if (err && err.status === 401) extra = ' Your token was rejected — <a href="#/settings">sign in again</a>.';
    return (
      '<div class="alert alert-danger" role="alert">' +
      '<h5 class="alert-heading"><i class="bi bi-exclamation-octagon me-2"></i>Something went wrong</h5>' +
      '<p class="mb-2">' +
      esc(message) +
      extra +
      '</p>' +
      (retryHash ? '<a class="btn btn-sm btn-outline-danger" href="' + attr(retryHash) + '">Try again</a>' : '') +
      '</div>'
    );
  }

  function mapLimit(items, limit, worker) {
    var results = new Array(items.length);
    var index = 0;
    function next() {
      if (index >= items.length) return Promise.resolve();
      var current = index++;
      return Promise.resolve(worker(items[current], current)).then(function (value) {
        results[current] = value;
        return next();
      });
    }
    var runners = [];
    var width = Math.max(1, Math.min(limit, items.length));
    for (var k = 0; k < width; k++) runners.push(next());
    return Promise.all(runners).then(function () {
      return results;
    });
  }

  function countWords(body) {
    return String(body || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
  }

  /* ── Data loading ───────────────────────────────────────────────────── */
  function loadPosts(force) {
    if (state.loaded.posts && !force) return Promise.resolve(state.posts);
    return listDir(BLOG_DIR)
      .then(function (files) {
        var markdown = files.filter(function (file) {
          return /\.(md|mdx)$/i.test(file.name);
        });
        return mapLimit(markdown, 6, function (file) {
          return readFile(file.path)
            .then(function (doc) {
              var parsed = parseFrontmatter(doc ? doc.text : '');
              return {
                name: file.name,
                path: file.path,
                sha: file.sha,
                size: file.size,
                title: parsed.fields.title || slugify(file.name),
                description: parsed.fields.description || '',
                category: parsed.fields.category || '',
                tags: Array.isArray(parsed.fields.tags) ? parsed.fields.tags : [],
                pubDate: parsed.fields.pubDate || '',
                updatedDate: parsed.fields.updatedDate || '',
                heroImage: parsed.fields.heroImage || '',
                words: countWords(parsed.body)
              };
            })
            .catch(function () {
              return {
                name: file.name,
                path: file.path,
                sha: file.sha,
                size: file.size,
                title: file.name,
                description: '',
                category: '',
                tags: [],
                pubDate: '',
                updatedDate: '',
                heroImage: '',
                words: 0,
                unreadable: true
              };
            });
        });
      })
      .then(function (posts) {
        posts.sort(function (a, b) {
          var da = new Date(a.pubDate).getTime() || 0;
          var db = new Date(b.pubDate).getTime() || 0;
          if (db !== da) return db - da;
          return a.name.localeCompare(b.name);
        });
        state.posts = posts;
        state.loaded.posts = true;
        var seen = {};
        posts.forEach(function (post) {
          if (post.category) seen[post.category] = true;
        });
        state.categories = Object.keys(seen).sort(function (a, b) {
          return a.localeCompare(b);
        });
        setCounts();
        return posts;
      });
  }

  function loadQueue(force) {
    if (state.loaded.queue && !force) return Promise.resolve();
    return Promise.all([
      listDir(PENDING_DIR),
      readFile(ORDER_FILE).catch(function () {
        return null;
      })
    ]).then(function (results) {
      var files = results[0].filter(function (file) {
        return /\.(md|mdx)$/i.test(file.name);
      });
      var orderDoc = results[1];
      var lines = orderDoc ? orderDoc.text.split(/\r?\n/) : [];
      state.order = lines
        .map(function (line) {
          return line.trim();
        })
        .filter(Boolean);
      state.orderSha = orderDoc ? orderDoc.sha : null;
      state.pendingFiles = files;
      state.loaded.queue = true;
      setCounts();
    });
  }

  /* The publish workflow walks .order top-to-bottom and publishes the first
     entry whose file still exists (see .github/workflows/schedule-posts.yml),
     so the dashboard shows exactly that list, then any stray files after it. */
  function queueRows() {
    var byName = {};
    state.pendingFiles.forEach(function (file) {
      byName[file.name] = file;
    });
    var rows = [];
    state.order.forEach(function (name) {
      rows.push({ name: name, file: byName[name] || null, inOrder: true });
      delete byName[name];
    });
    state.pendingFiles.forEach(function (file) {
      if (byName[file.name]) rows.push({ name: file.name, file: file, inOrder: false });
    });
    return rows;
  }

  function loadMedia(force) {
    if (state.loaded.media && !force) return Promise.resolve(state.media);
    return Promise.all([
      listDir(MEDIA_DIR).catch(function () {
        return [];
      }),
      listDir(OG_DIR).catch(function () {
        return [];
      })
    ]).then(function (results) {
      var tag = function (files, dir, label) {
        return files.map(function (file) {
          return {
            name: file.name,
            path: file.path,
            sha: file.sha,
            size: file.size,
            dir: dir,
            label: label,
            url: '/' + file.path.replace(/^public\//, '')
          };
        });
      };
      state.media = tag(results[0], MEDIA_DIR, 'article-media').concat(
        tag(results[1], OG_DIR, 'og')
      );
      state.media.sort(function (a, b) {
        return b.name.localeCompare(a.name, undefined, { numeric: true });
      });
      state.loaded.media = true;
      return state.media;
    });
  }

  /* ── View: dashboard ────────────────────────────────────────────────── */
  function statCard(label, value, icon, variant, hint) {
    return (
      '<div class="col-sm-6 col-xl-3">' +
      '<div class="card stat-card border-0 shadow-sm h-100">' +
      '<div class="card-body d-flex align-items-center gap-3">' +
      '<i class="bi bi-' + esc(icon) + ' fs-1 text-' + esc(variant) + '"></i>' +
      '<div>' +
      '<div class="fs-3 fw-semibold lh-1">' + esc(value) + '</div>' +
      '<div class="text-body-secondary small text-uppercase">' + esc(label) + '</div>' +
      (hint ? '<div class="text-body-secondary small">' + esc(hint) + '</div>' : '') +
      '</div></div></div></div>'
    );
  }

  function renderDashboard() {
    setPage('Dashboard', [{ label: 'Dashboard' }]);
    setActiveNav('dashboard');
    view(spinner('Loading the repository…'));

    Promise.all([loadPosts(), loadQueue(), loadMedia()])
      .then(function () {
        var words = state.posts.reduce(function (total, post) {
          return total + (post.words || 0);
        }, 0);
        var next = queueRows()[0];

        var html = '<div class="row g-3 mb-3">';
        html += statCard('Published posts', state.posts.length, 'file-earmark-text', 'primary', '~' + words.toLocaleString() + ' words');
        html += statCard('In queue', state.order.length, 'list-ol', 'warning', next ? 'next: ' + next.name : 'queue empty');
        html += statCard('Categories', state.categories.length, 'tags', 'info');
        html += statCard('Media files', state.media.length, 'images', 'success', 'article-media + og');
        html += '</div>';

        html += '<div class="row g-3">';
        html += recentPostsCard();
        html += dashboardSidePanel();
        html += '</div>';

        view(html);
        $$('#view .row-clickable').forEach(function (row) {
          row.addEventListener('click', function () {
            location.hash = row.getAttribute('data-href').slice(1);
          });
        });
      })
      .catch(function (err) {
        view(errorPanel(err, '#/dashboard'));
      });
  }

  function recentPostsCard() {
    var recent = state.posts.slice(0, 6);
    var html = '<div class="col-lg-8"><div class="card shadow-sm h-100">';
    html +=
      '<div class="card-header d-flex align-items-center justify-content-between">' +
      '<h3 class="card-title mb-0"><i class="bi bi-clock-history me-2"></i>Newest posts</h3>' +
      '<a class="btn btn-sm btn-outline-primary" href="#/posts">All posts</a>' +
      '</div>';
    html += '<div class="table-responsive"><table class="table table-sm table-hover mb-0 align-middle">';
    html +=
      '<thead><tr><th>Title</th><th class="d-none d-md-table-cell">Category</th>' +
      '<th class="text-nowrap">Published</th><th class="table-actions"></th></tr></thead><tbody>';
    if (!recent.length) {
      html += '<tr><td colspan="4" class="text-body-secondary">No posts found.</td></tr>';
    }
    recent.forEach(function (post) {
      html +=
        '<tr class="row-clickable" data-href="#/posts/edit/' +
        attr(encodeURIComponent(post.path)) +
        '">' +
        '<td><span class="fw-medium">' + esc(post.title) + '</span>' +
        '<div class="text-body-secondary small mono">' + esc(post.name) + '</div></td>' +
        '<td class="d-none d-md-table-cell">' +
        (post.category
          ? '<span class="badge text-bg-light border">' + esc(post.category) + '</span>'
          : '<span class="text-body-secondary">—</span>') +
        '</td>' +
        '<td class="text-nowrap">' + esc(prettyDate(post.pubDate)) + '</td>' +
        '<td class="table-actions"><i class="bi bi-pencil-square text-body-secondary"></i></td>' +
        '</tr>';
    });
    html += '</tbody></table></div></div></div>';
    return html;
  }

  function dashboardSidePanel() {
    var html = '<div class="col-lg-4 d-flex flex-column gap-3">';

    html +=
      '<div class="card shadow-sm"><div class="card-header"><h3 class="card-title mb-0">' +
      '<i class="bi bi-send-check me-2"></i>Publish pipeline</h3></div>';
    html += '<div class="card-body small">';
    html +=
      '<p class="mb-2">Queued posts are published one per day at <strong>09:00 UTC</strong> by the ' +
      '<span class="mono">Schedule post publishing</span> workflow, which also fires the LinkedIn teaser ' +
      'and the IndexNow submission.</p>';
    html +=
      '<p class="mb-0 text-body-secondary">Editing here only commits Markdown — reels, sharing and ' +
      'indexing stay in GitHub Actions.</p>';
    html += '</div><div class="card-footer d-flex flex-wrap gap-2">';
    html +=
      '<a class="btn btn-sm btn-outline-secondary" target="_blank" rel="noopener" href="https://github.com/' +
      attr(state.repo) +
      '/actions">Open Actions</a>';
    html +=
      '<a class="btn btn-sm btn-outline-secondary" target="_blank" rel="noopener" href="https://github.com/' +
      attr(state.repo) +
      '/commits/' +
      attr(state.branch) +
      '">Recent commits</a>';
    html += '</div></div>';

    html +=
      '<div class="card shadow-sm"><div class="card-header"><h3 class="card-title mb-0">' +
      '<i class="bi bi-diagram-3 me-2"></i>Where things live</h3></div>';
    html += '<div class="card-body small"><dl class="row mb-0">';
    [
      ['Drafts in the queue', PENDING_DIR + '/ + .order'],
      ['Live posts', BLOG_DIR + '/'],
      ['Uploaded media', MEDIA_DIR + '/'],
      ['OG cards', OG_DIR + '/']
    ].forEach(function (row) {
      html +=
        '<dt class="col-5 fw-normal text-body-secondary">' + esc(row[0]) + '</dt>' +
        '<dd class="col-7 mono mb-1">' + esc(row[1]) + '</dd>';
    });
    html += '</dl></div></div>';

    html += '</div>';
    return html;
  }

  /* ── View: posts ────────────────────────────────────────────────────── */
  var postsFilter = { q: '', category: '' };

  function filteredPosts() {
    var query = postsFilter.q.toLowerCase();
    return state.posts.filter(function (post) {
      if (postsFilter.category && post.category !== postsFilter.category) return false;
      if (!query) return true;
      return (
        post.title.toLowerCase().indexOf(query) !== -1 ||
        post.name.toLowerCase().indexOf(query) !== -1 ||
        post.description.toLowerCase().indexOf(query) !== -1 ||
        post.tags.join(' ').toLowerCase().indexOf(query) !== -1
      );
    });
  }

  function postsTableHtml() {
    var rows = filteredPosts();
    var html = '<div class="table-responsive"><table class="table table-hover align-middle mb-0">';
    html +=
      '<thead><tr><th>Title</th><th class="d-none d-lg-table-cell">Category</th>' +
      '<th class="d-none d-lg-table-cell">Tags</th><th class="text-nowrap">Published</th>' +
      '<th class="d-none d-md-table-cell text-end">Words</th><th class="table-actions"></th></tr></thead><tbody>';
    if (!rows.length) {
      html +=
        '<tr><td colspan="6" class="text-body-secondary py-4 text-center">' +
        'No posts match this filter.</td></tr>';
    }
    rows.forEach(function (post) {
      var slug = post.name.replace(/\.(md|mdx)$/i, '');
      html += '<tr>';
      html +=
        '<td><span class="fw-medium">' + esc(post.title) + '</span>' +
        (post.unreadable ? ' <span class="badge text-bg-danger">unreadable</span>' : '') +
        '<div class="text-body-secondary small mono">' + esc(post.name) + '</div></td>';
      html +=
        '<td class="d-none d-lg-table-cell">' +
        (post.category
          ? '<span class="badge text-bg-light border">' + esc(post.category) + '</span>'
          : '—') +
        '</td>';
      html +=
        '<td class="d-none d-lg-table-cell">' +
        (post.tags.length
          ? post.tags
              .slice(0, 3)
              .map(function (tag) {
                return (
                  '<span class="badge text-bg-secondary-subtle border text-body">' + esc(tag) + '</span>'
                );
              })
              .join(' ') +
            (post.tags.length > 3
              ? ' <span class="text-body-secondary small">+' + (post.tags.length - 3) + '</span>'
              : '')
          : '—') +
        '</td>';
      html += '<td class="text-nowrap">' + esc(prettyDate(post.pubDate)) + '</td>';
      html +=
        '<td class="d-none d-md-table-cell text-end text-body-secondary">' +
        (post.words || 0).toLocaleString() +
        '</td>';
      html += '<td class="table-actions">';
      html +=
        '<a class="btn btn-sm btn-outline-primary" href="#/posts/edit/' +
        attr(encodeURIComponent(post.path)) +
        '" title="Edit"><i class="bi bi-pencil"></i></a> ';
      html +=
        '<a class="btn btn-sm btn-outline-secondary" target="_blank" rel="noopener" href="' +
        attr(SITE_ORIGIN + '/blog/' + slug + '/') +
        '" title="View on the live site"><i class="bi bi-box-arrow-up-right"></i></a> ';
      html +=
        '<button class="btn btn-sm btn-outline-danger" data-delete-post="' +
        attr(post.path) +
        '" data-delete-name="' +
        attr(post.name) +
        '" title="Delete"><i class="bi bi-trash"></i></button>';
      html += '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderPosts() {
    setPage('Posts', [{ label: 'Posts' }]);
    setActiveNav('posts');
    view(spinner('Reading src/content/blog/…'));

    loadPosts()
      .then(function () {
        var html = '<div class="card shadow-sm">';
        html +=
          '<div class="card-header d-flex flex-wrap align-items-center gap-2">' +
          '<h3 class="card-title mb-0 me-auto"><i class="bi bi-file-earmark-text me-2"></i>Published posts</h3>' +
          '<div class="input-group input-group-sm" style="width:16rem">' +
          '<span class="input-group-text"><i class="bi bi-search"></i></span>' +
          '<input type="search" class="form-control" id="posts-search" placeholder="Search title, slug, tag…" value="' +
          attr(postsFilter.q) +
          '">' +
          '</div>' +
          '<select class="form-select form-select-sm w-auto" id="posts-category">' +
          '<option value="">All categories</option>' +
          state.categories
            .map(function (category) {
              return (
                '<option value="' +
                attr(category) +
                '"' +
                (category === postsFilter.category ? ' selected' : '') +
                '>' +
                esc(category) +
                '</option>'
              );
            })
            .join('') +
          '</select>' +
          '<button class="btn btn-sm btn-outline-secondary" id="posts-refresh" title="Reload from GitHub">' +
          '<i class="bi bi-arrow-clockwise"></i></button>' +
          '<a class="btn btn-sm btn-primary" href="#/posts/new"><i class="bi bi-plus-lg me-1"></i>New post</a>' +
          '</div>';
        html += '<div id="posts-table">' + postsTableHtml() + '</div>';
        html +=
          '<div class="card-footer text-body-secondary small">' +
          '<span id="posts-shown">' + filteredPosts().length + '</span> of ' + state.posts.length +
          ' posts · files in <span class="mono">' + esc(BLOG_DIR) + '/</span></div>';
        html += '</div>';

        view(html);
        wirePostsTable();

        $('#posts-search').addEventListener('input', function (event) {
          postsFilter.q = event.target.value;
          refreshPostsTable();
        });
        $('#posts-category').addEventListener('change', function (event) {
          postsFilter.category = event.target.value;
          refreshPostsTable();
        });
        $('#posts-refresh').addEventListener('click', function () {
          state.loaded.posts = false;
          renderPosts();
        });
      })
      .catch(function (err) {
        view(errorPanel(err, '#/posts'));
      });
  }

  function refreshPostsTable() {
    var host = $('#posts-table');
    if (!host) return;
    host.innerHTML = postsTableHtml();
    var shown = $('#posts-shown');
    if (shown) shown.textContent = filteredPosts().length;
    wirePostsTable();
  }

  function wirePostsTable() {
    $$('#posts-table [data-delete-post]').forEach(function (button) {
      button.addEventListener('click', function () {
        deletePost(button.getAttribute('data-delete-post'), button.getAttribute('data-delete-name'));
      });
    });
  }

  function deletePost(path, name) {
    confirmDialog(
      'Delete post',
      '<p class="mb-2">Delete <span class="mono">' + esc(name) + '</span>?</p>' +
        '<p class="mb-0 text-body-secondary small">This commits a delete to <span class="mono">' +
        esc(state.branch) +
        '</span>; the live page disappears on the next deploy. The file stays in Git history.</p>',
      'Delete'
    ).then(function (ok) {
      if (!ok) return null;
      toast('Deleting ' + name + '…');
      return gh(repoPath() + '/contents/' + path + '?ref=' + encodeURIComponent(state.branch))
        .then(function (doc) {
          return deleteFile(path, 'admin: delete post ' + name, doc.sha);
        })
        .then(function () {
          toast('Deleted ' + name, 'success');
          state.loaded.posts = false;
          return loadPosts(true).then(function () {
            if (location.hash.replace(/^#\/?/, '').split('/')[0] === 'posts') refreshPostsTable();
          });
        })
        .catch(function (err) {
          toast(err.message, 'danger');
        });
    });
  }

  /* ── View: editor (posts + queued drafts) ───────────────────────────── */
  var editor = null;

  function parseTags(value) {
    return String(value || '')
      .split(',')
      .map(function (tag) {
        return tag.trim();
      })
      .filter(Boolean);
  }

  function validateFields(fields) {
    var problems = [];
    if (!fields.title) problems.push('Title is required.');
    if (!fields.description) problems.push('Description is required (used for SEO and the RSS feed).');
    if (!fields.pubDate) problems.push('Publish date is required.');
    if (!fields.category) problems.push('Category is required.');
    if (fields.heroImage && fields.heroImage.charAt(0) !== '/' && !/^https?:\/\//i.test(fields.heroImage)) {
      problems.push('Hero image must start with "/" (a file in public/) or be a full URL.');
    }
    return problems;
  }

  function validateFilename(name) {
    if (!name) return 'A filename is required.';
    if (!/\.(md|mdx)$/i.test(name)) return 'The filename must end in .md or .mdx.';
    if (!/^[a-zA-Z0-9][a-zA-Z0-9 ._-]*\.(md|mdx)$/i.test(name)) {
      return 'Use letters, numbers, spaces, dots, underscores and dashes only.';
    }
    if (state.posts.some(function (post) { return post.name === name; })) {
      return 'A published post already uses that filename.';
    }
    if (state.pendingFiles.some(function (file) { return file.name === name; })) {
      return 'A queued draft already uses that filename.';
    }
    return '';
  }

  function frontmatterFieldsHtml(fields, isNew) {
    var html = '<div class="row g-3">';

    html +=
      '<div class="col-md-8">' +
      '<label class="form-label" for="f-title">Title <span class="text-danger">*</span></label>' +
      '<input type="text" class="form-control" id="f-title" value="' + attr(fields.title || '') + '" required>' +
      '</div>';
    html +=
      '<div class="col-md-4">' +
      '<label class="form-label" for="f-category">Category <span class="text-danger">*</span></label>' +
      '<input type="text" class="form-control" id="f-category" list="f-category-list" value="' +
      attr(fields.category || '') + '" required>' +
      '<datalist id="f-category-list">' +
      state.categories
        .map(function (category) {
          return '<option value="' + attr(category) + '"></option>';
        })
        .join('') +
      '</datalist>' +
      '</div>';

    html +=
      '<div class="col-12">' +
      '<label class="form-label" for="f-description">Description <span class="text-danger">*</span></label>' +
      '<textarea class="form-control" id="f-description" rows="2">' + esc(fields.description || '') + '</textarea>' +
      '<div class="form-text">One or two sentences — used for the meta description and RSS summary.</div>' +
      '</div>';

    html +=
      '<div class="col-md-3">' +
      '<label class="form-label" for="f-pubdate">Publish date <span class="text-danger">*</span></label>' +
      '<input type="date" class="form-control" id="f-pubdate" value="' + attr(toInputDate(fields.pubDate)) + '">' +
      '<div class="form-text" id="f-pubdate-note">' +
      (isNew ? 'The scheduler overwrites this when it publishes a queued draft.' : '') +
      '</div></div>';

    html +=
      '<div class="col-md-3">' +
      '<label class="form-label" for="f-updated">Updated date</label>' +
      '<input type="date" class="form-control" id="f-updated" value="' + attr(toInputDate(fields.updatedDate)) + '">' +
      '<div class="form-text">Optional — feeds the sitemap lastmod.</div></div>';

    html +=
      '<div class="col-md-6">' +
      '<label class="form-label" for="f-tags">Tags</label>' +
      '<input type="text" class="form-control" id="f-tags" placeholder="Astro, SEO, Windows 11" value="' +
      attr((Array.isArray(fields.tags) ? fields.tags : []).join(', ')) + '">' +
      '<div class="form-text">Comma separated.</div></div>';

    html +=
      '<div class="col-12">' +
      '<label class="form-label" for="f-hero">Hero image</label>' +
      '<div class="input-group">' +
      '<span class="input-group-text">/</span>' +
      '<input type="text" class="form-control" id="f-hero" placeholder="article-media/my-image.png" value="' +
      attr((fields.heroImage || '').replace(/^\//, '')) + '">' +
      '<button class="btn btn-outline-secondary" type="button" id="f-hero-browse">' +
      '<i class="bi bi-images me-1"></i>Browse</button>' +
      '</div>' +
      '<div class="form-text">Path inside <span class="mono">public/</span>. Leave empty to let the build use a placeholder card.</div>' +
      '<div id="f-hero-preview" class="mt-2"></div>' +
      '</div>';

    html += '</div>';
    return html;
  }

  var MD_TOOLS = [
    { md: 'h2', icon: 'type-h2', label: 'Heading 2' },
    { md: 'h3', icon: 'type-h3', label: 'Heading 3' },
    { md: 'bold', icon: 'type-bold', label: 'Bold' },
    { md: 'italic', icon: 'type-italic', label: 'Italic' },
    { md: 'code', icon: 'code', label: 'Inline code' },
    { md: 'codeblock', icon: 'file-code', label: 'Code block' },
    { md: 'ul', icon: 'list-ul', label: 'Bullet list' },
    { md: 'ol', icon: 'list-ol', label: 'Numbered list' },
    { md: 'quote', icon: 'quote', label: 'Quote' },
    { md: 'link', icon: 'link-45deg', label: 'Link' },
    { md: 'image', icon: 'image', label: 'Image from the library' },
    { md: 'hr', icon: 'dash-lg', label: 'Divider' }
  ];

  function editorToolbarHtml() {
    return MD_TOOLS.map(function (tool) {
      return (
        '<button type="button" class="btn btn-sm btn-outline-secondary" data-md="' +
        attr(tool.md) +
        '" title="' +
        attr(tool.label) +
        '"><i class="bi bi-' +
        attr(tool.icon) +
        '"></i></button>'
      );
    }).join('');
  }

  function paintEditor(fields, body) {
    var isPending = editor.isPending;
    var title = editor.isNew
      ? (isPending ? 'New queued draft' : 'New post')
      : editor.name;
    setPage(title, [
      { label: isPending ? 'Queue' : 'Posts', href: isPending ? '#/queue' : '#/posts' },
      { label: editor.isNew ? 'New' : editor.name }
    ]);

    var html = '';

    /* Action bar */
    html += '<div class="card shadow-sm mb-3"><div class="card-body d-flex flex-wrap align-items-center gap-2">';
    html += '<a class="btn btn-sm btn-outline-secondary" href="#/' + (isPending ? 'queue' : 'posts') + '">';
    html += '<i class="bi bi-arrow-left me-1"></i>Back</a>';
    html += '<span class="text-body-secondary small me-auto" id="editor-status">';
    html += editor.isNew ? 'Unsaved new draft' : 'Loaded from ' + esc(editor.path || editor.dir);
    html += '</span>';
    if (!isPending && !editor.isNew) {
      var liveSlug = editor.name.replace(/\.(md|mdx)$/i, '');
      html +=
        '<a class="btn btn-sm btn-outline-secondary" target="_blank" rel="noopener" href="' +
        attr(SITE_ORIGIN + '/blog/' + liveSlug + '/') +
        '"><i class="bi bi-box-arrow-up-right me-1"></i>Live page</a>';
    }
    if (!editor.isNew) {
      html +=
        '<button class="btn btn-sm btn-outline-danger" id="editor-delete"><i class="bi bi-trash me-1"></i>Delete</button>';
    }
    html +=
      '<button class="btn btn-sm btn-primary" id="editor-save"><i class="bi bi-cloud-arrow-up me-1"></i>Commit to ' +
      esc(state.branch) +
      '</button>';
    html += '</div></div>';

    /* Frontmatter */
    html += '<div class="card shadow-sm mb-3">';
    html +=
      '<div class="card-header"><h3 class="card-title mb-0"><i class="bi bi-sliders me-2"></i>Frontmatter</h3></div>';
    html += '<div class="card-body">' + frontmatterFieldsHtml(fields, editor.isNew) + '</div>';

    /* Filename + queue options */
    html += '<div class="card-footer"><div class="row g-3 align-items-end">';
    html +=
      '<div class="col-md-6"><label class="form-label" for="f-name">Filename</label>' +
      '<input type="text" class="form-control mono" id="f-name" value="' +
      attr(editor.name || '') +
      '"' +
      (editor.isNew ? '' : ' readonly') +
      '>' +
      '<div class="form-text">' +
      (editor.isNew
        ? 'Saved into <span class="mono">' + esc(editor.dir) + '/</span>.'
        : 'Renaming is not supported here — create a new file and delete this one.') +
      '</div></div>';
    html += '<div class="col-md-6">';
    if (isPending && editor.isNew) {
      html +=
        '<div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="f-enqueue" checked>' +
        '<label class="form-check-label" for="f-enqueue">Append to the publish queue ' +
        '(<span class="mono">' + esc(ORDER_FILE) + '</span>)</label></div>';
    }
    if (isPending) {
      html +=
        '<div class="form-text">Queued drafts are published by <span class="mono">schedule-posts.yml</span>, ' +
        'one per day at 09:00 UTC, in <span class="mono">.order</span> sequence.</div>';
    }
    html += '</div></div></div>';
    html += '</div>';

    /* Body */
    html += '<div class="card shadow-sm">';
    html +=
      '<div class="card-header d-flex flex-wrap align-items-center gap-1">' +
      '<h3 class="card-title mb-0 me-auto"><i class="bi bi-markdown me-2"></i>Body</h3>' +
      '<div class="d-flex flex-wrap gap-1">' + editorToolbarHtml() + '</div>' +
      '</div>';
    html += '<div class="card-body"><div class="editor-grid">';
    html +=
      '<div class="editor-pane"><textarea class="form-control editor-textarea mono" id="f-body" ' +
      'spellcheck="true">' + esc(body || '') + '</textarea>' +
      '<div class="form-text"><span id="f-words">0</span> words · Markdown, saved verbatim</div></div>';
    html +=
      '<div class="editor-pane"><div class="d-flex align-items-center justify-content-between mb-1">' +
      '<span class="text-body-secondary small"><i class="bi bi-eye me-1"></i>Preview</span>' +
      '<span class="text-body-secondary small">approximate — the site uses its own pipeline</span>' +
      '</div><div class="md-preview" id="f-preview"></div></div>';
    html += '</div></div></div>';

    view(html);
    wireEditor();
  }

  /* ── Markdown insertion helpers ─────────────────────────────────────── */
  function surroundSelection(ta, before, after, placeholder) {
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var value = ta.value;
    var selected = value.slice(start, end) || placeholder;
    ta.value = value.slice(0, start) + before + selected + after + value.slice(end);
    ta.focus();
    ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    ta.dispatchEvent(new Event('input'));
  }

  function insertAtCursor(ta, text) {
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var value = ta.value;
    ta.value = value.slice(0, start) + text + value.slice(end);
    var caret = start + text.length;
    ta.focus();
    ta.setSelectionRange(caret, caret);
    ta.dispatchEvent(new Event('input'));
  }

  function linePrefix(ta, prefix) {
    var value = ta.value;
    var start = ta.selectionStart;
    var lineStart = value.lastIndexOf('\n', start - 1) + 1;
    var lineEnd = value.indexOf('\n', start);
    if (lineEnd === -1) lineEnd = value.length;
    var line = value.slice(lineStart, lineEnd).replace(/^(\s*)(?:#{1,6}\s|>\s|[-*+]\s|\d+\.\s)?/, '$1');
    var out = prefix + line;
    ta.value = value.slice(0, lineStart) + out + value.slice(lineEnd);
    ta.focus();
    ta.setSelectionRange(lineStart + out.length, lineStart + out.length);
    ta.dispatchEvent(new Event('input'));
  }

  function prefixLines(ta, prefix, numbered) {
    var value = ta.value;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var lineStart = value.lastIndexOf('\n', start - 1) + 1;
    var lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;
    var block = value.slice(lineStart, lineEnd);
    var lines = block.length ? block.split('\n') : [''];
    var out = lines
      .map(function (line, index) {
        var clean = line.replace(/^(\s*)(?:[-*+]\s|\d+\.\s)?/, '$1');
        return (numbered ? index + 1 + '. ' : prefix) + clean;
      })
      .join('\n');
    ta.value = value.slice(0, lineStart) + out + value.slice(lineEnd);
    ta.focus();
    ta.setSelectionRange(lineStart, lineStart + out.length);
    ta.dispatchEvent(new Event('input'));
  }

  function applyMd(kind) {
    var ta = $('#f-body');
    if (!ta) return;
    switch (kind) {
      case 'bold':
        surroundSelection(ta, '**', '**', 'bold text');
        break;
      case 'italic':
        surroundSelection(ta, '*', '*', 'italic text');
        break;
      case 'code':
        surroundSelection(ta, '`', '`', 'code');
        break;
      case 'codeblock':
        surroundSelection(ta, '\n```text\n', '\n```\n', 'code');
        break;
      case 'link':
        surroundSelection(ta, '[', '](https://)', 'link text');
        break;
      case 'h2':
        linePrefix(ta, '## ');
        break;
      case 'h3':
        linePrefix(ta, '### ');
        break;
      case 'quote':
        linePrefix(ta, '> ');
        break;
      case 'ul':
        prefixLines(ta, '- ', false);
        break;
      case 'ol':
        prefixLines(ta, '', true);
        break;
      case 'hr':
        insertAtCursor(ta, '\n---\n');
        break;
      case 'image':
        pickMedia(function (item) {
          var alt = item.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
          insertAtCursor(ta, '![' + alt + '](' + item.url + ')');
        });
        break;
      default:
        break;
    }
  }

  /* ── Editor wiring ──────────────────────────────────────────────────── */
  var previewTimer = null;

  function updatePreview() {
    var body = $('#f-body');
    var preview = $('#f-preview');
    if (!body || !preview) return;
    preview.innerHTML = renderMarkdown(body.value);
    var words = $('#f-words');
    if (words) words.textContent = countWords(body.value).toLocaleString();
  }

  function schedulePreview() {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 150);
  }

  function updateHeroPreview() {
    var host = $('#f-hero-preview');
    var input = $('#f-hero');
    if (!host || !input) return;
    var value = input.value.trim();
    if (!value) {
      host.innerHTML = '';
      return;
    }
    var url = /^https?:\/\//i.test(value) ? value : SITE_ORIGIN + '/' + value.replace(/^\//, '');
    host.innerHTML =
      '<img src="' +
      attr(url) +
      '" alt="" class="rounded border" style="max-height:9rem">' +
      '<div class="form-text mono">' +
      esc(url) +
      '</div>';
    var img = host.querySelector('img');
    img.addEventListener('error', function () {
      img.replaceWith(document.createTextNode(''));
      host.innerHTML = '<span class="badge text-bg-warning">Preview unavailable — check the path</span>';
    });
  }

  function markDirty() {
    if (!editor || editor.dirty) return;
    editor.dirty = true;
    var status = $('#editor-status');
    if (status) status.innerHTML = '<span class="badge text-bg-warning">unsaved changes</span>';
  }

  function wireEditor() {
    var body = $('#f-body');
    if (body) {
      body.addEventListener('input', function () {
        markDirty();
        schedulePreview();
      });
    }

    $$('#view [data-md]').forEach(function (button) {
      button.addEventListener('click', function () {
        applyMd(button.getAttribute('data-md'));
      });
    });

    var hero = $('#f-hero');
    if (hero) {
      hero.addEventListener('input', function () {
        markDirty();
        updateHeroPreview();
      });
      updateHeroPreview();
    }

    var browse = $('#f-hero-browse');
    if (browse) {
      browse.addEventListener('click', function () {
        pickMedia(function (item) {
          hero.value = item.url.replace(/^\//, '');
          markDirty();
          updateHeroPreview();
        });
      });
    }

    ['#f-title', '#f-description', '#f-category', '#f-tags', '#f-pubdate', '#f-updated'].forEach(
      function (selector) {
        var input = $(selector);
        if (input) input.addEventListener('input', markDirty);
      }
    );

    var nameInput = $('#f-name');
    if (nameInput) {
      nameInput.addEventListener('input', function () {
        editor.slugTouched = true;
        markDirty();
      });
      if (editor.isNew && !editor.slugTouched) {
        var titleInput = $('#f-title');
        titleInput.addEventListener('input', function () {
          if (editor.slugTouched) return;
          var slug = slugify(titleInput.value);
          nameInput.value = slug ? slug + '.md' : '';
        });
      }
    }

    var save = $('#editor-save');
    if (save) save.addEventListener('click', saveEditor);

    var del = $('#editor-delete');
    if (del) del.addEventListener('click', deleteEditorFile);

    updatePreview();
  }

  function collectEditorFields() {
    var heroRaw = $('#f-hero').value.trim();
    var hero = '';
    if (heroRaw) hero = /^https?:\/\//i.test(heroRaw) ? heroRaw : '/' + heroRaw.replace(/^\//, '');
    return {
      title: $('#f-title').value.trim(),
      description: $('#f-description').value.trim(),
      heroImage: hero,
      pubDate: fromInputDate($('#f-pubdate').value),
      updatedDate: fromInputDate($('#f-updated').value),
      category: $('#f-category').value.trim(),
      tags: parseTags($('#f-tags').value)
    };
  }

  function readOrderLines() {
    return readFile(ORDER_FILE)
      .catch(function () {
        return null;
      })
      .then(function (doc) {
        var lines = doc
          ? doc.text
              .split(/\r?\n/)
              .map(function (line) {
                return line.trim();
              })
              .filter(Boolean)
          : [];
        return { lines: lines, sha: doc ? doc.sha : null };
      });
  }

  function writeOrder(lines, message, sha) {
    return writeFile(ORDER_FILE, lines.join('\n') + '\n', message, sha, false);
  }

  function enqueuePending(name) {
    return readOrderLines().then(function (current) {
      if (current.lines.indexOf(name) !== -1) return null;
      return writeOrder(current.lines.concat([name]), 'admin: enqueue ' + name, current.sha);
    });
  }

  function removeFromOrder(name) {
    return readOrderLines().then(function (current) {
      var next = current.lines.filter(function (line) {
        return line !== name;
      });
      if (next.length === current.lines.length) return null;
      return writeOrder(next, 'admin: remove ' + name + ' from the queue', current.sha);
    });
  }

  function saveEditor() {
    if (!editor) return;
    var fields = collectEditorFields();
    var problems = validateFields(fields);
    var newName = editor.isNew ? $('#f-name').value.trim() : editor.name;
    if (editor.isNew) {
      var nameProblem = validateFilename(newName);
      if (nameProblem) problems.push(nameProblem);
    }
    if (problems.length) {
      toast(problems[0], 'danger');
      return;
    }

    var path = editor.dir + '/' + newName;
    var body = $('#f-body').value.replace(/^\n+/, '').replace(/[ \t]+$/, '');
    var text = buildFrontmatter(fields, editor.extras) + '\n\n' + body + '\n';
    var slug = newName.replace(/\.(md|mdx)$/i, '');
    var message =
      (editor.isNew ? 'admin: add ' : 'admin: update ') +
      (editor.isPending ? 'queued draft ' : 'post ') +
      slug;

    var button = $('#editor-save');
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="bi bi-arrow-repeat spin me-1"></i>Committing…';
    }

    var shouldEnqueue =
      editor.isPending && editor.isNew && $('#f-enqueue') && $('#f-enqueue').checked;

    writeFile(path, text, message, editor.sha, false)
      .then(function () {
        return shouldEnqueue ? enqueuePending(newName) : null;
      })
      .then(function () {
        editor.dirty = false;
        toast('Committed: ' + message, 'success');
        state.loaded.posts = false;
        state.loaded.queue = false;
        return Promise.all([loadPosts(true), loadQueue(true)]);
      })
      .then(function () {
        location.hash = editor.isPending ? '#/queue' : '#/posts';
      })
      .catch(function (err) {
        toast(err.message, 'danger');
        if (button) {
          button.disabled = false;
          button.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i>Commit to ' + esc(state.branch);
        }
      });
  }

  function deleteEditorFile() {
    if (!editor || editor.isNew) return;
    var isPending = editor.isPending;
    var path = editor.path;
    var name = editor.name;
    confirmDialog(
      'Delete ' + (isPending ? 'queued draft' : 'post'),
      '<p class="mb-2">Delete <span class="mono">' + esc(name) + '</span>?</p>' +
        (isPending
          ? '<p class="mb-0 text-body-secondary small">The file is removed from <span class="mono">' +
            esc(PENDING_DIR) +
            '</span> and from <span class="mono">.order</span>, so it will never be published.</p>'
          : '<p class="mb-0 text-body-secondary small">This commits a delete; the live page disappears on the next deploy.</p>'),
      'Delete'
    ).then(function (ok) {
      if (!ok) return null;
      toast('Deleting ' + name + '…');
      return gh(repoPath() + '/contents/' + path + '?ref=' + encodeURIComponent(state.branch))
        .then(function (doc) {
          return deleteFile(path, 'admin: delete ' + (isPending ? 'queued draft ' : 'post ') + name, doc.sha);
        })
        .then(function () {
          return isPending ? removeFromOrder(name) : null;
        })
        .then(function () {
          toast('Deleted ' + name, 'success');
          state.loaded.posts = false;
          state.loaded.queue = false;
          location.hash = isPending ? '#/queue' : '#/posts';
        })
        .catch(function (err) {
          toast(err.message, 'danger');
        });
    });
  }

  /* ── View: editor entry point ───────────────────────────────────────── */
  function openEditor(mode, path) {
    var isPending = mode === 'pending';
    setActiveNav(isPending ? 'queue' : 'posts');
    view(spinner(path ? 'Opening ' + path + '…' : 'Preparing a new draft…'));

    Promise.all([loadPosts(), loadQueue()])
      .then(function () {
        if (!path) {
          return {
            isNew: true,
            name: '',
            path: null,
            sha: null,
            fields: { pubDate: todayStamp(), tags: [] },
            extras: [],
            body: ''
          };
        }
        return readFile(path).then(function (doc) {
          if (!doc) {
            throw new Error('That file is no longer in the repository — it may have just been published.');
          }
          var parsed = parseFrontmatter(doc.text);
          return {
            isNew: false,
            name: doc.name,
            path: doc.path,
            sha: doc.sha,
            fields: parsed.fields,
            extras: parsed.extras,
            body: parsed.body
          };
        });
      })
      .then(function (data) {
        editor = {
          mode: mode,
          isPending: isPending,
          dir: isPending ? PENDING_DIR : BLOG_DIR,
          isNew: data.isNew,
          name: data.name,
          path: data.path,
          sha: data.sha,
          extras: data.extras,
          dirty: false,
          slugTouched: false
        };
        paintEditor(data.fields, data.body);
      })
      .catch(function (err) {
        view(errorPanel(err, '#/' + (isPending ? 'queue' : 'posts')));
      });
  }

  /* ── Media picker (shared modal) ────────────────────────────────────── */
  function ensureMediaPicker() {
    var existing = $('#media-picker');
    if (existing) return existing;
    var el = document.createElement('div');
    el.id = 'media-picker';
    el.className = 'modal fade';
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="modal-dialog modal-lg modal-dialog-scrollable">' +
      '<div class="modal-content">' +
      '<div class="modal-header"><h5 class="modal-title">' +
      '<i class="bi bi-images me-2"></i>Media library</h5>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>' +
      '<div class="modal-body">' +
      '<div class="input-group input-group-sm mb-3">' +
      '<span class="input-group-text"><i class="bi bi-search"></i></span>' +
      '<input type="search" class="form-control" id="media-picker-search" placeholder="Filter by filename…">' +
      '</div>' +
      '<div id="media-picker-grid"></div>' +
      '</div></div></div>';
    document.body.appendChild(el);
    return el;
  }

  function mediaTileHtml(item) {
    var isImage = /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(item.name);
    return (
      '<button type="button" class="media-tile text-start p-0 border-0" data-pick="' +
      attr(item.path) +
      '">' +
      (isImage
        ? '<img src="' + attr(SITE_ORIGIN + item.url) + '" alt="" loading="lazy">'
        : '<div class="d-flex align-items-center justify-content-center" style="height:8rem">' +
          '<i class="bi bi-file-earmark fs-1 text-body-secondary"></i></div>') +
      '<span class="media-tile-body d-block"><span class="media-tile-name">' +
      esc(item.name) +
      '</span><span class="text-body-secondary">' +
      esc(item.label) +
      ' · ' +
      esc(bytes(item.size)) +
      '</span></span></button>'
    );
  }

  function pickMedia(callback) {
    var modalEl = ensureMediaPicker();
    var modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    var grid = $('#media-picker-grid', modalEl);
    var search = $('#media-picker-search', modalEl);
    grid.innerHTML = spinner('Loading media…');

    function paint() {
      var query = (search.value || '').toLowerCase();
      var items = state.media.filter(function (item) {
        return !query || item.name.toLowerCase().indexOf(query) !== -1;
      });
      grid.innerHTML = items.length
        ? '<div class="media-grid">' + items.map(mediaTileHtml).join('') + '</div>'
        : '<p class="text-body-secondary mb-0">No files match.</p>';
      $$('[data-pick]', grid).forEach(function (tile) {
        tile.addEventListener('click', function () {
          var path = tile.getAttribute('data-pick');
          var item = state.media.filter(function (candidate) {
            return candidate.path === path;
          })[0];
          modal.hide();
          if (item) callback(item);
        });
      });
    }

    loadMedia()
      .then(function () {
        search.value = '';
        paint();
      })
      .catch(function (err) {
        grid.innerHTML = errorPanel(err);
      });

    search.oninput = paint;
    modal.show();
  }

  /* ── View: queue (pending-posts + .order) ───────────────────────────── */
  function queueTableHtml() {
    var rows = queueRows();
    var html = '<div class="table-responsive"><table class="table table-hover align-middle mb-0">';
    html +=
      '<thead><tr><th style="width:3rem">#</th><th>Draft file</th>' +
      '<th class="d-none d-md-table-cell">Size</th><th class="table-actions">Order</th>' +
      '<th class="table-actions"></th></tr></thead><tbody>';
    if (!rows.length) {
      html +=
        '<tr><td colspan="5" class="text-center text-body-secondary py-4">' +
        'The queue is empty. Create a queued draft to start the publish schedule.</td></tr>';
    }
    rows.forEach(function (row, index) {
      var isNext = index === 0 && row.inOrder;
      html += '<tr class="queue-row' + (isNext ? ' queue-next' : '') + '">';
      html += '<td class="text-body-secondary">' + (index + 1) + '</td>';
      html +=
        '<td><span class="fw-medium mono">' +
        esc(row.name) +
        '</span>' +
        (row.file
          ? ''
          : ' <span class="badge text-bg-danger">missing file</span>') +
        (isNext
          ? ' <span class="badge text-bg-warning">next to publish</span>'
          : '') +
        (row.inOrder
          ? ''
          : ' <span class="badge text-bg-secondary">not in .order</span>') +
        '</td>';
      html +=
        '<td class="d-none d-md-table-cell text-body-secondary">' +
        esc(row.file ? bytes(row.file.size) : '—') +
        '</td>';
      html +=
        '<td class="table-actions">' +
        '<button class="btn btn-sm btn-outline-secondary" data-move="' +
        attr(row.name) +
        '" data-delta="-1" title="Move up"' +
        (index === 0 ? ' disabled' : '') +
        '><i class="bi bi-arrow-up"></i></button> ' +
        '<button class="btn btn-sm btn-outline-secondary" data-move="' +
        attr(row.name) +
        '" data-delta="1" title="Move down"' +
        (index === rows.length - 1 ? ' disabled' : '') +
        '><i class="bi bi-arrow-down"></i></button>' +
        '</td>';
      html += '<td class="table-actions">';
      if (row.file) {
        html +=
          '<a class="btn btn-sm btn-outline-primary" href="#/queue/edit/' +
          attr(encodeURIComponent(row.file.path)) +
          '" title="Edit"><i class="bi bi-pencil"></i></a> ';
      }
      if (row.inOrder) {
        html +=
          '<button class="btn btn-sm btn-outline-warning" data-unqueue="' +
          attr(row.name) +
          '" title="Remove from the queue (keeps the file)"><i class="bi bi-x-lg"></i></button> ';
      } else {
        html +=
          '<button class="btn btn-sm btn-outline-success" data-enqueue="' +
          attr(row.name) +
          '" title="Append to .order"><i class="bi bi-plus-lg"></i></button> ';
      }
      if (row.file) {
        html +=
          '<button class="btn btn-sm btn-outline-danger" data-delete-draft="' +
          attr(row.name) +
          '" title="Delete the file"><i class="bi bi-trash"></i></button>';
      }
      html += '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderQueue() {
    setPage('Queue', [{ label: 'Queue' }]);
    setActiveNav('queue');
    view(spinner('Reading pending-posts/…'));

    loadQueue()
      .then(function () {
        var rows = queueRows();
        var html = '<div class="card shadow-sm mb-3"><div class="card-body small">';
        html +=
          '<i class="bi bi-info-circle me-1"></i>The <span class="mono">Schedule post publishing</span> ' +
          'workflow publishes the <strong>first entry in <span class="mono">.order</span></strong> that still has a file, ' +
          'once a day at 09:00 UTC — then removes it from the working tree and stamps today\'s date. ' +
          'Order here is the publish order.';
        html += '</div></div>';

        html += '<div class="card shadow-sm">';
        html +=
          '<div class="card-header d-flex flex-wrap align-items-center gap-2">' +
          '<h3 class="card-title mb-0 me-auto"><i class="bi bi-list-ol me-2"></i>Publish queue</h3>' +
          '<button class="btn btn-sm btn-outline-secondary" id="queue-refresh" title="Reload from GitHub">' +
          '<i class="bi bi-arrow-clockwise"></i></button>' +
          '<a class="btn btn-sm btn-primary" href="#/queue/new"><i class="bi bi-plus-lg me-1"></i>New queued draft</a>' +
          '</div>';
        html += '<div id="queue-table">' + queueTableHtml() + '</div>';
        html +=
          '<div class="card-footer text-body-secondary small">' +
          rows.length +
          ' entries · ' +
          state.pendingFiles.length +
          ' draft file(s) in <span class="mono">' +
          esc(PENDING_DIR) +
          '/</span></div>';
        html += '</div>';

        view(html);
        wireQueueTable();

        $('#queue-refresh').addEventListener('click', function () {
          state.loaded.queue = false;
          renderQueue();
        });
      })
      .catch(function (err) {
        view(errorPanel(err, '#/queue'));
      });
  }

  function refreshQueueTable() {
    var host = $('#queue-table');
    if (!host) return;
    host.innerHTML = queueTableHtml();
    wireQueueTable();
    setCounts();
  }

  function queueMutation(promise, successMessage) {
    return promise
      .then(function () {
        toast(successMessage, 'success');
        state.loaded.queue = false;
        return loadQueue(true);
      })
      .then(function () {
        refreshQueueTable();
      })
      .catch(function (err) {
        toast(err.message, 'danger');
      });
  }

  function moveInOrder(name, delta) {
    return readOrderLines().then(function (current) {
      var lines = current.lines.slice();
      var index = lines.indexOf(name);
      var target = index + delta;
      if (index === -1 || target < 0 || target >= lines.length) return null;
      lines.splice(index, 1);
      lines.splice(target, 0, name);
      return writeOrder(lines, 'admin: reorder the publish queue', current.sha);
    });
  }

  function addToQueue(name) {
    return readOrderLines().then(function (current) {
      if (current.lines.indexOf(name) !== -1) return null;
      return writeOrder(current.lines.concat([name]), 'admin: enqueue ' + name, current.sha);
    });
  }

  function unqueue(name) {
    return readOrderLines().then(function (current) {
      var next = current.lines.filter(function (line) {
        return line !== name;
      });
      if (next.length === current.lines.length) return null;
      return writeOrder(next, 'admin: remove ' + name + ' from the queue', current.sha);
    });
  }

  function deleteDraft(name, path) {
    confirmDialog(
      'Delete queued draft',
      '<p class="mb-2">Delete <span class="mono">' + esc(name) + '</span> and drop it from <span class="mono">.order</span>?</p>' +
        '<p class="mb-0 text-body-secondary small">It will never be published. The file stays in Git history.</p>',
      'Delete'
    ).then(function (ok) {
      if (!ok) return null;
      return gh(repoPath() + '/contents/' + path + '?ref=' + encodeURIComponent(state.branch))
        .then(function (doc) {
          return deleteFile(path, 'admin: delete queued draft ' + name, doc.sha);
        })
        .then(function () {
          return unqueue(name);
        })
        .then(function () {
          toast('Deleted ' + name, 'success');
          state.loaded.queue = false;
          return loadQueue(true);
        })
        .then(function () {
          refreshQueueTable();
        })
        .catch(function (err) {
          toast(err.message, 'danger');
        });
    });
  }

  function wireQueueTable() {
    $$('#queue-table [data-move]').forEach(function (button) {
      button.addEventListener('click', function () {
        queueMutation(
          moveInOrder(button.getAttribute('data-move'), Number(button.getAttribute('data-delta'))),
          'Queue reordered'
        );
      });
    });
    $$('#queue-table [data-enqueue]').forEach(function (button) {
      button.addEventListener('click', function () {
        queueMutation(addToQueue(button.getAttribute('data-enqueue')), 'Added to the queue');
      });
    });
    $$('#queue-table [data-unqueue]').forEach(function (button) {
      button.addEventListener('click', function () {
        queueMutation(unqueue(button.getAttribute('data-unqueue')), 'Removed from the queue');
      });
    });
    $$('#queue-table [data-delete-draft]').forEach(function (button) {
      button.addEventListener('click', function () {
        var name = button.getAttribute('data-delete-draft');
        var file = state.pendingFiles.filter(function (candidate) {
          return candidate.name === name;
        })[0];
        if (file) deleteDraft(name, file.path);
      });
    });
  }

  /* ── View: media ────────────────────────────────────────────────────── */
  var mediaFilter = '';

  function sanitizeFileName(name) {
    return String(name)
      .replace(/[^\w.\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  function mediaGridHtml() {
    var query = mediaFilter.toLowerCase();
    var items = state.media.filter(function (item) {
      return !query || item.name.toLowerCase().indexOf(query) !== -1;
    });
    if (!items.length) {
      return '<p class="text-body-secondary mb-0">No media files found.</p>';
    }
    return (
      '<div class="media-grid">' +
      items
        .map(function (item) {
          var isImage = /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(item.name);
          return (
            '<div class="media-tile">' +
            (isImage
              ? '<img src="' + attr(SITE_ORIGIN + item.url) + '" alt="" loading="lazy">'
              : '<div class="d-flex align-items-center justify-content-center" style="height:8rem">' +
                '<i class="bi bi-file-earmark fs-1 text-body-secondary"></i></div>') +
            '<div class="media-tile-body">' +
            '<span class="media-tile-name mono" title="' +
            attr(item.name) +
            '">' +
            esc(item.name) +
            '</span>' +
            '<span class="text-body-secondary d-block mb-2">' +
            esc(item.label) +
            ' · ' +
            esc(bytes(item.size)) +
            '</span>' +
            '<div class="btn-group btn-group-sm w-100">' +
            '<button class="btn btn-outline-secondary" data-copy="' +
            attr(item.url) +
            '" title="Copy the public path"><i class="bi bi-clipboard"></i></button>' +
            '<a class="btn btn-outline-secondary" target="_blank" rel="noopener" href="' +
            attr(SITE_ORIGIN + item.url) +
            '" title="Open"><i class="bi bi-box-arrow-up-right"></i></a>' +
            '<button class="btn btn-outline-danger" data-delete-media="' +
            attr(item.path) +
            '" data-delete-media-name="' +
            attr(item.name) +
            '" title="Delete"><i class="bi bi-trash"></i></button>' +
            '</div></div></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderMedia() {
    setPage('Media', [{ label: 'Media' }]);
    setActiveNav('media');
    view(spinner('Listing public/article-media/ and public/og/…'));

    loadMedia()
      .then(function () {
        var html = '<div class="card shadow-sm mb-3">';
        html +=
          '<div class="card-header"><h3 class="card-title mb-0">' +
          '<i class="bi bi-cloud-arrow-up me-2"></i>Upload</h3></div>';
        html += '<div class="card-body"><div class="row g-3 align-items-end">';
        html +=
          '<div class="col-md-6"><label class="form-label" for="media-file">Image or file</label>' +
          '<input type="file" class="form-control" id="media-file" multiple accept="image/*">' +
          '<div class="form-text">Committed to <span class="mono">' +
          esc(MEDIA_DIR) +
          '/</span>. Spaces become dashes.</div></div>';
        html +=
          '<div class="col-md-6"><button class="btn btn-primary" id="media-upload" disabled>' +
          '<i class="bi bi-upload me-1"></i>Upload</button>' +
          '<div class="form-text">Uploaded files appear on the live site after the next deploy — ' +
          'the thumbnails below may 404 until then.</div></div>';
        html += '</div></div></div>';

        html += '<div class="card shadow-sm">';
        html +=
          '<div class="card-header d-flex flex-wrap align-items-center gap-2">' +
          '<h3 class="card-title mb-0 me-auto"><i class="bi bi-images me-2"></i>Library</h3>' +
          '<div class="input-group input-group-sm" style="width:16rem">' +
          '<span class="input-group-text"><i class="bi bi-search"></i></span>' +
          '<input type="search" class="form-control" id="media-search" placeholder="Filter by filename…" value="' +
          attr(mediaFilter) +
          '">' +
          '</div>' +
          '<button class="btn btn-sm btn-outline-secondary" id="media-refresh" title="Reload from GitHub">' +
          '<i class="bi bi-arrow-clockwise"></i></button>' +
          '</div>';
        html += '<div class="card-body" id="media-grid-host">' + mediaGridHtml() + '</div>';
        html +=
          '<div class="card-footer text-body-secondary small">' +
          state.media.length +
          ' files · <span class="mono">' +
          esc(MEDIA_DIR) +
          '/</span> and <span class="mono">' +
          esc(OG_DIR) +
          '/</span></div>';
        html += '</div>';

        view(html);
        wireMedia();
      })
      .catch(function (err) {
        view(errorPanel(err, '#/media'));
      });
  }

  function refreshMediaGrid() {
    var host = $('#media-grid-host');
    if (!host) return;
    host.innerHTML = mediaGridHtml();
    wireMediaGrid();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          toast('Copied ' + text, 'success');
        },
        function () {
          toast('Copy failed — the path is ' + text, 'warning');
        }
      );
    }
    toast('Copy the path manually: ' + text, 'info');
    return Promise.resolve();
  }

  function uploadMedia(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    toast('Uploading ' + list.length + ' file(s)…');
    return mapLimit(list, 2, function (file) {
      var name = sanitizeFileName(file.name) || 'upload';
      var path = MEDIA_DIR + '/' + name;
      return readFile(path)
        .catch(function () {
          return null;
        })
        .then(function (existing) {
          return file.arrayBuffer().then(function (buffer) {
            return writeFile(
              path,
              arrayBufferToBase64(buffer),
              'admin: upload ' + name,
              existing ? existing.sha : null,
              true
            );
          });
        })
        .then(function () {
          return name;
        });
    })
      .then(function (names) {
        toast('Uploaded ' + names.length + ' file(s)', 'success');
        state.loaded.media = false;
        return loadMedia(true).then(refreshMediaGrid);
      })
      .catch(function (err) {
        toast(err.message, 'danger');
      });
  }

  function deleteMedia(path, name) {
    confirmDialog(
      'Delete media file',
      '<p class="mb-2">Delete <span class="mono">' + esc(name) + '</span>?</p>' +
        '<p class="mb-0 text-body-secondary small">Posts that reference it will show a broken image. ' +
        'The file stays in Git history.</p>',
      'Delete'
    ).then(function (ok) {
      if (!ok) return null;
      return gh(repoPath() + '/contents/' + path + '?ref=' + encodeURIComponent(state.branch))
        .then(function (doc) {
          return deleteFile(path, 'admin: delete media ' + name, doc.sha);
        })
        .then(function () {
          toast('Deleted ' + name, 'success');
          state.loaded.media = false;
          return loadMedia(true).then(refreshMediaGrid);
        })
        .catch(function (err) {
          toast(err.message, 'danger');
        });
    });
  }

  function wireMediaGrid() {
    $$('[data-copy]').forEach(function (button) {
      button.addEventListener('click', function () {
        copyText(button.getAttribute('data-copy'));
      });
    });
    $$('[data-delete-media]').forEach(function (button) {
      button.addEventListener('click', function () {
        deleteMedia(button.getAttribute('data-delete-media'), button.getAttribute('data-delete-media-name'));
      });
    });
  }

  function wireMedia() {
    wireMediaGrid();

    var fileInput = $('#media-file');
    var uploadButton = $('#media-upload');
    if (fileInput && uploadButton) {
      fileInput.addEventListener('change', function () {
        uploadButton.disabled = !fileInput.files || !fileInput.files.length;
      });
      uploadButton.addEventListener('click', function () {
        uploadMedia(fileInput.files).then(function () {
          fileInput.value = '';
          uploadButton.disabled = true;
        });
      });
    }

    var search = $('#media-search');
    if (search) {
      search.addEventListener('input', function () {
        mediaFilter = search.value;
        refreshMediaGrid();
      });
    }

    var refresh = $('#media-refresh');
    if (refresh) {
      refresh.addEventListener('click', function () {
        state.loaded.media = false;
        renderMedia();
      });
    }
  }

  /* ── View: settings ─────────────────────────────────────────────────── */
  function renderSettings() {
    setPage('Settings', [{ label: 'Settings' }]);
    setActiveNav('settings');
    var user = state.user || {};

    var html = '<div class="row g-3">';

    /* Account */
    html += '<div class="col-lg-6"><div class="card shadow-sm h-100">';
    html +=
      '<div class="card-header"><h3 class="card-title mb-0">' +
      '<i class="bi bi-person-circle me-2"></i>Account</h3></div>';
    html += '<div class="card-body">';
    html +=
      '<p class="mb-2">Signed in as <strong>' +
      esc(user.login || 'unknown') +
      '</strong>' +
      (user.name ? ' (' + esc(user.name) + ')' : '') +
      '.</p>';
    html +=
      '<p class="text-body-secondary small mb-3">The token is sent only to <span class="mono">api.github.com</span>. ' +
      'It is kept in <span class="mono">sessionStorage</span> for this tab, or <span class="mono">localStorage</span> ' +
      'if you ticked "remember".</p>';
    html += '<button class="btn btn-outline-danger" id="settings-signout">' +
      '<i class="bi bi-box-arrow-right me-1"></i>Sign out</button>';
    html += '</div></div></div>';

    /* Repository */
    html += '<div class="col-lg-6"><div class="card shadow-sm h-100">';
    html +=
      '<div class="card-header"><h3 class="card-title mb-0">' +
      '<i class="bi bi-git me-2"></i>Repository</h3></div>';
    html += '<div class="card-body"><div class="row g-3">';
    html +=
      '<div class="col-12"><label class="form-label" for="s-repo">Repository</label>' +
      '<input type="text" class="form-control mono" id="s-repo" value="' + attr(state.repo) + '">' +
      '<div class="form-text">owner/name — the token must grant this repository Contents: Read and write.</div></div>';
    html +=
      '<div class="col-12"><label class="form-label" for="s-branch">Branch</label>' +
      '<input type="text" class="form-control mono" id="s-branch" value="' + attr(state.branch) + '">' +
      '<div class="form-text">Commits go straight to this branch, which Cloudflare deploys.</div></div>';
    html += '</div></div>';
    html +=
      '<div class="card-footer d-flex flex-wrap gap-2">' +
      '<button class="btn btn-primary" id="settings-save">Save</button>' +
      '<a class="btn btn-outline-secondary" target="_blank" rel="noopener" href="https://github.com/' +
      attr(state.repo) +
      '">Open repository</a>' +
      '<a class="btn btn-outline-secondary" target="_blank" rel="noopener" href="https://github.com/' +
      attr(state.repo) +
      '/actions">Actions</a>' +
      '</div></div></div>';

    /* Token */
    html += '<div class="col-lg-6"><div class="card shadow-sm h-100">';
    html +=
      '<div class="card-header"><h3 class="card-title mb-0">' +
      '<i class="bi bi-key me-2"></i>Creating a token</h3></div>';
    html += '<div class="card-body"><ol class="mb-3 ps-3 small">';
    html +=
      '<li class="mb-1">Open <a target="_blank" rel="noopener" href="https://github.com/settings/personal-access-tokens/new">' +
      'Fine-grained personal access tokens</a>.</li>';
    html += '<li class="mb-1">Set <strong>Repository access</strong> to only <span class="mono">' +
      esc(state.repo) + '</span>.</li>';
    html +=
      '<li class="mb-1">Under <strong>Permissions → Repository permissions</strong>, set ' +
      '<strong>Contents</strong> to <em>Read and write</em>. Nothing else is needed.</li>';
    html += '<li class="mb-1">Set a short expiry and regenerate when it lapses.</li>';
    html += '</ol>';
    html +=
      '<div class="alert alert-warning small mb-0"><i class="bi bi-exclamation-triangle me-1"></i>' +
      'A token in a browser is a real credential. Use the narrowest scope, keep the expiry short, ' +
      'and prefer "remember" off on shared machines.</div>';
    html += '</div></div></div>';

    /* Scope of this tool */
    html += '<div class="col-lg-6"><div class="card shadow-sm h-100">';
    html +=
      '<div class="card-header"><h3 class="card-title mb-0">' +
      '<i class="bi bi-info-circle me-2"></i>What this dashboard does not do</h3></div>';
    html += '<div class="card-body small"><ul class="mb-0 ps-3">';
    [
      'It never runs builds or deploys — Cloudflare deploys the push.',
      'It does not post to LinkedIn, submit to IndexNow or render reels; those stay in GitHub Actions.',
      'It does not upload OG cards into pending-posts/og/ — run <span class="mono">npm run generate:assets</span> for those.',
      'It does not touch published URLs, redirects or the sitemap.'
    ].forEach(function (line) {
      html += '<li class="mb-1">' + line + '</li>';
    });
    html += '</ul></div></div></div>';

    html += '</div>';
    view(html);

    $('#settings-signout').addEventListener('click', function () {
      signOut();
      toast('Signed out', 'info');
    });

    $('#settings-save').addEventListener('click', function () {
      var repo = $('#s-repo').value.trim();
      var branch = $('#s-branch').value.trim();
      if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
        toast('Repository must look like owner/name', 'danger');
        return;
      }
      if (!branch) {
        toast('Branch cannot be empty', 'danger');
        return;
      }
      state.repo = repo;
      state.branch = branch;
      state.branchFromConfig = true;
      state.loaded = { posts: false, queue: false, media: false };
      saveConfig();
      setCounts();
      toast('Settings saved', 'success');
      renderSettings();
    });
  }

  /* ── Router ─────────────────────────────────────────────────────────── */
  function route() {
    if (!state.token) return; /* the gate is showing */
    var hash = location.hash.replace(/^#\/?/, '');
    if (!hash) {
      location.replace('#/dashboard');
      return;
    }
    var segments = hash.split('/');
    var section = segments[0];
    var action = segments[1] || '';
    var rest = segments.slice(2).join('/');
    var arg = '';
    if (rest) {
      try {
        arg = decodeURIComponent(rest);
      } catch (e) {
        arg = rest;
      }
    }

    switch (section) {
      case 'posts':
        if (action === 'new') openEditor('post', null);
        else if (action === 'edit' && arg) openEditor('post', arg);
        else renderPosts();
        break;
      case 'queue':
        if (action === 'new') openEditor('pending', null);
        else if (action === 'edit' && arg) openEditor('pending', arg);
        else renderQueue();
        break;
      case 'media':
        renderMedia();
        break;
      case 'settings':
        renderSettings();
        break;
      case 'dashboard':
      default:
        renderDashboard();
        break;
    }
  }

  /* ── Sign-in gate ───────────────────────────────────────────────────── */
  function showGate() {
    var gate = $('#gate');
    if (gate) gate.hidden = false;
    var wrapper = $('.app-wrapper');
    if (wrapper) wrapper.style.display = 'none';
    var input = $('#gate-token');
    if (input) input.value = '';
    var error = $('#gate-error');
    if (error) error.hidden = true;
    var repoLabel = $('#gate-repo');
    if (repoLabel) repoLabel.textContent = state.repo;
  }

  function hideGate() {
    var gate = $('#gate');
    if (gate) gate.hidden = true;
    var wrapper = $('.app-wrapper');
    if (wrapper) wrapper.style.display = '';
  }

  function wireGate() {
    var form = $('#gate-form');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var token = $('#gate-token').value.trim();
      if (!token) return;
      var remember = $('#gate-remember').checked;
      var button = $('#gate-submit');
      var error = $('#gate-error');
      error.hidden = true;
      button.disabled = true;
      button.innerHTML = '<i class="bi bi-arrow-repeat spin me-1"></i>Verifying…';

      signIn(token, remember)
        .then(function (info) {
          hideGate();
          toast('Signed in as ' + info.user.login, 'success');
          if (!location.hash) location.replace('#/dashboard');
          route();
        })
        .catch(function (err) {
          error.hidden = false;
          error.textContent = err.message;
        })
        .then(function () {
          button.disabled = false;
          button.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i>Sign in';
        });
    });
  }

  /* ── Boot ───────────────────────────────────────────────────────────── */
  function hasRememberedToken() {
    try {
      return !!localStorage.getItem(LS_TOKEN);
    } catch (e) {
      return false;
    }
  }

  function boot() {
    var cfg = readConfig();
    state.repo = cfg.repo;
    if (cfg.branch) {
      state.branch = cfg.branch;
      state.branchFromConfig = true;
    }
    setCounts();
    wireGate();

    window.addEventListener('hashchange', route);

    document.addEventListener('keydown', function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        if ($('#editor-save')) {
          event.preventDefault();
          saveEditor();
        }
      }
    });

    var token = storedToken();
    if (!token) {
      showGate();
      return;
    }
    signIn(token, hasRememberedToken())
      .then(function () {
        hideGate();
        if (!location.hash) location.replace('#/dashboard');
        route();
      })
      .catch(function () {
        clearToken();
        showGate();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
