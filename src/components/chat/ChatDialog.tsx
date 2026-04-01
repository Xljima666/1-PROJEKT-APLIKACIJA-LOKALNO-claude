import DevPanel from "../dev/DevPanel";
import type { ConsoleLog } from "../dev/DevPanel";
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

const MODEL_LABELS: Record<"flash" | "pro" | "flash3" | "pro3", string> = {
  flash: "GPT-5.4-mini",
  pro: "GPT-5.4",
  flash3: "GPT-5.4-mini+",
  pro3: "GPT-5.4+",
};

const MODEL_BADGES: Record<"flash" | "pro" | "flash3" | "pro3", string> = {
  flash: "FAST",
  pro: "SMART",
  flash3: "FAST+",
  pro3: "SMART+",
};

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingName, setRecordingName] = useState("");
  const [savedActions, setSavedActions] = useState<{name:string,file:string}[]>([]);
  const [recordedSteps, setRecordedSteps] = useState<{n:number,url:string,desc:string,screenshot?:string}[]>([]);
  const [stepDesc, setStepDesc] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [studioTab, setStudioTab] = useState<"playwright"|"terminal"|"files"|"memory"|"webbuilder"|"gis"|"api">("playwright");
  const [studioRightTab, setStudioRightTab] = useState<"steps"|"console"|"actions"|"code">("steps");
  const [studioSidebarTool, setStudioSidebarTool] = useState("playwright");
  const [studioInput, setStudioInput] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<{t:string,msg:string}[]>([{t:"dim",msg:"Dev Studio spreman"}]);
  const [agentOnline, setAgentOnline] = useState<boolean|null>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [previewScreenshotUrl, setPreviewScreenshotUrl] = useState<string>("");
  const [lastPreviewSummary, setLastPreviewSummary] = useState<string>("");
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [reactions, setReactions] = useState<Record<number, "up" | "down">>({});
  const [pendingImages, setPendingImages] = useState<{name: string, base64: string, size: number}[]>([]);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isAgentActionRunning, setIsAgentActionRunning] = useState(false);
const handleDevPanelAction = async (
  action: "open" | "click" | "type" | "screenshot" | "learn",
  payload?: { url?: string; target?: string; value?: string }
) => {
  if (action === "open" && payload?.url) {
    await executeStudioFlow(`idi na ${payload.url}`);
    return;
  }

  if (action === "click" && payload?.target) {
    await executeStudioFlow(`klikni ${payload.target}`);
    return;
  }

  if (action === "type" && payload?.value) {
    await executeStudioFlow(`upiši "${payload.value}" u "input"`);
    return;
  }

  if (action === "screenshot") {
    await refreshPreviewScreenshot();
    return;
  }

  if (action === "learn") {
    handleStartRecording();
  }
};  
const devPanelMessages = messages.map((m, index) => ({
  id: `msg-${index}`,
  role: m.role,
  content: m.content,
  createdAt: undefined,
}));

const devPanelSteps = recordedSteps.map((step, index) => ({
  id: `step-${index}`,
  action: "screenshot" as const,
  label: step.desc || `Korak ${step.n}`,
  status: "done" as const,
  detail: step.url,
  target: step.url,
  createdAt: undefined,
}));

