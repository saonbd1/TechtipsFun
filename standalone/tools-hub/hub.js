// Tool Hub - client-side rendering, search and filters.
// Data comes from window.__hubData (embedded by generate_hub.py). No fetch(),
// so the page works from file:// without a server.
(function () {
  "use strict";

  var DATA = window.__hubData || { tools: [], repos: [], statuses: [], statusLabels: {} };
  var state = { q: "", category: null, repo: null, status: null };

  var repoName = {};
  (DATA.repos || []).forEach(function (r) { repoName[r.key] = r.name; });
  var repoUrl = {};
  (DATA.repos || []).forEach(function (r) { repoUrl[r.key] = r.url; });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function matches(tool) {
    if (state.category && tool.category !== state.category) return false;
    if (state.repo && tool.repo !== state.repo) return false;
    if (state.status && (tool.status || "ready") !== state.status) return false;
    if (!state.q) return true;
    var haystack = [
      tool.name, tool.summary, tool.category, tool.language,
      (tool.tags || []).join(" "), (tool.capabilities || []).join(" "),
      repoName[tool.repo] || tool.repo
    ].join(" ").toLowerCase();
    return state.q.split(/\s+/).every(function (word) {
      return haystack.indexOf(word) !== -1;
    });
  }

  function buildCard(tool) {
    var card = el("article", "card");

    var top = el("div", "card-top");
    var nameWrap = el("div");
    nameWrap.appendChild(el("div", "card-name", tool.name));
    top.appendChild(nameWrap);
    var status = tool.status || "ready";
    var badge = el("span", "badge " + status, (DATA.statusLabels || {})[status] || status);
    top.appendChild(badge);
    card.appendChild(top);

    if (tool.summary) card.appendChild(el("p", "card-summary", tool.summary));

    var meta = el("div", "meta");
    var repoPill = el("span", "pill", repoName[tool.repo] || tool.repo);
    if (repoUrl[tool.repo]) {
      var link = el("a", "pill", repoName[tool.repo] || tool.repo);
      link.href = repoUrl[tool.repo];
      link.target = "_blank";
      link.rel = "noopener";
      link.title = tool.path || "";
      meta.appendChild(link);
    } else {
      meta.appendChild(repoPill);
    }
    if (tool.path) meta.appendChild(el("span", "pill", tool.path));
    if (tool.language) meta.appendChild(el("span", "pill", tool.language));
    card.appendChild(meta);

    if (tool.capabilities && tool.capabilities.length) {
      var ul = el("ul", "caps");
      tool.capabilities.forEach(function (c) { ul.appendChild(el("li", null, c)); });
      card.appendChild(ul);
    }

    if (tool.run) {
      var run = el("div", "run");
      run.appendChild(el("code", null, tool.run));
      var copy = el("button", "copy", "copy");
      copy.type = "button";
      copy.addEventListener("click", function () {
        var done = function () {
          copy.textContent = "copied";
          copy.classList.add("done");
          setTimeout(function () { copy.textContent = "copy"; copy.classList.remove("done"); }, 1200);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(tool.run).then(done, function () { fallbackCopy(tool.run, done); });
        } else {
          fallbackCopy(tool.run, done);
        }
      });
      run.appendChild(copy);
      card.appendChild(run);
    }

    if (tool.tags && tool.tags.length) {
      var tags = el("div", "tags");
      tool.tags.forEach(function (t) { tags.appendChild(el("span", "tag", t)); });
      card.appendChild(tags);
    }
    return card;
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function render() {
    var grid = document.getElementById("grid");
    var empty = document.getElementById("empty");
    grid.innerHTML = "";

    var visible = (DATA.tools || []).filter(matches);
    var byCategory = {};
    visible.forEach(function (t) {
      var c = t.category || "Other";
      (byCategory[c] = byCategory[c] || []).push(t);
    });

    Object.keys(byCategory).sort().forEach(function (category) {
      var section = el("section");
      var head = el("div", "group-head");
      head.appendChild(el("h2", null, category));
      head.appendChild(el("div", "rule"));
      head.appendChild(el("span", "n", byCategory[category].length + " tool" + (byCategory[category].length === 1 ? "" : "s")));
      section.appendChild(head);
      var cards = el("div", "cards");
      byCategory[category]
        .sort(function (a, b) { return a.name.localeCompare(b.name); })
        .forEach(function (t) { cards.appendChild(buildCard(t)); });
      section.appendChild(cards);
      grid.appendChild(section);
    });

    empty.hidden = visible.length !== 0;
    document.getElementById("visible-count").textContent = visible.length;
  }

  function buildChips() {
    var counts = {};
    (DATA.tools || []).forEach(function (t) {
      counts[t.category || "Other"] = (counts[t.category || "Other"] || 0) + 1;
      counts["repo:" + t.repo] = (counts["repo:" + t.repo] || 0) + 1;
      counts["status:" + (t.status || "ready")] = (counts["status:" + (t.status || "ready")] || 0) + 1;
    });

    var groups = [
      { name: "category", key: "category", values: (DATA.categories || []).map(function (c) { return [c, c, counts[c] || 0]; }) },
      { name: "repo", key: "repo", values: (DATA.repos || []).map(function (r) { return [r.key, r.name, counts["repo:" + r.key] || 0]; }) },
      { name: "status", key: "status", values: (DATA.statuses || []).map(function (s) { return [s, (DATA.statusLabels || {})[s] || s, counts["status:" + s] || 0]; }) }
    ];

    groups.forEach(function (group) {
      var host = document.querySelector('.chips[data-group="' + group.key + '"]');
      if (!host) return;
      group.values.forEach(function (pair) {
        var value = pair[0], label = pair[1], n = pair[2];
        var chip = el("button", "chip");
        chip.type = "button";
        chip.appendChild(document.createTextNode(label));
        chip.appendChild(el("span", "n", n));
        chip.addEventListener("click", function () {
          state[group.key] = state[group.key] === value ? null : value;
          syncChips();
          render();
        });
        chip.setAttribute("data-value", value);
        host.appendChild(chip);
      });
    });
  }

  function syncChips() {
    ["category", "repo", "status"].forEach(function (key) {
      var chips = document.querySelectorAll('.chips[data-group="' + key + '"] .chip');
      for (var i = 0; i < chips.length; i++) {
        chips[i].classList.toggle("on", chips[i].getAttribute("data-value") === state[key]);
      }
    });
  }

  function renderStats() {
    var stats = DATA.liveStats;
    var host = document.getElementById("stats");
    if (!stats) { host.remove(); return; }
    [
      ["Scheduled reels", stats.scheduled_reels],
      ["Tracked posts", stats.tracked_posts]
    ].forEach(function (pair) {
      var box = el("div", "stat");
      box.appendChild(el("div", "stat-value", String(pair[1] != null ? pair[1] : 0)));
      box.appendChild(el("div", "stat-label", pair[0]));
      host.appendChild(box);
    });
  }

  function init() {
    renderStats();
    buildChips();
    render();

    var search = document.getElementById("search");
    search.addEventListener("input", function () {
      state.q = search.value.trim().toLowerCase();
      render();
    });
    document.getElementById("reset").addEventListener("click", function () {
      state = { q: "", category: null, repo: null, status: null };
      search.value = "";
      syncChips();
      render();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== search) {
        e.preventDefault();
        search.focus();
      } else if (e.key === "Escape" && document.activeElement === search) {
        search.value = "";
        state.q = "";
        render();
        search.blur();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
