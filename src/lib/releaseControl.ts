export type ReleaseLifecycleStatus =
  | "draft"
  | "awaiting_approvals"
  | "approved"
  | "merging"
  | "merged"
  | "monitoring"
  | "completed"
  | "alerted"
  | "failed"
  | "cancelled"
  | "ready"
  | "in_progress"
  | "shipped"
  | "blocked";

export const releaseLifecycleStatuses: ReleaseLifecycleStatus[] = [
  "draft",
  "awaiting_approvals",
  "approved",
  "merging",
  "merged",
  "monitoring",
  "completed",
  "alerted",
  "failed",
  "cancelled",
  "ready",
  "in_progress",
  "shipped",
  "blocked",
];

export function isReleaseLifecycleStatus(
  value: string,
): value is ReleaseLifecycleStatus {
  return releaseLifecycleStatuses.includes(value as ReleaseLifecycleStatus);
}

export function toSlackMessageText(input: {
  releaseName: string;
  projectName: string;
  targetEnvironment: string | null;
  prCount: number;
}) {
  const environment = input.targetEnvironment
    ? ` for ${input.targetEnvironment}`
    : "";

  return [
    `Release approval requested: ${input.releaseName}`,
    `Project: ${input.projectName}`,
    `Pull requests: ${input.prCount}`,
    `Target${environment}: ${input.targetEnvironment ?? "unspecified"}`,
  ].join("\n");
}

export function parseGrafanaValue(payload: unknown): number | null {
  if (typeof payload === "number" && Number.isFinite(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (typeof record.value === "number" && Number.isFinite(record.value)) {
      return record.value;
    }

    if (typeof record.value === "string") {
      const parsed = Number(record.value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const nestedValue = record.data;
    if (nestedValue) {
      const nested = parseGrafanaValue(nestedValue);
      if (nested !== null) {
        return nested;
      }
    }

    const result = record.result;
    if (Array.isArray(result) && result.length > 0) {
      const first = result[0];
      if (first && typeof first === "object") {
        const firstRecord = first as Record<string, unknown>;
        const value = firstRecord.value;
        if (Array.isArray(value) && typeof value[1] === "string") {
          const parsed = Number(value[1]);
          return Number.isFinite(parsed) ? parsed : null;
        }
      }
    }
  }

  return null;
}
