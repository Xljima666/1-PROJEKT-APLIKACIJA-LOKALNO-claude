import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatDialog from "@/components/chat/ChatDialog";
import DashboardLayout from "@/components/layout/DashboardLayout";

const Stellan = () => {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Bot className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Stellan AI Asistent</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Pozdrav! Trenutno imaš pristup Stellanu — tvom AI asistentu. Za pristup ostalim modulima obrati se administratoru.
        </p>
        <Button onClick={() => setChatOpen(true)} className="gap-2 mt-2">
          <Bot className="w-4 h-4" />
          Otvori Stellana
        </Button>
      </div>
      <ChatDialog open={chatOpen} onClose={() => setChatOpen(false)} />
    </DashboardLayout>
  );
};

export default Stellan;
