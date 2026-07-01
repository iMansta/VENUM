; Inno Setup script - gera Celeste-Setup.exe
; Requer Inno Setup 6 (ISCC.exe)

[Setup]
AppId={{A31A8E53-D4EE-40F1-9A6B-1E7A3294A6D2}
AppName=Celeste
AppVersion=1.0.0
AppPublisher=I V E N U M I
DefaultDirName={localappdata}\VENUM-Celeste
DefaultGroupName=VENUM
DisableProgramGroupPage=yes
OutputDir=..\..\public\downloads
OutputBaseFilename=Celeste-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Files]
Source: "..\celeste.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\Iniciar Celeste"; Filename: "{app}\celeste.exe"
Name: "{group}\Iniciar Celeste"; Filename: "{app}\celeste.exe"

[Run]
Filename: "{app}\celeste.exe"; Description: "Iniciar Celeste agora"; Flags: nowait postinstall skipifsilent
