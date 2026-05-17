---
name: "backlog-worker-start"
description: "Generate a worker identity for this session and start /loop 15m /backlog-poll. Run this once when joining the backlog worker pool."
argument-hint: "(none)"
compatibility: "Requires /backlog-poll and its config (.claude/backlog-poll.config.json). See METHODOLOGY.md."
metadata:
  author: "DeepBlueCLtd / backlog-navigator"
  source: "https://github.com/DeepBlueCLtd/backlog-navigator/blob/main/.claude/skills/backlog-worker-start/SKILL.md"
user-invocable: true
disable-model-invocation: false
---

## What this does

Initialises a worker identity for the current Claude Code session and
hands off to `/backlog-poll` via `/loop`. After running this once,
the session is part of the backlog worker pool: it claims tickets,
does the speckit work on them, and releases them at human-review
gates so other workers can pick up the next phase.

A second Claude Code session run from another container can run this
same command and will get its own distinct identity — the two
sessions cooperate via the `Owner` field on the Project, claiming
disjoint tickets.

## Steps

1. **Read the repo from config.** Open
   `.claude/backlog-poll.config.json`, parse out `repo` (e.g.
   `"DeepBlueCLtd/backlog-navigator"`), and derive a short repo tag:

   ```sh
   repo_full=$(jq -r '.repo' .claude/backlog-poll.config.json)
   repo_name=$(echo "$repo_full" | cut -d/ -f2)
   if [[ "$repo_name" == *-* ]]; then
     # Hyphenated: take initials of each part.
     # e.g. "backlog-navigator" -> "bn"
     repo_tag=$(echo "$repo_name" | tr '-' '\n' | awk '{printf "%s", substr($0,1,1)}')
   else
     # Single word: take first three chars.
     repo_tag=${repo_name:0:3}
   fi
   ```

2. **Generate a petname** with the repo tag prefix. Use this exact
   bash incantation in a subprocess (do not substitute):

   ```sh
   adjs=(swift happy clever quiet bold calm bright nimble eager loyal sharp keen fierce gentle daring)
   nouns=(otter mango cedar river hawk reef pine raven sage finch heron kite ember birch quartz)
   worker_id="${repo_tag}-${adjs[$((RANDOM % ${#adjs[@]}))]}-${nouns[$((RANDOM % ${#nouns[@]}))]}-$$"
   echo "$worker_id"
   ```

   For `backlog-navigator` you'd get e.g. `bn-swift-mango-7234`. The
   repo tag makes it obvious which Project's `Owner` field this
   worker is writing to when you're running workers across multiple
   repos. The `$$` suffix is the parent shell's PID — it makes
   accidental collisions effectively impossible in the same
   container.

3. **Write it to `/tmp/backlog-poll-worker-id`**, single line, no
   trailing whitespace. Overwrite any prior content — each
   `/backlog-worker-start` invocation establishes a fresh identity.

4. **Echo it in chat** so the maintainer sees which worker they just
   launched:

   > Worker **`<worker_id>`** ready. Polling the backlog every 15
   > minutes; claimed tickets will appear under this name in the
   > Project's `Owner` field.

5. **Start the loop**: invoke `/loop 15m /backlog-poll`. Each tick
   reads `/tmp/backlog-poll-worker-id` and uses that as the worker
   identity when claiming or skipping items.

## Notes

- The worker-id file lives in `/tmp`, intentionally outside the
  project tree. It's not committed and not referenced from any
  config file. Container restart clears it; the next worker session
  generates a new identity, which is what we want — abandoned
  ownerships become stale.
- If you want to poll once without entering the loop (e.g. to
  smoke-test the setup), run `/backlog-poll` after this skill has
  set up the identity.
- Stale `Owner` field cleanup is manual for now: if a worker dies
  mid-task and you want another worker to pick it up, clear the
  `Owner` field on that ticket in the Project UI.
