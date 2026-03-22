import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Zap, TrendingUp, Calendar, MessageSquare, DollarSign, Edit3, Check } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { hr } from "date-fns/locale";

interface UsageRow {
  id: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  model: string;
  created_at: string;
  conversation_id: string | null;
}

interface DailyStat {
  date: string;
  tokens: number;
  cost: number;
  requests: number;
}

// OpenAI GPT-4o pricing (approximate USD per token)
const INPUT_COST_PER_TOKEN = 2.5 / 1_000_000;   // $2.50 per 1M input tokens
const OUTPUT_COST_PER_TOKEN = 10 / 1_000_000;    // $10 per 1M output tokens

const BUDGET_KEY = "stellan_monthly_budget_usd";

const TokenUsage = () => {
  const { user, isAdmin } = useAuth();
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [allUsersUsage, setAllUsersUsage] = useState<{ user_id: string; full_name: string | null; inputTokens: number; outputTokens: number; cost: number }[]>([]);
  const [budget, setBudget] = useState(10);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("10");
  const [editingCredits, setEditingCredits] = useState(false);
  const [creditsInput, setCreditsInput] = useState("");

  useEffect(() => {
    if (!user) return;
    loadUsage();
    loadBudgetFromDB();
  }, [user]);

  const loadBudgetFromDB = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("company_settings")
      .select("ai_budget_usd, ai_credits_remaining")
      .eq("user_id", user.id)
      .single();
    if (data) {
      if (data.ai_budget_usd != null) {
        setBudget(data.ai_budget_usd);
        setBudgetInput(data.ai_budget_usd.toString());
      }
      if (data.ai_credits_remaining != null) {
        setCreditsRemaining(data.ai_credits_remaining);
        setCreditsInput(data.ai_credits_remaining.toString());
      }
    }
  };

  const loadUsage = async () => {
    setLoading(true);
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();

    const { data, error } = await supabase
      .from("token_usage")
      .select("*")
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd)
      .order("created_at", { ascending: false });

    if (!error && data) setUsage(data);

    if (isAdmin) {
      const { data: allData } = await supabase
        .from("token_usage")
        .select("user_id, input_tokens, output_tokens, total_tokens, created_at")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      if (allData && profiles) {
        const userMap = new Map<string, { inputTokens: number; outputTokens: number }>();
        allData.forEach((row: any) => {
          const existing = userMap.get(row.user_id) || { inputTokens: 0, outputTokens: 0 };
          userMap.set(row.user_id, {
            inputTokens: existing.inputTokens + row.input_tokens,
            outputTokens: existing.outputTokens + row.output_tokens,
          });
        });

        const result = Array.from(userMap.entries()).map(([uid, data]) => ({
          user_id: uid,
          full_name: profiles.find((p: any) => p.user_id === uid)?.full_name || "Nepoznat",
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          cost: data.inputTokens * INPUT_COST_PER_TOKEN + data.outputTokens * OUTPUT_COST_PER_TOKEN,
        })).sort((a, b) => b.cost - a.cost);

        setAllUsersUsage(result);
      }
    }

    setLoading(false);
  };

  const totalInput = usage.reduce((sum, r) => sum + r.input_tokens, 0);
  const totalOutput = usage.reduce((sum, r) => sum + r.output_tokens, 0);
  const totalCost = totalInput * INPUT_COST_PER_TOKEN + totalOutput * OUTPUT_COST_PER_TOKEN;
  const totalRequests = usage.length;
  const remaining = Math.max(budget - totalCost, 0);
  const usagePercent = budget > 0 ? Math.min((totalCost / budget) * 100, 100) : 0;

  // Daily breakdown
  const dailyStats: DailyStat[] = [];
  const dayMap = new Map<string, { inputTokens: number; outputTokens: number; requests: number }>();
  usage.forEach((r) => {
    const day = format(new Date(r.created_at), "yyyy-MM-dd");
    const existing = dayMap.get(day) || { inputTokens: 0, outputTokens: 0, requests: 0 };
    dayMap.set(day, {
      inputTokens: existing.inputTokens + r.input_tokens,
      outputTokens: existing.outputTokens + r.output_tokens,
      requests: existing.requests + 1,
    });
  });
  dayMap.forEach((val, key) => {
    const cost = val.inputTokens * INPUT_COST_PER_TOKEN + val.outputTokens * OUTPUT_COST_PER_TOKEN;
    dailyStats.push({ date: key, tokens: val.inputTokens + val.outputTokens, cost, requests: val.requests });
  });
  dailyStats.sort((a, b) => b.date.localeCompare(a.date));

  const formatUsd = (n: number) => `$${n.toFixed(2)}`;

  const formatTokens = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  const saveBudget = async () => {
    const val = parseFloat(budgetInput);
    if (!isNaN(val) && val > 0) {
      setBudget(val);
      if (user) {
        await supabase
          .from("company_settings")
          .upsert({ user_id: user.id, ai_budget_usd: val }, { onConflict: "user_id" });
      }
    }
    setEditingBudget(false);
  };

  const saveCredits = async () => {
    const val = parseFloat(creditsInput);
    if (!isNaN(val) && val >= 0) {
      setCreditsRemaining(val);
      if (user) {
        await supabase
          .from("company_settings")
          .upsert({ user_id: user.id, ai_credits_remaining: val }, { onConflict: "user_id" });
      }
    }
    setEditingCredits(false);
  };

  return (
    <DashboardLayout>
      <div className="p-4 space-y-4 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">Potrošnja — Stellan AI</h1>
            <p className="text-xs text-muted-foreground">
              {format(new Date(), "LLLL yyyy", { locale: hr })}
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1">
              {editingBudget ? (
                <>
                  <Input
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    className="w-20 h-7 text-xs"
                    type="number"
                    min="1"
                    step="0.5"
                    onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveBudget}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setBudgetInput(budget.toString()); setEditingBudget(true); }}>
                  <Edit3 className="w-3 h-3" />
                  Budžet: {formatUsd(budget)}
                </Button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground animate-pulse">Učitavam...</div>
        ) : (
          <>
            {/* Main usage card */}
            <Card className="border-primary/20">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <span className="text-2xl font-bold text-foreground">{formatUsd(totalCost)}</span>
                    <span className="text-sm text-muted-foreground">/ {formatUsd(budget)}</span>
                  </div>
                  <Badge variant={usagePercent > 80 ? "destructive" : usagePercent > 50 ? "secondary" : "outline"}>
                    {usagePercent.toFixed(0)}%
                  </Badge>
                </div>
                <Progress value={usagePercent} className="h-2.5" />
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Preostalo: <span className="font-semibold text-foreground">{formatUsd(remaining)}</span></span>
                  <span>{totalRequests} zahtjeva</span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ulazni tokeni</p>
                    <p className="text-sm font-semibold text-foreground">{formatTokens(totalInput)}</p>
                    <p className="text-[10px] text-muted-foreground">{formatUsd(totalInput * INPUT_COST_PER_TOKEN)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Izlazni tokeni</p>
                    <p className="text-sm font-semibold text-foreground">{formatTokens(totalOutput)}</p>
                    <p className="text-[10px] text-muted-foreground">{formatUsd(totalOutput * OUTPUT_COST_PER_TOKEN)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* OpenAI Credits */}
            {isAdmin && (
              <Card className="border-accent/30">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">OpenAI krediti</span>
                    </div>
                    {editingCredits ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          value={creditsInput}
                          onChange={(e) => setCreditsInput(e.target.value)}
                          className="w-20 h-7 text-xs"
                          type="number"
                          min="0"
                          step="0.01"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && saveCredits()}
                        />
                        <span className="text-xs text-muted-foreground">/ {formatUsd(budget)}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveCredits}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          setCreditsInput(creditsRemaining?.toString() || "0");
                          setEditingCredits(true);
                        }}
                      >
                        <Edit3 className="w-3 h-3" />
                        {creditsRemaining != null ? formatUsd(creditsRemaining) : "—"} / {formatUsd(budget)}
                      </Button>
                    )}
                  </div>
                  {creditsRemaining != null && (
                    <div className="mt-2">
                      <Progress value={(creditsRemaining / budget) * 100} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Stvarno stanje na OpenAI računu (ručni unos)
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Dnevna potrošnja
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dailyStats.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nema podataka za ovaj mjesec</p>
                ) : (
                  dailyStats.slice(0, 14).map((day) => (
                    <div key={day.date} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16">
                          {format(new Date(day.date), "dd. MMM", { locale: hr })}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          <MessageSquare className="w-2.5 h-2.5 mr-1" />
                          {day.requests}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-muted rounded-full h-1.5">
                          <div
                            className="bg-primary rounded-full h-1.5 transition-all"
                            style={{ width: `${Math.min((day.cost / (budget / 30)) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-foreground w-14 text-right">
                          {formatUsd(day.cost)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Admin: all users */}
            {isAdmin && allUsersUsage.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Potrošnja po korisnicima
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {allUsersUsage.map((u) => (
                    <div key={u.user_id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-xs text-foreground">{u.full_name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-muted rounded-full h-1.5">
                          <div
                            className="bg-primary rounded-full h-1.5"
                            style={{ width: `${Math.min((u.cost / budget) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-foreground w-14 text-right">
                          {formatUsd(u.cost)}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <p className="text-[10px] text-muted-foreground text-center">
              Cijene su aproksimativne (GPT-4o: $2.50/1M ulaz, $10/1M izlaz). Stvarna potrošnja može varirati.
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TokenUsage;
