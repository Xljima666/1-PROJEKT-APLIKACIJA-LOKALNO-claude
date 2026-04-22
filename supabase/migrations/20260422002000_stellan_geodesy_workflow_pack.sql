-- Add a practical workflow pack for Stellan as a Croatian geodetic assistant.
-- This is operational guidance, not a substitute for checking official sources.

INSERT INTO public.stellan_knowledge (title, category, content, tags, created_by)
SELECT
  'Geodetski predmet - intake i trijaza',
  'geodezija',
  'Kad korisnik pokrene novi geodetski predmet, prvo prikupi minimalni skup podataka: vrsta posla ili elaborata, katastarska opcina, cestica ili vise cestica, narucitelj, OIB ako je potreban, kontakt, svrha, rok i postoje li dostupni dokumenti. Ako korisnik nema sve podatke, ne zaustavljaj posao: razdvoji ono sto se moze napraviti odmah od onoga sto blokira sluzbeni nastavak. Uvijek vrati operativni sazetak: sto znamo, sto nedostaje, koji su izvori provjereni, koji je sljedeci najbolji korak.',
  ARRAY['geodezija', 'predmet', 'intake', 'trijaza', 'checklista'],
  'migration'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stellan_knowledge
  WHERE title = 'Geodetski predmet - intake i trijaza'
);

INSERT INTO public.stellan_knowledge (title, category, content, tags, created_by)
SELECT
  'Elaborat - radna kontrolna lista',
  'geodezija',
  'Za elaborat uvijek strukturiraj odgovor po fazama: 1) identifikacija predmeta, 2) podaci o k.o. i cesticama, 3) narucitelj i svrha, 4) dokumenti iz SDGE-a i OSS/Uredene zemlje, 5) terenski ili uredski ulazi koji nedostaju, 6) nacrt radnji za izradu, 7) kontrola prije predaje. Ne tvrdi da je elaborat spreman za predaju ako nisu provjereni svi obvezni prilozi i aktualna pravila. Kad je propis ili obrazac bitan, koristi sluzbene izvore prije konacne tvrdnje.',
  ARRAY['geodezija', 'elaborat', 'kontrola', 'sdge', 'oss'],
  'migration'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stellan_knowledge
  WHERE title = 'Elaborat - radna kontrolna lista'
);

INSERT INTO public.stellan_knowledge (title, category, content, tags, created_by)
SELECT
  'SDGE - strategija pretrage i preuzimanja dokumenata',
  'sdge',
  'Za SDGE prvo odaberi najuziji pouzdan kriterij: broj predmeta ako postoji, zatim godina i interni broj, zatim naziv/narucitelj/k.o. Ako rezultat nije jednoznacan, ne pogadaj: prikazi kandidate i zatrazi potvrdu. Za PDF dokument koristi download_sdge_pdf tek kad je predmet dovoljno identificiran. Za povratnice i dostavu koristi sdge_povratnice. U odgovoru uvijek oznaci SDGE kao izvor i navedi kriterije pretrage.',
  ARRAY['sdge', 'pretraga', 'pdf', 'povratnice', 'predmet'],
  'migration'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stellan_knowledge
  WHERE title = 'SDGE - strategija pretrage i preuzimanja dokumenata'
);

INSERT INTO public.stellan_knowledge (title, category, content, tags, created_by)
SELECT
  'OSS Uredena zemlja - parcel workflow',
  'oss',
  'Za OSS/Uredena zemlja minimalno trazi katastarsku opcinu i broj cestice. Prvo koristi search_oss mode search. Ako dobijes parcel_id, nastavi s details, owners, land_registry ili download prema zahtjevu. Dokumente razdvoji po namjeni: posjedovni list za posjedovne podatke, kopija katastarskog plana za prikaz katastarskog plana, ZK izvadak za zemljisnoknjizne podatke. Ako postoji vise pogodaka ili podbrojeva, trazi potvrdu prije zakljucka.',
  ARRAY['oss', 'uredjena-zemlja', 'cestica', 'posjedovni-list', 'zk'],
  'migration'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stellan_knowledge
  WHERE title = 'OSS Uredena zemlja - parcel workflow'
);

INSERT INTO public.stellan_knowledge (title, category, content, tags, created_by)
SELECT
  'PDF i obrasci - pravilo pouzdanog popunjavanja',
  'pdf',
  'Kod PDF obrazaca prvo utvrdi je li PDF samo za pregled, za listanje polja ili za popunjavanje. Ne popunjavaj kriticne podatke pretpostavkom: OIB, adresa, k.o., cestica, broj predmeta, narucitelj, podnositelj i datumi moraju biti iz kartice, dokumenta, sluzbenog izvora ili korisnikove potvrde. Ako izradas nacrt, jasno ga oznaci kao nacrt za provjeru. Ako korisnik trazi gotov dokument, nakon popunjavanja navedi koja polja su popunjena i koja treba rucno provjeriti.',
  ARRAY['pdf', 'obrasci', 'popunjavanje', 'kontrola', 'elaborat'],
  'migration'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stellan_knowledge
  WHERE title = 'PDF i obrasci - pravilo pouzdanog popunjavanja'
);

INSERT INTO public.stellan_knowledge (title, category, content, tags, created_by)
SELECT
  'Aktualna geodezija - hijerarhija izvora',
  'pravila-izvora',
  'Kad je pitanje vezano uz aktualne propise, sluzbene obrasce, rokove, procedure, nadleznosti ili tumacenja, odgovaraj po hijerarhiji izvora: 1) korisnikovi dokumenti i predmet, 2) interni GeoTerra podaci, 3) SDGE/OSS podaci, 4) sluzbeni javni izvori kao DGU, Katastar i Narodne novine, 5) ostali web izvori samo kao pomocni trag. Ako ne mozes provjeriti aktualnost, reci da informaciju treba potvrditi prije sluzbene upotrebe.',
  ARRAY['aktualno', 'izvori', 'dgu', 'katastar', 'narodne-novine'],
  'migration'
WHERE NOT EXISTS (
  SELECT 1 FROM public.stellan_knowledge
  WHERE title = 'Aktualna geodezija - hijerarhija izvora'
);
