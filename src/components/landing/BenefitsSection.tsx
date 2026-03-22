import { 
  Award, 
  Clock, 
  Shield, 
  Users, 
  Zap,
  HeartHandshake
} from "lucide-react";

const benefits = [
  {
    icon: Award,
    title: "Ovlašteni geodeti",
    description: "Svi naši geodeti posjeduju ovlaštenje Državne geodetske uprave za obavljanje poslova.",
  },
  {
    icon: Clock,
    title: "Brza realizacija",
    description: "Terenske radove obavljamo u dogovorenim rokovima bez nepotrebnog čekanja.",
  },
  {
    icon: Shield,
    title: "Pravna sigurnost",
    description: "Naši elaborati prolaze kontrolu u katastru i zemljišnoknjižnom sudu bez problema.",
  },
  {
    icon: Zap,
    title: "Moderna oprema",
    description: "Koristimo najnovije GNSS i totalnu stanicu za maksimalnu preciznost mjerenja.",
  },
  {
    icon: Users,
    title: "Iskusni tim",
    description: "Više od 15 godina iskustva u geodetskoj struci na području cijele Hrvatske.",
  },
  {
    icon: HeartHandshake,
    title: "Osobni pristup",
    description: "Svaki klijent dobiva posvećenog geodeta koji prati projekt od početka do kraja.",
  },
];

const BenefitsSection = () => {
  return (
    <section id="o-nama" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Zašto <span className="text-gradient">GEO TERRA</span>?
          </h2>
          <p className="text-lg text-muted-foreground">
            Razlozi zbog kojih nam klijenti vjeruju već godinama.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className="flex gap-4 p-6 rounded-2xl bg-card border border-border hover:shadow-lg transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-lg">
                <benefit.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
