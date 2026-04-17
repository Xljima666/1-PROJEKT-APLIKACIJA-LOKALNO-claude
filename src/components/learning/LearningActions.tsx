import React from 'react';
import { Button } from '@/components/ui/button';
import { Record, Wand2, Save, PlayCircle, ArrowRight } from 'lucide-react';

interface LearningActionsProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onImproveCode: () => void;
  onSaveFlow: () => void;
  onTestFlow: () => void;
  onConvertToFMECard: () => void;
}

export const LearningActions: React.FC<LearningActionsProps> = ({
  isRecording,
  onStartRecording,
  onImproveCode,
  onSaveFlow,
  onTestFlow,
  onConvertToFMECard
}) => {
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-widest text-zinc-500 mb-4">AKCIJE</div>

      <Button
        onClick={onStartRecording}
        disabled={isRecording}
        className="w-full h-14 text-base bg-red-600 hover:bg-red-700 flex items-center gap-3"
      >
        <Record className="w-5 h-5" />
        {isRecording ? 'Snimanje u tijeku...' : '1. Pamćenje — Snimi'}
      </Button>

      <Button
        onClick={onImproveCode}
        variant="outline"
        className="w-full h-14 text-base border-emerald-600 text-emerald-400 hover:bg-emerald-950 flex items-center gap-3"
      >
        <Wand2 className="w-5 h-5" />
        2. Stellan — Popravi kod
      </Button>

      <Button
        onClick={onSaveFlow}
        className="w-full h-12 bg-zinc-700 hover:bg-zinc-600 flex items-center gap-3"
      >
        <Save className="w-4 h-4" />
        3. Spremi Flow
      </Button>

      <Button
        onClick={onTestFlow}
        variant="secondary"
        className="w-full h-12 flex items-center gap-3"
      >
        <PlayCircle className="w-4 h-4" />
        4. Testiraj Flow
      </Button>

      <Button
        onClick={onConvertToFMECard}
        className="w-full h-12 bg-violet-600 hover:bg-violet-700 flex items-center gap-3"
      >
        <ArrowRight className="w-4 h-4" />
        5. Pretvori u FME Karticu
      </Button>

      <div className="pt-6 text-[10px] text-zinc-500 leading-relaxed">
        Redoslijed je namjerno ovakav.<br/>
        Prvo snimi → Stellan popravi → Spremi → Testiraj → Pretvori u karticu.<br/><br/>
        Sve se sprema u bazu i pojavljuje u lijevoj listi.
      </div>
    </div>
  );
};
