import { Link } from "react-router-dom";
import geoTerraLogo from "@/assets/geo-terra-logo.jpg";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-white rounded-lg px-3 py-1.5">
              <img src={geoTerraLogo} alt="GEO TERRA d.o.o." className="h-8 w-auto object-contain" />
            </div>
          </Link>
          <div className="flex flex-col items-center gap-2 text-background/70 text-sm">
            <p>Adresa: Draše 57b, 49290 Kraljevec na Sutli</p>
            <p>Mob: 095/918-4775</p>
            <p>Mail: geoterra@geoterrainfo.net</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
