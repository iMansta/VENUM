; Compat script legado - gera Anaconda-Setup.exe
; Requer Inno Setup 6 (ISCC.exe)

[Setup]
AppId={{A31A8E53-D4EE-40F1-9A6B-1E7A3294A6D2}
AppName=Anaconda
AppVersion=1.1.0
AppPublisher=I V E N U M I
DefaultDirName={localappdata}\VENUM-Anaconda
DefaultGroupName=VENUM
DisableProgramGroupPage=yes
OutputDir=..\..\public\downloads
OutputBaseFilename=Anaconda-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Files]
Source: "..\celeste.exe"; DestDir: "{app}"; DestName: "anaconda.exe"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\Iniciar Anaconda"; Filename: "{app}\anaconda.exe"
Name: "{group}\Iniciar Anaconda"; Filename: "{app}\anaconda.exe"

[Run]
Filename: "{app}\anaconda.exe"; Description: "Iniciar a Anaconda agora"; Flags: nowait postinstall skipifsilent
