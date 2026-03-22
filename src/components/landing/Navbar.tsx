import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import geoTerraLogo from "@/assets/geo-terra-logo.jpg";

const Navbar = () => {
  const navLinks = [
    { href: "#o-nama", label: "O nama" },
    { href: "#usluge", label: "Usluge" },
    { href: "#kontakt", label: "Kontakt" },
  ];

  const cesticaLinks = [
    { href: "https://oss.uredjenazemlja.hr", label: "OSS" },
    { href: "https://ispu.mgipu.hr", label: "ISPU" },
    { href: "https://www.zakon.hr/z/19/Zakon-o-gradnji", label: "Zakon o zgradama" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="container mx-auto px-4">
        {/* Main row: Logo + nav links */}
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <img src={geoTerraLogo} alt="GEO TERRA d.o.o." className="h-9 w-auto object-contain group-hover:scale-105 transition-transform" style={{ mixBlendMode: "multiply" }} />
          </Link>

          <div className="flex items-center justify-center gap-2 sm:gap-4 flex-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-0.5 text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap hover:text-primary transition-colors outline-none">
                Informacije o česticama
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {cesticaLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer"
                    >
                      {link.label}
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Second row: Built for Surveyors + Prijava */}
        <div className="flex items-center justify-between border-t border-border/30 py-1.5">
          <Button size="sm" asChild className="h-7 text-xs sm:text-sm">
            <Link to="/software">Software — Built for Surveyors</Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="h-7 text-xs sm:text-sm">
            <Link to="/login">Prijava</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
