import zipfile
with zipfile.ZipFile('chat (1).zip', 'r') as z:
    print(z.namelist())