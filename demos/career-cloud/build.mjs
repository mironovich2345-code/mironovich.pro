import { writeFileSync } from "node:fs";
import { careerQuestions, careerTasks, generateSyntheticAnalysis, syntheticAnswers } from "../../lib/career-diagnostic.ts";

const data = {
  questions: careerQuestions.map(([key, label, values]) => ({ key, label, values: [...values] })),
  tasks: careerTasks.map(({ id, title, steps }) => ({ id, title, steps })),
  plans: Object.fromEntries(careerTasks.map((task) => {
    const answers = syntheticAnswers();
    answers.tasks = [task.id];
    return [task.id, generateSyntheticAnalysis(answers).plan];
  })),
  directions: generateSyntheticAnalysis(syntheticAnswers()).directions,
  demo: true,
};
if (data.questions.length !== 18 || data.tasks.length !== 5 ||
    Object.values(data.plans).some((plan) => plan.length !== 30 ||
      plan.some((item,i) => item.day !== i + 1))) {
  throw new Error("Career demo must match the validated 18-question / 30-step product");
}
writeFileSync(new URL("./data.json",import.meta.url),JSON.stringify(data));
console.log("Cloud demo assets generated from the current validated career-diagnostic source");
