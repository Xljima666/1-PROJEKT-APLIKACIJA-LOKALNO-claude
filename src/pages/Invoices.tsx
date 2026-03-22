import DashboardLayout from "@/components/layout/DashboardLayout";
import { ExternalLink, Globe, MapPin } from "lucide-react";

const links = [
  {
    id: "oss",
    title: "OSS",
    description: "Otvoreni sustav upravljanja",
    url: "https://oss.uredjenazemlja.hr",
    icon: Globe,
  },
  {
    id: "sdge",
    title: "SDGE",
    description: "Sustav digitalne geodetske evidencije",
    url: "https://sdge.dgu.hr",
    icon: MapPin,
  },
  {
    id: "ispu",
    title: "ISPU",
    description: "Informacijski sustav prostornog uređenja",
    url: "https://ispu.mgipu.hr/#/",
    icon: Globe,
  },
  {
    id: "dxf2gml",
    title: "DXF2GML",
    description: "Konverzija DXF u GML format",
    url: "https://dxf2gml.dgu.hr/",
    icon: Globe,
  },
  {
    id: "edozvola",
    title: "eDozvola",
    description: "Sustav za elektroničke dozvole",
    url: "https://edozvola.gov.hr/",
    icon: Globe,
  },
  {
    id: "geoportal",
    title: "Geoportal Zagreb",
    description: "Karta Grada Zagreba",
    url: "https://geoportal.zagreb.hr/Karta",
    icon: MapPin,
  },
];

const Invoices = () => {
  return (
    <DashboardLayout noScroll>
      <div className="p-6 space-y-6 h-full overflow-y-auto scrollbar-hide">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors group"
            >
              <div className="p-3 rounded-lg bg-primary/10 text-primary">
                <link.icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{link.title}</p>
                <p className="text-sm text-muted-foreground truncate">{link.description}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Invoices;
