# neat-worldpay-pos


pos_desktop_mode:
docker-compose build
docker-compose up

Export:
docker save -o ~/Desktop/pos-desktop-mode.tar pos_desktop_mode-websocket-server

Import:
docker load -i pos-desktop-mode.tar
