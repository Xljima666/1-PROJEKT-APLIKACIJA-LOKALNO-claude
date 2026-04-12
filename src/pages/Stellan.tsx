import { useState } from "react";
import { Bot, Brain, Rocket, TerminalSquare, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ChatDialog from "@/components/chat/ChatDialog";
import DashboardLayout from "@/components/layout/DashboardLayout";
 
const Stellan = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [initialView, setInitialView] = useState<"chat" | "dev">("chat");

  const openChat = (view: "chat" | "dev") => {
    setInitialView(view);
    setChatOpen(true);
  };

  return (
    <DashboardLayout noScroll>
      <div className="dev-flow-bg relative flex h-full flex-col overflow-auto p-6 text-white">
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
          <div className="dev-surface dev-glow-border rounded-[34px] p-6 sm:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="dev-pill rounded-full px-3 py-1 text-[11px]">
                    <Bot className="mr-1 h-3.5 w-3.5" />
                    Stellan Workspace
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-violet-400/16 bg-violet-400/10 px-3 py-1 text-[11px] text-violet-100">
                    <Brain className="mr-1 h-3.5 w-3.5" />
                    Chat + DEV Studio
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-emerald-400/16 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100">
                    <Workflow className="mr-1 h-3.5 w-3.5" />
                    Workflow look
                  </Badge>
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl xl:text-[2.9rem]">
                  Stellan AI agent za rad, debug i deploy
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/68 sm:text-base">
                  Vizual je sada bliže workflow builder stilu. Otvori normalni Stellan chat ili uđi ravno u DEV Studio za git,
                  commit, build, deploy, status i logove.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button className="h-12 rounded-2xl bg-white px-5 text-slate-950 hover:bg-white/90" onClick={() => openChat("chat")}>
                    <Bot className="mr-2 h-4 w-4" />
                    Otvori chat
                  </Button>
                  <Button className="h-12 rounded-2xl bg-emerald-400 px-5 text-slate-950 hover:bg-emerald-300" onClick={() => openChat("dev")}>
                    <TerminalSquare className="mr-2 h-4 w-4" />
                    Otvori DEV Studio
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
                <div className="rounded-[26px] border border-white/10 bg-black/15 p-5">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/92">
                    <TerminalSquare className="h-4 w-4 text-cyan-300" />
                    DEV panel
                  </div>
                  <p className="text-sm leading-6 text-white/60">
                    Čist pregled git statusa, builda, deploya, commit poruka i logova na jednom mjestu.
                  </p>
                </div>

                <div className="rounded-[26px] border border-white/10 bg-black/15 p-5">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/92">
                    <Rocket className="h-4 w-4 text-emerald-300" />
                    Produkcija
                  </div>
                  <p className="text-sm leading-6 text-white/60">
                    GitHub i Vercel status ostaju pregledni bez skakanja po više servisa i tabova.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="dev-surface-soft rounded-[28px] p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/90">
                <TerminalSquare className="h-4 w-4 text-cyan-300" />
                DEV stil
              </div>
              <p className="text-sm leading-6 text-white/58">
                Tamna pozadina, grid overlay i zeleno-plavi glow prate vizual koji si pokazao na drugoj slici.
              </p>
            </div>

            <div className="dev-surface-soft rounded-[28px] p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/90">
                <Brain className="h-4 w-4 text-violet-300" />
                Odvojene zone
              </div>
              <p className="text-sm leading-6 text-white/58">
                Učenje i mozak ostaju posebni, a DEV ostaje čist i fokusiran samo na repo i deploy posao.
              </p>
            </div>

            <div className="dev-surface-soft rounded-[28px] p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/90">
                <Bot className="h-4 w-4 text-emerald-300" />
                Brzi ulaz
              </div>
              <p className="text-sm leading-6 text-white/58">
                Iz ove početne stranice odmah otvaraš chat ili DEV Studio bez dodatnog lutanja po aplikaciji.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ChatDialog open={chatOpen} onClose={() => setChatOpen(false)} initialView={initialView} />
    </DashboardLayout>
  );
};

export default Stellan;
