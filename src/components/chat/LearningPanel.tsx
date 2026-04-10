import { useBrainPanelTech } from "./BrainPanelTech";
import { useLearningPanelTech } from "./useLearningPanelTech";
import { LEARNING_NODE_TYPES } from "./learningNodeTypes";

const LearningPanelV2 = ({ onClose }) => {
  const brain = useBrainPanelTech([]);
  const learning = useLearningPanelTech();

  const convertStepsToNodes = (steps) => {
    const nodes = steps.map((s, i) => {
      let type = "click";
      if (s.action?.includes("goto")) type = "goto";
      if (s.action?.includes("fill")) type = "fill";

      return {
        id: `node-${i}`,
        x: 200 + i * 260,
        y: 200,
        label: LEARNING_NODE_TYPES[type].label,
        category: LEARNING_NODE_TYPES[type].category,
        config: {
          selector: s.selector,
          value: s.value,
          url: s.url,
        },
      };
    });

    brain.actions.setNodes(nodes);
  };

  return (
    <div className="fixed inset-0 bg-[#050816] text-white">

      <div className="flex justify-between p-3 border-b border-white/10">
        <button onClick={onClose}>← Nazad</button>

        <div className="flex gap-2">
          {!learning.state.recording ? (
            <button onClick={learning.actions.startRecording}>⏺ Record</button>
          ) : (
            <button onClick={async () => {
              const steps = await learning.actions.stopRecording();
              convertStepsToNodes(steps);
            }}>
              ⏹ Stop
            </button>
          )}

          <button onClick={learning.actions.runFlow}>▶ Run</button>
          <button onClick={learning.actions.loadPreview}>📸 Preview</button>
        </div>
      </div>

      <div className="flex-1">
        {/* UBACI OVDJE BrainPanel canvas */}
      </div>

      {learning.state.preview && (
        <div className="absolute bottom-0 right-0 w-80">
          <img src={learning.state.preview} />
        </div>
      )}

    </div>
  );
};

export default LearningPanelV2;
