import { useState } from "react";
import { cn } from "@/lib/utils";
import { FlowsSidebar } from "./FlowsSidebar";
import { FlowCodeViewer } from "./FlowCodeViewer";
import { LearningActions } from "./LearningActions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Brain } from "lucide-react";

export function LearningLayout() {
  const [flows, setFlows] = useState<any[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [currentCode, setCurrentCode] = useState<string>("// Kod će se pojavljivati ovdje dok snimaš...");
  const [isRecording, setIsRecording] = useState(false);

  const handleStartRecording = async () => {
    setIsRecording(true);
    // Poziv start_recording tool-a
    console.log("Pokrećem recording...");
  };

  const handleImproveCode = () => {
    console.log("Stellan popravlja kod...");
    // Ovdje će ići AI improve logika
  };

  const handleSaveFlow = () => {
    console.log("Spremam flow...");
  };

  const handleTestFlow = () => {
    console.log("Testiram flow...");
  };

  const handleConvertToFMECard = () => {
    console.log("Pretvaram u FME karticu...");
  };

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100">
      {/* Lijeva kolona - Lista flowova */}
      <div className="w-72 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
          <Brain className="w-5 h-5 text-emerald-400" />
          <h2 className="font-semibold">Moji Flowovi</h2>
        </div>
        <FlowsSidebar 
          flows={flows} 
          selectedFlow={selectedFlow} 
          onSelect={setSelectedFlow} 
        />
      </div>

      {/* Središnji dio - Live Code */}
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b border-zinc-800 flex items-center px-6 justify-between bg-zinc-900">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Nazad na Stellan
            </Button>
            <div className="text-sm text-zinc-400">
              {selectedFlow ? selectedFlow : "Novi Flow"}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            {isRecording && <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              SNIMAM
            </div>}
          </div>
        </div>

        <FlowCodeViewer code={currentCode} onCodeChange={setCurrentCode} />
      </div>

      {/* Desna kolona - Akcije */}
      <div className="w-80 border-l border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3">
        <LearningActions
          isRecording={isRecording}
          onStartRecording={handleStartRecording}
          onImproveCode={handleImproveCode}
          onSaveFlow={handleSaveFlow}
          onTestFlow={handleTestFlow}
          onConvertToFMECard={handleConvertToFMECard}
        />
      </div>
    </div>
  );
}
