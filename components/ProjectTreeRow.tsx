"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { RecentProject } from "@/lib/project-groups";
import { useI18n } from "@/hooks/useI18n";
import { SESSION_LIST_ITEM_HEIGHT, displayCwd, PathLabel } from "./SessionSidebar";

/**
 * Compact per-project activity badges for the project tree headers:
 * a spinning running icon + count and an unread dot + count. Renders
 * nothing when the project has no activity. Counts share the accent /
 * unread colors of the per-session indicators so the two stay visually
 * consistent.
 */
export function showProjectActivity(
  activity: { running: number; unread: number } | undefined,
  t: (key: string) => string,
): ReactNode {
  if (!activity || (activity.running === 0 && activity.unread === 0)) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, marginLeft: 6 }}>
      {activity.running > 0 && (
        <span
          title={t("sidebar.agentRunning")}
          aria-label={`${t("sidebar.agentRunning")} (${activity.running})`}
          style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--accent)", fontSize: 10, fontFamily: "var(--font-mono)" }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: "block" }}>
            <g>
              <path d="M21 12a9 9 0 1 1-3.8-7.4" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite" />
            </g>
          </svg>
          {activity.running}
        </span>
      )}
      {activity.unread > 0 && (
        <span
          title={t("sidebar.newSessionActivity")}
          aria-label={`${t("sidebar.newSessionActivity")} (${activity.unread})`}
          style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#0891b2", fontSize: 10, fontFamily: "var(--font-mono)" }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
          {activity.unread}
        </span>
      )}
    </span>
  );
}

/**
 * Project header row in the sidebar tree. Exactly one session-list item
 * tall (the list virtualizes on uniform row height). Clicking toggles
 * expand/collapse — it does NOT switch the active cwd; only selecting a
 * session does that.
 */
export function ProjectTreeRow({
  project,
  expanded,
  isActive,
  sessionCount,
  activity,
  homeDir,
  onToggle,
  onNewSession,
}: {
  project: RecentProject;
  expanded: boolean;
  isActive: boolean;
  sessionCount: number;
  activity: { running: number; unread: number } | undefined;
  homeDir: string;
  onToggle: () => void;
  onNewSession: () => void;
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);

  const label = displayCwd(project.root, homeDir);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      title={project.root}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: SESSION_LIST_ITEM_HEIGHT,
        display: "flex",
        alignItems: "center",
        gap: 6,
        paddingLeft: 14,
        paddingRight: 8,
        cursor: "pointer",
        background: isActive ? "var(--bg-selected)" : hovered ? "var(--bg-hover)" : "transparent",
        borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
        transition: "background 0.1s",
        overflow: "hidden",
      }}
    >
      <span style={{ flexShrink: 0, display: "inline-flex", color: "var(--text-dim)" }}>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
          aria-hidden="true"
        >
          <polyline points="3 2 7 5 3 8" />
        </svg>
      </span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke={isActive ? "var(--accent)" : "var(--text-dim)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
        aria-hidden="true"
      >
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      </svg>
      <PathLabel
        text={label}
        style={{
          flex: 1,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 500,
          color: isActive ? "var(--text)" : "var(--text-muted)",
        }}
      />
      <span
        title={t("sidebar.sessionCount", { count: sessionCount })}
        aria-label={t("sidebar.sessionCount", { count: sessionCount })}
        style={{ flexShrink: 0, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}
      >
        {sessionCount}
      </span>
      {showProjectActivity(activity, t)}
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNewSession();
          }}
          title={t("sidebar.newSessionInProject", { path: label })}
          aria-label={t("sidebar.newSessionInProject", { path: label })}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, padding: 0, marginLeft: 2,
            background: "var(--bg-hover)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-muted)",
            cursor: "pointer",
            flexShrink: 0,
            transition: "background 0.12s, color 0.12s, border-color 0.12s",
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            e.currentTarget.style.background = "var(--bg-selected)";
            e.currentTarget.style.color = "var(--accent)";
            e.currentTarget.style.borderColor = "rgba(37,99,235,0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-hover)";
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <line x1="6" y1="1" x2="6" y2="11" />
            <line x1="1" y1="6" x2="11" y2="6" />
          </svg>
        </button>
      )}
    </div>
  );
}
