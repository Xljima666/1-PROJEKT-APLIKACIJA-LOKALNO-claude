import { 
  MapPin, 
  Ruler, 
  FileText, 
  Building2, 
  Layers, 
  Target,
  Mountain,
  Landmark
} from "lucide-react";

const features = [
  {
    icon: MapPin,
    title: "Katastarska izmjera",
    description: "Precizno snimanje i obilježavanje granica katastarskih čestica na terenu.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: Ruler,
    title: "Parcelacija zemljišta",
    description: "Dioba i spajanje katastarskih čestica prema potrebama vlasnika.",
    color: "text-secondary",
    bgColor: "bg-secondary/10",
  },
  {
    icon: Target,
    title: "Iskolčenje objekata",
    description: "Prijenos projektiranih koordinata objekta na teren prije početka gradnje.",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    icon: FileText,
    title: "Geodetski elaborati",
    description: "Izrada svih vrsta geodetskih elaborata za potrebe katastra i suda.",
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  {
    icon: Building2,
    title: "Evidentiranje zgrada",
    description: "Upis i evidentiranje novoizgrađenih ili neevidentiranih zgrada u katastar.",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    icon: Layers,
    title: "Geodetski projekti",
    description: "Izrada geodetskih projekata za građevinske dozvole i legalizacije.",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  {
    icon: Mountain,
    title: "Topografska snimanja",
    description: "Detaljno snimanje terena za projektiranje prometnica, infrastrukture i objekata.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: Landmark,
    title: "Etažiranje",
    description: "Razrada planova posebnih dijelova nekretnina za upis vlasništva.",
    color: "text-secondary",
    bgColor: "bg-secondary/10",
  },
];

const FeaturesSection = () => {
  return (
    <section id="usluge" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Naše <span className="text-gradient">usluge</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Pružamo širok spektar geodetskih usluga za fizičke i pravne osobe — 
            od katastarskih izmjera i parcelacija do složenih geodetskih projekata i etažiranja.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