const devPanelPreview = {
  url: previewUrl,
  title: "Playwright preview",
  screenshotUrl: previewScreenshot,
  isLive: agentOnline === true,
  summary: lastPreviewSummary,
};
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
      addLog("ok", "OK " + last.content.slice(0,70));
      const b64idx = last.content.indexOf("data:image/png;base64,");
      if (b64idx > -1) {
        const b64end = last.content.indexOf(")", b64idx);
        if (b64end > -1) { setPreviewScreenshot(last.content.slice(b64idx, b64end)); addLog("ok", "screenshot"); }
      }
    }
  }, [messages.length]);

  useEffect(() => {
    if (!devMode) return;
    checkAgentHealth();
    void (async () => {
      const result = await callAgentDirect("record/list", {}, "GET");
      if (result?.success && Array.isArray(result.actions)) {
        setSavedActions(result.actions);
        addLog("ok", `✓ Učitano akcija: ${result.actions.length}`);
      }
    })();
  }, [devMode]);
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


  // Dev Studio helpers ────────────────────────────────────
  const addLog = (t: string, msg: string) => {
    setConsoleLogs(prev => [...prev.slice(-99), { t, msg }]);
    setTimeout(() => consoleEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
  };

  // Direct agent call - bypasses Stellan/Gemini entirely
  const callAgentDirect = async (endpoint: string, body: object = {}, method: "POST" | "GET" = "POST") => {
    const AGENT_URL = import.meta.env.VITE_AGENT_SERVER_URL || "";
    const AGENT_KEY = import.meta.env.VITE_AGENT_API_KEY || "";
    if (!AGENT_URL) { addLog("warn", "AGENT_SERVER_URL nije postavljen"); return null; }
    try {
      const res = await fetch(`${AGENT_URL}/${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json", "X-API-Key": AGENT_KEY, "ngrok-skip-browser-warning": "true" },
        body: method === "GET" ? undefined : JSON.stringify(body),
      });
      return await res.json();
    } catch (e) {
      addLog("warn", `Agent greška: ${e}`);
      return null;
    }
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

  const pushAssistantMessage = useCallback((content: string) => {
    if (!content.trim()) return;
    setMessages(prev => [...prev, { role: "assistant", content }]);
  }, []);

  const extractVisibleSummary = (raw: string) => {
    const clean = raw.replace(/\s+/g, " ").trim();
    if (!clean) return "";
    return clean.length > 1400 ? clean.slice(0, 1400) + "…" : clean;
  };

  const syncPreviewFromAgent = useCallback((data: any) => {
    if (!data) return;
    if (data.url) {
      setPreviewUrl(data.url);
      setPreviewScreenshotUrl(data.url);
    }
    if (data.screenshot_base64) {
      const src = data.screenshot_base64.startsWith("data:image")
        ? data.screenshot_base64
        : `data:image/png;base64,${data.screenshot_base64}`;
      setPreviewScreenshot(src);
    }
  }, []);

  const describeCurrentPreview = useCallback(async (options?: { heading?: string; fallback?: string; silent?: boolean }) => {
    const extracted = await callAgentDirect("playwright", { action: "extract", timeout: 15000 });
    if (!extracted?.success) {
      const fallback = options?.fallback || "Ne mogu trenutno očitati sadržaj stranice.";
      if (!options?.silent) pushAssistantMessage(`⚠️ ${fallback}`);
      return "";
    }

    const visible = extractVisibleSummary(extracted?.content || "");
    setLastPreviewSummary(visible || options?.fallback || "");

    if (!options?.silent) {
      const titleLine = extracted?.url ? `**URL:** ${extracted.url}` : "";
      pushAssistantMessage([
        options?.heading || "### Stellan vidi u previewu",
        titleLine,
        visible || options?.fallback || "Stranica je otvorena, ali nisam izvukao dovoljno teksta za sažetak.",
      ].filter(Boolean).join("\n\n"));
    }

    return visible;
  }, [pushAssistantMessage]);

  const refreshPreviewScreenshot = useCallback(async (options?: { fullPage?: boolean; silent?: boolean }) => {
    const refreshed = await callAgentDirect("playwright", { action: "screenshot", full_page: options?.fullPage ?? false, timeout: 15000 });
    if (refreshed?.success) {
      syncPreviewFromAgent(refreshed);
    } else if (!options?.silent) {
      pushAssistantMessage(`⚠️ Ne mogu osvježiti preview: ${refreshed?.error || "agent nedostupan"}`);
    }
    return refreshed;
  }, [pushAssistantMessage, syncPreviewFromAgent]);

  const waitForPreviewReady = useCallback(async (timeoutMs = 5000) => {
    const waited = await callAgentDirect("playwright", { action: "wait", timeout: timeoutMs });
    if (waited?.success) {
      addLog("ok", `✓ Pričekao sam ${timeoutMs}ms za učitavanje`);
      await refreshPreviewScreenshot({ silent: true });
    } else {
      addLog("warn", "Čekanje nije uspjelo: " + (waited?.error || "agent nedostupan"));
    }
    return waited;
  }, [refreshPreviewScreenshot]);

  const runPlaywrightAction = useCallback(async (payload: any, options?: { appendSummary?: boolean; summaryPrefix?: string; refreshAfter?: boolean; describeAfter?: boolean; describeHeading?: string }) => {
    setIsAgentActionRunning(true);
    try {
      const data = await callAgentDirect("playwright", payload);
      if (!data?.success) {
        addLog("warn", data?.error || "Agent akcija nije uspjela");
        pushAssistantMessage(`❌ Agent greška: ${data?.error || "nepoznata greška"}`);
        return null;
      }
      syncPreviewFromAgent(data);
      if (options?.appendSummary && data.message) {
        pushAssistantMessage(`${options.summaryPrefix || "✅"} ${data.message}`);
      }
      if (options?.refreshAfter) {
        await refreshPreviewScreenshot({ silent: true });
      }
      if (options?.describeAfter) {
        await describeCurrentPreview({ heading: options.describeHeading || "### Stellan vidi u previewu", fallback: "Akcija je izvršena, ali nisam izvukao dovoljno teksta za sažetak." });
      }
      return data;
    } finally {
      setIsAgentActionRunning(false);
    }
  }, [pushAssistantMessage, syncPreviewFromAgent, refreshPreviewScreenshot, describeCurrentPreview]);

  const runHighLevelAgentCommand = useCallback(async (command: string) => {
    setIsAgentActionRunning(true);
    try {
      const data = await callAgentDirect("agent/run", { command });
      if (!data?.success) {
        addLog("warn", data?.error || "Agent ne razumije naredbu");
        return null;
      }
      syncPreviewFromAgent(data);
      if (data?.message) addLog("ok", data.message);
      return data;
    } finally {
      setIsAgentActionRunning(false);
    }
  }, [syncPreviewFromAgent]);

  const executeStudioCommand = useCallback(async (cmd: string) => {
    const raw = cmd.trim();
    if (!raw) return;
    addLog("info", "→ " + raw.slice(0, 80));
    setStudioInput("");

    const lower = raw.toLowerCase();
    const urlMatch = raw.match(/((https?:\/\/|www\.)[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i);
    const navIntent = /^(idi na|odi na|otvori|open|navigate)/i.test(lower) || (!!urlMatch && !/^(klikni|pritisni|upiši|upisi|unesi|unesite|čekaj|cekaj)/i.test(lower));

    if (navIntent && urlMatch) {
      const result = await runHighLevelAgentCommand(raw);
      if (result?.success) {
        const extracted = await callAgentDirect("playwright", { action: "extract", timeout: 10000 });
        const visible = extractVisibleSummary(extracted?.content || "");
        setLastPreviewSummary(visible || result.message || "Stranica je otvorena.");
        pushAssistantMessage([
          "### Stellan vidi u previewu",
          result.title ? `**Naslov:** ${result.title}` : "",
          result.url ? `**URL:** ${result.url}` : "",
          visible || result.message || "Stranica je otvorena i screenshot je osvježen."
        ].filter(Boolean).join("\n\n"));
      }
      return;
    }

    if (/(screenshot|snimku|snimi|što vidiš|sto vidis)/i.test(lower)) {
      const result = await runHighLevelAgentCommand(raw);
      if (result?.success) {
        const extracted = await callAgentDirect("playwright", { action: "extract", timeout: 10000 });
        const visible = extractVisibleSummary(extracted?.content || "");
        setLastPreviewSummary(visible || result.message || "Screenshot je osvježen.");
        pushAssistantMessage(`### Pregled stranice\n\n${visible || result.message || "Screenshot je osvježen u previewu."}`);
      }
      return;
    }

    const clickMatch = raw.match(/^(klikni|pritisni)\s+(.+)$/i);
    if (clickMatch) {
      const target = clickMatch[2].trim().replace(/^['"]|['"]$/g, "");
      const selector = target.startsWith("#") || target.startsWith(".") || target.startsWith("//") || target.startsWith("text=") ? target : `text=${target}`;
      const data = await runPlaywrightAction(
        { action: "click", selector, timeout: 20000 },
        { refreshAfter: true, describeAfter: true, describeHeading: `### Stellan vidi nakon klika na ${target}` }
      );
      if (data?.success) {
        await waitForPreviewReady(1500);
        pushAssistantMessage(`✅ Kliknuo sam **${target}**.`);
      }
      return;
    }

    const fillQuoted = raw.match(/^(upiši|upisi|unesi|unesite)\s+["“](.+?)["”]\s+u\s+["“](.+?)["”]$/i);
    const fillSimple = raw.match(/^(upiši|upisi|unesi|unesite)\s+(.+?)\s+u\s+(.+)$/i);
    const fillMatch = fillQuoted || fillSimple;
    if (fillMatch) {
      const value = fillMatch[2].trim();
      const target = fillMatch[3].trim();
      const selector = target.startsWith("#") || target.startsWith(".") || target.startsWith("//") || target.startsWith("input") || target.startsWith("textarea") || target.startsWith("select")
        ? target
        : `input[placeholder*=\"${target}\" i], input[name*=\"${target}\" i], textarea[placeholder*=\"${target}\" i]`;
      const data = await runPlaywrightAction(
        { action: "fill", selector, value, timeout: 20000 },
        { refreshAfter: true, describeAfter: true, describeHeading: `### Stellan vidi nakon unosa u ${target}` }
      );
      if (data?.success) {
        pushAssistantMessage(`✅ Upisao sam **${value}** u **${target}**.`);
      }
      return;
    }

    const waitSeconds = raw.match(/^(čekaj|cekaj)\s+(\d+)\s*(s|sek|sekundi|sec)?$/i);
    const waitMs = raw.match(/^(čekaj|cekaj)\s+(\d+)\s*ms$/i);
    if (waitSeconds || waitMs) {
      const timeout = waitMs ? Number(waitMs[2]) : Number(waitSeconds?.[2] || 1) * 1000;
      const data = await runPlaywrightAction(
        { action: "wait", timeout },
        { appendSummary: true, summaryPrefix: "⏳", refreshAfter: true, describeAfter: true, describeHeading: "### Stellan vidi nakon čekanja" }
      );
      if (data?.success) {
        setLastPreviewSummary(`Pričekao sam ${timeout}ms i osvježio preview.`);
      }
      return;
    }

    if (lower.includes("html") || lower.includes("izvuci tekst") || lower.includes("procitaj stranicu") || lower.includes("pročitaj stranicu")) {
      const extracted = await callAgentDirect("playwright", { action: "extract", timeout: 15000 });
      if (extracted?.success) {
        pushAssistantMessage(`### Tekst sa stranice\n\n${extractVisibleSummary(extracted.content || "") || "Nisam uspio izvući tekst."}`);
      } else {
        pushAssistantMessage(`❌ Ne mogu izvući tekst: ${extracted?.error || "nepoznata greška"}`);
      }
      return;
    }

    pushAssistantMessage('ℹ️ DEV v2 razumije naredbe tipa: `idi na oss.uredjenazemlja.hr`, `klikni Prijava`, `upiši "Marko" u "korisničko ime"`, `čekaj 3s`, `screenshot`, `izvuci tekst`.');
  }, [pushAssistantMessage, runPlaywrightAction, waitForPreviewReady, describeCurrentPreview, runHighLevelAgentCommand]);

  const executeStudioFlow = useCallback(async (rawInput: string) => {
    const normalized = rawInput
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean)
      .join("\n");

    const steps = normalized
      .split(/\n+|\s+onda\s+/i)
      .map(s => s.trim())
      .filter(Boolean);

    if (steps.length <= 1) {
      await executeStudioCommand(rawInput);
      return;
    }

    pushAssistantMessage(`### DEV flow\n\nPokrećem **${steps.length}** koraka redom.`);
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      addLog("info", `Flow ${i + 1}/${steps.length}: ${step}`);
      await executeStudioCommand(step);
    }
    pushAssistantMessage("✅ DEV flow je završen.");
  }, [executeStudioCommand, pushAssistantMessage]);

  const studioSend = (cmd: string) => {
    void executeStudioFlow(cmd);
  };

  const handleStudioExecute = () => {
    void executeStudioFlow(studioInput);
  };

  const handleStudioScreenshot = () => {
    void executeStudioCommand(`screenshot ${previewUrl}`);
  };

  const handlePreviewDescribe = () => {
    void describeCurrentPreview({ heading: "### Stellan vidi u previewu", fallback: "Preview je osvježen, ali nema dovoljno teksta za sažetak." });
  };

  const handlePreviewWait = () => {
    void waitForPreviewReady(2500).then((result) => {
      if (result?.success) {
        void describeCurrentPreview({ heading: "### Stellan vidi nakon čekanja", fallback: "Stranica je čekala učitavanje, ali nema dovoljno teksta za sažetak." });
      }
    });
  };

  const handleCaptureStep = async () => {
    if (!stepDesc.trim()) {
      const desc = prompt("Opiši ovaj korak (npr. 'Klikni na Prijava'):");
      if (!desc) return;
      setStepDesc(desc);
    }
    setIsCapturing(true);
    addLog("info", "📸 Snimam korak...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const AGENT_URL = import.meta.env.VITE_AGENT_SERVER_URL || "";
      if (!AGENT_URL) {
        // Fallback: ask Stellan to screenshot
        studioSend(`Napravi screenshot trenutne stranice i opiši korak: ${stepDesc || "trenutni prikaz"}`);
        setStepDesc("");
        setIsCapturing(false);
        return;
      }
      const desc = stepDesc || "korak " + (recordedSteps.length + 1);
      const data = await callAgentDirect("screenshot/step", { description: desc });
      if (data.success) {
        const step = { n: recordedSteps.length + 1, url: data.url, desc, screenshot: data.screenshot_base64 };
        setRecordedSteps(prev => [...prev, step]);
        if (data.screenshot_base64) setPreviewScreenshot("data:image/png;base64," + data.screenshot_base64);
        addLog("ok", `✓ Korak ${step.n}: ${desc}`);
        setStudioRightTab("steps");
      } else {
        addLog("warn", "Screenshot neuspješan: " + (data.error || "greška"));
      }
    } catch (e) {
      studioSend(`Napravi screenshot i zapiši korak: ${stepDesc || "korak"}`);
    }
    setStepDesc("");
    setIsCapturing(false);
  };

  const handleStartRecording = async () => {
    const name = prompt("Ime akcije koju snimas (npr. oss_prijava):");
    if (!name) return;
    setRecordingName(name);
    setIsRecording(true);
    setRecordedSteps([]);
    addLog("info", "Pokrećem učenje...");
    const result = await callAgentDirect("record/start", { name });
    if (result?.success) {
      addLog("ok", "Učenje pokrenuto: " + name);
    } else {
      addLog("warn", "Greška pri pokretanju: " + (result?.error || "agent nedostupan"));
      setIsRecording(false);
    }
  };

  const handleCancelRecording = () => {
    setIsRecording(false);
    setRecordingName("");
    setRecordedSteps([]);
    setStepDesc("");
    addLog("warn", "Učenje prekinuto");
  };

  const handleSaveAction = async () => {
    if (!recordingName) return;
    addLog("info", "Spremam akciju...");
    const result = await callAgentDirect("record/save", { name: recordingName });
    if (result?.success) {
      addLog("ok", `Akcija "${recordingName}" spremljena (${result.steps || 0} linija koda)`);
      if (result.script) setGeneratedCode(result.script);
      setStudioRightTab("code");
    } else {
      addLog("warn", "Greška pri spremanju: " + (result?.error || "agent nedostupan"));
    }
    setIsRecording(false);
    setRecordingName("");
    setRecordedSteps([]);
  };

  const handleRunSavedAction = async (name: string) => {
    addLog("info", `▶ Pokrećem akciju: ${name}`);
    setStudioRightTab("console");
    const result = await callAgentDirect("record/run", { name });
    if (result?.success) {
      addLog("ok", `✓ Akcija "${name}" izvršena`);
      if (result.stdout) addLog("dim", result.stdout.slice(0, 400));
      if (result.stderr) addLog("warn", result.stderr.slice(0, 240));
      pushAssistantMessage(`✅ Pokrenuo sam akciju **${name}**.`);
    } else {
      addLog("warn", `Greška pri pokretanju akcije "${name}": ` + (result?.error || "agent nedostupan"));
      pushAssistantMessage(`❌ Ne mogu pokrenuti akciju **${name}**: ${result?.error || "agent nedostupan"}`);
    }
  };

  const handleRefreshActions = async () => {
    addLog("info", "Učitavam spremljene akcije...");
    const result = await callAgentDirect("record/list", {}, "GET");
    if (result?.success && Array.isArray(result.actions)) {
      setSavedActions(result.actions);
      setStudioRightTab("actions");
      addLog("ok", `✓ Učitano akcija: ${result.actions.length}`);
    } else {
      addLog("warn", "Greška pri učitavanju akcija: " + (result?.error || "agent nedostupan"));
    }
  };

  const handleListActions = () => {
    void handleRefreshActions();
  };

  const handleDeploy = async () => {
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
      {!devMode && (
        <div className="flex flex-col min-w-0 relative flex-1">
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
                <p className="text-[9px] text-white/30">{MODEL_LABELS[selectedModel]} · vision · memorija ✓ · internet</p>
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
      )}

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

        {/* STELLAN DEV STUDIO — powered by DevPanel */}
        {devMode && !isMobile && (
          <div className="flex-1 min-w-0 overflow-hidden bg-[hsl(220,15%,6%)]">
            <div className="flex items-center justify-between border-l border-white/[0.06] border-b border-white/[0.06] bg-[hsl(220,15%,5%)] px-3 py-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDevMode(false)}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.08]"
                >
                  ← Natrag na chat
                </button>
                <span className="text-[10px] text-white/30">DEV fullscreen</span>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/60 hover:bg-white/[0.08] hover:text-white"
              >
                Zatvori
              </button>
            </div>
            <div className="h-[calc(100%-45px)] border-l border-white/[0.06] min-w-0 overflow-hidden">
              <DevPanel
                title="Dev Studio"
                messages={devPanelMessages}
                steps={devPanelSteps}
                preview={devPanelPreview}
                consoleLogs={consoleLogs}
                isAgentRunning={isAgentActionRunning}
                isThinking={isLoading}
                agentOnline={agentOnline}
                modelBadge={MODEL_BADGES[selectedModel]}
                isRecording={isRecording}
                recordingName={recordingName}
                isDeploying={isDeploying}
                deployStatus={deployStatus}
                savedActions={savedActions}
                onSendMessage={(msg) => studioSend(msg)}
                onRunAction={handleDevPanelAction}
                onStopAgent={() => abortControllerRef.current?.abort()}
                onClearSteps={() => setRecordedSteps([])}
                onSelectStep={(step) => {
                  if (step.detail) {
                    setPreviewUrl(step.detail);
                  }
                }}
                onDescribePreview={handlePreviewDescribe}
                onWaitForLoad={handlePreviewWait}
                onRefreshScreenshot={handleStudioScreenshot}
                onDeploy={handleDeploy}
                onStartAgent={handleStartAgent}
                onStartRecording={handleStartRecording}
                onSaveRecording={handleSaveAction}
                onCancelRecording={handleCancelRecording}
                onRunSavedAction={handleRunSavedAction}
                onRefreshActions={handleRefreshActions}
                onCheckHealth={checkAgentHealth}
                onPortalAction={(cmd) => studioSend(cmd)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatDialog;
