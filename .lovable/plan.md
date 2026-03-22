
CILJ

Ispraviti 2 stvari:
1. linkovi u Stellan chatu da budu pouzdano klikabilni
2. jasno odvojiti što Stellan može napraviti kao korisnik alata, a što moram ja mijenjati u logici chata

ŠTO SAM UTVRDIO

- U `src/components/chat/ChatMessage.tsx` markdown linkovi se trenutno renderiraju kao `button` koji radi `window.open(...)`.
- U konzoli postoji warning iz `ChatMessage` / `ReactMarkdown` oko `ref`, što znači da je trenutni custom render markdowna nestabilan.
- U `supabase/functions/chat/index.ts` već postoje alati:
  - `search_drive`
  - `list_drive_folder`
- Backend već zna dohvatiti podfoldere, ali Stellan nije dovoljno strogo usmjeren da ih uvijek prikaže kako ti želiš.
- Kratki odgovor na tvoje pitanje: Stellan ne može sam sebi “namjestiti” novo ponašanje. Može koristiti postojeće alate, ali ne može sam promijeniti svoj prompt, format odgovora ni backend logiku. To moram napraviti ja.

PLAN IMPLEMENTACIJE

1. Stabilizirati linkove u chatu
- Zamijeniti renderanje vanjskih markdown linkova iz `button + window.open` u pravi `<a href target="_blank" rel="noopener noreferrer">`.
- Interni `#code-*` link ostaviti kao kontrolirani klik za skrolanje na kod.
- Po potrebi izdvojiti markdown renderere u ref-safe komponente da nestane React warning.

2. Učiniti Drive odgovor dosljednim
- Doraditi prompt u `chat` funkciji tako da za upite tipa “pregledaj drive”, “folder”, “podfolder”, “predmet 46-2025”:
  - prvo pozove `search_drive`
  - zatim automatski pozove `list_drive_folder` za glavni pronađeni folder / top rezultate
  - prikaže hijerarhiju: glavni folder → podfolderi → tek onda relevantne datoteke ako ih korisnik traži
- Zabraniti da kao primarni rezultat izbacuje “random datoteke” ako je pronađen odgovarajući folder.

3. Ispraviti Stellanovo “lažno obećavanje”
- U system prompt dodati strogo pravilo:
  - ne smije govoriti “prilagodio sam”, “napisao sam skriptu”, “namjestio sam” ako nije stvarno pozvao alat i dobio uspjeh
  - kad korisnik traži promjenu ponašanja chata, mora jasno reći da to traži developersku izmjenu

4. Doraditi format Drive rezultata
- Za svaki glavni folder ispis:
  - naziv + ispravan link
  - odmah ispod podfoldere s linkovima
  - opcionalno broj pronađenih stavki
- Datoteke prikazivati samo:
  - ako nema folder pogodaka, ili
  - ako korisnik eksplicitno traži datoteke unutar foldera

5. Provjera nakon izmjene
- Testirati end-to-end u chatu s upitima:
  - “pregledaj google drive za 46 2025”
  - “predmet Hruševar”
  - “ispiši podfoldere od 046-2025 Hruševar Robert - PARCELACIJA”
- Provjeriti:
  - da linkovi otvaraju točnu lokaciju
  - da se prvo vide folderi i podfolderi
  - da Stellan više ne tvrdi da je nešto “namjestio” ako nije

ŠTO OVO ZNAČI ZA TVOJE PITANJE

- Linkovi: trenutno je problem vrlo vjerojatno u frontend renderanju chata, ne u samim Drive URL-ovima.
- Folderi i podfolderi: Stellan ih može dohvatiti ako već ima alat, ali ne može sam sebi promijeniti pravila rada. Dakle:
  - može koristiti postojeće alate
  - ne može sam sebi dodati novo ponašanje ni garantirati novi format odgovora bez moje izmjene

TEHNIČKI DETALJI

- Frontend datoteka: `src/components/chat/ChatMessage.tsx`
- Backend logika: `supabase/functions/chat/index.ts`
- Relevantni dijelovi:
  - `searchGoogleDrive(...)`
  - `listDriveFolder(...)`
  - system prompt oko “search mode”
- Nema potrebe za promjenama baze podataka za ovaj zahvat.
