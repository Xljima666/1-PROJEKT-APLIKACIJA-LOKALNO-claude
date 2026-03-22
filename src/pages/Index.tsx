import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import BenefitsSection from "@/components/landing/BenefitsSection";
import PricingSection from "@/components/landing/PricingSection";
import ContactSection from "@/components/landing/ContactSection";
import Footer from "@/components/landing/Footer";
import { PullToRefresh } from "@/components/PullToRefresh";

const Index = () => {
  return (
    <PullToRefresh>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main>
          <HeroSection />
          <PricingSection />
          <BenefitsSection />
          <ContactSection />
        </main>
        <Footer />
      </div>
    </PullToRefresh>
  );
};

export default Index;
