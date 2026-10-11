---
title: "10 Linux terminal commands I use every single day"
description: "I’ve been using Linux as my daily driver for over five years. In that time, I’ve collected dozens of commands — but the ones below are the ones that"
pubDate: "Jul 17 2026"
heroImage: "/linux-server.webp"
category: "Linux & Terminal"
tags: ["Linux", "Terminal", "Command Line", "Developer Tools"]

---

![Linux terminal and server management](/linux-server.webp)

I’ve been using Linux as my daily driver for over five years. In that time, I’ve collected dozens of commands — but the ones below are the ones that actually stuck. These aren’t the flashy ones from “top 100 Linux commands” listicles. These are the quiet workhorses. For a comfortable terminal to run them in, see our [Ghostty terminal configuration guide](/blog/simple-ghostty-terminal-configuration-guide/).

## 1. tldr — man pages for humans

Forget reading a 500-line man page just to remember the right flag for tar. tldr gives you the 5 most common usages, instantly.

```
$ tldr tar
# Extract a tar archive:
tar xf archive.tar.gz

# Create a tar archive:
tar czf output.tar.gz directory/
```

## 2. fzf — fuzzy finder that changes everything

Pipe anything into fzf and get an interactive, fuzzy-searchable list. I use it for command history, file navigation, and branch switching in git.

```
# Search command history interactively
$ history | fzf

# Open any file quickly
$ find . -type f | fzf | xargs nvim
```

## 3. rg (ripgrep) — search faster than grep

Ripgrep is grep, but written in Rust and orders of magnitude faster on large codebases. It also respects .gitignore by default.

```
$ rg "TODO" --type py
```

> “The best tool is the one you actually remember to use.”

## 4. watch — repeat a command automatically

Running df -h every 30 seconds to watch disk usage? Let watch do it for you.

```
$ watch -n 5 df -h
```

## 5. htop / btop — actually readable process viewer

Plain top works, but btop is a visual upgrade that shows CPU, memory, and network in a clean TUI. Worth the install.

The remaining 5 commands are z (smart cd), bat (cat with syntax highlighting), fd (better find), exa (better ls), and ncdu (disk usage navigator). Each one earns its place.
