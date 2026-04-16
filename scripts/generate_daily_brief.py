"""Daily Brief Generator for Stellan v2.1
Pokreće se svako jutro preko GitHub Actions.
"""
import datetime
import os

def generate_daily_brief():
    today = datetime.date.today()
    weekday = today.strftime("%A")
    croatian_weekdays = {
        "Monday": "Ponedjeljak",
        "Tuesday": "Utorak",
        "Wednesday": "Srijeda",
        "Thursday": "Četvrtak",
        "Friday": "Petak",
        "Saturday": "Subota",
        "Sunday": "Nedjelja"
    }
    dan = croatian_weekdays.get(weekday, weekday)
    date_str = today.strftime("%d.%m.%Y.")
    
    content = f"""# ☀️ Dnevni brief — {date_str} ({dan})

**Stellan v2.1** • Automatski generiran u 6:30

---

## 🎯 Hitno danas (rok < 48h)


---

## 🔥 Najvažniji prioritet današnjeg dana


---

## 📬 Emailovi koji čekaju odgovor (>24h)


---

## 📊 SDGE — Promjene statusa aktivnih predmeta


---

## 💰 Financije / Solo (neplaćeno, otvorene ponude)


---

## 🛠 Stellanov komentar i preporuka za danas

**Najvažniji zadatak danas:**

---

_Ovaj brief je generiran automatski. Nakon što ga pročitaš, slobodno mi reci što želiš da dublje popunim ili automatiziram (npr. stvarno dohvaćanje podataka iz SDGE, Gmaila ili GeoTerra app-a)._
"""

    folder = "0 MOZAK"
    os.makedirs(folder, exist_ok=True)
    filepath = os.path.join(folder, "brief.md")
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    
    print(f"✅ Daily brief generiran: {filepath}")
    return filepath


if __name__ == "__main__":
    generate_daily_brief()
