import { LIMITS } from "./constants";

/*
 * "Import from JSON": people describe a project to any AI assistant, paste the
 * JSON it writes back into Blueprint, and get a project with its tasks and
 * subtasks in one go. Blueprint never sends anything to an AI itself; the
 * prompt below is copied by the person and used wherever they like.
 */

/** A small, complete example of the format. */
export const IMPORT_EXAMPLE = {
  title: "Launch the pocket synth beta",
  description: "Ship a TestFlight beta to 50 friends and collect feedback.",
  tags: ["feature"],
  tasks: [
    {
      title: "Record the demo video",
      description: "60 seconds, phone only, show tilt and the arpeggiator.",
      priority: "HIGH",
      tags: [],
      subtasks: ["Write the shot list", "Film", "Edit and add captions"],
    },
    {
      title: "Set up the TestFlight build",
      priority: "MEDIUM",
      subtasks: [{ title: "Archive the release build", description: "Use the beta signing profile." }, "Invite the first 10 testers"],
    },
  ],
};

/** The prompt to give an AI, with this team's tags so it only uses real ones. */
export function importPrompt(teamTags: string[]): string {
  const tagRule = teamTags.length
    ? `"tags" may only use these names (without #): ${teamTags.join(", ")}. Leave it empty if none fit.`
    : `Leave every "tags" list empty.`;
  return [
    "Turn the project I describe at the end into a plan for the Blueprint app.",
    "Reply with JSON only (no explanation, no code fences), in exactly this shape:",
    "",
    JSON.stringify(IMPORT_EXAMPLE, null, 2),
    "",
    "Rules:",
    `- "title" is required for the project and for every task, up to ${LIMITS.title} characters.`,
    `- "description" (optional) up to ${LIMITS.description} characters; a task's "notes" (optional) up to ${LIMITS.notes}.`,
    `- At most ${LIMITS.importTasks} tasks, each with at most ${LIMITS.importSubtasks} subtasks.`,
    '- A subtask is a short string, or an object with "title" and an optional "description".',
    '- "priority" is "LOW", "MEDIUM" or "HIGH".',
    `- ${tagRule}`,
    "- Keep the whole reply under 25,000 characters.",
    "",
    "My project:",
    "<describe your project here>",
  ].join("\n");
}

/** Pulls the JSON out of a reply even if the AI wrapped it in a code fence or a sentence. */
export function extractJson(raw: string): string {
  const text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1]!.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}
