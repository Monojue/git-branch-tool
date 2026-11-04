@echo off
rem Git Branch Tool (Windows): double-click this file once to put a "Git Branch Tool" shortcut on the desktop.
rem The shortcut starts the tool without a console window (start.vbs). Run it again after moving this folder.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dir = (Get-Location).Path;" ^
  "$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Git Branch Tool.lnk';" ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk);" ^
  "$s.TargetPath = Join-Path $env:SystemRoot 'System32\wscript.exe';" ^
  "$s.Arguments = '\"' + (Join-Path $dir 'start.vbs') + '\"';" ^
  "$s.WorkingDirectory = $dir;" ^
  "$s.IconLocation = (Join-Path $dir 'icon.ico') + ',0';" ^
  "$s.Description = 'Git Branch Tool';" ^
  "$s.Save();" ^
  "Write-Host ('Shortcut created: ' + $lnk)"
if errorlevel 1 (echo Could not create the shortcut.) else (echo Right-click it to pin it to the taskbar or Start.)
pause
