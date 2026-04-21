-- Seed Stellan with a first operational geodesy knowledge base.
-- These records are procedural guidance. Current rules must still be checked
-- against official sources before final professional use.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.stellan_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'general',
  tags text[] DEFAULT ARRAY[]::text[],
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stellan_knowledge_category
  ON public.stellan_knowledge (category);

CREATE INDEX IF NOT EXISTS idx_stellan_knowledge_title
  ON public.stellan_knowledge (title);

INSERT INTO public.stellan_knowledge (title, category, content)
SELECT
  'Geodetski elaborat - osnovni operativni workflow',
  'geodezija',
  'Kad korisnik trazi pomoc oko elaborata, prvo identificiraj vrstu elaborata, katastarsku opcinu, cesticu ili vise cestica, narucitelja, svrhu i fazu predmeta. Zatim napravi operativnu checklistu: sto treba provjeriti u aplikaciji, sto treba preuzeti iz SDGE/OSS-a, koji dokumenti nedostaju, sto se moze pripremiti odmah i koji je iduci najbolji korak. Ne tvrdi da je elaborat predan, potpisan ili ovjeren ako to nije potvrdeno iz SDGE-a ili od korisnika. Ako se spominju aktualni propisi, obrasci, rokovi ili posebne procedure, provjeri sluzbeni izvor prije konacnog odgovora.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stellan_knowledge
  WHERE title = 'Geodetski elaborat - osnovni operativni workflow'
);

INSERT INTO public.stellan_knowledge (title, category, content)
SELECT
  'SDGE - operativni rad s predmetima i PDF dokumentima',
  'sdge',
  'Za SDGE upite prvo koristi search_sdge kad korisnik navede naziv, godinu, status, katastarsku opcinu, interni broj ili izradivaca. Ako korisnik trazi dokument za poznati predmet, koristi download_sdge_pdf. Ako korisnik pita za otpremu, dostavu ili povratnice, koristi sdge_povratnice. U odgovoru jasno navedi izvor podatka i broj predmeta ako je poznat. Ako pretraga ne vrati rezultat, reci koji su kriteriji koristeni i predlozi usko sljedece pretrazivanje.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stellan_knowledge
  WHERE title = 'SDGE - operativni rad s predmetima i PDF dokumentima'
);

INSERT INTO public.stellan_knowledge (title, category, content)
SELECT
  'OSS Uredena zemlja - rad s cesticama i dokumentima',
  'oss',
  'Za OSS/Uredena zemlja upite trazi minimalno katastarsku opcinu i broj cestice. Prvo koristi search_oss u mode search, a zatim parcel_id iz rezultata za details, owners, land_registry ili download. Za dokumente razlikuj posjedovni list, kopiju katastarskog plana i ZK izvadak. Ako korisnik ne zna tocnu katastarsku opcinu ili cestica ima podbrojeve, trazi pojasnjenje prije zakljucka.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stellan_knowledge
  WHERE title = 'OSS Uredena zemlja - rad s cesticama i dokumentima'
);

INSERT INTO public.stellan_knowledge (title, category, content)
SELECT
  'PDF dokumenti u geodetskom predmetu - pravila rada',
  'pdf',
  'Za PDF obrasce prvo utvrdi je li potrebno izlistati polja ili odmah popuniti poznate vrijednosti. Ne pretpostavljaj podatke koji moraju biti tocni, poput OIB-a, adrese, katastarske opcine, cestice, broja predmeta ili narucitelja. Ako PDF dolazi iz SDGE/OSS-a, u sazetku navedi izvor i svrhu dokumenta. Kod pripreme nacrta jasno oznaci da je nacrt za provjeru prije sluzbene upotrebe.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stellan_knowledge
  WHERE title = 'PDF dokumenti u geodetskom predmetu - pravila rada'
);

INSERT INTO public.stellan_knowledge (title, category, content)
SELECT
  'Aktualna geodezija - pravilo provjere izvora',
  'pravila-izvora',
  'Kad korisnik pita za aktualne geodetske propise, pravilnike, obrasce, rokove, javne procedure ili tumacenja, nemoj se oslanjati samo na memoriju modela. Prvo provjeri interno znanje kroz search_knowledge, a zatim koristi web_search/search_internet prema sluzbenim izvorima kad je bitna svjezina informacije. Preferirani izvori su DGU, Katastar, SDGE, OSS/Uredena zemlja i Narodne novine. Ako ne mozes potvrditi podatak, reci da ga treba provjeriti prije sluzbene primjene.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stellan_knowledge
  WHERE title = 'Aktualna geodezija - pravilo provjere izvora'
);
