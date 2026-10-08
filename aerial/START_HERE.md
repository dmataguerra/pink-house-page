# Start here

Extract the source archive into a folder you can write to. Open PowerShell in the folder containing `aerial/`, then run:

```powershell
powershell -NoProfile -File .\aerial\setup.ps1
```

Setup installs the locked dependencies if needed, prepares local configuration without overwriting existing settings, selects an available browser, and runs the software, build, test and browser checks.

The default animation uses the included open map data: it begins at the map-rendering point from the earlier preview and continues around a simplified 3D neighborhood. The target is labeled “Pink House”; coordinates and the video footer are hidden. Buildings and heights are approximate. No private survey or API key is needed.

Generate the actual 20-second, Full HD MP4, starting at the former 10-second point:

```powershell
npm --prefix aerial run render
```

The final video is published at `output/house_flyover.mp4` only after validation succeeds.

If an old local configuration sets `FLYOVER_MODE=surveyed`, change it to `FLYOVER_MODE=illustrated`. The surveyed mode is optional and still requires an independently licensed real 3D survey. See `aerial/README.md` for previews, source attribution, refreshing the included map data and verification commands.
