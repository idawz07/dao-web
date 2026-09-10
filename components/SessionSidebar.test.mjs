import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const { getSessionListIndices } = await jiti.import("./SessionSidebar.tsx");
const { buildSidebarTreeRows } = await jiti.import("../lib/sidebar-tree.ts");

const source = await readFile(new URL("./SessionSidebar.tsx", import.meta.url), "utf8");
const sidebarTreeSource = await readFile(new URL("../lib/sidebar-tree.ts", import.meta.url), "utf8");
const projectTreeRowSource = await readFile(new URL("./ProjectTreeRow.tsx", import.meta.url), "utf8");
const sessionItemSource = source.slice(source.indexOf("function SessionItem("));

test("scrolling keeps the focused session and the viewport mounted without expanding the whole window", () => {
  for (const [scrollTop, focusedIndex] of [[0, 1999], [10000, 0]]) {
    const indices = getSessionListIndices(2000, scrollTop, 335, focusedIndex);
    const firstVisible = Math.floor(scrollTop / 54);
    const lastVisible = Math.ceil((scrollTop + 335) / 54) - 1;
    for (let index = firstVisible; index <= lastVisible; index++) assert.ok(indices.includes(index));
    assert.ok(indices.includes(focusedIndex));
    assert.equal(indices.length, 24);
    assert.equal(new Set(indices).size, indices.length);
    assert.deepEqual(indices, [...indices].sort((a, b) => a - b));
  }
  assert.equal(getSessionListIndices(2000, 0, 335, 3).length, 23);
  const blurred = getSessionListIndices(2000, 10000, 335);
  assert.equal(blurred.length, 23);
  assert.ok(!blurred.includes(0));
});

test("session windows stay valid after a project shrinks and before the viewport is measured", () => {
  assert.deepEqual(getSessionListIndices(5, 80000, 335, 1999), [0, 1, 2, 3, 4]);
  assert.deepEqual(getSessionListIndices(0, 80000, 335, 1999), []);
  assert.equal(getSessionListIndices(2000, 0, 0).length, 28);
});

