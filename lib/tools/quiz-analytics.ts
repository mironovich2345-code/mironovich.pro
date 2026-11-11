import { track } from "../analytics";
import { readConsent } from "../consent";
import { quizAnalyticsPayload, type QuizEvent, type QuizAnalyticsStep } from "./quiz-analytics-policy";
export function trackQuiz(event: QuizEvent, mode: "labor-cost" | "automation-cost", step: QuizAnalyticsStep) {
  if (typeof window === "undefined") return;
  const safe = quizAnalyticsPayload(event, mode === "labor-cost" ? "labor" : "automation", step, readConsent());
  if (safe) track(safe.event, safe.params);
}
