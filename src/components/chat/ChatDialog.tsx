import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, Send, Sparkles, Plus, MessageSquare, Trash2, Code2, PanelLeftClose, PanelLeftOpen, PanelRightClose, Mic, Square, ClipboardList, Brain, Upload, Camera, Image, File, Paperclip, HardDrive, ArrowDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage, CopyButton } from "./ChatMessage";
import type { CodeBlock } from "./ChatMessage";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// CodeBlock type imported from ChatMessage
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

// Extract code blocks from all assistant messages
function extractCodeBlocks(messages: Message[]): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const codeRegex = /```(\w+)\n([\s\S]*?)```/g;

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    let match;
    while ((match = codeRegex.exec(msg.content)) !== null) {
      blocks.push({
        language: match[1] || "text",
        code: match[2].trim(),
        label: `${match[1] || "code"} — ${match[2].trim().slice(0, 40)}...`,
      });
    }
  }
  return blocks;
}

interface ChatDialogProps {
  open: boolean;
  onClose: () => void;
}

// CopyButton imported from ChatMessage

const mergeTranscriptWithOverlap = (acc: string, segment: string) => {
  const left = acc.trim();
  const right = segment.trim();

  if (!right) return left;
  if (!left) return right;
  if (right.startsWith(left)) return right;
  if (left.startsWith(right)) return left;

  const max = Math.min(left.length, right.length);
  for (let i = max; i > 0; i--) {
    if (left.endsWith(right.slice(0, i))) {
      return `${left}${right.slice(i)}`.trim();
    }
  }

  return `${left} ${right}`.trim();
};

