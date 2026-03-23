import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

const normalizeAssistantContent = (input: string) => {
  if (!input) return "";

  // Ako već ima markdown → ne diraj
  if (
    /^#{1,4}\s/m.test(input) ||
    /^>\s/m.test(input) ||
    /```[\s\S]*?```/.test(input)
  ) {
    return input;
  }

  const lines = input.split("\n");
  const out: string[] = [];
  let first = false;
  let inCode = false;

  for (let raw of lines) {
    const line = raw.trim();

    if (raw.trimStart().startsWith("```")) {
      inCode = !inCode;
      out.push(raw);
      continue;
    }

    if (inCode) {
      out.push(raw);
      continue;
    }

    if (!line) {
      out.push("");
      continue;
    }

    // prvi red = naslov
    if (!first) {
      out.push(`# ${line}`);
      first = true;
      continue;
    }

    // koraci
    if (/^\d+[\.\)]\s+/.test(line)) {
      out.push(`## ${line}`);
      continue;
    }

    // callout
    if (/^(napomena|savjet|gotovo|bitno|upozorenje)\s*:/i.test(line)) {
      out.push(`> ${line}`);
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
};

export const ChatMessage = memo(({ role, content }: ChatMessageProps) => {
  const renderedContent =
    role === "assistant" ? normalizeAssistantContent(content) : content;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: role === "user" ? "flex-end" : "flex-start",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          background:
            role === "user"
              ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
              : "rgba(255,255,255,0.05)",
          padding: "16px",
          borderRadius: "16px",
          color: "white",
          fontSize: "15px",
          lineHeight: "1.6",
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  marginBottom: "10px",
                  padding: "8px 12px",
                  background:
                    "linear-gradient(90deg, rgba(34,197,94,0.2), transparent)",
                  borderLeft: "4px solid #22c55e",
                }}
              >
                {children}
              </div>
            ),

            h2: ({ children }) => (
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  margin: "10px 0",
                  borderRadius: "999px",
                  background: "rgba(59,130,246,0.2)",
                  color: "#60a5fa",
                  fontWeight: "bold",
                }}
              >
                {children}
              </div>
            ),

            p: ({ children }) => (
              <p style={{ margin: "10px 0", opacity: 0.9 }}>{children}</p>
            ),

            code: ({ inline, children }) =>
              inline ? (
                <code
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                >
                  {children}
                </code>
              ) : (
                <pre
                  style={{
                    background: "#0f172a",
                    padding: "12px",
                    borderRadius: "10px",
                    overflowX: "auto",
                    marginTop: "10px",
                  }}
                >
                  <code>{children}</code>
                </pre>
              ),

            blockquote: ({ children }) => (
              <div
                style={{
                  background: "rgba(251,191,36,0.1)",
                  borderLeft: "4px solid #facc15",
                  padding: "10px",
                  margin: "10px 0",
                  borderRadius: "8px",
                }}
              >
                {children}
              </div>
            ),
          }}
        >
          {renderedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
});