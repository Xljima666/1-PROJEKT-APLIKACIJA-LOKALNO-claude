import { Button } from "@/components/ui/button";
import { Play, Bot, Save, TestTube, ArrowRightCircle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

interface LearningActionsProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onImproveCode: () => void;
  onSaveFlow: () => void;
  onTestFlow: () => void;
  onConvertToFMECard: () => void;
}

export function LearningActions({
  isRecording,
  onStartRecording,
  onImproveCode,
  onSaveFlow,
  onTestFlow,
  onConvertToFMECard,
}: LearningActionsProps) {
  return (
    <div className="space-y-2">
      <div className="uppercase text-xs text-zinc-500 mb-4 px-1">AKCIJE</div>

      <Button
        onClick={onStartRecording}
        className={cn(
          "w-full h-12 text-base font-medium",
          isRecording 
            ? "bg-red-600 hover:bg-red-700" 
            : "bg-emerald-600 hover:bg-emerald-500"
        )}
      >
        <CircleDot className="w-5 h-5 mr-3" />
        {isRecording ? "Zaustavi snimanje" : "1. Pamćenje (Snimi)"}
      </Button>

      <Button
        onClick={onImproveCode}
        variant="outline"
        className="w-full h-11 border-emerald-900 hover:bg-emerald-950 text-emerald-400"
      >
        <Bot className="w-4 h-4 mr-2" />
        2. Stellan — Popravi kod
      </Button>

      <Button onClick={onSaveFlow} className="w-full h-11" variant="secondary">
        <Save className="w-4 h-4 mr-2" />
        3. Spremi Flow
      </Button>

      <Button onClick={onTestFlow} variant="secondary" className="w-full h-11">
        <TestTube className="w-4 h-4 mr-2" />
        4. Testiraj Flow
      </Button>

      <Button 
        onClick={onConvertToFMECard}
        className="w-full h-11 bg-violet-600 hover:bg-violet-500"
      >
        <ArrowRightCircle className="w-4 h-4 mr-2" />
        5. Pretvori u FME Karticu
      </Button>

      <div className="mt-8 text-[10px] text-zinc-500 px-2 leading-relaxed">
        Flow se automatski popunjava dok snimaš u Chromiumu.<br/>
        Nakon snimanja Stellan će ti predložiti poboljšanja.<br/>
        Na kraju možeš flow pretvoriti u karticu za FME sučelje.
      </div>
    </div>
  );
}
