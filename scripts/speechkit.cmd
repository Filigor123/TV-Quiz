@echo off
setlocal
set "TVQUIZ_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%TVQUIZ_PYTHON%" goto system_python
"%TVQUIZ_PYTHON%" -B -X utf8 "%~dp0speechkit.py" %*
exit /b %ERRORLEVEL%
:system_python
py -3 -B -X utf8 "%~dp0speechkit.py" %*
exit /b %ERRORLEVEL%