test("only Shift+click bypasses session deletion confirmation", () => {
  assert.match(
    sessionItemSource,
    /const handleDeleteClick[\s\S]*?if \(e\.shiftKey\) \{\s*void performDelete\(\);\s*\} else \{\s*setConfirmDelete\(true\);/,
  );
});

test("does not register row-level session deletion shortcuts", () => {
  assert.doesNotMatch(sessionItemSource, /const handleKeyDown/);
  assert.doesNotMatch(sessionItemSource, /onKeyDown=\{handleKeyDown\}/);
  assert.doesNotMatch(sessionItemSource, /tabIndex=\{0\}/);
});

test("polls running sessions only while the tab is visible", () => {
  assert.doesNotMatch(source, /new EventSource\("\/api\/agent\/running\/events"\)/);
  assert.match(source, /fetch\("\/api\/agent\/running"/);
  assert.match(source, /document\.visibilityState !== "visible"/);
  assert.match(source, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
});

test("exposes the polled running-session set to the shell", () => {
  assert.match(source, /onRunningSessionIdsChange\?: \(ids: Set<string>\) => void/);
  assert.match(source, /onRunningSessionIdsChange\?\.\(runningSessionIds\)/);
});

test("exposes the loaded session catalog to the shell", () => {
  assert.match(source, /onSessionsChange\?: \(sessions: SessionInfo\[\]\) => void/);
  assert.match(source, /onSessionsChange\?\.\(allSessions\)/);
});

test("subagent completion stays silent and never becomes unread", () => {
  assert.match(source, /completionNotificationSuppressedSessionIds\?: string\[\]/);
  assert.match(
    source,
    /completedWithNotifications = completedInBackground\.filter\([\s\S]*?!previousSuppressedCompletionSessionIdsRef\.current\.has\(id\)[\s\S]*?!knownSubagentIds\.has\(id\)/,
  );
  assert.match(source, /completedWithNotifications\.forEach\(\(id\) => next\.add\(id\)\)/);
  assert.match(source, /if \(completedWithNotifications\.length > 0\) \{\s*onBackgroundTaskDone\?\.\(\)/);
  assert.match(
    source,
    /filter\(\(session\) => session\.relation\?\.kind !== "subagent"\)[\s\S]*?unreadEligibleIds\.has\(id\)/,
  );
});

test("includes project activity counts in accessible labels", () => {
  assert.match(
    projectTreeRowSource,
    /aria-label=\{`\$\{t\("sidebar\.agentRunning"\)\} \(\$\{activity\.running\}\)`\}/,
  );
  assert.match(
    projectTreeRowSource,
    /aria-label=\{`\$\{t\("sidebar\.newSessionActivity"\)\} \(\$\{activity\.unread\}\)`\}/,
  );
});

test("formats session timestamps with the active locale", () => {
  assert.match(source, /import \{ formatRelativeTime \} from "@\/lib\/i18n\/format"/);
  assert.match(sessionItemSource, /const \{ locale, t \} = useI18n\(\)/);
  assert.match(sessionItemSource, /formatRelativeTime\(session\.modified, locale\)/);
});

test("does not persist an unchanged fallback title ending in whitespace", () => {
  assert.match(
    sessionItemSource,
    /const name = renameValue\.trim\(\);[\s\S]*?if \(renameValue === title \|\| name === \(session\.name \?\? ""\)\) return;/,
  );
});

test("offers the downstream context-menu hook only on a normal session row", () => {
  assert.match(sessionItemSource, /const handleContextMenu[\s\S]*?dispatchSessionRowContextMenu\(\{/);
  assert.match(
    sessionItemSource,
    /onContextMenu=\{confirmDelete \|\| renaming \? undefined : handleContextMenu\}/,
  );
});

test("lifecycle refreshes bypass the cache while cross-window polling reuses it", () => {
  assert.match(source, /force \? "\/api\/sessions\?force=1" : "\/api\/sessions"/);
  assert.match(source, /cache: "no-store"/);
  assert.match(source, /loadSessions\(isFirst, !isFirst\)/);
  assert.match(source, /data\.sessionListVersion !== sessionListVersionRef\.current[\s\S]*?await loadSessions\(\)/);
  assert.doesNotMatch(source, /sessionRefreshDone|sessionRefreshTimerRef|title=\{t\("sidebar\.refresh"\)\}/);
  assert.match(source, /loadSessions\(false, true\);[\s\S]*?onBackgroundTaskDone/);
});

test("does not expose disk-backed actions for transient sessions", () => {
  assert.match(sessionItemSource, /if \(session\.transient\) return;/);
  assert.match(sessionItemSource, /\{hovered && !session\.transient && \(/);
});

test("hides subagent rows and aggregates their state into the main session row", () => {
  assert.match(sidebarTreeSource, /listSessionFamilies\(sessionsForProject\(sessions, project\.key\)\)/);
  assert.match(source, /familySessions\.some\(\(session\) => session\.id === selectedSessionId\)/);
  assert.match(source, /familySessions\.some\(\(session\) => runningSessionIds\.has\(session\.id\)\)/);
  assert.doesNotMatch(source, /function SessionTreeItem/);
});

test("row builder flattens projects into uniform header/session rows", () => {
  const session = (id, cwd, modified, extra = {}) => ({
    id,
    cwd,
    modified,
    name: `name-${id}`,
    firstMessage: `first-${id}`,
    ...extra,
  });
  const sessions = [
    session("s1", "/repo/a/src", "2025-01-01T00:00:00Z", { projectKey: "ws-a", projectRoot: "/repo/a" }),
    session("s2", "/repo/a", "2025-01-03T00:00:00Z", { projectKey: "ws-a", projectRoot: "/repo/a" }),
    session("s3", "/repo/b", "2025-01-02T00:00:00Z", { projectKey: "ws-b", projectRoot: "/repo/b" }),
  ];
  const projects = [
    { key: "ws-a", root: "/repo/a" },
    { key: "ws-b", root: "/repo/b" },
  ];

  const collapsed = buildSidebarTreeRows(projects, new Set(), sessions, "ws-a");
  assert.deepEqual(collapsed.map((row) => row.kind), ["project", "project"]);
  assert.equal(collapsed[0].isActive, true);
  assert.equal(collapsed[1].isActive, false);
  // Headers carry the session count even while collapsed.
  assert.equal(collapsed[0].sessionCount, 2);
  assert.equal(collapsed[1].sessionCount, 1);

  const expanded = buildSidebarTreeRows(projects, new Set(["ws-a"]), sessions, "ws-a");
  assert.deepEqual(expanded.map((row) => row.kind), ["project", "session", "session", "project"]);
  assert.equal(expanded[1].family.root.id, "s2");
  assert.equal(expanded[2].family.root.id, "s1");
  assert.equal(expanded[3].expanded, false);

  const emptyProject = buildSidebarTreeRows(
    [{ key: "ws-empty", root: "/repo/empty" }],
    new Set(["ws-empty"]),
    sessions,
    "ws-empty",
  );
  assert.deepEqual(emptyProject.map((row) => row.kind), ["project", "empty"]);
});

test("row builder inherits the family's latest modified time for display", () => {
  const session = (id, modified, extra = {}) => ({
    id,
    cwd: "/repo/a",
    modified,
    name: `name-${id}`,
    firstMessage: `first-${id}`,
    ...extra,
  });
  const sessions = [
    session("main", "2025-01-01T00:00:00Z", { projectKey: "ws-a", projectRoot: "/repo/a" }),
    session("agent", "2025-01-04T00:00:00Z", {
      projectKey: "ws-a",
      projectRoot: "/repo/a",
      relation: { kind: "subagent", parentSessionId: "main" },
    }),
  ];
  const rows = buildSidebarTreeRows(
    [{ key: "ws-a", root: "/repo/a" }],
    new Set(["ws-a"]),
    sessions,
    "ws-a",
  );
  assert.deepEqual(rows.map((row) => row.kind), ["project", "session"]);
  const row = rows[1];
  assert.equal(row.family.root.id, "main");
  assert.equal(row.family.subagents.length, 1);
  assert.equal(row.displaySession.modified, "2025-01-04T00:00:00Z");
  assert.deepEqual(row.familySessions.map((s) => s.id), ["main", "agent"]);
});
