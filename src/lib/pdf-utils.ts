import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

let fontCache: string | null = null;

export async function loadRobotoFont(): Promise<string | null> {
  if (fontCache) return fontCache;
  try {
    const response = await fetch("/fonts/Roboto-Regular.ttf");
    const buffer = await response.arrayBuffer();
    const binary = new Uint8Array(buffer);
    let str = "";
    for (let i = 0; i < binary.length; i++) {
      str += String.fromCharCode(binary[i]);
    }
    fontCache = btoa(str);
    return fontCache;
  } catch (err) {
    console.error("Failed to load Roboto font:", err);
    return null;
  }
}

export async function getCompanyLogo(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("company_settings")
      .select("logo_url")
      .eq("user_id", user.id)
      .single();
    return data?.logo_url || null;
  } catch {
    return null;
  }
}

export async function setupPDF(): Promise<jsPDF> {
  const doc = new jsPDF();
  const fontBase64 = await loadRobotoFont();
  if (fontBase64) {
    doc.addFileToVFS("Roboto-Regular.ttf", fontBase64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.setFont("Roboto", "normal");
  }

  const logoUrl = await getCompanyLogo();
  if (logoUrl) {
    try {
      const img = await fetch(logoUrl);
      const blob = await img.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      doc.addImage(dataUrl, "PNG", 15, 10, 30, 30);
    } catch (err) {
      console.error("Failed to load logo:", err);
    }
  }

  return doc;
}
