; Inno Setup script - gera Anaconda-Setup.exe
; Requer Inno Setup 6 (ISCC.exe)

[Setup]
AppId={{A31A8E53-D4EE-40F1-9A6B-1E7A3294A6D2}
AppName=Anaconda
AppVersion=1.3.3
AppPublisher=I V E N U M I
AppPublisherURL=https://venum-eight.vercel.app
DefaultDirName={localappdata}\VENUM-Anaconda
DefaultGroupName=VENUM
DisableProgramGroupPage=yes
OutputDir=..\..\public\downloads
OutputBaseFilename=Anaconda-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
SetupIconFile=.\assets\anaconda.ico
WizardImageFile=.\assets\wizard.bmp
WizardSmallImageFile=.\assets\wizard-small.bmp
UninstallDisplayIcon={app}\anaconda.exe

[Files]
Source: "..\anaconda.exe"; DestDir: "{app}"; DestName: "anaconda.exe"; Flags: ignoreversion
Source: "..\Anaconda-Debug.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\public\assets\anaconda-icon.png"; DestDir: "{app}"; Flags: ignoreversion
Source: ".\assets\anaconda.ico"; DestDir: "{app}"; DestName: "anaconda-icon.ico"; Flags: ignoreversion
Source: "C:\Users\Mansta\Downloads\npcap-1.88.exe"; DestDir: "{tmp}"; DestName: "npcap-1.88.exe"; Flags: deleteafterinstall ignoreversion

[Icons]
Name: "{autodesktop}\Anaconda - VENUM"; Filename: "{app}\anaconda.exe"; WorkingDir: "{app}"; IconFilename: "{app}\anaconda-icon.ico"
Name: "{group}\Anaconda - VENUM"; Filename: "{app}\anaconda.exe"; WorkingDir: "{app}"; IconFilename: "{app}\anaconda-icon.ico"
Name: "{group}\Anaconda Debug (banco guilda)"; Filename: "{app}\Anaconda-Debug.bat"; WorkingDir: "{app}"; IconFilename: "{app}\anaconda-icon.ico"

[Run]
Filename: "{tmp}\npcap-1.88.exe"; Parameters: ""; StatusMsg: "Instalando Npcap (captura passiva de rede)..."; Flags: waituntilterminated; Check: not NpcapInstalled
Filename: "{app}\anaconda.exe"; Description: "Iniciar a Anaconda agora"; Flags: nowait postinstall skipifsilent

[Code]
function NpcapInstalled: Boolean;
begin
  Result :=
    FileExists(ExpandConstant('{sys}\Npcap\wpcap.dll')) or
    FileExists(ExpandConstant('{win}\System32\Npcap\wpcap.dll')) or
    FileExists(ExpandConstant('{win}\SysWOW64\Npcap\wpcap.dll'));
end;
