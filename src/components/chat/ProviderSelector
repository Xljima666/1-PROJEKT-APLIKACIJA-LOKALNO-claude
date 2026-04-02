import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Key, Check, ChevronDown, Eye, EyeOff, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  keyName: string;
  apiKeyLabel: string;
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  openai: {
    label: "ChatGPT",
    icon: "🤖",
    color: "emerald",
    models: [
      { id: "gpt-4o", label: "GPT-4o", badge: "SMART" },
      { id: "gpt-4o-mini", label: "GPT-4o mini", badge: "FAST" },
      { id: "gpt-4.1", label: "GPT-4.1", badge: "NEW" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini", badge: "FAST+" },
      { id: "o4-mini", label: "o4-mini", badge: "REASON" },
    ],
    keyName: "OPENAI_API_KEY",
    apiKeyLabel: "OpenAI API Key",
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
    keyName: "ANTHROPIC_API_KEY",
    apiKeyLabel: "Anthropic API Key",
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
    keyName: "GOOGLE_AI_API_KEY",
    apiKeyLabel: "Google AI API Key",
  },
  xai: {
    label: "Grok",
    icon: "⚡",
    color: "sky",
    models: [
      { id: "grok-3-mini-fast", label: "Grok 3 Mini", badge: "FAST" },
      { id: "grok-3", label: "Grok 3", badge: "SMART" },
    ],
    keyName: "GROK_API_KEY",
    apiKeyLabel: "xAI API Key",
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
  const { user } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const provider = PROVIDERS[selectedProvider];

  // Load which providers have keys saved
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_api_keys")
        .select("key_name")
        .eq("user_id", user.id);
      if (data) {
        const keys: Record<string, boolean> = {};
        for (const row of data) keys[row.key_name] = true;
        setSavedKeys(keys);
      }
    })();
  }, [user]);

  const handleSaveApiKey = async (providerKey: Provider) => {
    if (!user || !apiKeyValue.trim()) return;
    setSaving(true);
    const keyName = PROVIDERS[providerKey].keyName;
    
    // Upsert: delete old then insert new
    await supabase.from("user_api_keys").delete().eq("user_id", user.id).eq("key_name", keyName);
    await supabase.from("user_api_keys").insert({
      user_id: user.id,
      key_name: keyName,
      key_value: apiKeyValue.trim(),
      key_label: PROVIDERS[providerKey].apiKeyLabel,
      key_category: "ai_provider",
    });
    
    setSavedKeys(prev => ({ ...prev, [keyName]: true }));
    setApiKeyValue("");
    setShowApiKeyInput(false);
    setSaving(false);
  };

  const handleRemoveApiKey = async (providerKey: Provider) => {
    if (!user) return;
    const keyName = PROVIDERS[providerKey].keyName;
    await supabase.from("user_api_keys").delete().eq("user_id", user.id).eq("key_name", keyName);
    setSavedKeys(prev => {
      const next = { ...prev };
      delete next[keyName];
      return next;
    });
  };

  const currentModel = provider.models.find(m => m.id === selectedModel) || provider.models[0];
  const hasKey = savedKeys[provider.keyName];

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

      {/* API Key indicator */}
      <button
        onClick={() => setShowApiKeyInput(!showApiKeyInput)}
        title={hasKey ? `${provider.apiKeyLabel} postavljan` : `Postavi ${provider.apiKeyLabel}`}
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
          hasKey
            ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
        )}
      >
        <Key className="w-3 h-3" />
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
                  const pHasKey = savedKeys[p.keyName];
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
                      {pHasKey && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      )}
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

            {/* Quick API key status */}
            <div className="p-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between px-2">
                <span className="text-[9px] text-white/30">
                  {hasKey ? "✅ API ključ postavljen" : "⚠️ Nema API ključa"}
                </span>
                <button
                  onClick={() => { setShowDropdown(false); setShowApiKeyInput(true); }}
                  className="text-[9px] text-primary hover:text-primary/80 font-medium"
                >
                  {hasKey ? "Promijeni" : "Postavi"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* API Key Input Popup */}
      {showApiKeyInput && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setShowApiKeyInput(false); setApiKeyValue(""); }} />
          <div className="absolute bottom-10 left-0 z-50 w-80 rounded-xl bg-[hsl(220,15%,10%)] border border-white/[0.1] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">{provider.icon}</span>
                <span className="text-xs font-medium text-white/80">{provider.apiKeyLabel}</span>
              </div>
              <button
                onClick={() => { setShowApiKeyInput(false); setApiKeyValue(""); }}
                className="w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06]"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="relative mb-3">
              <input
                type={apiKeyVisible ? "text" : "password"}
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                placeholder={hasKey ? "••••••••••••••••" : "sk-... ili slično"}
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/80 placeholder-white/25 focus:outline-none focus:border-primary/40 pr-8"
              />
              <button
                onClick={() => setApiKeyVisible(!apiKeyVisible)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {apiKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleSaveApiKey(selectedProvider)}
                disabled={!apiKeyValue.trim() || saving}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                  apiKeyValue.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-white/[0.06] text-white/20 cursor-not-allowed"
                )}
              >
                <Save className="w-3 h-3" />
                {saving ? "Spremam..." : "Spremi"}
              </button>
              {hasKey && (
                <button
                  onClick={() => handleRemoveApiKey(selectedProvider)}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  Obriši
                </button>
              )}
            </div>

            <p className="text-[9px] text-white/20 mt-2">
              Ključ se sprema sigurno u bazu. Koristi se samo za pozive prema {provider.label} API-ju.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
