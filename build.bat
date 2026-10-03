@echo off
REM Windows (MinGW g++ / MSYS2). Run from this folder.
g++ -std=c++17 -O2 -Wall -o server.exe cpp\*.cpp -lws2_32 -lcrypt32
if %errorlevel% neq 0 ( echo BUILD FAILED & exit /b 1 )
echo Built server.exe  -  run:  server.exe
