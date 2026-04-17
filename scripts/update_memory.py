# update_memory.py
# v2.3 - Automatski updater memorije (spaja staro + novo)

import datetime
def append_to_memory(new_entry: str):
    with open("0 MOZAK/memory.md", "a", encoding="utf-8") as f:
        f.write("\n\n### Nova stavka — " + datetime.datetime.now().strftime("%d.%m.%Y. %H:%M") + "\n")
        f.write(new_entry + "\n")
    print("✅ Dodano u memory.md (bez brisanja starog)")

print("update_memory.py v2.3 spreman za korištenje.")
