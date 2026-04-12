import DevPanel from "../dev/DevPanel";
import type { ConsoleLog } from "../dev/DevPanel";
import LearningPanel from "./LearningPanel";
import BrainPanel from "./BrainPanel";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, Send, Sparkles, Plus, MessageSquare, Trash2, Code2, PanelLeftClose, PanelLeftOpen, PanelRightClose, Mic, Square, ClipboardList, Upload, Camera, Image, File, FileText, Paperclip, HardDrive, ArrowDown, Search, Download, Zap, Brain } from "lucide-react";
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
import ProviderSelector, { PROVIDERS, type Provider } from "./ProviderSelector";
import { useDevOpsStatus } from "@/hooks/useDevOpsStatus";

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
  initialView?: "chat" | "dev";
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

const ChatDialog = ({ open, onClose, initialView = "chat" }: ChatDialogProps) => {
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
  const [devStudioMode, setDevStudioMode] = useState(false);
  const [brainMode, setBrainMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"flash" | "pro" | "flash3" | "pro3">("flash");
  const [selectedProvider, setSelectedProvider] = useState<Provider>("xai");
  const [selectedProviderModel, setSelectedProviderModel] = useState<string>("grok-4-1-fast");
  const [previewUrl, setPreviewUrl] = useState("http://localhost:8080");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<"idle" | "success" | "error">("idle");
  const [isStartingAgent, setIsStartingAgent] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingName, setRecordingName] = useState("");
  const [budgetEur, setBudgetEur] = useState<string>(() => localStorage.getItem("stellan_budget") || "");
  const [spentEur, setSpentEur] = useState<number>(() => parseFloat(localStorage.getItem("stellan_spent") || "0"));
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
  const [projectRootState, setProjectRootState] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("stellan_project_root") || "" : ""));
  const [generatedCode, setGeneratedCode] = useState("");
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [previewScreenshotUrl, setPreviewScreenshotUrl] = useState<string>("");
  const [lastPreviewSummary, setLastPreviewSummary] = useState<string>("");
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [reactions, setReactions] = useState<Record<number, "up" | "down">>({});
  const [pendingImages, setPendingImages] = useState<{name: string, base64: string, size: number}[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{name: string, size: number, type: string, content?: string, language?: string, pdfText?: string, pdfPages?: number, pdfUrl?: string}[]>([]);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isAgentActionRunning, setIsAgentActionRunning] = useState(false);

  const {
    snapshot: devOpsSnapshot,
    loading: devOpsLoading,
    refreshing: devOpsRefreshing,
    refresh: refreshDevOps,
  } = useDevOpsStatus({
    enabled: open && devStudioMode && !isMobile,
    projectRoot: projectRootState,
  });
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

// Track all agent steps (not just recorded ones)
const [devSteps, setDevSteps] = useState<{id:string;action:string;label:string;status:"queued"|"running"|"done"|"error";detail?:string;target?:string}[]>([]);

const addDevStep = (action: string, label: string, target?: string) => {
  const id = `step-${Date.now()}`;
  setDevSteps(prev => [...prev, { id, action, label, status: "running", target }]);
  return id;
};

const updateDevStep = (id: string, status: "done" | "error", detail?: string) => {
  setDevSteps(prev => prev.map(s => s.id === id ? { ...s, status, detail } : s));
};

const devPanelSteps = devSteps.map((step) => ({
  id: step.id,
  action: (step.action as "open" | "click" | "type" | "screenshot" | "learn") || "open",
  label: step.label,
  status: step.status,
  detail: step.detail,
  target: step.target,
  createdAt: undefined,
}));


