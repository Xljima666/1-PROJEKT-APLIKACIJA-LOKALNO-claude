import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdf_url, pdf_base64, field_values, list_fields_only } = await req.json();

    // Need either a URL or base64 PDF
    if (!pdf_url && !pdf_base64) {
      return new Response(
        JSON.stringify({ error: "Potreban je pdf_url ili pdf_base64 parametar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load the PDF
    let pdfBytes: Uint8Array;
    if (pdf_base64) {
      // Decode base64
      const binaryString = atob(pdf_base64);
      pdfBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        pdfBytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      // Fetch from URL
      const pdfRes = await fetch(pdf_url);
      if (!pdfRes.ok) {
        return new Response(
          JSON.stringify({ error: `Nije moguće dohvatiti PDF: ${pdfRes.status}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
    }

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const allFields = form.getFields();

    // List fields mode — just return field names and types
    if (list_fields_only) {
      const fieldList = allFields.map((f: any) => {
        const name = f.getName();
        const type = f.constructor.name.replace("PDF", "").replace("Field", "");
        let options: string[] | undefined;
        
        // For dropdowns/option lists, get available options
        try {
          if (type === "Dropdown" || type === "OptionList") {
            options = f.getOptions?.() || [];
          }
        } catch (_) {}

        return { name, type, ...(options ? { options } : {}) };
      });

      return new Response(
        JSON.stringify({ success: true, fields: fieldList, total: fieldList.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fill mode — requires field_values
    if (!field_values || typeof field_values !== "object") {
      return new Response(
        JSON.stringify({ error: "Potreban je field_values objekt za ispunjavanje" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const filled: string[] = [];
    const errors: string[] = [];

    for (const [fieldName, value] of Object.entries(field_values)) {
      try {
        const field = form.getField(fieldName);
        if (!field) {
          errors.push(`Polje "${fieldName}" ne postoji u PDF-u`);
          continue;
        }

        const type = field.constructor.name;

        if (type === "PDFTextField") {
          (field as any).setText(String(value));
          filled.push(fieldName);
        } else if (type === "PDFCheckBox") {
          if (value === true || value === "true" || value === "Da" || value === "yes") {
            (field as any).check();
          } else {
            (field as any).uncheck();
          }
          filled.push(fieldName);
        } else if (type === "PDFDropdown") {
          (field as any).select(String(value));
          filled.push(fieldName);
        } else if (type === "PDFRadioGroup") {
          (field as any).select(String(value));
          filled.push(fieldName);
        } else if (type === "PDFOptionList") {
          if (Array.isArray(value)) {
            (field as any).select(value.map(String));
          } else {
            (field as any).select([String(value)]);
          }
          filled.push(fieldName);
        } else {
          errors.push(`Polje "${fieldName}" ima nepodržani tip: ${type}`);
        }
      } catch (e) {
        errors.push(`Greška kod polja "${fieldName}": ${e.message}`);
      }
    }

    // Flatten form so fields are no longer editable (optional but cleaner)
    // form.flatten(); // Uncomment if you want non-editable output

    const filledPdfBytes = await pdfDoc.save();
    const base64Output = btoa(
      String.fromCharCode(...filledPdfBytes)
    );

    return new Response(
      JSON.stringify({
        success: true,
        filled_fields: filled,
        errors: errors.length > 0 ? errors : undefined,
        pdf_base64: base64Output,
        size_bytes: filledPdfBytes.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fill-pdf error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Interna greška pri obradi PDF-a" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
