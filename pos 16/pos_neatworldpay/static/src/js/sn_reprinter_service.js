/** @odoo-module **/
/* global html2canvas */
odoo.define('pos_neatworldpay.SNReprintReceiptScreen', function(require) {
    'use strict';

    const { Printer } = require('point_of_sale.Printer');
    const Registries = require('point_of_sale.Registries');
    const ReprintReceiptScreen = require('point_of_sale.ReprintReceiptScreen')


    const SNReprintReceiptScreen = (ReprintReceiptScreen) => class extends ReprintReceiptScreen {
        async getReceiptImage() {
            const printer = new Printer(null, this.env.pos);
            const image = await printer.htmlToImg(this.orderReceipt.el.firstElementChild.outerHTML)
            return image
        }
        async _printWeb() {
            if (window.isNeatPOSAndroidApp && window.useBluetoothPrinter) {
                const image = await this.getReceiptImage()
                AndroidInterface.onBluetoothPrintReceipt(image);
            } else {
                await super._printWeb();
            }
        }
    };

    Registries.Component.extend(ReprintReceiptScreen, SNReprintReceiptScreen);
    return ReprintReceiptScreen;
});

