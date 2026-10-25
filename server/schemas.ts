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
  required: ["summary", "facts", "actions"],
};

export const gemDraftSchema = splitSchema.properties.newGem;
