# CAD DWG import

Stellan CAD moze direktno ucitati tekstualni DXF u browseru. Za pravi DWG import treba vanjski converter servis, jer je DWG binarni/proprietary CAD format i nije pouzdano citljiv samo frontend JavaScriptom.

Podrzani put u aplikaciji:

1. Postavi `VITE_CAD_CONVERTER_URL`, npr. `http://localhost:8791`.
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
