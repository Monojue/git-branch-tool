# Creates "Git Branch Tool" shortcuts on the Desktop and in the Start menu.
# Run by double-clicking install-shortcuts.bat (or: powershell -ExecutionPolicy Bypass -File create-shortcuts.ps1)
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ws = New-Object -ComObject WScript.Shell
$places = @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))
foreach ($place in $places) {
  $lnk = $ws.CreateShortcut((Join-Path $place 'Git Branch Tool.lnk'))
  $lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
  $lnk.Arguments = '"' + (Join-Path $dir 'launcher.vbs') + '"'
  $lnk.WorkingDirectory = $dir
  $lnk.IconLocation = (Join-Path $dir 'icon.ico') + ',0'
  $lnk.Description = 'Git Branch Tool'
  $lnk.Save()
  Write-Output ('Created: ' + (Join-Path $place 'Git Branch Tool.lnk'))
}
