export const quizEvents = ["tool_start", "tool_step", "tool_abandon", "tool_complete", "tool_consultation"] as const;
export type QuizEvent = typeof quizEvents[number];
export const quizAnalyticsSteps = ["processes", "employees", "frequency", "duration", "schedule", "actual_shifts", "shift_hours", "pay", "obstacle", "issue_frequency", "consequence", "result"] as const;
export type QuizAnalyticsStep = typeof quizAnalyticsSteps[number];
/** Runtime allowlists: never answer IDs, group/task counts, salaries or arbitrary strings. */
export function quizAnalyticsPayload(event: unknown, tool: unknown, step: unknown, consent: unknown) {
  if (consent !== "granted" || !quizEvents.includes(event as QuizEvent) || !["labor", "automation"].includes(String(tool)) || !quizAnalyticsSteps.includes(step as QuizAnalyticsStep)) return null;
  return { event: event as QuizEvent, params: { location: "tools" as const, tool: tool as "labor" | "automation", step: step as QuizAnalyticsStep } };
}
