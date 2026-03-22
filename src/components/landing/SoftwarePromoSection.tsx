import { Monitor, Kanban, Calendar, MessageSquare, FileText, Shield } from "lucide-react";

const features = [
  {
    icon: Kanban,
    title: "Kanban Project Boards",
    description: "Organize all your surveying jobs on visual boards — track progress from fieldwork to final documentation.",
  },
  {
    icon: Calendar,
    title: "Calendar & Scheduling",
    description: "Plan field surveys, set deadlines, and manage team availability in one unified calendar view.",
  },
  {
    icon: MessageSquare,
    title: "AI Assistant (Stellan)",
    description: "Built-in AI chat that understands your projects — search records, generate documents, and get instant answers.",
  },
  {
    icon: FileText,
    title: "Quotes, Invoices & Work Orders",
    description: "Create professional documents in seconds with auto-calculated totals and PDF export.",
  },
  {
    icon: Shield,
    title: "Bring Your Own Keys",
    description: "Use your own API keys for full control — Google, AI, and third-party integrations stay in your hands.",
  },
  {
    icon: Monitor,
    title: "Works Everywhere",
    description: "Progressive Web App — install on desktop or mobile, works offline, and syncs when you're back online.",
  },
];

const SoftwarePromoSection = () => {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Aplikacija <span className="text-gradient">Built for Surveyors</span>
          </h2>
          <p className="text-base text-muted-foreground">
            Od praćenja projekata do fakturiranja i AI pretraživanja dokumenata — 
            sve što vaš geodetski ured treba, u jednoj aplikaciji.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-5 rounded-xl bg-card border border-border hover:border-primary/40 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SoftwarePromoSection;
