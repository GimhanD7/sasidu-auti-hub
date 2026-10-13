export function jobTiming(job, endTime) {
  const startedAt = job.startedAt || job.technicianAcceptedAt || null;
  const completedAt = endTime || job.completedAt || job.finalReport?.completedAt || (job.timeline || []).findLast(event => event.status === 'Ready')?.timestamp || null;
  const elapsed = startedAt && completedAt ? new Date(completedAt) - new Date(startedAt) : null;
  return { startedAt, completedAt, durationHours: elapsed !== null && Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed / 3600000 * 1000000) / 1000000 : null };
}
