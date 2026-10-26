/** JSON schemas handed to Gemini (responseJsonSchema). The API enforces shape, not truth. */

const str = (description?: string) => ({ type: "string", ...(description ? { description } : {}) });
const strs = (description?: string) => ({ type: "array", items: { type: "string" }, ...(description ? { description } : {}) });

export const splitSchema = {
  type: "object",
  properties: {
    headline: str("One line: what is going on, in plain English"),
    language: str("Main language the person used, e.g. Tamil, English, Tanglish"),
    locationHint: str("Best location clue in the input, verbatim, or empty"),
    fragments: {
      type: "array",
      description: "One per distinct problem. Merge duplicates about the same problem.",
      items: {
        type: "object",
        properties: {
          gemId: str("id of the Gem that should handle this, or 'new' if none fits"),
          title: str("Short title, e.g. 'Family stranded by flood water'"),
          summary: str("What this part of the input says, 1-3 sentences"),
          evidence: strs("Evidence ids this fragment uses, e.g. E1"),
          urgency: { type: "string", enum: ["critical", "high", "medium", "low"] },
        },
        required: ["gemId", "title", "summary", "evidence", "urgency"],
      },
    },
    reply: str("Only when there is NO real-world problem to act on (a greeting, small talk, a general question, a question about Paalam): your direct answer to the person, friendly and under 80 words, in their language. Return no fragments then. Leave empty otherwise."),
    harnessNote: str("Optional: one rule (≤25 words) worth adding to your playbook for future runs. Leave empty if none."),
    newGem: {
      type: "object",
      description: "Only if a fragment has gemId 'new': the specialist Gem to create for it",
      properties: {
        id: str("short lowercase id"),
        name: str(),
        purpose: str("one line: what kinds of input it handles"),
        instructions: str("what it extracts, which tools it uses and which actions it proposes"),
        tools: strs("tool ids it needs, from the list given"),
      },
      required: ["id", "name", "purpose", "instructions", "tools"],
    },
  },
  required: ["headline", "language", "locationHint", "fragments"],
};

const factItem = {
  type: "object",
  properties: {
    field: str("e.g. Location, People, Water level, Medicine"),
    value: str(),
    status: { type: "string", enum: ["reported", "inferred", "unknown"] },
    sources: strs("evidence ids (E1) and/or tool call ids (T1) that support it"),
    verification: { type: "string", enum: ["verified", "unverified", "conflict"] },
    note: str("why it is verified / unverified / in conflict"),
  },
  required: ["field", "value", "status", "sources", "verification"],
};

export const planSchema = {
  type: "object",
  properties: {
    toolCalls: {
      type: "array",
      description: "Up to 8 calls to your tools that would verify facts or find help",
      items: {
        type: "object",
        properties: {
          tool: str(),
          argsJson: str("arguments as a JSON object string"),
          why: str("a few words"),
        },
        required: ["tool", "argsJson", "why"],
      },
    },
  },
  required: ["toolCalls"],
};

export const actSchema = {
  type: "object",
  properties: {
    mode: {
      type: "string",
      enum: ["answer", "plan", "actions"],
      description:
        "answer = just talk (advice, explanations, questions back); plan = a structured plan the person follows (diet, workout, study, recovery, steps), optionally with follow-ups; actions = real-world steps someone must approve (calls, messages, rescue, forms). Pick what the situation needs, not the most elaborate.",
    },
    reply: str("answer/plan: your reply to the person in their language, plain text, short paragraphs or '- ' bullets, under 180 words. actions: leave empty."),
    planTitle: str("plan mode: the plan's title, e.g. 'Hostel bulk: 2,800 kcal a day'. Empty otherwise."),
    planSections: {
      type: "array",
      description: "plan mode: REQUIRED, the plan itself, 2-6 sections (e.g. Breakfast 7:30, Lunch, Pre-workout, Dinner, Rules), each with short concrete items. Empty otherwise. Don't repeat the plan in reply.",
      items: { type: "object", properties: { heading: str(), items: strs() }, required: ["heading", "items"] },
    },
    followUps: {
      type: "array",
      description: "Reminders that genuinely help (a daily 6:00 meal reminder, a check-in in 4 hours). Max 4. Empty if none are useful.",
      items: {
        type: "object",
        properties: {
          title: str("short, e.g. 'Breakfast: 4 eggs + oats'"),
          message: str("the notification text, one or two sentences"),
          daily: str("HH:MM 24-hour local time if it repeats daily, else empty"),
          inMinutes: { type: "integer", description: "for a one-off: minutes from now; 0 if daily" },
        },
        required: ["title", "message"],
      },
    },
    summary: str("2 sentences for the person: what you found and what to do first"),
    facts: { type: "array", items: factItem },
    location: {
      type: "object",
      properties: { lat: { type: "number" }, lng: { type: "number" }, label: str() },
    },
    harnessNote: str("Optional: one rule (≤25 words) worth adding to your playbook for future runs. Leave empty if none."),
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["navigate", "call", "sms", "share", "alert", "readback", "request", "warn", "browser_fill", "poster"] },
          title: str("Imperative, e.g. 'Send rescue request to 1070'"),
          detail: str("Why, in one or two sentences"),
          effect: str("Exactly what happens if approved"),
          payloadJson: str("JSON object string: navigate {lat,lng,label}; call {number,script}; sms {to,body}; share {text}; alert {to,body}; request {to,body}; readback {text,lang}; warn {text}; browser_fill {url, steps:[{field, value}]} using field labels the browse tool reported (never passwords/OTP/card/PIN; it stops before submit); poster {headline, lines:[string], lang, style} for a shareable warning or instruction image"),
          evidence: strs("evidence and tool ids backing this action"),
          unresolved: strs("what is still unknown that a human should check"),
          priority: { type: "integer" },
        },
        required: ["kind", "title", "detail", "effect", "payloadJson", "evidence", "unresolved", "priority"],
      },
    },
  },
  required: ["mode", "summary", "facts", "actions"],
};

export const gemDraftSchema = splitSchema.properties.newGem;

/** A starting set of Gems for a new mission: one line per specialist. */
export const missionGemsSchema = {
  type: "object",
  properties: {
    gems: { type: "array", items: str("one specialist Gem: what messy input it takes and what verified actions it produces, ≤ 40 words"), maxItems: 4 },
  },
  required: ["gems"],
};
