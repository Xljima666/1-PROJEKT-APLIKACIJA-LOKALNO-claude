import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import SoftwarePromoSection from "@/components/landing/SoftwarePromoSection";
import { PullToRefresh } from "@/components/PullToRefresh";

const Software = () => {
  return (
    <PullToRefresh>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-16">
          <SoftwarePromoSection />
        </main>
        <Footer />
      </div>
    </PullToRefresh>
  );
};

export default Software;
