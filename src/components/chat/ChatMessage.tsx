import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

const normalizeAssistantContent = (input: string) => {
  if (!input) return "";

  // već ima markdown → ne diraj
  if (
    /^#{1,4}\s/m.test(input) ||
    /^>\s/m.test(input) ||
    /```[\s\S]*?```/.test(input)
  ) {
    return input;
  }

  let text = input;

  // 🔥 1. ubaci nove redove prije ključnih riječi
  text = text
    .replace(/(Napomena:)/gi, "\n\n$1")
    .replace(/(Savjet:)/gi, "\n\n$1")
    .replace(/(Gotovo:)/gi, "\n\n$1")
    .replace(/(\d+\.)/g, "\n\n$1");

  const lines = text.split("\n");
  const out: string[] = [];
  let first = false;
  let inCode = false;

  for (let raw of lines) {
    const line = raw.trim();

    if (!line) {
      out.push("");
      continue;
    }

    // naslov
    if (!first) {
      out.push(`# ${line}`);
      first = true;
      continue;
    }

    // koraci
    if (/^\d+\./.test(line)) {
      out.push(`## ${line}`);
      continue;
    }

    // callout
    if (/^(Napomena|Savjet|Gotovo|Bitno|Upozorenje):/i.test(line)) {
      out.push(`> ${line}`);
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
};