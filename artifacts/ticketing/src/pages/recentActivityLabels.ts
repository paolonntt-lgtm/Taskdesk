export function formatRecentActivitySummary(actionType: string, actorName: string | null, t: any): string {
  const labels: Record<string, string> = {
    created: t.dashboard.activityCreated,
    assigned: t.dashboard.activityAssigned,
    unassigned: t.dashboard.activityUnassigned,
    status_changed: t.dashboard.activityStatusChanged,
    priority_changed: t.dashboard.activityPriorityChanged,
    category_changed: t.dashboard.activityCategoryChanged,
    location_changed: t.dashboard.activityLocationChanged,
    comment_added: t.dashboard.activityCommentAdded,
    comment_edited: t.dashboard.activityCommentEdited,
    comment_deleted: t.dashboard.activityCommentDeleted,
    email_reply_sent: t.dashboard.activityEmailReplySent,
    note_added: t.dashboard.activityNoteAdded,
    checklist_item_updated: t.dashboard.activityChecklistUpdated,
    checklist_applied_from_template: t.dashboard.activityChecklistUpdated,
    solution_marked: t.dashboard.activitySolutionMarked,
    visibility_changed: t.dashboard.activityVisibilityChanged,
    recurrence_created: t.dashboard.activityRecurrenceUpdated,
    recurrence_set: t.dashboard.activityRecurrenceUpdated,
    recurrence_removed: t.dashboard.activityRecurrenceUpdated,
    cloned_from: t.dashboard.activityCloned,
    ticket_restored: t.dashboard.activityRestored,
    worked_hours_changed: t.dashboard.activityWorkedHoursChanged,
  };
  const activityLabel = labels[actionType] ?? t.dashboard.activityUpdated;
  const authorLabel = actorName
    ? t.dashboard.activityBy(actorName)
    : t.dashboard.activityUnknownAuthor;
  return `${activityLabel} · ${authorLabel}`;
}
