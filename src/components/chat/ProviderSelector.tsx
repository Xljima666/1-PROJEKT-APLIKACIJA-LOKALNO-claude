import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";

export type Provider = "openai" | "anthropic" | "google" | "xai";

export interface ProviderModel {
  id: string;
  label: string;
  badge: string;
}

export interface ProviderConfig {
  label: string;
  icon: string;
  color: string;
  models: ProviderModel[];
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  xai: {
    label: "Grok",
    icon: "⚡",
    color: "sky",
    models: [
      { id: "grok-4-1-fast-non-reasoning", label: "Grok 4.1 Fast", badge: "FAST" },
      { id: "grok-4.20-reasoning", label: "Grok 4.20", badge: "REASON" },
    ],
  },
  openai: {
    label: "ChatGPT",
    icon: "🤖",
    color: "emerald",
    models: [
      { id: "gpt-5.4", label: "GPT-5.4", badge: "SMART" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 mini", badge: "FAST" },
    ],
  },
  anthropic: {
    label: "Claude",
    icon: "🧠",
    color: "orange",
    models: [
      { id: "claude-sonnet-4-20250514", label: "Sonnet 4", badge: "SMART" },
      { id: "claude-3-5-haiku-20241022", label: "Haiku 3.5", badge: "FAST" },
      { id: "claude-3-5-sonnet-20241022", label: "Sonnet 3.5", badge: "SMART" },
    ],
  },
  google: {
    label: "Gemini",
    icon: "💎",
    color: "blue",
    models: [
      { id: "gemini-2.5-flash", label: "2.5 Flash", badge: "FAST" },
      { id: "gemini-2.5-pro", label: "2.5 Pro", badge: "SMART" },
      { id: "gemini-2.5-flash-lite", label: "2.5 Flash Lite", badge: "LITE" },
    ],
  },
};

interface ProviderSelectorProps {
  selectedProvider: Provider;
  selectedModel: string;
  onProviderChange: (provider: Provider) => void;
  onModelChange: (model: string) => void;
}

export default function ProviderSelector({
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
}: ProviderSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const provider = PROVIDERS[selectedProvider];
  const currentModel = provider.models.find(m => m.id === selectedModel) || provider.models[0];

  return (
    <div className="relative flex items-center gap-0.5">
      {/* Provider + Model button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={cn(
          "h-8 px-2 rounded-lg flex items-center gap-1 text-[10px] font-medium transition-all border",
          "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-white/60 hover:text-white/80"
        )}
      >
        <span className="text-xs">{provider.icon}</span>
        <span className="hidden sm:inline">{provider.label}</span>
        <span className="text-white/30">·</span>
        <span className="text-white/50">{currentModel.label}</span>
        <ChevronDown className="w-2.5 h-2.5 text-white/30 ml-0.5" />
      </button>

      {/* Dropdown - Provider & Model selection */}
      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div className="absolute bottom-10 left-0 z-50 w-72 rounded-xl bg-[hsl(220,15%,10%)] border border-white/[0.1] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
            {/* Providers */}
            <div className="p-2 border-b border-white/[0.06]">
              <p className="text-[9px] text-white/30 uppercase tracking-wider px-2 pb-1.5">Provider</p>
              <div className="grid grid-cols-4 gap-1">
                {(Object.keys(PROVIDERS) as Provider[]).map((key) => {
                  const p = PROVIDERS[key];
                  const isActive = key === selectedProvider;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        onProviderChange(key);
                        onModelChange(PROVIDERS[key].models[0].id);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-lg text-[10px] transition-all relative",
                        isActive
                          ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                          : "text-white/50 hover:text-white/70 hover:bg-white/[0.06]"
                      )}
                    >
                      <span className="text-sm">{p.icon}</span>
                      <span className="font-medium">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Models for selected provider */}
            <div className="p-2">
              <p className="text-[9px] text-white/30 uppercase tracking-wider px-2 pb-1.5">Model</p>
              <div className="space-y-0.5">
                {provider.models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onModelChange(model.id);
                      setShowDropdown(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition-all",
                      selectedModel === model.id
                        ? "bg-primary/15 text-primary"
                        : "text-white/60 hover:text-white/80 hover:bg-white/[0.06]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {selectedModel === model.id && <Check className="w-3 h-3" />}
                      <span className="font-medium">{model.label}</span>
                    </div>
                    <span className={cn(
                      "text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase",
                      model.badge === "FAST" && "bg-emerald-500/15 text-emerald-400",
                      model.badge === "SMART" && "bg-blue-500/15 text-blue-400",
                      model.badge === "NEW" && "bg-violet-500/15 text-violet-400",
                      model.badge === "FAST+" && "bg-emerald-500/15 text-emerald-400",
                      model.badge === "REASON" && "bg-purple-500/15 text-purple-400",
                      model.badge === "LITE" && "bg-white/10 text-white/40",
                    )}>{model.badge}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
