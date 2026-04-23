# CAD DWG import

Stellan CAD moze direktno ucitati tekstualni DXF u browseru. Za pravi DWG import koristi lokalni converter servis, jer je DWG binarni/proprietary CAD format i nije pouzdano citljiv samo frontend JavaScriptom.

## Lokalni converter

Jednokratno instaliraj LibreDWG command-line alat:

```powershell
npm run cad:converter:install
```

Zatim pokreni lokalni converter:

```powershell
npm run cad:converter
```

Servis slusa na:

```text
http://localhost:8791
```

Aplikacija defaultno koristi taj URL. Ako zelis drugi server, postavi:

```text
VITE_CAD_CONVERTER_URL=http://localhost:8791
```

Converter prvo koristi lokalni `dwg2dxf.exe` iz LibreDWG-a. Ako taj put ne uspije, proba Windows COM fallback preko ZWCAD-a. Ako zelis promijeniti COM fallback:

```powershell
$env:CAD_CONVERTER_PROGIDS="ZWCAD.Application,AutoCAD.Application"
npm run cad:converter
```

Podrzani put u aplikaciji:

1. Pokreni `npm run cad:converter`.
2. U CAD-u klikni `Ucitaj CAD` i odaberi `.dwg`.
3. Frontend salje `multipart/form-data` POST na `${VITE_CAD_CONVERTER_URL}/convert`.
4. Converter vraca jedan od ova dva odgovora:

```json
{
  "dxf": "0\nSECTION\n2\nENTITIES\n..."
}
```

ili:

```json
{
  "layers": [
    { "id": "l-0", "name": "0", "color": "#ffffff", "visible": true, "locked": false }
  ],
  "shapes": [
    { "id": "s-1", "layerId": "l-0", "type": "line", "x1": 0, "y1": 0, "x2": 100, "y2": 0 }
  ]
}
```

Preporuceni converteri:

- ODA File Converter / ODA Drawings SDK za najvjerniji DWG -> DXF put.
- Autodesk Platform Services Model Derivative API ako zelis cloud viewer/derivate umjesto vlastitog converter servera.
- LibreDWG moze biti koristan za dio DWG verzija, ali treba ga testirati na nasim geodetskim crtezima prije produkcije.

Bitno: template gumbi `Skica 500` i `KKP ZK 500` sluze samo za gotove layere, layoute, debljine i plot stilove. Oni nisu zamjena za stvarno otvaranje bilo kojeg DWG crteza.
