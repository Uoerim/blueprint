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
  tasks: [
    {
      title: "Record the demo video",
      description: "60 seconds, phone only, show tilt and the arpeggiator.",
      priority: "HIGH",
      tags: ["feature"],
      subtasks: ["Write the shot list", "Film", "Edit and add captions"],
    },
    {
      title: "Set up the TestFlight build",
      priority: "MEDIUM",
      tags: [],
      subtasks: [{ title: "Archive the release build", description: "Use the beta signing profile." }, "Invite the first 10 testers"],
    },
  ],
};

/** Where the person's own description goes when they haven't written one here. */
export const PROMPT_PLACEHOLDER = "<describe your project here: what it is, who it's for, what done looks like, any deadline>";

/**
 * The prompt to give an AI: the format, the limits, this team's tags (so it
 * only uses real ones) and, if given, the person's description of the project.
 */
export function importPrompt(teamTags: string[], about = ""): string {
  const tagRule = teamTags.length
    ? `Each task's "tags" may only use these names (without #): ${teamTags.join(", ")}. Use an empty list when none fit.`
    : `Leave every task's "tags" list empty.`;
  return [
    "You are helping me plan a project in Blueprint, a team task app.",
    "Turn the project I describe at the end into a plan: a project with tasks, and subtasks where they help.",
    "",
    "Reply with JSON only (no explanation, no code fences), in exactly this shape:",
    "",
    JSON.stringify(IMPORT_EXAMPLE, null, 2),
    "",
    "Format rules:",
    `- "title" is required for the project and for every task, up to ${LIMITS.title} characters.`,
    `- "description" is optional, up to ${LIMITS.description} characters. A task may also have "notes", up to ${LIMITS.notes}.`,
    `- At most ${LIMITS.importTasks} tasks, each with at most ${LIMITS.importSubtasks} subtasks.`,
    '- A subtask is a short string, or an object with "title" and an optional "description".',
    '- "priority" is "LOW", "MEDIUM" or "HIGH".',
    `- ${tagRule} Tags go on tasks only, never on the project.`,
    "- Keep the whole reply under 25,000 characters.",
    "",
    "Planning guidance:",
    "- Start every task title with a verb, and make each task something one person can finish in a day or two.",
    "- Put the tasks in the order they should happen.",
    "- Mark only the few tasks that block everything else as HIGH.",
    "- Use subtasks for checklists inside a task, not for separate pieces of work.",
    "- If something about the project is unclear, make a sensible assumption and put it in the project description.",
    "",
    "My project:",
    about.trim() || PROMPT_PLACEHOLDER,
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
