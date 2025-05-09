/** @odoo-module **/
/* global html2canvas */
odoo.define('pos_neatworldpay.SNReceiptScreen', function(require) {
    'use strict';

    const { Printer } = require('point_of_sale.Printer');
    const Registries = require('point_of_sale.Registries');
    const ReceiptScreen = require('point_of_sale.ReceiptScreen')


    const SNReceiptScreen = (ReceiptScreen) => class extends ReceiptScreen {
        async getReceiptImage() {
            const printer = new Printer(null, this.env.pos);
            const image = await printer.htmlToImg(this.orderReceipt.el.firstElementChild.outerHTML)
            return image
        }
        async _printWeb() {
            if (window.isNeatPOSAndroidApp && window.useBluetoothPrinter) {
                const image = await this.getReceiptImage()
                AndroidInterface.onBluetoothPrintReceipt(image);
            }
            else if(window.desktop_ws && window.is_printing_allowed_desktop_ws_map && window.is_printing_allowed_desktop_ws_map[localStorage.getItem("neatworldpay_synced_device_code")]) {
                const image = await this.getReceiptImage()
                window.desktop_ws.send(JSON.stringify({ type: "message", msgType: "print", msgPayload: image }));
            }
            else {
                await super._printWeb();
            }
        }
    };

    Registries.Component.extend(ReceiptScreen, SNReceiptScreen);
    return ReceiptScreen;

});

