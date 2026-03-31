import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, Send, Sparkles, Plus, MessageSquare, Trash2, Code2, PanelLeftClose, PanelLeftOpen, PanelRightClose, Mic, Square, ClipboardList, Upload, Camera, Image, File, Paperclip, HardDrive, ArrowDown, Search, Download } from "lucide-react";
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

// Agent status badge - checks agent health
const AgentStatusBadge = () => {
  const [agentOk, setAgentOk] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-health`,
          { headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        setAgentOk(res.ok);
      } catch {
        setAgentOk(false);
      }
    };
    check();
  }, []);

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border",
      agentOk === true
        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        : agentOk === false
        ? "bg-red-500/10 text-red-400 border-red-500/20"
        : "bg-white/[0.04] text-white/30 border-white/[0.06]"
    )}>
      <div className={cn(
        "w-1.5 h-1.5 rounded-full",
        agentOk === true ? "bg-emerald-400 animate-pulse" : agentOk === false ? "bg-red-400" : "bg-white/20"
      )} />
      Agent {agentOk === true ? "online" : agentOk === false ? "offline" : "..."}
    </div>
  );
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
  const [reasoningMode, setReasoningMode] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"flash" | "pro" | "flash3" | "pro3">("flash");
  const [previewUrl, setPreviewUrl] = useState("http://localhost:8080");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<"idle" | "success" | "error">("idle");
  const [isStartingAgent, setIsStartingAgent] = useState(false);
  const [studioTab, setStudioTab] = useState<"playwright"|"terminal"|"files"|"memory"|"webbuilder"|"gis"|"api">("playwright");
  const [studioRightTab, setStudioRightTab] = useState<"steps"|"console"|"actions"|"code">("steps");
  const [studioSidebarTool, setStudioSidebarTool] = useState("playwright");
  const [studioInput, setStudioInput] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<{t:string,msg:string}[]>([{t:"dim",msg:"Dev Studio spreman"}]);
  const [agentOnline, setAgentOnline] = useState<boolean|null>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [previewScreenshotUrl, setPreviewScreenshotUrl] = useState<string>("");
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [reactions, setReactions] = useState<Record<number, "up" | "down">>({});
  const [pendingImages, setPendingImages] = useState<{name: string, base64: string, size: number}[]>([]);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);
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
          setPendingImages(prev => [...prev, { name: file.name, base64, size: file.size }]);
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

          // Upload PDF to storage so Stellan can reference it by URL
          let pdfStorageUrl = "";
          try {
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const storagePath = `${user.id}/${timestamp}_${safeName}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("chat-pdfs")
              .upload(storagePath, new Uint8Array(arrayBuffer), {
                contentType: "application/pdf",
                upsert: false,
              });
            if (!uploadError && uploadData) {
              const { data: urlData } = supabase.storage.from("chat-pdfs").getPublicUrl(storagePath);
              pdfStorageUrl = urlData?.publicUrl || "";
            }
          } catch (storageErr) {
            console.error("PDF storage upload error:", storageErr);
          }

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
          const urlLine = pdfStorageUrl ? `\n\n🔗 PDF URL za uređivanje: ${pdfStorageUrl}` : "";
          // Remove the "parsing" message and add real content
          setMessages(prev => {
            const filtered = prev.filter(m => !m.content.includes(`Parsiram PDF: **${file.name}**`));
            return [...filtered, { role: "user", content: `📄 PDF: **${file.name}**${pageInfo} (${(file.size / 1024).toFixed(1)} KB)${urlLine}\n\n${fullText.trim() || "_Nema tekstualnog sadržaja (skenirani dokument)_"}` }];
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
  }, [messages, thinkingStatus, scrollToBottom]);


  useEffect(() => { if (thinkingStatus) addLog("info", thinkingStatus); }, [thinkingStatus]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && last.content) {
      addLog("ok", "✓ " + last.content.replace(/#+\s/g,"").slice(0,70));
      const codeMatch = last.content.match(/```(?:typescript|javascript|python)?\n([\s\S]*?)```/);
      if (codeMatch) setGeneratedCode(codeMatch[1].trim());
      const b64Match = last.content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
      if (b64Match) { setPreviewScreenshot(b64Match[1]); addLog("ok", "📸 screenshot"); }
      const jsonB64 = last.content.match(/"screenshot_base64"\s*:\s*"([A-Za-z0-9+/=]{20,})"/);
      if (jsonB64) { setPreviewScreenshot("data:image/png;base64," + jsonB64[1]); addLog("ok", "📸 screenshot"); }
    }
  }, [messages.length]);

  useEffect(() => { if (devMode) checkAgentHealth(); }, [devMode]);
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
    if (!rawText && pendingImages.length === 0) return;
    if (isLoading || !user) return;

    const baseText = driveSearchMode
      ? `Pretraži firmeni Google Drive I Trello za: ${rawText}. Prikaži sve relevantne rezultate s linkovima, označi izvor (Drive ili Trello).`
      : rawText;

    const imagesMd = pendingImages.map(img => `![${img.name}](${img.base64})`).join('\n');
    const text = imagesMd
      ? (imagesMd + (baseText ? '\n\n' + baseText : ''))
      : baseText;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setPendingImages([]);
    setDriveSearchMode(false);
    setIsLoading(true);
    forceScrollToBottom();

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
          model: selectedModel,
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
            // Handle status events (thinking indicator)
            if (parsed.status) {
              setThinkingStatus(parsed.status);
              continue;
            }
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              // Clear thinking status when actual content starts streaming
              setThinkingStatus(null);
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
    setThinkingStatus(null);

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


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleDeploy = async () => {

  // ── Dev Studio helpers ────────────────────────────────────
  const addLog = (t: string, msg: string) => {
    setConsoleLogs(prev => [...prev.slice(-99), { t, msg }]);
    setTimeout(() => consoleEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
  };

  const checkAgentHealth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setAgentOnline(false); return; }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-health`,
        { headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      setAgentOnline(res.ok);
      addLog(res.ok ? "ok" : "warn", res.ok ? "✓ agent online :8432" : "✗ agent offline");
    } catch { setAgentOnline(false); addLog("warn", "✗ agent nedostupan"); }
  };

  const studioSend = (cmd: string) => {
    if (!cmd.trim()) return;
    addLog("info", "→ " + cmd.trim().slice(0, 80));
    setInput(cmd.trim());
    setStudioInput("");
    setTimeout(() => {
      const btn = document.querySelector("[data-send-btn]") as HTMLButtonElement;
      btn?.click();
    }, 80);
  };

  const handleStudioExecute = () => studioSend(studioInput);

  const handleStudioScreenshot = () => studioSend(
    `Napravi playwright screenshot stranice ${previewUrl} i detaljno opiši što vidiš — sve elemente, tekstove, gumbe, inpute, navigaciju.`
  );

    setIsDeploying(true);
    setDeployStatus("idle");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-health`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "git_push", message: "deploy via Stellan" }),
        }
      );
      setDeployStatus(res.ok ? "success" : "error");
    } catch {
      setDeployStatus("error");
    } finally {
      setIsDeploying(false);
      setTimeout(() => setDeployStatus("idle"), 4000);
    }
  };

  const handleStartAgent = () => {
    setInput("Pokreni agent server naredbom: cd 'D:\\1 PROJEKT APLIKACIJA LOKALNO\\1 PROJEKT APLIKACIJA LOKALNO claude\\docs\\agent-server' i pokreni start_agent.bat");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleReaction = (index: number, reaction: "up" | "down") => {
    setReactions(prev => ({
      ...prev,
      [index]: prev[index] === reaction ? undefined as any : reaction,
    }));
  };

  const handleExport = () => {
    if (!messages.length) return;
    const lines = messages.map(m => {
      const role = m.role === "user" ? "👤 Vi" : "🤖 Stellan";
      return `${role}:\n${m.content}\n`;
    });
    const text = `# Razgovor sa Stellanom\n${new Date().toLocaleString("hr-HR")}\n\n---\n\n${lines.join("\n---\n\n")}`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stellan-razgovor-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
            {/* Search box */}
            <div className="px-2 pb-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] focus-within:border-primary/30">
                <Search className="w-3 h-3 text-white/30 shrink-0" />
                <input
                  value={sidebarSearch}
                  onChange={e => setSidebarSearch(e.target.value)}
                  placeholder="Traži razgovore..."
                  className="flex-1 bg-transparent text-[11px] text-white/60 placeholder-white/25 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {conversations.filter(c => !sidebarSearch || c.title.toLowerCase().includes(sidebarSearch.toLowerCase())).map((conv) => (
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

        {/* Main chat area */}
        <div className={cn("flex flex-col min-w-0 relative", devMode ? "w-[35%] shrink-0" : "flex-1")}>
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
                <p className="text-[9px] text-white/30">gpt-4o · vision · memorija ✓ · internet</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">

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
              {hasMessages && (
                <button
                  onClick={handleExport}
                  title="Exportaj razgovor"
                  className="h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-[10px] bg-white/[0.06] text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
              )}
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
              <div className="flex flex-col items-center justify-center h-full px-6 gap-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-xl shadow-primary/10">
                  <Sparkles className="w-8 h-8 text-primary/60" />
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-white/90 text-2xl font-semibold tracking-tight">Kako vam mogu pomoći?</p>
                  <p className="text-white/35 text-base max-w-lg leading-relaxed">Pamtim razgovore, koristim znanje iz mozga na Google Driveu i pretražujem internet.</p>
                </div>
                {/* Suggested questions */}
                <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                  {[
                    { icon: "🔍", text: "Pretraži SDGE portal", prompt: "Pretraži SDGE portal za najnovije zahtjeve" },
                    { icon: "📁", text: "Pretraži Google Drive", prompt: "Pretraži firmeni Google Drive za dokumente" },
                    { icon: "📧", text: "Pretraži Gmail", prompt: "Pretraži Gmail inbox za nepročitane poruke" },
                    { icon: "📊", text: "Status projekata", prompt: "Pokaži mi status aktivnih projekata u GeoTerra aplikaciji" },
                    { icon: "🧾", text: "Provjeri račune", prompt: "Pretraži Solo fakturiranje za posljednje račune" },
                    { icon: "🔎", text: "Provjeri OIB", prompt: "Provjeri OIB za osobu ili tvrtku" },
                  ].map((s) => (
                    <button
                      key={s.text}
                      onClick={() => { setInput(s.prompt); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-primary/20 text-left transition-all group"
                    >
                      <span className="text-base">{s.icon}</span>
                      <span className="text-[12px] text-white/50 group-hover:text-white/70 transition-colors">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-6">
                {messages.map((msg, i) => {
                  // Extract images from user messages for proper display
                  const imgRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
                  const imgs: { alt: string; src: string }[] = [];
                  let cleanContent = msg.content;
                  if (msg.role === "user") {
                    let m;
                    const regex2 = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
                    while ((m = regex2.exec(msg.content)) !== null) {
                      imgs.push({ alt: m[1], src: m[2] });
                    }
                    cleanContent = msg.content.replace(imgRegex, "").trim();
                  }
                  return (
                    <div key={i}>
                      {imgs.length > 0 && (
                        <div className="flex justify-end gap-2 flex-wrap mb-2">
                          {imgs.map((img, j) => (
                            <img
                              key={j}
                              src={img.src}
                              alt={img.alt}
                              className="max-h-52 max-w-[280px] rounded-xl border border-white/10 object-cover shadow-lg"
                            />
                          ))}
                        </div>
                      )}
                      <ChatMessage
                        role={msg.role}
                        content={msg.role === "user" && imgs.length > 0 ? cleanContent : msg.content}
                        isLatest={i === messages.length - 1}
                        isStreaming={i === messages.length - 1 && isStreamingRef.current}
                        codeBlocks={codeBlocks}
                        hasCode={hasCode}
                        onShowCodePanel={() => setShowCodePanel(true)}
                        onScrollToCode={scrollToCode}
                        messageIndex={i}
                        onReaction={handleReaction}
                        reaction={reactions[i] ?? null}
                      />
                    </div>
                  );
                })}
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
                    <div className="flex flex-col gap-1.5 py-1.5">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </motion.div>
                )}
                {thinkingStatus && isLoading && (
                  <motion.div
                    key={thinkingStatus}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2 ml-8.5 py-1"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                      className="w-3.5 h-3.5 rounded-full border-2 border-primary/30 border-t-primary"
                    />
                    <span className="text-xs text-white/40 italic">{thinkingStatus}</span>
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
            {/* Pending image previews */}
            {pendingImages.length > 0 && (
              <div className="flex gap-2 flex-wrap px-3 pt-3 pb-1">
                {pendingImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={img.base64}
                      alt={img.name}
                      className="h-16 w-16 object-cover rounded-lg border border-white/10"
                    />
                    <button
                      onClick={() => setPendingImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 hover:bg-red-400 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    >×</button>
                    <div className="text-[9px] text-white/30 mt-0.5 truncate w-16">{img.name}</div>
                  </div>
                ))}
              </div>
            )}
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
                <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                  {(["flash","pro","flash3","pro3"] as const).map((key) => {
                    const labels: Record<string,string> = {flash:"2.5F",pro:"2.5P",flash3:"3F",pro3:"3.1P"};
                    const titles: Record<string,string> = {flash:"Gemini 2.5 Flash",pro:"Gemini 2.5 Pro",flash3:"Gemini 3 Flash Preview",pro3:"Gemini 3.1 Pro Preview"};
                    return (
                      <button key={key} onClick={() => setSelectedModel(key)} title={titles[key]}
                        className={cn("h-7 px-1.5 rounded-md text-[9px] font-bold transition-all",
                          selectedModel === key ? "bg-primary text-white" : "text-white/30 hover:text-white/60"
                        )}>
                        {labels[key]}
                      </button>
                    );
                  })}
                </div>
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
                      (input.trim() || pendingImages.length > 0)
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-white/[0.06] text-white/20 cursor-not-allowed"
                    )}
                    onClick={send} data-send-btn
                    disabled={!input.trim() && pendingImages.length === 0}
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

        {/* ═══ STELLAN DEV STUDIO ═══ */}
        {devMode && !isMobile && (
          <div className="flex-1 border-l border-white/[0.06] flex flex-col bg-[hsl(220,15%,4%)] min-w-0 overflow-hidden">

            {/* ── TOP BAR ── */}
            <div className="flex items-stretch border-b border-white/[0.06] bg-[hsl(220,15%,5%)] shrink-0 h-[42px]">
              {/* Brand */}
              <div className="flex items-center gap-2 px-3 border-r border-white/[0.06] shrink-0">
                <div className="w-6 h-6 rounded-md bg-indigo-700 flex items-center justify-center text-[11px] font-bold text-indigo-200">S</div>
                <div>
                  <div className="text-[11px] font-semibold text-white/70 leading-tight">Dev Studio</div>
                  <div className="text-[9px] text-white/25 leading-tight">GeoTerra Info</div>
                </div>
              </div>
              {/* Tabs */}
              <div className="flex items-stretch flex-1 overflow-x-auto">
                {([
                  { key: "playwright", icon: "🎭", label: "Playwright" },
                  { key: "terminal",   icon: "⌨️", label: "Terminal" },
                  { key: "files",      icon: "📁", label: "Fajlovi" },
                  { key: "memory",     icon: "🧠", label: "Memorija" },
                  { key: "webbuilder", icon: "🎨", label: "Web Builder" },
                  { key: "gis",        icon: "🗺️", label: "GIS Alati" },
                  { key: "api",        icon: "🔌", label: "API Tester" },
                ] as const).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setStudioTab(t.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 text-[10px] border-b-2 border-t-2 border-t-transparent transition-all whitespace-nowrap",
                      studioTab === t.key
                        ? "text-indigo-300 border-b-indigo-500 bg-white/[0.03]"
                        : "text-white/25 border-b-transparent hover:text-white/50 hover:bg-white/[0.02]"
                    )}
                  >
                    <span className="text-[11px]">{t.icon}</span>{t.label}
                  </button>
                ))}
              </div>
              {/* Right actions */}
              <div className="flex items-center gap-1.5 px-3 border-l border-white/[0.06] shrink-0">
                <div className="flex items-center gap-1.5 text-[9px] text-white/30 mr-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {selectedModel === "flash" ? "2.5-flash" : selectedModel === "pro" ? "2.5-pro" : selectedModel === "flash3" ? "3-flash" : "3.1-pro"}
                </div>
                <button
                  onClick={handleStartAgent}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/15 transition-all"
                >⚡ Agent</button>
                <button
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium border transition-all",
                    isDeploying ? "bg-amber-500/10 text-amber-300 border-amber-500/20 cursor-wait"
                    : deployStatus === "success" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                    : deployStatus === "error" ? "bg-red-500/10 text-red-300 border-red-500/20"
                    : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/15"
                  )}
                >
                  {isDeploying ? "⏳ Deploy..." : deployStatus === "success" ? "✅ Deployed" : deployStatus === "error" ? "❌ Greška" : "🚀 Deploy"}
                </button>
              </div>
            </div>

            {/* ── BODY ── */}
            <div className="flex flex-1 min-h-0">

              {/* Left icon sidebar */}
              <div className="w-10 bg-[hsl(220,15%,4%)] border-r border-white/[0.06] flex flex-col items-center py-2 gap-1 shrink-0">
                {([
                  { key: "playwright", icon: "🎭", tip: "Playwright" },
                  { key: "terminal",   icon: "⌨️", tip: "Terminal" },
                  { key: "files",      icon: "📁", tip: "Fajlovi" },
                ] as const).map(s => (
                  <button key={s.key} title={s.tip}
                    onClick={() => { setStudioSidebarTool(s.key); setStudioTab(s.key); }}
                    className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all",
                      studioSidebarTool === s.key ? "bg-indigo-500/15 text-indigo-300" : "text-white/20 hover:text-white/50 hover:bg-white/[0.05]"
                    )}>
                    {s.icon}
                  </button>
                ))}
                <div className="w-5 h-px bg-white/[0.07] my-1" />
                {([
                  { key: "sdge",   icon: "🏛️", tip: "SDGE Portal" },
                  { key: "oss",    icon: "📋", tip: "OSS Portal" },
                  { key: "solo",   icon: "🧾", tip: "Solo.hr" },
                  { key: "drive",  icon: "📂", tip: "Google Drive" },
                ] as const).map(s => (
                  <button key={s.key} title={s.tip}
                    onClick={() => setStudioInput(`Otvori ${s.tip} u Playwright-u`)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-white/20 hover:text-white/50 hover:bg-white/[0.05] transition-all">
                    {s.icon}
                  </button>
                ))}
                <div className="w-5 h-px bg-white/[0.07] my-1" />
                {([
                  { key: "webbuilder", icon: "🎨", tip: "Web Builder" },
                  { key: "gis",        icon: "🗺️", tip: "GIS / QGIS" },
                  { key: "autocad",    icon: "📐", tip: "AutoCAD / LISP" },
                  { key: "git",        icon: "🔀", tip: "Git" },
                  { key: "api",        icon: "🔌", tip: "API Tester" },
                ] as const).map(s => (
                  <button key={s.key} title={s.tip}
                    onClick={() => setStudioInput(`Pokreni ${s.tip}`)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-white/20 hover:text-white/50 hover:bg-white/[0.05] transition-all">
                    {s.icon}
                  </button>
                ))}
              </div>

              {/* Center — URL bar + iframe */}
              <div className="flex flex-col flex-1 min-w-0">
                {/* URL bar */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[hsl(220,15%,5%)] border-b border-white/[0.05] shrink-0">
                  <div className="flex gap-1">
                    {["←","→","↻"].map(a => (
                      <button key={a}
                        onClick={a === "↻" ? () => studioSend(`Napravi playwright screenshot stranice ${previewUrl}`) : undefined}
                        className="w-5 h-5 rounded text-[9px] text-white/25 bg-white/[0.03] border border-white/[0.06] hover:text-white/50 hover:bg-white/[0.07] transition-all flex items-center justify-center">
                        {a}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1 focus-within:border-indigo-500/30 transition-colors">
                    <span className="text-[9px] text-emerald-400/60">🔒</span>
                    <input
                      value={previewUrl}
                      onChange={e => setPreviewUrl(e.target.value)}
                      className="flex-1 bg-transparent text-[10px] font-mono text-white/40 focus:text-white/70 focus:outline-none placeholder:text-white/15"
                      placeholder="http://localhost:8080"
                    />
                  </div>
                  <div className="flex gap-1">
                    {[
                      { icon: "📸", tip: "Screenshot → Stellan analizira", action: () => setStudioInput("Napravi screenshot trenutne stranice i analiziraj što vidiš") },
                      { icon: "↗",  tip: "Otvori u novom tabu", action: () => window.open(previewUrl, "_blank") },
                      { icon: "🔍", tip: "Inspiciraj element", action: () => setStudioInput("Inspiciraj označeni element na stranici") },
                    ].map(b => (
                      <button key={b.icon} title={b.tip} onClick={b.action}
                        className="w-6 h-6 rounded text-[10px] text-white/25 bg-white/[0.03] border border-white/[0.06] hover:text-white/60 hover:bg-white/[0.07] transition-all flex items-center justify-center">
                        {b.icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Screenshot Preview — Playwright */}
                <div className="flex-1 relative bg-[#0a0c12] overflow-auto flex items-start justify-center">
                  {previewScreenshot ? (
                    <>
                      <img
                        src={previewScreenshot}
                        alt="Playwright screenshot"
                        className="w-full h-auto object-contain"
                        style={{maxWidth:"100%"}}
                      />
                      <div className="absolute top-2 right-2 flex gap-1.5">
                        <button
                          onClick={() => studioSend(`Napravi playwright screenshot stranice ${previewUrl} i opiši promjene`)}
                          className="px-2 py-1 rounded-md text-[9px] bg-black/60 text-white/50 border border-white/10 hover:bg-black/80 backdrop-blur-sm transition-all"
                        >↻ Osvježi</button>
                        <button
                          onClick={() => setPreviewScreenshot(null)}
                          className="px-2 py-1 rounded-md text-[9px] bg-black/60 text-white/50 border border-white/10 hover:bg-black/80 backdrop-blur-sm transition-all"
                        >✕</button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                      <div className="text-4xl opacity-20">🎭</div>
                      <div className="text-[11px] text-white/20 leading-relaxed max-w-[200px]">
                        Upiši URL i klikni 📸 ili reci Stellanu da otvori stranicu
                      </div>
                      <button
                        onClick={() => studioSend(`Otvori ${previewUrl} u Playwright-u i napravi screenshot`)}
                        className="px-3 py-1.5 rounded-lg text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
                      >▶ Otvori {previewUrl}</button>
                    </div>
                  )}
                </div>

              {/* Right panel */}
              <div className="w-[220px] border-l border-white/[0.06] flex flex-col bg-[hsl(220,15%,4%)] shrink-0">
                {/* Right tabs */}
                <div className="flex border-b border-white/[0.06] bg-[hsl(220,15%,5%)] shrink-0">
                  {([
                    { key: "steps",   label: "Koraci" },
                    { key: "console", label: "Log" },
                    { key: "actions", label: "Akcije" },
                    { key: "code",    label: "Kod" },
                  ] as const).map(t => (
                    <button key={t.key} onClick={() => setStudioRightTab(t.key)}
                      className={cn("flex-1 py-1.5 text-[9px] border-b-[1.5px] transition-all",
                        studioRightTab === t.key
                          ? "text-indigo-300 border-indigo-500"
                          : "text-white/20 border-transparent hover:text-white/40"
                      )}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Steps tab */}
                {studioRightTab === "steps" && (
                  <div className="flex-1 p-2 flex flex-col gap-1.5 overflow-y-auto">
                    {([
                      { s: "done",   n: "✓", title: "Otvori SDGE portal",        meta: "342ms" },
                      { s: "done",   n: "✓", title: "Prijava s kredencijalima",   meta: "1.2s" },
                      { s: "active", n: "3", title: `Klikni "Novi zahtjev"`,      meta: "čeka..." },
                      { s: "wait",   n: "4", title: "Popuni obrazac (k.č., k.o.)", meta: "" },
                      { s: "wait",   n: "5", title: "Priloži elaborat PDF",        meta: "" },
                      { s: "wait",   n: "6", title: "Pošalji i preuzmi potvrdu",   meta: "" },
                    ]).map((step, i) => (
                      <div key={i} className={cn("flex items-start gap-2 p-2 rounded-lg",
                        step.s === "done"   ? "bg-emerald-500/[0.04]" :
                        step.s === "active" ? "bg-indigo-500/[0.08] border border-indigo-500/20" :
                        "opacity-40"
                      )}>
                        <div className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] shrink-0 mt-0.5",
                          step.s === "done"   ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" :
                          step.s === "active" ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 animate-pulse" :
                          "bg-white/[0.04] text-white/20 border border-white/[0.08]"
                        )}>
                          {step.n}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn("text-[10px] leading-snug",
                            step.s === "active" ? "text-indigo-200" : step.s === "done" ? "text-white/50" : "text-white/25"
                          )}>{step.title}</div>
                          {step.meta && <div className="text-[8px] text-white/20 mt-0.5">{step.meta}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}


                {/* Console tab — live logs */}
                {studioRightTab === "console" && (
                  <div className="flex-1 p-2 font-mono text-[9px] leading-loose overflow-y-auto bg-[hsl(220,15%,3%)]">
                    {consoleLogs.map((l, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className="text-white/10 shrink-0">{String(i+1).padStart(2,"0")}</span>
                        <span className={
                          l.t === "ok"   ? "text-emerald-400" :
                          l.t === "info" ? "text-indigo-300" :
                          l.t === "warn" ? "text-amber-300" :
                          l.t === "err"  ? "text-red-400" :
                          "text-white/20"
                        }>{l.msg}</span>
                      </div>
                    ))}
                    <div ref={consoleEndRef} />
                  </div>
                )}

                {/* Actions tab — click to execute */}
                {studioRightTab === "actions" && (
                  <div className="flex-1 p-2 flex flex-col gap-1.5 overflow-y-auto">
                    <div className="text-[9px] text-white/20 px-1 mb-1">Klikni akciju → Stellan izvršava</div>
                    {([
                      { icon: "🏛️", name: "SDGE prijava",              cmd: "Otvori SDGE portal playwright-om i prijavi se s kredencijalima", badge: "ok", bc: "emerald" },
                      { icon: "📋", name: "OSS pretraživanje",          cmd: "Otvori OSS portal playwright-om i pretraži najnovije predmete", badge: "ok", bc: "emerald" },
                      { icon: "🧾", name: "Solo novi račun",             cmd: "Otvori Solo.hr playwright-om i pripremi novi račun", badge: "ok", bc: "emerald" },
                      { icon: "📂", name: "Drive pregled foldera",       cmd: "Pretraži firmeni Google Drive i ispiši sadržaj glavnog foldera", badge: "ok", bc: "emerald" },
                      { icon: "🔍", name: "OIB lookup",                 cmd: "Pokreni provjeru OIB-a za unos korisnika", badge: "ok", bc: "emerald" },
                      { icon: "📸", name: "Screenshot + analiza",       cmd: `Napravi playwright screenshot stranice ${previewUrl} i detaljno opiši što vidiš`, badge: "live", bc: "indigo" },
                      { icon: "🗺️", name: "eNekretnine parcela",        cmd: "Otvori eNekretnine playwright-om i pretraži podatke o parceli", badge: "ok", bc: "emerald" },
                      { icon: "📐", name: "Pokreni LISP skriptu",       cmd: "Pokreni Python skriptu koja poziva AutoCAD LISP funkciju", badge: "beta", bc: "amber" },
                      { icon: "🔀", name: "Git push deploy",            cmd: "Pokreni git push na GitHub i deploya na Vercel", badge: "ok", bc: "emerald" },
                      { icon: "🌐", name: "Web scrape stranice",        cmd: `Scrapiraj sadržaj stranice ${previewUrl} i izvuci ključne podatke`, badge: "live", bc: "indigo" },
                    ]).map((a, i) => (
                      <button key={i}
                        onClick={() => studioSend(a.cmd)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:bg-indigo-500/[0.08] hover:border-indigo-500/20 transition-all text-left group">
                        <span className="text-sm">{a.icon}</span>
                        <span className="flex-1 text-[10px] text-white/45 group-hover:text-white/70">{a.name}</span>
                        <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full border",
                          a.bc === "emerald" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          a.bc === "amber"   ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                        )}>{a.badge}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Code tab — auto-populated from assistant responses */}
                {studioRightTab === "code" && (
                  <div className="flex-1 p-2 overflow-y-auto flex flex-col gap-2">
                    <div className="text-[9px] text-white/20 px-1">Kod iz Stellanovog odgovora</div>
                    {generatedCode ? (
                      <>
                        <pre className="bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.05] font-mono text-[9px] text-white/50 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                          {generatedCode}
                        </pre>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => navigator.clipboard.writeText(generatedCode)}
                            className="flex-1 py-1.5 text-[9px] text-white/30 border border-white/[0.07] rounded-lg hover:bg-white/[0.04] transition-all">
                            📋 Kopiraj
                          </button>
                          <button
                            onClick={() => studioSend(`Pokreni ovaj kod lokalno:\n\`\`\`\n${generatedCode}\n\`\`\``)}
                            className="flex-1 py-1.5 text-[9px] text-emerald-400 border border-emerald-500/20 rounded-lg bg-emerald-500/[0.06] hover:bg-emerald-500/10 transition-all">
                            ▶ Pokreni
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center text-[10px] text-white/15 px-4">
                          <div className="text-2xl mb-2">{ }</div>
                          Kada Stellan napiše kod, pojavljuje se ovdje
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── BOTTOM COMMAND BAR ── */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.06] bg-[hsl(220,15%,5%)] shrink-0">
              <input
                value={studioInput}
                onChange={e => setStudioInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleStudioExecute(); }}
                placeholder="Nauči Stellana akciju, daj playwright naredbu..."
                className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 text-[11px] font-mono text-white/50 placeholder:text-white/20 focus:outline-none focus:border-indigo-500/30 focus:text-white/70 transition-colors"
              />
              <button
                onClick={handleStudioScreenshot}
                title="Screenshot trenutne stranice → Stellan analizira"
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-[10px] text-white/35 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:text-white/60 transition-all"
              >📸</button>
              <button
                onClick={() => { setStudioRightTab("console"); addLog("info", "→ otvori " + previewUrl); }}
                title="Otvori URL u previewu"
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-[10px] text-white/35 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:text-white/60 transition-all"
              >🌐</button>
              <button
                onClick={handleStudioExecute}
                disabled={!studioInput.trim()}
                className={cn(
                  "flex items-center gap-1 px-3 py-2 rounded-lg text-[10px] font-medium border transition-all",
                  studioInput.trim()
                    ? "text-indigo-200 bg-indigo-500/15 border-indigo-500/25 hover:bg-indigo-500/25"
                    : "text-white/15 bg-white/[0.02] border-white/[0.05] cursor-not-allowed"
                )}
              >▶ Izvedi</button>
            </div>

            {/* ── STATUS BAR ── */}
            <div className="flex items-center gap-3 px-3 py-1 border-t border-white/[0.04] bg-[hsl(220,15%,3%)] shrink-0">
              <div className="flex items-center gap-1.5 text-[9px] text-white/25">
                <div className={cn("w-1.5 h-1.5 rounded-full", agentOnline === true ? "bg-emerald-400 animate-pulse" : agentOnline === false ? "bg-red-400" : "bg-white/20")} />
                {agentOnline === true ? "Agent online" : agentOnline === false ? "Agent offline" : "Agent..."}
              </div>
              <div className="w-px h-3 bg-white/[0.07]" />
              <div className="flex items-center gap-1.5 text-[9px] text-white/20">
                <div className="w-1 h-1 rounded-full bg-indigo-400" />
                Playwright
              </div>
              <div className="w-px h-3 bg-white/[0.07]" />
              <div className="flex items-center gap-1.5 text-[9px] text-white/20">
                <div className="w-1 h-1 rounded-full bg-violet-400" />
                {selectedModel}
              </div>
              <div className="text-[9px] text-white/12 ml-1 truncate max-w-[200px]">📍 {previewUrl}</div>
              <button
                onClick={checkAgentHealth}
                className="ml-auto text-[9px] text-white/15 hover:text-white/40 transition-colors"
                title="Provjeri status agenta"
              >↺</button>
            </div>

          </div>
        )}
    </div>
  );
};

export default ChatDialog;
