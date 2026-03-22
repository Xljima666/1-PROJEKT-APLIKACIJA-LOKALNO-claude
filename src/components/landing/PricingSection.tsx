import { 
  MapPin, 
  Ruler, 
  Target, 
  FileText, 
  Building2, 
  Layers, 
  Mountain, 
  Landmark 
} from "lucide-react";

const services = [
  {
    icon: MapPin,
    title: "Katastarska izmjera",
    description: "Utvrđivanje i obilježavanje granica katastarskih čestica prema novom Pravilniku o geodetskim elaboratima (NN 7/2026). Uključuje terensko snimanje GNSS i totalnom stanicom te izradu elaborata izmjere.",
  },
  {
    icon: Ruler,
    title: "Parcelacija zemljišta",
    description: "Dioba ili spajanje katastarskih čestica uz izradu parcelacijskog elaborata sukladno novim pravilima za digitalni katastar. Obavezna prethodna provjera u BZP-u.",
  },
  {
    icon: Target,
    title: "Iskolčenje objekata",
    description: "Prijenos projektiranih koordinata na teren prije početka gradnje. Izrađujemo elaborat iskolčenja koji je obavezan dio tehničke dokumentacije za građevinsku dozvolu.",
  },
  {
    icon: FileText,
    title: "Geodetski elaborati",
    description: "Izrada svih vrsta elaborata prema Pravilniku iz 2026.: elaborati izmjere, elaborati za evidentiranje, elaborati za infrastrukturu i elaborati posebnih dijelova zgrada.",
  },
  {
    icon: Building2,
    title: "Evidentiranje zgrada",
    description: "Snimanje i upis novoizgrađenih ili neevidentiranih zgrada u katastar i zemljišnu knjigu. Obavezno za sve objekte koji nisu upisani u digitalni katastar.",
  },
  {
    icon: Layers,
    title: "Geodetski projekti",
    description: "Izrada geodetskog projekta kao sastavnog dijela glavnog projekta za ishođenje građevinske dozvole. Uključuje geodetski situacijski nacrt stvarnog stanja.",
  },
  {
    icon: Mountain,
    title: "Topografska snimanja",
    description: "Detaljno snimanje terena za potrebe projektiranja prometnica, komunalne infrastrukture i objekata. Izlazni proizvod je geodetski situacijski nacrt s visinskim prikazom.",
  },
  {
    icon: Landmark,
    title: "Etažiranje",
    description: "Izrada elaborata za upis posebnih dijelova nekretnina (stanova, garaža, poslovnih prostora) u zemljišnu knjigu. Neophodan korak za prodaju i kredit pojedinog stana.",
  },
];

const PricingSection = () => {
  return (
    <section id="usluge" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Opis naših <span className="text-gradient">usluga</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Obavljamo kompletne geodetske usluge za fizičke osobe, tvrtke i javni sektor 
            — od izmjere i parcelacije do iskolčenja i izrade elaborata.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {services.map((service, index) => (
            <div
              key={service.title}
              className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 animate-fade-in flex gap-4"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <service.icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{service.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
