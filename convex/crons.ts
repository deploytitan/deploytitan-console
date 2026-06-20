import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "dispatch pending release notifications",
  { minutes: 5 },
  internal.releaseControl.dispatchPendingNotifications,
  {},
);

crons.interval(
  "poll active release monitoring sessions",
  { minutes: 5 },
  internal.releaseControl.pollActiveMonitoringSessions,
  {},
);

export default crons;
