# Start here

Extract the source archive into a folder you can write to. Open PowerShell in the folder containing `aerial/`, then run:

```powershell
powershell -NoProfile -File .\aerial\setup.ps1
```

Setup installs the locked dependencies if needed, prepares local configuration without overwriting existing settings, selects an available browser, and runs the software, build, test and browser checks.

The setup process has been verified on the original Windows machine. The property video still requires an independently licensed, textured 3D survey of the house and neighborhood. The supplied template grants no data rights and cannot render a video.

See `aerial/README.md` for the dataset requirements and rendering commands. Once a real survey and its license have been configured, run:

```powershell
npm --prefix aerial run render
```

The final video is published at `output/house_flyover.mp4` only after validation succeeds.
