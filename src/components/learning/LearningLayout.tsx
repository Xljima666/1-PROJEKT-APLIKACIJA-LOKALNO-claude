import React, { useState, useEffect } from 'react';
import { FlowsSidebar } from './FlowsSidebar';
import { FlowCodeViewer } from './FlowCodeViewer';
import { LearningActions } from './LearningActions';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export const LearningLayout: React.FC = () => {
  const [flows, setFlows] = useState<any[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [currentCode, setCurrentCode] = useState<string>('// Kod će se pojaviti ovdje dok snimaš...');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedActions, setRecordedActions] = useState<any[]>([]);

  const handleStartRecording = async () => {
    setIsRecording(true);
    // Poziv na start_recording tool
    console.log('🎥 Pokrećem snimanje...');
    // Ovdje će biti playwright integracija
  };

  const handleImproveCode = async () => {
    if (!currentCode) return;
    console.log('🧠 Stellan popravlja kod...');
    // Ovdje će biti AI improve logika
    setCurrentCode('// Stellan je poboljšao kod...\n' + currentCode);
  };

  const handleSaveFlow = () => {
    console.log('💾 Spremam flow:', selectedFlow);
    // save_action + baza
  };

  const handleTestFlow = () => {
    console.log('▶️ Testiram flow...');
    // run_action
  };

  const handleConvertToFMECard = () => {
    console.log('🔄 Pretvaram u FME karticu...');
    // Kreira novu karticu u GeoTerra appu
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
      <div className="border-b border-zinc-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Learning Flows</h1>
          <div className="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/30">
            v2.4 — Recording + Stellan AI
          </div>
        </div>
        <div className="text-sm text-zinc-500">Agent online</div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Lijeva kolona - Lista flowova */}
        <div className="w-72 border-r border-zinc-800 bg-zinc-950">
          <FlowsSidebar 
            flows={flows}
            selectedFlow={selectedFlow}
            onSelect={setSelectedFlow}
            onNewFlow={() => setSelectedFlow('new-flow-' + Date.now())}
          />
        </div>

        {/* Sredina - Live Code Viewer */}
        <div className="flex-1 flex flex-col">
          <FlowCodeViewer code={currentCode} isRecording={isRecording} />
        </div>

        {/* Desna kolona - Akcije */}
        <div className="w-80 border-l border-zinc-800 bg-zinc-900 p-4">
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
    </div>
  );
};
