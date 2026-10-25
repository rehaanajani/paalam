import { Fragment, type ReactNode } from "react";

/** Just enough formatting for model replies: paragraphs, "- " bullets and **bold**. No HTML is ever injected. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>));
}

export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length)
      blocks.push(
        <ul key={`l${blocks.length}`}>
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line) ?? /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet) list.push(bullet[1]!);
    else {
      flush();
      if (line) blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>);
    }
  }
  flush();
  return <div className="rich">{blocks}</div>;
}
