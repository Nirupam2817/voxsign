@echo off
title VoxSign - Sign Language to Speech System
echo ========================================================
echo Starting VoxSign Sign Language to Speech Web Application
echo ========================================================
echo.
echo Launching local server and opening web browser...
echo Keep this window open while using the website.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
