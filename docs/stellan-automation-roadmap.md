# Stellan Automation Roadmap

Ovaj dokument je radna mapa za automatizaciju Stellana. Cilj nije da Stellan odmah radi sve sam, nego da pouzdano preuzima sve vise operativnog posla uz jasnu kontrolu korisnika.

## Princip rada

Stellan treba automatizirati posao u slojevima:

1. Prvo promatra i uci.
2. Zatim predlaze checklistu, dopis, rizik ili sljedeci korak.
3. Zatim radi poluautomatiku uz potvrdu.
4. Tek kada ima dovoljno confidencea, radi ogranicenu automatiku.

Za geodetski posao najvaznije je da Stellan nikad ne klikne kriticnu predaju, slanje ili brisanje bez potvrde korisnika.

## Faza 1: Odmah korisno

Ovo su automatizacije koje imaju velik efekt, a mali rizik.

### 1. Correction memory pregled

Status: sljedece za implementaciju.

Sto treba napraviti:
- u Memorija tabu prikazati spremljene correction memories
- vezati ih uz portal i flow_type
- omoguciti brisanje ili deaktivaciju pogresne korekcije
- prikazati sto korekcija mijenja: faze, checklistu, rizike i upozorenja

Vrijednost:
- Stellan ne uci samo iz klikova, nego iz tvoje ispravke
- moze se kontrolirati sto firma smatra pravilnim postupkom

### 2. Checklist generator po tipu elaborata

Status: prioritet visok.

Sto treba napraviti:
- iz shadow sesija i correction memorije sloziti checklist predlozak
- odvojiti tipove: parcelacija, upis, uskladjenje, iskolcenje, situacija, ZK
- checklistu prikazati u predmetu i u Stellan panelu

Primjer:
- "Za parcelaciju provjeri: skica, popis koordinata, punomoc, dokaz pravnog interesa, PDF finalna kontrola."

### 3. PDF extraction

Status: prioritet visok.

Sto treba napraviti:
- ucitati PDF zakljucka, rjesenja, ZK izvatka ili posjedovnice
- izvuci broj predmeta, k.o., cestice, stranke, rokove i trazene dopune
- automatski sloziti sazetak i checklistu sto treba napraviti

Vrijednost:
- manje rucnog citanja
- manje propustenih rokova i priloga

### 4. Mail draft iz konteksta predmeta

Status: prioritet visok.

Sto treba napraviti:
- povezati predmet, status, rokove i zadnje dokumente
- generirati mail stranci, katastru, opcini ili kolegi
- ostaviti slanje uvijek na korisnicku potvrdu

Primjeri:
- dopis katastru
- odgovor stranci sto nedostaje
- interni sazetak za tim
- follow-up ako se ceka odgovor

### 5. Predaj-spremno kontrola

Status: prioritet visok.

Sto treba napraviti:
- prije predaje provjeriti obavezne priloge
- provjeriti nazive dokumenata
- provjeriti je li PDF citljiv i odgovara tipu elaborata
- upozoriti na duplikate ili ocite nelogicnosti

Vrijednost:
- manje gresaka u SDGE predaji
- manje povratnica i ispravaka

## Faza 2: Poluautomatika

Ovdje Stellan pocinje pomagati u portalu, ali korisnik i dalje potvrduje kriticne korake.

### 6. SDGE assist mode

Status: nakon Faze 1.

Sto treba napraviti:
- otvoriti pravi portal i predmet
- prepoznati fazu rada
- ponuditi sljedeci korak
- pripremiti unos ili upload
- traziti potvrdu prije izvrsenja

Pravilo:
- Stellan smije pripremiti i navigirati
- Stellan ne smije predati, poslati ili obrisati bez potvrde

### 7. Next-step engine

Status: nakon checklist generatora.

Sto treba napraviti:
- na temelju predmeta, checklisti i memorije predloziti najlogicniji sljedeci korak
- oznaciti rizik ako nesto nedostaje
- ponuditi akcije: dopis, mail, PDF kontrola, SDGE nastavak

Primjeri:
- "Predmet ima zakljucak, ali nema spremljen rok."
- "Ovaj tip elaborata obicno ima PDF provjeru prije predaje, a ovdje je nema."

### 8. Kalendar i rokovi

Status: nakon PDF extractiona.

Sto treba napraviti:
- iz dokumenata i mailova izvuci rokove
- povezati rok s predmetom
- upozoriti ako predmet stoji
- prikazati dnevni prioritet

### 9. Dashboard zastoja

Status: nakon next-step enginea.

Sto treba napraviti:
- prikazati predmete koji stoje
- grupirati po razlogu zastoja
- predloziti akciju za svaki zastoj

Razlozi:
- ceka stranku
- ceka katastar
- fali PDF
- fali teren
- fali dopis
- ceka predaju

## Faza 3: Ogranicena automatika

Ovo dolazi tek kada Stellan ima dovoljno stabilnu memoriju i correction rules.

### 10. Pokreni nauceni playbook

Status: poslije stabilnih playbookova.

Sto treba napraviti:
- za playbook prikazati confidence po fazi
- omoguciti pokretanje samo prvih par koraka
- dodati checkpoint prije svakog rizicnog koraka
- spremiti rezultat izvedbe nazad u memoriju

### 11. Automatska priprema predmeta

Status: poslije PDF extractiona i checklist generatora.

Sto treba napraviti:
- iz imena predmeta ili PDF-a sloziti pocetni predmet
- popuniti osnovne podatke
- pripremiti checklistu i mail draft
- povezati kalendar ako postoji rok

### 12. CAD priprema i kontrola

Status: paralelno, ali ne prije stabilnosti osnovnog workflowa.

Sto treba napraviti:
- ucitati DWG/DXF
- provjeriti layer-e, boje, debljine i layout
- usporediti sa standardnim templateom
- pripremiti export za skicu ili KKP ZK

## Redoslijed implementacije

Preporuceni redoslijed:

1. Correction memory pregled u Memorija tabu.
2. Checklist generator po tipu elaborata.
3. PDF extraction za zakljucke, rjesenja i izvatke.
4. Predaj-spremno kontrola.
5. Mail draft iz konteksta predmeta.
6. Next-step engine.
7. SDGE assist mode s potvrdom.
8. Kalendar i rokovi.
9. Dashboard zastoja.
10. Pokretanje playbooka s checkpointovima.

## Pravila sigurnosti

Stellan mora traziti potvrdu za:

- predaju elaborata
- slanje maila
- brisanje dokumenta
- izmjenu stvarnog podatka u portalu
- upload finalnog dokumenta
- promjene koje mogu utjecati na rok ili sluzbeni predmet

Stellan smije bez potvrde:

- analizirati PDF
- sloziti checklistu
- pripremiti draft maila
- pripremiti dopis
- otvoriti portal ili predmet
- izraditi sazetak
- oznaciti rizik

## Mjera uspjeha

Automatizacija je dobra ako:

- smanjuje rucno citanje dokumenata
- smanjuje broj propustenih priloga
- smanjuje povratnice
- ubrzava pripremu mailova i dopisa
- daje bolji pregled predmeta
- ne uvodi rizicne automatske klikove bez potvrde

Najvazniji cilj: Stellan treba postati operativni geodetski asistent koji pamti kako firma radi, prepoznaje sto fali i pomaze pripremiti sljedeci siguran korak.
