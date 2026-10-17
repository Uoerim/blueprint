import { LIMITS } from "./constants";

/*
 * "Import with AI": people describe an idea to any AI assistant, paste the
 * JSON it writes back into the idea vault, and get the idea with its tasks and
 * subtasks in one go, ready to promote to a project. Blueprint never sends anything to an AI itself; the
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
export const PROMPT_PLACEHOLDER = "<describe your idea here: what it is, who it's for, what done looks like, any deadline>";

/**
 * The prompt to give an AI: the format, the limits, this team's tags (so it
 * only uses real ones) and, if given, the person's description of the project.
 */
export function importPrompt(teamTags: string[], about = ""): string {
  const tagRule = teamTags.length
    ? `Each task's "tags" may only use these names (without #): ${teamTags.join(", ")}. Use an empty list when none fit.`
    : `Leave every task's "tags" list empty.`;
  return [
    "You are helping me plan an idea in Blueprint, a team app where ideas become projects with tasks.",
    "Turn the idea I describe at the end into a plan: a title, a short description, the tasks to build it, and subtasks where they help.",
    "",
    "Reply with JSON only (no explanation, no code fences), in exactly this shape:",
    "",
    JSON.stringify(IMPORT_EXAMPLE, null, 2),
    "",
    "Format rules:",
    `- "title" is required for the idea and for every task, up to ${LIMITS.title} characters.`,
    `- "description" is optional, up to ${LIMITS.description} characters. A task may also have "notes", up to ${LIMITS.notes}.`,
    `- At most ${LIMITS.importTasks} tasks, each with at most ${LIMITS.importSubtasks} subtasks.`,
    '- A subtask is a short string, or an object with "title" and an optional "description".',
    '- "priority" is "LOW", "MEDIUM" or "HIGH".',
    `- ${tagRule} Tags go on tasks only, never on the idea itself.`,
    "- Strictly valid JSON: double quotes only, no comments, no trailing commas, and write every backslash as \\\\ (for example inside regular expressions).",
    "- Keep the whole reply under 25,000 characters.",
    "",
    "Planning guidance:",
    "- Start every task title with a verb, and make each task something one person can finish in a day or two.",
    "- Put the tasks in the order they should happen.",
    "- Mark only the few tasks that block everything else as HIGH.",
    "- Use subtasks for checklists inside a task, not for separate pieces of work.",
    "- If something about the idea is unclear, make a sensible assumption and put it in the description.",
    "",
    "My idea:",
    about.trim() || PROMPT_PLACEHOLDER,
  ].join("\n");
}

const ESCAPES = new Set(['"', "\\", "/", "b", "f", "n", "r", "t"]);
const CONTROL: Record<string, string> = { "\n": "\\n", "\r": "\\r", "\t": "\\t" };

/**
 * Fixes the small JSON slips AI assistants often make, without touching
 * anything that's already valid: a lone backslash in text (like \d in a regular
 * expression), raw line breaks inside text, “curly” quotes around keys and
 * values, comments, and trailing commas. Plain text processing only; the
 * result still has to pass JSON.parse and the plan's own validation.
 */
export function repairJson(text: string): string {
  let out = "";
  let inString = false;
  let closer = '"';
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inString) {
      if (c === "\\") {
        const next = text[i + 1] ?? "";
        if (ESCAPES.has(next)) {
          out += c + next;
          i++;
        } else if (next === "u" && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
          out += text.slice(i, i + 6);
          i += 5;
        } else out += "\\\\"; // a lone backslash: keep it as a real backslash
      } else if (c === closer || (closer === '"' && c === '"')) {
        out += '"';
        inString = false;
      } else if (c === '"') out += '\\"'; // a straight quote inside a “curly-quoted” value
      else out += CONTROL[c] ?? c;
      continue;
    }
    if (c === '"' || c === "\u201C" || c === "\u201D") {
      inString = true;
      closer = c === '"' ? '"' : "\u201D";
      out += '"';
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 1;
    } else if (c === ",") {
      // Drop a comma that only comes before a closing bracket.
      let j = i + 1;
      while (/\s/.test(text[j] ?? "")) j++;
      if (text[j] !== "}" && text[j] !== "]") out += c;
    } else out += c;
  }
  return out;
}

export type ParsedReply = { ok: true; data: unknown; repaired: boolean } | { ok: false; message: string };

/**
 * Reads an AI's reply as JSON: the JSON itself, or the JSON inside a code
 * fence or a sentence, with small slips repaired. When it still can't be read,
 * says where (line and a few words around the spot) so it's easy to fix.
 */
export function parseReply(raw: string): ParsedReply {
  const text = extractJson(raw);
  try {
    return { ok: true, data: JSON.parse(text), repaired: false };
  } catch (first) {
    try {
      return { ok: true, data: JSON.parse(repairJson(text)), repaired: true };
    } catch {
      const pos = Number(/position (\d+)/.exec(String((first as Error).message))?.[1]);
      if (!Number.isFinite(pos)) return { ok: false, message: "That isn't valid JSON yet. Paste the AI's whole reply; code fences are fine." };
      const line = text.slice(0, pos).split("\n").length;
      const near = text.slice(Math.max(0, pos - 24), pos + 24).replace(/\s+/g, " ").trim();
      return { ok: false, message: `That isn't valid JSON yet: something's off on line ${line}, near “${near}”. Ask the AI to fix it, or correct it here.` };
    }
  }
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