useEffect(() => {
  if (!open) return;

  const nextRoot = typeof window !== "undefined" ? localStorage.getItem("stellan_project_root") || "" : "";
  setProjectRootState(nextRoot);

  if (initialView === "dev" && !isMobile) {
    setDevStudioMode(true);
    setDevMode(false);
    setBrainMode(false);
  } else if (initialView === "chat") {
    setDevStudioMode(false);
  }
}, [open, initialView, isMobile]);

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
          const arrayBuffer = await file.arrayBuffer();

          // Upload PDF to storage
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
          if (fullText.length > 200000) fullText = fullText.slice(0, 200000) + "\n...[skraćeno]";

          setPendingFiles(prev => [...prev, {
            name: file.name,
            size: file.size,
            type: "application/pdf",
            pdfText: fullText.trim() || "_Nema tekstualnog sadržaja (skenirani dokument)_",
            pdfPages: pdf.numPages,
            pdfUrl: pdfStorageUrl || undefined,
          }]);
        } catch (err) {
          console.error("PDF parse error:", err);
          setPendingFiles(prev => [...prev, { name: file.name, size: file.size, type: "application/pdf" }]);
        }
        continue;
      }

      // Try to read as text
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
          if (fileContent.length > 200000) fileContent = fileContent.slice(0, 200000) + "\n...[skraćeno]";
          
          const ext = file.name.split('.').pop()?.toLowerCase() || "";
          const langMap: Record<string, string> = {
            js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx", py: "python",
            json: "json", html: "html", htm: "html", css: "css", xml: "xml",
            sql: "sql", yaml: "yaml", yml: "yaml", md: "markdown", sh: "bash",
            bat: "batch", go: "go", rs: "rust", rb: "ruby", java: "java",
            kt: "kotlin", swift: "swift", cpp: "cpp", c: "c", php: "php",
          };
          const lang = langMap[ext] || ext || "text";
          
          setPendingFiles(prev => [...prev, {
            name: file.name,
            size: file.size,
            type: file.type || "text/plain",
            content: fileContent,
            language: lang,
          }]);
        } catch {
          setPendingFiles(prev => [...prev, { name: file.name, size: file.size, type: file.type || "unknown" }]);
        }
        continue;
      }

      // Binary file — just metadata
      setPendingFiles(prev => [...prev, { name: file.name, size: file.size, type: file.type || "unknown" }]);
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
    if (!rawText && pendingImages.length === 0 && pendingFiles.length === 0) return;
    if (isLoading || !user) return;

    // ── PROJECT COMMAND INTERCEPT ──
    if (pendingImages.length === 0 && pendingFiles.length === 0 && rawText && isLikelyProjectCommand(rawText)) {
      setMessages(prev => [...prev, { role: "user", content: rawText }]);
      setInput("");
      await executeProjectCommand(rawText);
      return;
    }

    // ── DEV MODE INTERCEPT ──
    if (devMode && pendingImages.length === 0 && pendingFiles.length === 0 && rawText) {
      const lower = rawText.toLowerCase();
      const hasUrl = /https?:\/\/[^\s]+/i.test(rawText);
      const isAgentCommand = hasUrl
        || /^(otvori|idi na|klikni|pritisni|upiši|upisi|unesi|čekaj|cekaj|screenshot|snimi|snimku)/i.test(lower)
        || lower.includes("otvori ") || lower.includes("idi na ")
        || lower.includes("klikni ") || lower.includes("pritisni ")
        || lower.includes("screenshot") || lower.includes("izvuci tekst");

      if (isAgentCommand) {
        setMessages(prev => [...prev, { role: "user", content: rawText }]);
        setInput("");
        await executeStudioFlow(rawText);
        return;
      }
    }

    const baseText = rawText;

    // Build message content: files + images + text
    const parts: string[] = [];

    // Pending files → AI gets full content, ««FILE»» delimiters for UI rendering
    for (const f of pendingFiles) {
      const sizeStr = `${(f.size / 1024).toFixed(1)} KB`;
      if (f.pdfText) {
        const pages = f.pdfPages || 0;
        const urlPart = f.pdfUrl ? `:${f.pdfUrl}` : "";
        parts.push(`\u00ab\u00abFILE:pdf:${f.name}:${sizeStr}:${pages}${urlPart}\u00bb\u00bb\n${f.pdfText}\n\u00ab\u00ab/FILE\u00bb\u00bb`);
      } else if (f.content && f.language) {
        parts.push(`\u00ab\u00abFILE:${f.language}:${f.name}:${sizeStr}\u00bb\u00bb\n${f.content}\n\u00ab\u00ab/FILE\u00bb\u00bb`);
      } else {
        parts.push(`\u00ab\u00abFILE:bin:${f.name}:${sizeStr}\u00bb\u00bb\n[binarni sadržaj]\n\u00ab\u00ab/FILE\u00bb\u00bb`);
      }
    }

    // Pending images
    const imagesMd = pendingImages.map(img => `![${img.name}](${img.base64})`).join('\n');
    if (imagesMd) parts.push(imagesMd);

    // User text
    if (baseText) parts.push(baseText);

    const text = parts.join('\n\n');

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setPendingImages([]);
    setPendingFiles([]);
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
    // streamTimeoutId is declared here so it's accessible in both try and cleanup
    let streamTimeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      // Guard: if session has expired the publishable key is not a valid JWT — fail early
      if (!currentSession?.access_token) {
        console.error("[Chat] Nema aktivne sesije — ne mogu poslati poruku");
        setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Sesija je istekla. Osvježi stranicu i pokušaj ponovo." }]);
        setIsLoading(false);
        isStreamingRef.current = false;
        return;
      }

      // Truncate history to last 40 messages to avoid context-window overflow and slow timeouts
      const MAX_HISTORY = 40;
      const cleanMessages = newMessages.length > MAX_HISTORY ? newMessages.slice(-MAX_HISTORY) : newMessages;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Abort the stream after 130 s so the UI never stays locked indefinitely
      streamTimeoutId = setTimeout(() => {
        console.warn("[Chat] Stream timeout — prekidam zahtjev nakon 130 s");
        abortController.abort();
      }, 130_000);

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          messages: cleanMessages,
          conversation_id: convId,
          reasoning: reasoningMode,
          model: selectedModel,
          provider: selectedProvider,
          provider_model: selectedProviderModel,
        }),
        signal: abortController.signal,
      });

      if (!resp.ok) {
        let errMsg = "Greška u komunikaciji s AI servisom.";
        try { const b = await resp.json(); errMsg = b.error || errMsg; } catch { /* not JSON */ }
        console.error("[Chat] HTTP greška:", resp.status, errMsg);
        setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
        if (streamTimeoutId) clearTimeout(streamTimeoutId);
        abortControllerRef.current = null;
        isStreamingRef.current = false;
        setThinkingStatus(null);
        setIsLoading(false);
        return;
      }

      if (!resp.body) {
        console.error("[Chat] Nema tijela odgovora od servera");
        setMessages((prev) => [...prev, { role: "assistant", content: "Nema odgovora od servera." }]);
        if (streamTimeoutId) clearTimeout(streamTimeoutId);
        abortControllerRef.current = null;
        isStreamingRef.current = false;
        setThinkingStatus(null);
        setIsLoading(false);
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
        // User stopped generation (or 130 s timeout) — keep what we have so far
        if (!assistantSoFar) {
          assistantSoFar = "⏹ Generiranje zaustavljeno.";
          setMessages((prev) => [...prev, { role: "assistant", content: assistantSoFar }]);
        }
      } else {
        console.error("[Chat] Greška pri slanju poruke:", e);
        assistantSoFar = "Greška u povezivanju s AI servisom.";
        setMessages((prev) => [...prev, { role: "assistant", content: assistantSoFar }]);
      }
    }

    if (streamTimeoutId) clearTimeout(streamTimeoutId);
    abortControllerRef.current = null;
    isStreamingRef.current = false;
    setThinkingStatus(null);

    // Estimate cost (rough: ~4 chars/token, using xAI pricing)
    if (assistantSoFar) {
      const inputChars = newMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
      const outputChars = assistantSoFar.length;
      const inputTokens = inputChars / 4;
      const outputTokens = outputChars / 4;
      // Grok 4.1 Fast: $0.20/1M in, $0.50/1M out; Grok 4.20: $2/1M in, $6/1M out
      const isReasoning = selectedProviderModel.includes("4.20");
      const inRate = isReasoning ? 2.0 : 0.20;
      const outRate = isReasoning ? 6.0 : 0.50;
      const costUsd = (inputTokens * inRate + outputTokens * outRate) / 1_000_000;
      const costEur = costUsd * 0.92; // approx USD→EUR
      setSpentEur(prev => {
        const next = +(prev + costEur).toFixed(4);
        localStorage.setItem("stellan_spent", String(next));
        return next;
      });
    }

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

  const isLikelyProjectCommand = (raw: string) => {
    const text = raw.trim();
    return (
      /^(procitaj|pročitaj|read)\s+/i.test(text) ||
      /^(nadji|nađi)\s+/i.test(text) ||
      /^(pretrazi projekt|pretraži projekt|search project)\s+/i.test(text) ||
      /^(trazi u projektu|traži u projektu)\s+/i.test(text) ||
      /^(pokreni build|run build|build)$/i.test(text) ||
      /^(git status|status)$/i.test(text) ||
      /^(git commit|commit)\b/i.test(text) ||
      /^(git push|push)\b/i.test(text) ||
      /^(deploy)\b/i.test(text) ||
      /^(primijeni patch|primjeni patch|apply patch)\b/i.test(text) ||
      /^(spremi file|zapisi file|zapiši file|write file)\s+/i.test(text) ||
      /^(postavi projekt root|postavi project root|set project root|root)\s+/i.test(text)
    );
  };

  const executeProjectCommand = async (rawInput: string) => {
    const raw = rawInput.trim();
    if (!raw) return false;

    const cleanQuoted = (value: string) => value.trim().replace(/^["'`]|["'`]$/g, "");
    const getProjectRoot = () => (localStorage.getItem("stellan_project_root") || "").trim();
    const detectLanguage = (path: string) => {
      const ext = path.split(".").pop()?.toLowerCase() || "";
      const map: Record<string, string> = {
        ts: "ts",
        tsx: "tsx",
        js: "javascript",
        jsx: "jsx",
        py: "python",
        json: "json",
        html: "html",
        css: "css",
        md: "markdown",
        sql: "sql",
        yaml: "yaml",
        yml: "yaml",
        sh: "bash",
        bat: "bat",
        ps1: "powershell",
      };
      return map[ext] || "";
    };
    const makeCodeFence = (path: string, content: string) => {
      const lang = detectLanguage(path);
      return `\`\`\`${lang}\n${content}\n\`\`\``;
    };
    const readCodeBlock = (text: string) => {
      const match = text.match(/```(?:[a-z0-9_+-]+)?\n([\s\S]*?)```/i);
      return match?.[1]?.trim() || "";
    };
    const trimOutput = (value: string, max = 16000) =>
      value.length > max ? value.slice(0, max) + "\n... [skraćeno]" : value;
    const likelyFileQuery = (value: string) => {
      const q = value.trim();
      if (!q) return false;
      if (/[\\/]/.test(q)) return true;
      if (/\.[a-z0-9]{1,8}$/i.test(q)) return true;
      if (/^(package|vite|tsconfig|vercel|tailwind|postcss|eslint|prettier|components)\b/i.test(q)) return true;
      return false;
    };
    const formatCommandResult = (result: any, fallback = "Nema outputa.") => {
      if (!result) return fallback;
      const parts = [
        result.error ? `ERROR: ${result.error}` : "",
        result.stdout || "",
        result.stderr || "",
      ].filter(Boolean);
      return trimOutput(parts.join("\n\n").trim() || fallback);
    };
    const normalizeGitMessage = (value: string) =>
      cleanQuoted(value.replace(/^(-m|--message)\s+/i, "").trim());

    addLog("info", "🗂 " + raw.slice(0, 100));
    setDevStudioMode(true);

    let match = raw.match(/^(?:postavi projekt root|postavi project root|set project root|root)\s+([\s\S]+)$/i);
    if (match) {
      const nextRoot = cleanQuoted(match[1]);
      localStorage.setItem("stellan_project_root", nextRoot);
      setProjectRootState(nextRoot);
      pushAssistantMessage(`✅ Projekt root postavljen:\n\n\`${nextRoot}\``);
      addLog("ok", `Project root: ${nextRoot}`);
      return true;
    }

    match = raw.match(/^(?:procitaj|pročitaj|read)(?:\s+file)?\s+([\s\S]+)$/i);
    if (match) {
      const filePath = cleanQuoted(match[1]);
      const result = await callAgentDirect("read_file", { path: filePath });
      if (result?.success) {
        const content = trimOutput(String(result.content || ""));
        pushAssistantMessage(`### Read file\n\n**Path:** \`${filePath}\`\n\n${makeCodeFence(filePath, content)}`);
        addLog("ok", `Read file: ${filePath}`);
      } else {
        pushAssistantMessage(`❌ Ne mogu pročitati file **${filePath}**: ${result?.error || "agent nedostupan"}`);
        addLog("warn", `Read file failed: ${filePath}`);
      }
      return true;
    }

    match = raw.match(/^(?:spremi file|zapisi file|zapiši file|write file)\s+([^\n]+)$/i);
    if (match) {
      const filePath = cleanQuoted(match[1]);
      const content = readCodeBlock(raw);
      if (!content) {
        pushAssistantMessage("⚠️ Za spremanje filea pošalji naredbu ovako:\n\n`spremi file src/.../Example.tsx`\n\npa ispod stavi full content u code blocku.");
        return true;
      }
      const result = await callAgentDirect("write_file", { path: filePath, content, backup_first: true });
      if (result?.success) {
        pushAssistantMessage(`✅ Spremljeno u \`${filePath}\`${result?.backup_path ? `\n\nBackup: \`${result.backup_path}\`` : ""}`);
        addLog("ok", `Write file: ${filePath}`);
      } else {
        pushAssistantMessage(`❌ Ne mogu spremiti file **${filePath}**: ${result?.error || "agent nedostupan"}`);
        addLog("warn", `Write file failed: ${filePath}`);
      }
      return true;
    }

    match =
      raw.match(/^(?:nadji|nađi)\s+(.+)$/i) ||
      raw.match(/^(?:pretrazi projekt|pretraži projekt|search project|trazi u projektu|traži u projektu)\s+(.+)$/i);

    if (match) {
      const query = cleanQuoted(match[1]);
      const projectRoot = getProjectRoot();
      if (!projectRoot) {
        pushAssistantMessage("⚠️ Prvo postavi projekt root. Primjer:\n\n`postavi project root D:/1 PROJEKT APLIKACIJA LOKALNO`");
        addLog("warn", "Project root nije postavljen");
        return true;
      }

      if (likelyFileQuery(query)) {
        const findResult = await callAgentDirect("find_files", {
          root: projectRoot,
          pattern: query,
          max_results: 20,
        });

        if (findResult?.success) {
          const files = Array.isArray(findResult.files) ? findResult.files.slice(0, 20) : [];
          if (!files.length) {
            pushAssistantMessage(`🔎 Nisam našao file **${query}** u projektu.`);
          } else {
            const lines = files.map((item: any) => `- \`${item.path}\`${item.size ? ` — ${item.size} B` : ""}`).join("\n");
            pushAssistantMessage(`### Find file\n\n**Pattern:** \`${query}\`\n**Root:** \`${projectRoot}\`\n\n${lines}`);
          }
          addLog("ok", `Find file: ${query}`);
          return true;
        }
      }

      const result = await callAgentDirect("search_in_files", {
        root: projectRoot,
        query,
        extensions: [".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".md", ".sql"],
        recursive: true,
      });
      if (result?.success) {
        const matches = Array.isArray(result.matches) ? result.matches.slice(0, 20) : [];
        if (!matches.length) {
          pushAssistantMessage(`🔎 Nisam našao ništa za **${query}** u projektu.`);
        } else {
          const lines = matches.map((item: any) => `- \`${item.path}${item.line ? `:${item.line}` : ""}\` — ${String(item.text || "").trim()}`).join("\n");
          pushAssistantMessage(`### Search project\n\n**Query:** \`${query}\`\n**Root:** \`${projectRoot}\`\n\n${lines}`);
        }
        addLog("ok", `Search project: ${query}`);
      } else {
        pushAssistantMessage(`❌ Pretraga projekta nije uspjela: ${result?.error || "agent nedostupan"}`);
        addLog("warn", `Search failed: ${query}`);
      }
      return true;
    }

    if (/^(?:pokreni build|run build|build)$/i.test(raw)) {
      const projectRoot = getProjectRoot();
      if (!projectRoot) {
        pushAssistantMessage("⚠️ Prvo postavi projekt root prije builda.");
        addLog("warn", "Build bez project roota");
        return true;
      }
      const result = await callAgentDirect("run_build", { cwd: projectRoot });
      const outputParts = [
        result?.error ? `ERROR: ${result.error}` : "",
        result?.stdout || "",
        result?.stderr || "",
      ].filter(Boolean);
      const output = trimOutput(outputParts.join("\n\n").trim() || "Nema build outputa.");
      const logHints = [result?.stdout_log, result?.stderr_log].filter(Boolean).map((item: string) => `- \`${item}\``).join("\n");
      const extraHint = !result?.success && !result?.stdout && !result?.stderr && result?.error
        ? "\n\nVjerojatno build puca prije zapisivanja loga."
        : "";
      if (result?.success) {
        pushAssistantMessage(`✅ Build je prošao.\n\n${makeCodeFence("build.log", output)}${logHints ? `\n\nLogovi:\n${logHints}` : ""}`);
        addLog("ok", "Build OK");
      } else {
        pushAssistantMessage(`❌ Build je pao.\n\n${makeCodeFence("build.log", output)}${logHints ? `\n\nLogovi:\n${logHints}` : ""}${extraHint}`);
        addLog("warn", `Build failed${result?.error ? `: ${result.error}` : ""}`);
      }
      return true;
    }

    if (/^(?:git status|status)$/i.test(raw)) {
      const projectRoot = getProjectRoot();
      if (!projectRoot) {
        pushAssistantMessage("⚠️ Prvo postavi projekt root prije git status.");
        addLog("warn", "Git status bez project roota");
        return true;
      }
      const result = await callAgentDirect("git_status", { repo_path: projectRoot });
      const output = formatCommandResult(result, "Nema git status outputa.");
      if (result?.success) {
        pushAssistantMessage(`### Git status\n\n**Repo:** \`${projectRoot}\`\n\n${makeCodeFence("git-status.txt", output)}`);
        addLog("ok", "Git status OK");
      } else {
        pushAssistantMessage(`❌ Git status nije uspio.\n\n${makeCodeFence("git-status.txt", output)}`);
        addLog("warn", `Git status failed${result?.error ? `: ${result.error}` : ""}`);
      }
      return true;
    }

    match = raw.match(/^(?:git commit|commit)\s+([\s\S]+)$/i);
    if (match) {
      const projectRoot = getProjectRoot();
      if (!projectRoot) {
        pushAssistantMessage("⚠️ Prvo postavi projekt root prije git commita.");
        addLog("warn", "Git commit bez project roota");
        return true;
      }
      const message = normalizeGitMessage(match[1]);
      if (!message) {
        pushAssistantMessage("⚠️ Pošalji commit poruku. Primjer:\n\n`git commit \"brain panel fix\"`");
        addLog("warn", "Git commit bez poruke");
        return true;
      }
      const result = await callAgentDirect("git_commit", { repo_path: projectRoot, message });
      const output = formatCommandResult(result, "Nema git commit outputa.");
      if (result?.success) {
        pushAssistantMessage(`✅ Git commit je prošao.\n\n**Poruka:** \`${message}\`\n\n${makeCodeFence("git-commit.txt", output)}`);
        addLog("ok", `Git commit: ${message}`);
      } else {
        pushAssistantMessage(`❌ Git commit nije uspio.\n\n${makeCodeFence("git-commit.txt", output)}`);
        addLog("warn", `Git commit failed${result?.error ? `: ${result.error}` : ""}`);
      }
      return true;
    }

    match = raw.match(/^(?:git push|push)(?:\s+([a-zA-Z0-9._\/-]+))?$/i);
    if (match) {
      const projectRoot = getProjectRoot();
      if (!projectRoot) {
        pushAssistantMessage("⚠️ Prvo postavi projekt root prije git pusha.");
        addLog("warn", "Git push bez project roota");
        return true;
      }
      const branch = cleanQuoted(match[1] || "");
      const result = await callAgentDirect("git_push", {
        repo_path: projectRoot,
        branch: branch || undefined,
      });
      const output = formatCommandResult(result, "Nema git push outputa.");
      if (result?.success) {
        pushAssistantMessage(`✅ Git push je prošao.${branch ? `\n\n**Branch:** \`${branch}\`` : ""}\n\n${makeCodeFence("git-push.txt", output)}`);
        addLog("ok", `Git push${branch ? `: ${branch}` : ""}`);
      } else {
        pushAssistantMessage(`❌ Git push nije uspio.\n\n${makeCodeFence("git-push.txt", output)}`);
        addLog("warn", `Git push failed${result?.error ? `: ${result.error}` : ""}`);
      }
      return true;
    }

    match = raw.match(/^(?:deploy)(?:\s+([\s\S]+))?$/i);
    if (match) {
      const projectRoot = getProjectRoot();
      if (!projectRoot) {
        pushAssistantMessage("⚠️ Prvo postavi projekt root prije deploya.");
        addLog("warn", "Deploy bez project roota");
        return true;
      }

      const message = normalizeGitMessage(match[1] || "") || `deploy ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
      pushAssistantMessage(`### Deploy\n\nPokrećem build → git commit → git push...`);

      const buildResult = await callAgentDirect("run_build", { cwd: projectRoot });
      if (!buildResult?.success) {
        pushAssistantMessage(`❌ Deploy zaustavljen na buildu.\n\n${makeCodeFence("build.log", formatCommandResult(buildResult, "Nema build outputa."))}`);
        addLog("warn", "Deploy stopped at build");
        return true;
      }

      const commitResult = await callAgentDirect("git_commit", { repo_path: projectRoot, message });
      if (!commitResult?.success) {
        pushAssistantMessage(`❌ Build je prošao, ali git commit nije uspio.\n\n${makeCodeFence("git-commit.txt", formatCommandResult(commitResult, "Nema git commit outputa."))}`);
        addLog("warn", "Deploy stopped at git commit");
        return true;
      }

      const pushResult = await callAgentDirect("git_push", { repo_path: projectRoot });
      if (!pushResult?.success) {
        pushAssistantMessage(`❌ Build i commit su prošli, ali git push nije uspio.\n\n${makeCodeFence("git-push.txt", formatCommandResult(pushResult, "Nema git push outputa."))}`);
        addLog("warn", "Deploy stopped at git push");
        return true;
      }

      pushAssistantMessage(
        `✅ Deploy je prošao.\n\n**Commit:** \`${message}\`\n\n${makeCodeFence("build.log", formatCommandResult(buildResult, "Nema build outputa."))}`
      );
      addLog("ok", "Deploy completed");
      return true;
    }

    if (/^(?:primijeni patch|primjeni patch|apply patch)\b/i.test(raw)) {
      const projectRoot = getProjectRoot();
      if (!projectRoot) {
        pushAssistantMessage("⚠️ Prvo postavi projekt root prije apply patcha.");
        addLog("warn", "Patch bez project roota");
        return true;
      }

      let parsedPayload: any = null;
      const codeBlock = readCodeBlock(raw);
      const afterCommand = raw.replace(/^(?:primijeni patch|primjeni patch|apply patch)\b/i, "").trim();

      try {
        parsedPayload = JSON.parse(codeBlock || afterCommand);
      } catch {
        parsedPayload = null;
      }

      if (!parsedPayload) {
        pushAssistantMessage("⚠️ Nisam uspio pročitati patch JSON. Pošalji `apply patch` i ispod JSON u code blocku.");
        addLog("warn", "Patch JSON parse fail");
        return true;
      }

      const payload = Array.isArray(parsedPayload)
        ? {
            cwd: projectRoot,
            files: parsedPayload,
            run_build: true,
            git_commit: false,
            git_push: false,
          }
        : {
            cwd: parsedPayload.cwd || projectRoot,
            files: parsedPayload.files || [],
            run_build: parsedPayload.run_build ?? true,
            build_command: parsedPayload.build_command,
            build_timeout: parsedPayload.build_timeout,
            git_commit: parsedPayload.git_commit ?? false,
            commit_message: parsedPayload.commit_message || "patch via chat",
            git_push: parsedPayload.git_push ?? false,
            git_branch: parsedPayload.git_branch || "main",
          };

      const result = await callAgentDirect("safe_apply_patch_set", payload);
      const buildBlock = result?.build ? trimOutput(`${result.build.stdout || ""}\n${result.build.stderr || ""}`.trim()) : "";
      if (result?.success) {
        pushAssistantMessage(
          `✅ Patch je primijenjen.\n\n- Fileova: **${Array.isArray(result?.written_files) ? result.written_files.length : 0}**\n- Backupa: **${Array.isArray(result?.backups) ? result.backups.length : 0}**${
            buildBlock ? `\n\n${makeCodeFence("build.log", buildBlock)}` : ""
          }`
        );
        addLog("ok", "Patch applied");
      } else {
        pushAssistantMessage(
          `❌ Patch nije uspio.${result?.error ? `\n\nGreška: ${result.error}` : ""}${
            buildBlock ? `\n\n${makeCodeFence("build.log", buildBlock)}` : ""
          }`
        );
        addLog("warn", "Patch failed");
      }
      return true;
    }

    return false;
  };


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

  const executeStudioCommand = useCallback(async (cmd: string) => {
    const raw = cmd.trim();
    if (!raw) return;
    addLog("info", "→ " + raw.slice(0, 80));
    setStudioInput("");

    const urlMatch = raw.match(/https?:\/\/[^\s]+/i);
    const lower = raw.toLowerCase();

    // NAVIGATE
    if ((lower.startsWith("idi na ") || lower.startsWith("otvori ") || lower.includes("otvori") || lower.includes("idi na")) && urlMatch) {
      const stepId = addDevStep("open", `Open ${urlMatch[0]}`, urlMatch[0]);
      const nav = await runPlaywrightAction({ action: "navigate", url: urlMatch[0], timeout: 45000 }, { appendSummary: true, summaryPrefix: "🌐" });
      if (nav?.success) {
        updateDevStep(stepId, "done", nav.title || urlMatch[0]);
        const titleLine = nav.title ? `**${nav.title}**` : urlMatch[0];
        pushAssistantMessage(`🌐 Otvorio sam ${titleLine}. Screenshot je u previewu.`);
      } else {
        updateDevStep(stepId, "error", nav?.error || "Navigacija nije uspjela");
        pushAssistantMessage(`❌ Ne mogu otvoriti ${urlMatch[0]}: ${nav?.error || "greška"}`);
      }
      return;
    }

    // SCREENSHOT
    if (lower.includes("screenshot") || lower.includes("snimku") || lower.includes("snimi") || lower.includes("što vidiš") || lower.includes("sto vidis")) {
      const stepId = addDevStep("screenshot", "Screenshot", previewUrl);
      const shot = await runPlaywrightAction({ action: "screenshot", full_page: true }, { appendSummary: true, summaryPrefix: "📸" });
      if (shot?.success) {
        updateDevStep(stepId, "done", "Screenshot osvježen");
        pushAssistantMessage(`📸 Screenshot osvježen u previewu.`);
      } else {
        updateDevStep(stepId, "error", shot?.error || "Screenshot nije uspio");
      }
      return;
    }

    // CLICK
    const clickMatch = raw.match(/^(klikni|pritisni)\s+(.+)$/i);
    if (clickMatch) {
      const target = clickMatch[2].trim().replace(/^na\s+/i, "").replace(/^['"]|['"]$/g, "");
      const selector = target.startsWith("#") || target.startsWith(".") || target.startsWith("//") || target.startsWith("text=") ? target : `text=${target}`;
      const stepId = addDevStep("click", `Click "${target}"`, target);
      const data = await runPlaywrightAction(
        { action: "click", selector, timeout: 20000 },
        { refreshAfter: true }
      );
      if (data?.success) {
        await waitForPreviewReady(1500);
        updateDevStep(stepId, "done");
        pushAssistantMessage(`✅ Kliknuo sam **${target}**.`);
      } else {
        updateDevStep(stepId, "error", data?.error || "Klik nije uspio");
        pushAssistantMessage(`❌ Klik na **${target}** nije uspio: ${data?.error || "greška"}`);
      }
      return;
    }

    // FILL / TYPE
    const fillQuoted = raw.match(/^(upiši|upisi|unesi|unesite)\s+[""\u201C](.+?)[""\u201D]\s+u\s+[""\u201C](.+?)[""\u201D]$/i);
    const fillSimple = raw.match(/^(upiši|upisi|unesi|unesite)\s+(.+?)\s+u\s+(.+)$/i);
    const fillMatch = fillQuoted || fillSimple;
    if (fillMatch) {
      const value = fillMatch[2].trim();
      const target = fillMatch[3].trim();
      const selector = target.startsWith("#") || target.startsWith(".") || target.startsWith("//") || target.startsWith("input") || target.startsWith("textarea") || target.startsWith("select")
        ? target
        : `input[placeholder*="${target}" i], input[name*="${target}" i], textarea[placeholder*="${target}" i]`;
      const stepId = addDevStep("type", `Type "${value}" → ${target}`, target);
      const data = await runPlaywrightAction(
        { action: "fill", selector, value, timeout: 20000 },
        { refreshAfter: true }
      );
      if (data?.success) {
        updateDevStep(stepId, "done");
        pushAssistantMessage(`✅ Upisao sam **${value}** u **${target}**.`);
      } else {
        updateDevStep(stepId, "error", data?.error || "Unos nije uspio");
        pushAssistantMessage(`❌ Unos u **${target}** nije uspio: ${data?.error || "greška"}`);
      }
      return;
    }

    // SIMPLE TYPE (no target — types into currently focused element)
    // e.g. "upiši darpet" without "u [polje]"
    const simpleType = raw.match(/^(upiši|upisi|unesi|unesite)\s+(.+)$/i);
    if (simpleType) {
      const value = simpleType[2].trim();
      const stepId = addDevStep("type", `Type "${value}"`, "fokusirano polje");
      // Try focused element first, then fall back to any visible input
      const data = await runPlaywrightAction(
        { action: "fill", selector: ":focus", value, timeout: 10000 },
        { refreshAfter: true }
      );
      if (data?.success) {
        updateDevStep(stepId, "done");
        pushAssistantMessage(`✅ Upisao sam **${value}**.`);
      } else {
        // Fallback: try the first empty visible input
        const fallback = await runPlaywrightAction(
          { action: "fill", selector: "input:visible:not([type=hidden]):not([readonly]), textarea:visible", value, timeout: 10000 },
          { refreshAfter: true }
        );
        if (fallback?.success) {
          updateDevStep(stepId, "done");
          pushAssistantMessage(`✅ Upisao sam **${value}**.`);
        } else {
          updateDevStep(stepId, "error", "Nema fokusiranog polja");
          pushAssistantMessage(`❌ Nema fokusiranog polja za unos. Probaj: \`klikni Korisničko ime\` pa onda \`upiši ${value}\``);
        }
      }
      return;
    }

    // WAIT
    const waitSeconds = raw.match(/^(čekaj|cekaj)\s+(\d+)\s*(s|sek|sekundi|sec)?$/i);
    const waitMs = raw.match(/^(čekaj|cekaj)\s+(\d+)\s*ms$/i);
    if (waitSeconds || waitMs) {
      const timeout = waitMs ? Number(waitMs[2]) : Number(waitSeconds?.[2] || 1) * 1000;
      const stepId = addDevStep("open", `Wait ${timeout}ms`);
      const data = await runPlaywrightAction(
        { action: "wait", timeout },
        { refreshAfter: true }
      );
      if (data?.success) {
        updateDevStep(stepId, "done", `Pričekao ${timeout}ms`);
        setLastPreviewSummary(`Pričekao sam ${timeout}ms i osvježio preview.`);
      } else {
        updateDevStep(stepId, "error");
      }
      return;
    }

    // EXTRACT TEXT (only when explicitly asked)
    if (lower.includes("html") || lower.includes("izvuci tekst") || lower.includes("procitaj stranicu") || lower.includes("pročitaj stranicu")) {
      const extracted = await callAgentDirect("playwright", { action: "extract", timeout: 15000 });
      if (extracted?.success) {
        pushAssistantMessage(`### Tekst sa stranice\n\n${extractVisibleSummary(extracted.content || "") || "Nisam uspio izvući tekst."}`);
      } else {
        pushAssistantMessage(`❌ Ne mogu izvući tekst: ${extracted?.error || "nepoznata greška"}`);
      }
      return;
    }

    pushAssistantMessage('ℹ️ DEV v2 razumije: `idi na https://...`, `klikni Prijava`, `upiši "Marko" u "ime"`, `čekaj 3s`, `screenshot`, `izvuci tekst`.');
  }, [pushAssistantMessage, runPlaywrightAction, syncPreviewFromAgent, waitForPreviewReady, describeCurrentPreview]);

  const executeStudioFlow = useCallback(async (rawInput: string) => {
    const normalized = rawInput
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean)
      .join("\n");

    const steps = normalized
      .split(/\n+|\s+onda\s+|\s+i\s+(?=otvori|idi\s+na|klikni|pritisni|upiši|upisi|unesi|čekaj|cekaj|screenshot|snimi|izvuci)/i)
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

  const handleDevPortalAction = useCallback(async (cmd: string) => {
    const handled = await executeProjectCommand(cmd);
    if (!handled) {
      await executeStudioFlow(cmd);
    }
    window.setTimeout(() => { void refreshDevOps(); }, 250);
  }, [executeProjectCommand, executeStudioFlow, refreshDevOps]);


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
      await handleDevPortalAction("deploy");
      setDeployStatus("success");
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

  if (devStudioMode && !isMobile) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-lg">
        <div className="relative h-[98vh] w-[99vw] overflow-hidden rounded-2xl border border-white/[0.06] bg-[hsl(220,15%,7%)] shadow-2xl">
          <DevPanel
            title="Dev Studio"
            steps={devPanelSteps}
            preview={devPanelPreview}
            consoleLogs={consoleLogs as ConsoleLog[]}
            isAgentRunning={isAgentActionRunning}
            agentOnline={agentOnline}
            modelBadge={PROVIDERS[selectedProvider].models.find(m => m.id === selectedProviderModel)?.badge || MODEL_BADGES[selectedModel]}
            isRecording={isRecording}
            recordingName={recordingName}
            isDeploying={isDeploying}
            deployStatus={deployStatus}
            savedActions={savedActions}
            projectRoot={projectRootState}
            devOps={devOpsSnapshot}
            devOpsLoading={devOpsLoading || devOpsRefreshing}
            onRunAction={handleDevPanelAction}
            onStopAgent={() => abortControllerRef.current?.abort()}
            onClearSteps={() => setDevSteps([])}
            onDeleteStep={(stepId) => setDevSteps(prev => prev.filter(step => step.id !== stepId))}
            onSelectStep={(step) => addLog("info", `Odabran korak: ${step.label}`)}
            onDescribePreview={handlePreviewDescribe}
            onWaitForLoad={handlePreviewWait}
            onRefreshScreenshot={handleStudioScreenshot}
            onRefreshDevOps={() => { void refreshDevOps(); }}
            onDeploy={handleDeploy}
            onStartAgent={handleStartAgent}
            onStartRecording={() => { void handleStartRecording(); }}
            onSaveRecording={() => { void handleSaveAction(); }}
            onCancelRecording={handleCancelRecording}
            onRunSavedAction={(name) => { void handleRunSavedAction(name); }}
            onRefreshActions={() => { void handleRefreshActions(); }}
            onCheckHealth={() => { void checkAgentHealth(); }}
            onPortalAction={(cmd) => { void handleDevPortalAction(cmd); }}
            onBackToStellan={() => setDevStudioMode(false)}
          />
        </div>
      </div>
    );
  }

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
                <p className="text-[9px] text-white/30">{PROVIDERS[selectedProvider].icon} {PROVIDERS[selectedProvider].label} · {PROVIDERS[selectedProvider].models.find(m => m.id === selectedProviderModel)?.label || selectedProviderModel} · vision · memorija ✓</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">

              <button
                onClick={() => { setDevStudioMode(!devStudioMode); if (!devStudioMode) { setDevMode(false); setBrainMode(false); } }}
                title="DEV Studio — agent preview, actions, build, patch i project komande iz chata"
                className={cn(
                  "h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-[10px] transition-colors",
                  devStudioMode
                    ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30"
                    : "bg-white/[0.06] text-white/40 hover:text-cyan-300 hover:bg-cyan-500/10"
                )}
              >
                <Code2 className="w-3 h-3" />
                DEV
              </button>
              <button
                onClick={() => { setDevMode(!devMode); if (!devMode) { setDevStudioMode(false); setBrainMode(false); } }}
                title="Učenje — Browser Use automation"
                className={cn(
                  "h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-[10px] transition-colors",
                  devMode
                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                    : "bg-white/[0.06] text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10"
                )}
              >
                <Zap className="w-3 h-3" />
                Učenje
              </button>
              <button
                onClick={() => { setBrainMode(!brainMode); if(!brainMode) { setDevMode(false); setDevStudioMode(false); } }}
                title="Mozak — Vizualni pregled Stellanovih toolova, znanja i workflowa"
                className={cn(
                  "h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-[10px] transition-colors",
                  brainMode
                    ? "bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30"
                    : "bg-white/[0.06] text-white/40 hover:text-purple-400 hover:bg-purple-500/10"
                )}
              >
                <Brain className="w-3 h-3" />
                Mozak
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
            {/* Pending attachment previews */}
            {(pendingImages.length > 0 || pendingFiles.length > 0) && (
              <div className="flex gap-2 flex-wrap px-3 pt-3 pb-1">
                {pendingImages.map((img, i) => (
                  <div key={`img-${i}`} className="relative group">
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
                {pendingFiles.map((file, i) => {
                  const ext = file.name.split('.').pop()?.toLowerCase() || "";
                  const badgeColors: Record<string, string> = {
                    zip: "#fbbf24", rar: "#fbbf24", "7z": "#fbbf24", gz: "#fbbf24", tar: "#fbbf24",
                    pdf: "#ef4444", doc: "#3b82f6", docx: "#3b82f6",
                    ts: "#3178c6", tsx: "#3178c6", js: "#f7df1e", jsx: "#61dafb", py: "#3776ab",
                    html: "#e34f26", css: "#264de4", json: "#a8a8a8", sql: "#f29111",
                    csv: "#22c55e", xls: "#22c55e", xlsx: "#22c55e",
                  };
                  const color = badgeColors[ext] || "#8b8b8b";
                  return (
                    <div key={`file-${i}`} className="relative group">
                      <div className="h-16 w-20 rounded-lg border border-white/10 bg-white/[0.04] flex flex-col items-center justify-center gap-1 px-1">
                        <FileText className="w-4 h-4" style={{ color }} />
                        <span className="text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded" style={{ color, background: `${color}20` }}>{ext || "FILE"}</span>
                      </div>
                      <button
                        onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 hover:bg-red-400 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      >×</button>
                      <div className="text-[9px] text-white/30 mt-0.5 truncate w-20">{file.name}</div>
                    </div>
                  );
                })}
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
              placeholder={isListening ? "Slušam..." : "Pitajte Stellana..."}
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
                <ProviderSelector
                  selectedProvider={selectedProvider}
                  selectedModel={selectedProviderModel}
                  onProviderChange={setSelectedProvider}
                  onModelChange={setSelectedProviderModel}
                />
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
                      (input.trim() || pendingImages.length > 0 || pendingFiles.length > 0)
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-white/[0.06] text-white/20 cursor-not-allowed"
                    )}
                    onClick={send} data-send-btn
                    disabled={!input.trim() && pendingImages.length === 0 && pendingFiles.length === 0}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 mt-1.5">
            <span className="text-[9px] text-white/25">Potrošeno:</span>
            <span className="text-[9px] font-mono text-emerald-400/60">{spentEur.toFixed(4)} €</span>
            {budgetEur && (
              <>
                <span className="text-[9px] text-white/20">/</span>
                <span className="text-[9px] font-mono text-white/30">{budgetEur} €</span>
              </>
            )}
            <span className="text-[9px] text-white/15">|</span>
            <span className="text-[9px] text-white/25">Budget:</span>
            <input
              type="number"
              step="0.01"
              value={budgetEur}
              onChange={(e) => { setBudgetEur(e.target.value); localStorage.setItem("stellan_budget", e.target.value); }}
              placeholder="€"
              className="w-14 text-[9px] font-mono bg-transparent border-b border-white/10 text-white/40 focus:text-white/70 focus:border-primary/40 outline-none text-center placeholder:text-white/15"
            />
            <button
              onClick={() => { setSpentEur(0); localStorage.setItem("stellan_spent", "0"); }}
              className="text-[8px] text-white/15 hover:text-white/40 transition-colors"
              title="Resetiraj potrošnju"
            >
              reset
            </button>
          </div>
        </div>
        </div>


        {/* DEV Studio */}
        {devStudioMode && !isMobile && (
          <div className="flex-1 border-l border-white/[0.06] min-w-0 overflow-hidden">
            <DevPanel
              title="Dev Studio"
              steps={devPanelSteps}
              preview={devPanelPreview}
              consoleLogs={consoleLogs as ConsoleLog[]}
              isAgentRunning={isAgentActionRunning}
              agentOnline={agentOnline}
              modelBadge={PROVIDERS[selectedProvider].models.find(m => m.id === selectedProviderModel)?.badge || MODEL_BADGES[selectedModel]}
              isRecording={isRecording}
              recordingName={recordingName}
              isDeploying={isDeploying}
              deployStatus={deployStatus}
              savedActions={savedActions}
            projectRoot={projectRootState}
            devOps={devOpsSnapshot}
            devOpsLoading={devOpsLoading || devOpsRefreshing}
              onRunAction={handleDevPanelAction}
              onStopAgent={() => abortControllerRef.current?.abort()}
              onClearSteps={() => setDevSteps([])}
              onDeleteStep={(stepId) => setDevSteps(prev => prev.filter(step => step.id !== stepId))}
              onSelectStep={(step) => addLog("info", `Odabran korak: ${step.label}`)}
              onDescribePreview={handlePreviewDescribe}
              onWaitForLoad={handlePreviewWait}
              onRefreshScreenshot={handleStudioScreenshot}
            onRefreshDevOps={() => { void refreshDevOps(); }}
              onDeploy={handleDeploy}
              onStartAgent={handleStartAgent}
              onStartRecording={() => { void handleStartRecording(); }}
              onSaveRecording={() => { void handleSaveAction(); }}
              onCancelRecording={handleCancelRecording}
              onRunSavedAction={(name) => { void handleRunSavedAction(name); }}
              onRefreshActions={() => { void handleRefreshActions(); }}
              onCheckHealth={() => { void checkAgentHealth(); }}
              onPortalAction={(cmd) => { void handleDevPortalAction(cmd); }}
              onBackToStellan={() => setDevStudioMode(false)}
            />
          </div>
        )}
 

        {/* STELLAN UČENJE — Browser Use automation panel */}
        {devMode && !isMobile && (
          <div className="flex-1 border-l border-white/[0.06] min-w-0 overflow-hidden">
            <LearningPanel
              onClose={() => setDevMode(false)}
              agentServerUrl={import.meta.env.VITE_AGENT_SERVER_URL || ""}
            />
          </div>
        )}

        {/* STELLAN MOZAK — Visual brain panel (fullscreen overlay) */}
        {brainMode && !isMobile && (
          <div className="fixed inset-0 z-50">
            <BrainPanel onClose={() => setBrainMode(false)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatDialog;
