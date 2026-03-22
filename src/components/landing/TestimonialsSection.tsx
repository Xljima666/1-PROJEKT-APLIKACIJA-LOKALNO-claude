import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Tomislav Jurić",
    role: "Investitor, Zagreb",
    content: "GEO TERRA je odradio parcelaciju i iskolčenje za naš stambeni projekt brzo i precizno. Elaborat je prošao bez primjedbi.",
    rating: 5,
    avatar: "TJ",
  },
  {
    name: "Ana Brkić",
    role: "Vlasnica nekretnine, Split",
    content: "Trebala sam etažiranje stana i pomoć oko legalizacije. Sve su riješili profesionalno i na vrijeme. Toplo preporučujem!",
    rating: 5,
    avatar: "AB",
  },
  {
    name: "Grad Zaprešić",
    role: "Javni naručitelj",
    content: "Surađujemo s GEO TERRA na katastarskim izmjerama komunalne infrastrukture već godinama. Kvaliteta i pouzdanost su na najvišoj razini.",
    rating: 5,
    avatar: "GZ",
  },
];

const TestimonialsSection = () => {
  return (
    <section id="reference" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Što kažu naši <span className="text-gradient">klijenti</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Povjerenje naših klijenata je naša najbolja preporuka.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="p-6 rounded-2xl bg-card border border-border hover:shadow-lg transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                ))}
              </div>

              {/* Content */}
              <p className="text-muted-foreground mb-6 italic">"{testimonial.content}"</p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
