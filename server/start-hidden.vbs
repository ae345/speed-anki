' Starts the speed-anki sync server without a window. Used at Windows login.
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
node = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(node) Then node = "node"
sh.Run """" & node & """ """ & dir & "\server.js""", 0, False
