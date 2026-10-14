---

title: "My dev environment in 2026 — what changed, what stayed"
description: "I do this annual audit of my dev setup. What tools did I keep? What did I finally ditch? What snuck in and became irreplaceable?"
pubDate: "Oct 15 2026"
heroImage: "/dev-environment.webp"
category: "Developer Productivity"
tags: ["Developer Tools", "Productivity", "Workstation", "Software Development"]

---

I do this annual audit of my dev setup. What tools did I keep? What did I finally ditch? What snuck in and became irreplaceable?

This year the headline is simple: my terminal quietly became an AI workstation, and almost every tool in it shipped a release that mattered.

What stayed

- Neovim — still my primary editor. I'm on the 0.12 series now, which shipped in March 2026 with a built-in plugin manager (`vim.pack`), native insert-mode completion, and a much better default statusline. LazyVim still makes config maintenance bearable, but I'll admit I'm watching `vim.pack` — the built-in manager now covers the basics with a proper lockfile, and I like the idea of one less external dependency. For now, lazy-loading keeps me on lazy.nvim.
- Tmux — demoted, not dropped. It's no longer on my local machine (Zellij won that role, see below), but tmux is still on every server I SSH into, and that ubiquity keeps it installed. The 3.7 release finally brought native floating panes, which killed the last plugin I was maintaining for popups — a nice parting gift.
- Zsh + Starship — fast prompt, great defaults. Starship 1.26 kept improving git state detection and added sha256 repo support; I notice none of it, which is exactly the point.
- Git + lazygit — lazygit (now past 0.61) is the TUI that made me actually enjoy git. Still the first thing I install on a fresh machine.

What's new

- Zellij — verdict's in: the experiment is over and Zellij won. It's my local multiplexer now. The 0.4x series added a welcome screen for session management, a built-in filepicker, nested sessions, and Kitty graphics support, and its WASM plugin system matured fast enough that I stopped missing tmux's ecosystem. Saved layouts per project turned out to be the killer feature — one command and my editor, file manager, and agent pane are arranged exactly how I left them.
- Ghostty — fastest terminal I've used. GPU-rendered, minimal. The 1.3 release (March 2026) finally closed my two biggest gaps with scrollback search and native scrollbars, and the project is now a non-profit funded by donations. See my [Ghostty configuration guide](/blog/simple-ghostty-terminal-configuration-guide/) for setup details.
- Yazi — a terminal file manager that just works. The 26.8 releases added drag-and-drop, a trash bin, a command palette, and bulk create — small quality-of-life things that add up. Image previews over the Kitty graphics protocol Just Work, which still feels like magic.

The thing that actually changed everything: AI in the terminal

I can't write this audit without mentioning it. This year, a coding agent (Claude Code, mostly) became a permanent resident in a tmux pane. That single change reshaped my requirements more than any editor or terminal switch:

- Scrollback search became essential. When an agent streams 500 lines and you need the one line where it explains its reasoning, Ghostty 1.3's new Cmd+F search went from nice-to-have to daily driver. (Fun fact: Ghostty 1.3 even fixed a memory leak that heavy agent workloads had been triggering since 1.0.)
- Multiplexers are agent habitats. Persistent sessions mean an agent can keep working while I detach, context intact. Zellij's saved layouts made this trivially good — the agent gets its own pane, pre-sized and pre-positioned, every time.
- Speed matters differently now. It's not about fast compile output anymore — it's about an agent streaming a 200-line refactor without a stutter.

What I dropped

VS Code is gone from my daily rotation. I used it for 4 years, but Neovim + Cursor cover everything it did, better. I also dropped Notion in favour of plain markdown files synced with Syncthing — fourteen months in, that decision has aged perfectly. No outages, no lock-in, grep-able notes.

The full stack at a glance

Tool	Role	Current series (Oct 2026)	
Neovim + LazyVim	Editor	0.12 (vim.pack built in)	
Zellij	Local multiplexing (daily driver)	0.4x (nested sessions, WASM plugins)	
tmux	Server / SSH sessions	3.7 (native floating panes)	
Ghostty	Terminal	1.3.x (scrollback search)	
Yazi	File manager	26.8.x (trash, drag-and-drop)	
Zsh + Starship	Shell + prompt	Starship 1.26	
Git + lazygit	Version control	lazygit 0.61	
Syncthing	Note sync	—	
Claude Code	AI pair programmer	—	

> The best dev environment is the one you stop thinking about.