import { useState } from "react";
import { Bot, Brain, Rocket, TerminalSquare } from "lucide-react";
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
      <div className="flex h-full flex-col overflow-auto bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_30%),#0b1020] p-6 text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                    <Bot className="mr-1 h-3.5 w-3.5" />
                    Stellan Workspace
                  </Badge>
                  <Badge variant="outline" className="border-violet-500/20 bg-violet-500/10 text-violet-200">
                    <Brain className="mr-1 h-3.5 w-3.5" />
                    Chat + DEV Studio
                  </Badge>
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Stellan AI agent za rad, debug i deploy
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/68 sm:text-base">
                  Ovdje otvaraš normalni Stellan chat ili direktno ulaziš u profesionalni DEV Studio za preview,
                  git status, build, deploy, greške, logove i spremljene akcije.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
                <Button className="h-12 bg-white text-slate-950 hover:bg-white/90" onClick={() => openChat("chat")}>
                  <Bot className="mr-2 h-4 w-4" />
                  Otvori chat
                </Button>
                <Button className="h-12 bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={() => openChat("dev")}>
                  <TerminalSquare className="mr-2 h-4 w-4" />
                  Otvori DEV Studio
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/90">
                <TerminalSquare className="h-4 w-4 text-cyan-200" />
                DEV panel
              </div>
              <p className="text-sm leading-6 text-white/60">
                Pregled grešaka, build i deploy status, git stanje, logovi i brze akcije u jednom čistom panelu.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/90">
                <Brain className="h-4 w-4 text-violet-200" />
                Flow & learning
              </div>
              <p className="text-sm leading-6 text-white/60">
                Snimaj radnje, spremaj flowove i ponovno ih izvršavaj bez traženja skripti po projektu.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/90">
                <Rocket className="h-4 w-4 text-emerald-200" />
                Online deploy pregled
              </div>
              <p className="text-sm leading-6 text-white/60">
                GitHub i Vercel stanje mogu se pratiti iz istog DEV layera bez skakanja po više servisa.
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
