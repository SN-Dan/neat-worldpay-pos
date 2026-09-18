/** @odoo-module **/
/* global html2canvas */
window.__neat_pos_defined = window.__neat_pos_defined || {};
if (!window.__neat_pos_defined['pos_neatworldpay.SNReprintReceiptScreen']) {
    window.__neat_pos_defined['pos_neatworldpay.SNReprintReceiptScreen'] = true;
    odoo.define('pos_neatworldpay.SNReprintReceiptScreen', function(require) {
        'use strict';

        const { Printer } = require('point_of_sale.Printer');
        const Registries = require('point_of_sale.Registries');
        const ReprintReceiptScreen = require('point_of_sale.ReprintReceiptScreen')


        const SNReprintReceiptScreen = (ReprintReceiptScreen) => class extends ReprintReceiptScreen {
            async getReceiptImage() {
                const printer = new Printer(null, this.env.pos);
                printer.isEmail = true
                const image = await printer.htmlToImg(this.orderReceipt.el.innerHTML)
                return image
            }
            async _printWeb() {
                if (window.isNeatPOSAndroidApp && window.useBluetoothPrinter) {
                    const image = await this.getReceiptImage()
                    AndroidInterface.onBluetoothPrintReceipt(image);
                } 
                else if(window.desktop_ws && window.is_printing_allowed_desktop_ws_map && window.is_printing_allowed_desktop_ws_map[localStorage.getItem("neat_synced_device_code")]) {
                    const image = await this.getReceiptImage()
                    if (window.desktop_ws_is_online && window.desktop_ws_send_print) {
                        await window.desktop_ws_send_print(image);
                    } else {
                        window.desktop_ws.send(JSON.stringify({ type: "message", msgType: "print", msgPayload: image }));
                    }
                }
                else {
                    await super._printWeb();
                }
            }
        };

        Registries.Component.extend(ReprintReceiptScreen, SNReprintReceiptScreen);
        return ReprintReceiptScreen;
    });
}
