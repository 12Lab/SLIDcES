if [%1]==[] goto defip
http-server -a %1 -p 8086
exit 1

:defip

http-server -a 127.0.0.1 -p 8086
