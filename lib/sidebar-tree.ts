import type { SessionInfo } from "./types";
import { sessionsForProject, type RecentProject } from "./project-groups";
import { listSessionFamilies, type SessionFamily } from "./session-family";

/** A project header row in the sidebar tree. */
export interface SidebarProjectRow {
  kind: "project";
  /** Stable row key for React (prefix keeps it distinct from session rows). */
  key: string;
  project: RecentProject;
  /** Whether this project's session rows are shown below the header. */
  expanded: boolean;
  /** True when this is the project of the active cwd. */
  isActive: boolean;
  /** Number of session rows under this project. */
  sessionCount: number;
}

/** A session (family) row under an expanded project. */
export interface SidebarSessionRow {
  kind: "session";
  key: string;
  family: SessionFamily;
  /** [root, ...subagents] — drives selected/running/unread aggregation. */
  familySessions: SessionInfo[];
  /** Family root with the family's latest modified time (display only). */
  displaySession: SessionInfo;
}

/** Placeholder row: an expanded project with no sessions. */
export interface SidebarEmptyRow {
  kind: "empty";
  key: string;
}

export type SidebarTreeRow = SidebarProjectRow | SidebarSessionRow | SidebarEmptyRow;

/**
 * Flattens the project list into a single uniform row list for the
 * windowed sidebar: one header row per project, then its session rows
 * when expanded. Every row is exactly one session-list item tall, so
 * the list's existing virtualization math works unchanged.
 *
 * Family grouping runs for every project (headers show a session count
 * even while collapsed); the row emission below is the only thing the
 * expanded state controls.
 */
export function buildSidebarTreeRows(
  projects: readonly RecentProject[],
  expanded: ReadonlySet<string>,
  sessions: readonly SessionInfo[],
  activeProjectKey: string | null,
): SidebarTreeRow[] {
  const rows: SidebarTreeRow[] = [];
  for (const project of projects) {
    const isOpen = expanded.has(project.key);
    const families = listSessionFamilies(sessionsForProject(sessions, project.key));
    rows.push({
      kind: "project",
      key: `p:${project.key}`,
      project,
      expanded: isOpen,
      isActive: project.key === activeProjectKey,
      sessionCount: families.length,
    });
    if (!isOpen) continue;
    if (families.length === 0) {
      rows.push({ kind: "empty", key: `e:${project.key}` });
    }
    for (const family of families) {
      const familySessions = [family.root, ...family.subagents];
      rows.push({
        kind: "session",
        key: `s:${family.root.id}`,
        family,
        familySessions,
        displaySession: family.latestModified === family.root.modified
          ? family.root
          : { ...family.root, modified: family.latestModified },
      });
    }
  }
  return rows;
}