const ChatDialog = ({ open, onClose }: ChatDialogProps) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [isListeningTask, setIsListeningTask] = useState(false);
  const [taskTranscript, setTaskTranscript] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const recognitionRef = useRef<any>(null);
  const taskRecognitionRef = useRef<any>(null);
  const [driveSearchMode, setDriveSearchMode] = useState(false);
  const [brainConnected, setBrainConnected] = useState<boolean | null>(null);
  const [reasoningMode, setReasoningMode] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("http://localhost:8080");
  const abortControllerRef = useRef<AbortController | null>(null);

  const voiceBaseRef = useRef("");

  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setInput((prev) => prev + " [Preglednik ne podržava glasovni unos]");
      return;
    }

    voiceBaseRef.current = input.trim();

    const recognition = new SpeechRecognition();
    recognition.lang = "hr-HR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let mergedFinal = "";
      let mergedInterim = "";

      for (let i = 0; i < event.results.length; i++) {
        const transcript = String(event.results[i][0]?.transcript ?? "").trim();
        if (!transcript) continue;

        if (event.results[i].isFinal) {
          mergedFinal = mergeTranscriptWithOverlap(mergedFinal, transcript);
        } else {
          mergedInterim = mergeTranscriptWithOverlap(mergedInterim, transcript);
        }
      }

      const mergedAll = mergeTranscriptWithOverlap(mergedFinal, mergedInterim);
      const base = voiceBaseRef.current;
      setInput(((base ? `${base} ` : "") + mergedAll).trim());
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, input]);

  const toggleVoiceTask = useCallback(async () => {
    if (isListeningTask) {
      taskRecognitionRef.current?.stop();
      setIsListeningTask(false);
      const text = taskTranscript.trim();
      if (text && user) {
        const { data: existing } = await supabase
          .from("workspace_items")
          .select("position")
          .eq("is_private", false)
          .order("position", { ascending: false })
          .limit(1);
        const nextPos = existing && existing.length > 0 ? existing[0].position + 1 : 0;
        await supabase.from("workspace_items").insert({
          user_id: user.id,
          text,
          is_private: false,
          position: nextPos,
        });
        setTaskTranscript("");
        setMessages((prev) => [...prev, { role: "assistant", content: `✅ Zadatak dodan na radnu ploču: **"${text}"**` }]);
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    setTaskTranscript("");

    const recognition = new SpeechRecognition();
    recognition.lang = "hr-HR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let mergedFinal = "";
      let mergedInterim = "";

      for (let i = 0; i < event.results.length; i++) {
        const transcript = String(event.results[i][0]?.transcript ?? "").trim();
        if (!transcript) continue;

        if (event.results[i].isFinal) {
          mergedFinal = mergeTranscriptWithOverlap(mergedFinal, transcript);
        } else {
          mergedInterim = mergeTranscriptWithOverlap(mergedInterim, transcript);
        }
      }

      setTaskTranscript(mergeTranscriptWithOverlap(mergedFinal, mergedInterim));
    };

    recognition.onerror = () => setIsListeningTask(false);
    recognition.onend = () => setIsListeningTask(false);

    taskRecognitionRef.current = recognition;
    recognition.start();
    setIsListeningTask(true);
  }, [isListeningTask, taskTranscript, user]);

  const codeBlocks = useMemo(() => extractCodeBlocks(messages), [messages]);

  // Auto-open code panel on desktop when new code blocks appear
  const prevCodeCountRef = useRef(0);
  useEffect(() => {
    if (codeBlocks.length > 0 && codeBlocks.length !== prevCodeCountRef.current && !isMobile) {
      setShowCodePanel(true);
    }
    prevCodeCountRef.current = codeBlocks.length;
  }, [codeBlocks.length, isMobile]);
  const codePanelRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToCode = useCallback((index: number) => {
    const el = document.getElementById(`code-block-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-emerald-400/60");
      setTimeout(() => el.classList.remove("ring-2", "ring-emerald-400/60"), 2000);
    }
    if (!showCodePanel) setShowCodePanel(true);
  }, [showCodePanel]);

  const handleFileDrop = useCallback(async (files: FileList) => {
    if (!user || files.length === 0) return;
    
    // Process multiple files
    const filesToProcess = Array.from(files).slice(0, 10);
    
    for (const file of filesToProcess) {
      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) {
        setMessages(prev => [...prev, { role: "assistant", content: `❌ **${file.name}** je prevelika (max 20MB).` }]);
        continue;
      }

      // Check if it's an image
      const imageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff"];
      const isImage = imageTypes.includes(file.type) || /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)$/i.test(file.name);

      if (isImage) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          const uploadMsg = `🖼️ **${file.name}** (${(file.size / 1024).toFixed(1)} KB)\n\n![${file.name}](${base64})`;
          setInput(prev => prev + (prev ? "\n" : "") + `[Priložena slika: ${file.name}]`);
          setMessages(prev => [...prev, { role: "user", content: uploadMsg }]);
        };
        reader.readAsDataURL(file);
        continue;
      }

      // Check if it's a PDF
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        try {
          setMessages(prev => [...prev, { role: "assistant", content: `⏳ Parsiram PDF: **${file.name}**...` }]);
          const arrayBuffer = await file.arrayBuffer();
          const pdfjsLib = await import("pdfjs-dist");
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const totalPages = Math.min(pdf.numPages, 50);
          let fullText = "";
          for (let p = 1; p <= totalPages; p++) {
            const page = await pdf.getPage(p);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
            if (pageText) fullText += `\n--- Stranica ${p} ---\n${pageText}`;
          }
          if (fullText.length > 30000) fullText = fullText.slice(0, 30000) + "\n...[skraćeno]";
          const pageInfo = pdf.numPages > 50 ? ` (prikazano 50/${pdf.numPages} stranica)` : ` (${pdf.numPages} str.)`;
          // Remove the "parsing" message and add real content
          setMessages(prev => {
            const filtered = prev.filter(m => !m.content.includes(`Parsiram PDF: **${file.name}**`));
            return [...filtered, { role: "user", content: `📄 PDF: **${file.name}**${pageInfo} (${(file.size / 1024).toFixed(1)} KB)\n\n${fullText.trim() || "_Nema tekstualnog sadržaja (skenirani dokument)_"}` }];
          });
          setInput(prev => prev + (prev ? "\n" : "") + `[Priložen PDF: ${file.name}]`);
        } catch (err) {
          setMessages(prev => {
            const filtered = prev.filter(m => !m.content.includes(`Parsiram PDF: **${file.name}**`));
            return [...filtered, { role: "assistant", content: `❌ Greška pri parsiranju PDF-a: **${file.name}**` }];
          });
        }
        continue;
      }

      // Try to read as text - broad detection
      const textExtensions = [
        ".txt", ".md", ".csv", ".json", ".xml", ".kml", ".gml", ".html", ".htm",
        ".css", ".js", ".jsx", ".ts", ".tsx", ".py", ".sql", ".yaml", ".yml",
        ".env", ".ini", ".cfg", ".conf", ".toml", ".log", ".sh", ".bat", ".ps1",
        ".c", ".cpp", ".h", ".hpp", ".java", ".kt", ".swift", ".go", ".rs", ".rb",
        ".php", ".pl", ".r", ".m", ".lua", ".dart", ".scala", ".groovy",
        ".dockerfile", ".gitignore", ".editorconfig", ".prettierrc", ".eslintrc",
        ".svg", ".geojson", ".topojson", ".gpx", ".wkt",
      ];
      const isTextByExt = textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      const isTextByType = file.type.startsWith("text/") || 
        ["application/json", "application/xml", "application/javascript", "application/x-yaml",
         "application/toml", "application/xhtml+xml", "application/svg+xml"].includes(file.type);
      const isText = isTextByExt || isTextByType;

      if (isText) {
        try {
          let fileContent = await file.text();
          if (fileContent.length > 30000) fileContent = fileContent.slice(0, 30000) + "\n...[skraćeno]";
          
          // Detect language for syntax highlighting
          const ext = file.name.split('.').pop()?.toLowerCase() || "";
          const langMap: Record<string, string> = {
            js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx", py: "python",
            json: "json", html: "html", htm: "html", css: "css", xml: "xml",
            sql: "sql", yaml: "yaml", yml: "yaml", md: "markdown", sh: "bash",
            bat: "batch", go: "go", rs: "rust", rb: "ruby", java: "java",
            kt: "kotlin", swift: "swift", cpp: "cpp", c: "c", php: "php",
          };
          const lang = langMap[ext] || ext || "text";
          
          const uploadMsg = `📎 Učitana datoteka: **${file.name}** (${(file.size / 1024).toFixed(1)} KB)\n\n\`\`\`${lang}\n${fileContent}\n\`\`\``;
          setInput(prev => prev + (prev ? "\n" : "") + `[Priložena datoteka: ${file.name}]`);
          setMessages(prev => [...prev, { role: "user", content: uploadMsg }]);
        } catch {
          const uploadMsg = `📎 Učitana datoteka: **${file.name}** (${(file.size / 1024).toFixed(1)} KB, ${file.type || "nepoznat tip"})`;
          setInput(prev => prev + (prev ? "\n" : "") + `[Priložena datoteka: ${file.name}]`);
          setMessages(prev => [...prev, { role: "user", content: uploadMsg }]);
        }
        continue;
      }

      // Binary file - just note it
      const uploadMsg = `📎 Učitana datoteka: **${file.name}** (${(file.size / 1024).toFixed(1)} KB, ${file.type || "nepoznat tip"})`;
      setInput(prev => prev + (prev ? "\n" : "") + `[Priložena datoteka: ${file.name}]`);
      setMessages(prev => [...prev, { role: "user", content: uploadMsg }]);
    }
  }, [user]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFileDrop(e.dataTransfer.files);
  }, [handleFileDrop]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) setConversations(data);
  }, [user]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data.map((m: any) => ({ role: m.role, content: m.content })));
      // Force scroll to bottom after loading conversation
      setTimeout(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
          setShowScrollButton(false);
        }
      }, 100);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadConversations();
      inputRef.current?.focus();
    }
  }, [open, loadConversations]);

  const scrollRAF = useRef<number>(0);
  const isStreamingRef = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Track scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollButton(distFromBottom > 200);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  // Force scroll to bottom (ignores near-bottom check)
  const forceScrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    // Use setTimeout to ensure DOM has rendered
    setTimeout(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      setShowScrollButton(false);
    }, 50);
  }, []);

  // Smooth auto-scroll: throttle to ~60fps using rAF, only if user is near bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRAF.current) return;
    scrollRAF.current = requestAnimationFrame(() => {
      scrollRAF.current = 0;
      const container = messagesContainerRef.current;
      if (!container) return;
      // Only auto-scroll if user is near the bottom (within 150px)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isNearBottom || isStreamingRef.current) {
        container.scrollTo({ top: container.scrollHeight, behavior: isStreamingRef.current ? "auto" : "smooth" });
      }
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const selectConversation = async (conv: Conversation) => {
    setActiveConversationId(conv.id);
    await loadMessages(conv.id);
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_conversations").delete().eq("id", id);
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
    }
    loadConversations();
  };

  const send = async () => {
    const rawText = input.trim();
    if (!rawText || isLoading || !user) return;

    const text = driveSearchMode
      ? `Pretraži firmeni Google Drive I Trello za: ${rawText}. Prikaži sve relevantne rezultate s linkovima, označi izvor (Drive ili Trello).`
      : rawText;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setDriveSearchMode(false);
    setIsLoading(true);

    let convId = activeConversationId;

    if (!convId) {
      const title = text.slice(0, 60) + (text.length > 60 ? "..." : "");
      const { data } = await supabase
        .from("chat_conversations")
        .insert({ user_id: user.id, title })
        .select()
        .single();
      if (data) {
        convId = data.id;
        setActiveConversationId(convId);
      }
    }

    if (convId) {
      await supabase.from("chat_messages").insert({
        conversation_id: convId,
        role: "user",
        content: text,
      });
    }

    let assistantSoFar = "";
    isStreamingRef.current = true;

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      // Send messages as-is — backend converts inline base64 images to OpenAI vision format
      const cleanMessages = newMessages;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: cleanMessages,
          conversation_id: convId,
          reasoning: reasoningMode,
        }),
        signal: abortController.signal,
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Greška" }));
        setMessages((prev) => [...prev, { role: "assistant", content: err.error || "Greška u komunikaciji." }]);
        setIsLoading(false);
        isStreamingRef.current = false;
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let updateScheduled = false;

      const flushUpdate = () => {
        updateScheduled = false;
        const snapshot = assistantSoFar;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: snapshot } : m));
          }
          return [...prev, { role: "assistant", content: snapshot }];
        });
      };

      let streamDone = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done || streamDone) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              // Throttle DOM updates to ~30fps for smooth rendering
              if (!updateScheduled) {
                updateScheduled = true;
                requestAnimationFrame(flushUpdate);
              }
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
      // Final flush to ensure all content is rendered
      flushUpdate();
    } catch (e: any) {
      if (e?.name === "AbortError") {
        // User stopped generation — keep what we have so far
        if (!assistantSoFar) {
          assistantSoFar = "⏹ Generiranje zaustavljeno.";
          setMessages((prev) => [...prev, { role: "assistant", content: assistantSoFar }]);
        }
      } else {
        assistantSoFar = "Greška u povezivanju s AI servisom.";
        setMessages((prev) => [...prev, { role: "assistant", content: assistantSoFar }]);
      }
    }

    abortControllerRef.current = null;
    isStreamingRef.current = false;

    if (convId && assistantSoFar) {
      await supabase.from("chat_messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: assistantSoFar,
      });
      await supabase.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      loadConversations();
    }

    setIsLoading(false);
  };

  // Check brain connection status
  useEffect(() => {
    if (!user || !open) return;
    // Brain is a shared resource - check if ANY user has connected it
    supabase.from("google_brain_tokens").select("id").limit(1).maybeSingle().then(({ data }) => {
      setBrainConnected(!!data);
    });
  }, [user, open]);

  const connectBrain = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/brain-auth?action=auth-url`,
        { headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const data = await resp.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      console.error("Brain connect error:", e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!open) return null;

  const hasMessages = messages.length > 0;
  const hasCode = codeBlocks.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-lg">
      <div className={cn(
        "relative bg-[hsl(220,15%,7%)] border border-white/[0.06] rounded-2xl flex shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200",
        devMode ? "w-[99vw] h-[98vh]" : "w-[96vw] h-[94vh]"
      )}>

        {/* Left sidebar - conversations */}
        {showSidebar && (
          <div className="w-56 border-r border-white/[0.06] flex flex-col bg-[hsl(220,15%,5%)] shrink-0">
            <div className="p-2.5 border-b border-white/[0.06] flex gap-1.5">
              <Button
                onClick={startNewConversation}
                className="flex-1 bg-white/[0.06] hover:bg-white/[0.1] text-white/70 text-[11px] gap-1.5 h-8 rounded-lg"
                variant="ghost"
              >
                <Plus className="w-3 h-3" />
                Novi
              </Button>
              <button
                onClick={() => setShowSidebar(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={cn(
                    "px-2.5 py-2 cursor-pointer flex items-center gap-2 group hover:bg-white/[0.04] transition-colors",
                    activeConversationId === conv.id && "bg-white/[0.06]"
                  )}
                >
                  <MessageSquare className="w-3 h-3 text-white/25 shrink-0" />
                  <span className="text-[11px] text-white/50 truncate flex-1">{conv.title}</span>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main chat area - LEFT (70%) */}
        <div className={cn("flex flex-col min-w-0 relative", devMode ? "w-[340px] shrink-0" : "flex-1")}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              {!showSidebar && (
                <button
                  onClick={() => setShowSidebar(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors mr-1"
                >
                  <PanelLeftOpen className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white tracking-tight">Stellan</p>
                <p className="text-[9px] text-white/30">gpt-4o · vision · mozak{brainConnected ? ' ✓' : ''} · internet</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {brainConnected === false && (
                <button
                  onClick={connectBrain}
                  className="h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-[10px] bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                >
                  <Brain className="w-3 h-3" />
                  Poveži mozak
                </button>
              )}
              {hasCode && (
                <button
                  onClick={() => setShowCodePanel(!showCodePanel)}
                  className={cn(
                    "h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-[10px] transition-colors",
                    showCodePanel
                      ? "bg-primary/20 text-primary"
                      : "bg-white/[0.06] text-white/40 hover:text-white/60"
                  )}
                >
                  <Code2 className="w-3 h-3" />
                  Kodovi
                </button>
              )}
              <button
                onClick={() => setDevMode(!devMode)}
                title="Dev Mode — live preview"
                className={cn(
                  "h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-[10px] transition-colors",
                  devMode
                    ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30"
                    : "bg-white/[0.06] text-white/40 hover:text-violet-400 hover:bg-violet-500/10"
                )}
              >
                <Code2 className="w-3 h-3" />
                Dev
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            className={cn("flex-1 overflow-y-auto scrollbar-hide relative", dragOver && "ring-2 ring-emerald-400/40 ring-inset")}
            ref={messagesContainerRef}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {dragOver && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-emerald-500/[0.05] backdrop-blur-sm pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-emerald-400">
                  <Upload className="w-10 h-10" />
                  <p className="text-sm font-medium">Ispustite datoteku ovdje</p>
                </div>
              </div>
            )}
            {!hasMessages ? (
              <div className="flex flex-col items-center justify-center h-full px-6 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary/60" />
                </div>
                <div className="text-center space-y-1.5">
                <p className="text-white/90 text-2xl font-semibold tracking-tight">Kako vam mogu pomoći?</p>
                   <p className="text-white/35 text-base max-w-lg leading-relaxed">Pamtim razgovore, koristim znanje iz mozga na Google Driveu i pretražujem internet.</p>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-6">
                {messages.map((msg, i) => (
                  <ChatMessage
                    key={i}
                    role={msg.role}
                    content={msg.content}
                    isLatest={i === messages.length - 1}
                    codeBlocks={codeBlocks}
                    hasCode={hasCode}
                    onShowCodePanel={() => setShowCodePanel(true)}
                    onScrollToCode={scrollToCode}
                  />
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="flex justify-start"
                  >
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4, ease: "backOut" }}
                      className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mr-2.5 mt-0.5 shrink-0"
                    >
                      <Sparkles className="w-3 h-3 text-primary-foreground" />
                    </motion.div>
                    <div className="flex items-center gap-1 py-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" style={{ animationDelay: "300ms" }} />
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Scroll to bottom button */}
          {showScrollButton && hasMessages && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20">
              <button
                onClick={forceScrollToBottom}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground text-xs font-medium shadow-lg shadow-primary/20 transition-all hover:scale-105 backdrop-blur-sm"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                Na dno
              </button>
            </div>
          )}

          <div className="p-3 border-t border-white/[0.06]">
            {/* Task voice recording indicator */}
            {isListeningTask && (
              <div className="mb-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                <ClipboardList className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="text-xs text-amber-300 flex-1 truncate">
                  {taskTranscript ? taskTranscript.replace(/\u200B/g, "") : "Slušam za zadatak..."}
                </span>
                <button
                  onClick={toggleVoiceTask}
                  className="px-2 py-1 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-medium hover:bg-amber-500/30 transition-colors"
                >
                  Spremi
                </button>
            </div>
          )}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl focus-within:border-primary/40 transition-colors flex flex-col">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                const files: File[] = [];
                for (let i = 0; i < items.length; i++) {
                  const item = items[i];
                  if (item.kind === "file") {
                    const file = item.getAsFile();
                    if (file) files.push(file);
                  }
                }
                if (files.length > 0) {
                  e.preventDefault();
                  const dt = new DataTransfer();
                  files.forEach(f => dt.items.add(f));
                  handleFileDrop(dt.files);
                }
              }}
              placeholder={isListening ? "Slušam..." : driveSearchMode ? "Pretraži firmeni Drive..." : "Pitajte Stellana..."}
              rows={2}
              className="w-full resize-none bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none"
            />
            {/* Icons row below textarea */}
            <div className="flex items-center justify-between px-2 py-2 border-t border-white/[0.06]">
              <div className="flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(e) => { if (e.target.files) handleFileDrop(e.target.files); e.target.value = ""; }}
                />
                <input
                  id="camera-input"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => { if (e.target.files) handleFileDrop(e.target.files); e.target.value = ""; }}
                />
                <input
                  id="gallery-input"
                  type="file"
                  className="hidden"
                  accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.svg"
                  onChange={(e) => { if (e.target.files) handleFileDrop(e.target.files); e.target.value = ""; }}
                />
                <div className="relative">
                  <button
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    title="Priloži"
                    className="h-8 w-8 rounded-lg flex items-center justify-center bg-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.1] transition-all"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </button>
                  {showAttachMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
                      <div className="absolute bottom-10 left-0 z-50 w-44 rounded-xl bg-[hsl(220,15%,12%)] border border-white/[0.1] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <button
                          onClick={() => { document.getElementById('camera-input')?.click(); setShowAttachMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
                        >
                          <Camera className="w-4 h-4 text-white/40" />
                          Kamera
                        </button>
                        <button
                          onClick={() => { document.getElementById('gallery-input')?.click(); setShowAttachMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
                        >
                          <Image className="w-4 h-4 text-white/40" />
                          Fotografije
                        </button>
                        <div className="border-t border-white/[0.06]" />
                        <button
                          onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
                        >
                          <File className="w-4 h-4 text-white/40" />
                          Datoteke
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => {
                    setDriveSearchMode(!driveSearchMode);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  title="Pretraži firmeni Google Drive"
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                    driveSearchMode
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-white/[0.06] text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10"
                  )}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleVoiceTask}
                  disabled={isListening}
                  title="Govori zadatak za radnu ploču"
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                    isListeningTask
                      ? "bg-amber-500/20 text-amber-400 animate-pulse"
                      : "bg-white/[0.06] text-white/40 hover:text-amber-400 hover:bg-amber-500/10",
                    isListening && "opacity-30 cursor-not-allowed"
                  )}
                >
                  {isListeningTask ? <Square className="w-3.5 h-3.5" /> : <ClipboardList className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={toggleVoice}
                  disabled={isListeningTask}
                  title="Govori poruku za chat"
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                    isListening
                      ? "bg-red-500/20 text-red-400 animate-pulse"
                      : "bg-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.1]",
                    isListeningTask && "opacity-30 cursor-not-allowed"
                  )}
                >
                  {isListening ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setReasoningMode(!reasoningMode)}
                  title={reasoningMode ? "Reasoning uključen (sporije, pametnije)" : "Uključi reasoning"}
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center transition-all text-[10px] font-bold",
                    reasoningMode
                      ? "bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30"
                      : "bg-white/[0.06] text-white/40 hover:text-purple-400 hover:bg-purple-500/10"
                  )}
                >
                  R
                </button>
                {isLoading ? (
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all"
                    onClick={() => abortControllerRef.current?.abort()}
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-lg transition-all",
                      input.trim()
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-white/[0.06] text-white/20 cursor-not-allowed"
                    )}
                    onClick={send}
                    disabled={!input.trim()}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <p className="text-[9px] text-white/15 text-center mt-1.5">Stellan može griješiti. Provjerite važne informacije.</p>
        </div>
        </div>

        {/* Code panel - RIGHT (30%) */}
        {/* Desktop: inline panel */}
        {!isMobile && showCodePanel && hasCode && (
          <div className="w-[30%] border-l border-white/[0.06] flex flex-col bg-[hsl(220,12%,6%)] shrink-0">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-primary/70" />
                <span className="text-xs font-medium text-white/70">Kodovi ({codeBlocks.length})</span>
              </div>
              <button
                onClick={() => setShowCodePanel(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              >
                <PanelRightClose className="w-3.5 h-3.5" />
              </button>
            </div>
            <div ref={codePanelRef} className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-3">
              {codeBlocks.map((block, i) => (
                <div key={i} id={`code-block-${i}`} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all duration-500">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.03]">
                    <span className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-wider">Kod #{i + 1} · {block.language}</span>
                    <CopyButton text={block.code} />
                  </div>
                  <SyntaxHighlighter
                    language={block.language || "text"}
                    style={oneDark}
                    customStyle={{ margin: 0, padding: "12px", background: "transparent", fontSize: "12px", lineHeight: "1.6" }}
                    wrapLongLines
                  >
                    {block.code}
                  </SyntaxHighlighter>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mobile: slide-in overlay panel from right */}
        {isMobile && hasCode && (
          <>
            {/* Toggle button - always visible when code exists and panel is closed */}
            {!showCodePanel && (
              <button
                onClick={() => setShowCodePanel(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-14 rounded-l-xl bg-[hsl(220,12%,10%)] border border-white/[0.08] border-r-0 flex items-center justify-center text-primary/60 hover:text-primary hover:bg-[hsl(220,12%,14%)] transition-colors shadow-lg"
              >
                <Code2 className="w-4 h-4" />
              </button>
            )}

            {/* Overlay backdrop */}
            {showCodePanel && (
              <div
                className="absolute inset-0 z-20 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowCodePanel(false)}
              />
            )}

            {/* Sliding panel */}
            <div
              className={cn(
                "absolute right-0 top-0 bottom-0 z-30 w-[80%] max-w-xs border-l border-white/[0.06] flex flex-col bg-[hsl(220,12%,6%)] shadow-2xl transition-transform duration-300 ease-in-out",
                showCodePanel ? "translate-x-0" : "translate-x-full"
              )}
            >
              <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-primary/70" />
                  <span className="text-xs font-medium text-white/70">Kodovi ({codeBlocks.length})</span>
                </div>
                <button
                  onClick={() => setShowCodePanel(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
                >
                  <PanelRightClose className="w-3.5 h-3.5" />
                </button>
              </div>
              <div ref={codePanelRef} className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-3">
                {codeBlocks.map((block, i) => (
                  <div key={i} id={`code-block-mobile-${i}`} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all duration-500">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.03]">
                      <span className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-wider">Kod #{i + 1} · {block.language}</span>
                      <CopyButton text={block.code} />
                    </div>
                    <SyntaxHighlighter
                      language={block.language || "text"}
                      style={oneDark}
                      customStyle={{ margin: 0, padding: "12px", background: "transparent", fontSize: "12px", lineHeight: "1.6" }}
                      wrapLongLines
                    >
                      {block.code}
                    </SyntaxHighlighter>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Dev Mode — Live Preview Panel */}
        {devMode && !isMobile && (
          <div className="flex-1 border-l border-white/[0.06] flex flex-col bg-[hsl(220,12%,4%)]">
            <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-xs font-medium text-white/60">Live Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={previewUrl}
                  onChange={e => setPreviewUrl(e.target.value)}
                  className="text-[11px] bg-white/[0.06] text-white/60 rounded-lg px-3 py-1.5 w-72 border border-white/[0.06] focus:outline-none focus:border-violet-500/40 focus:text-white/80"
                  placeholder="http://localhost:8080"
                />
                <button
                  onClick={() => {
                    const iframe = document.getElementById('dev-preview') as HTMLIFrameElement;
                    if (iframe) { iframe.src = iframe.src; }
                  }}
                  title="Osvježi"
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors text-sm"
                >
                  ↻
                </button>
                <button
                  onClick={() => window.open(previewUrl, '_blank')}
                  title="Otvori u novom tabu"
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.1] transition-colors text-xs"
                >
                  ↗
                </button>
              </div>
            </div>
            <iframe
              id="dev-preview"
              src={previewUrl}
              className="flex-1 w-full border-0"
              title="Live Preview"
            />
          </div>
        )}

      </div>
    </div>
  );
};

export default ChatDialog;
