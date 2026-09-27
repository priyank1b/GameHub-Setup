!macro customInit
  # 1. Terminate running GameHub instances so binaries are not locked during installation / upgrade
  ExecWait 'cmd.exe /c taskkill /F /IM GameHub.exe /T >nul 2>&1'
  Sleep 500
!macroend

!macro customUnInstall
  # Ensure all dynamically created folders, unpacked native modules, and caches are cleanly removed
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
!macroend
