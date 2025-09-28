/** @odoo-module **/

import { EpsonPrinter } from "@point_of_sale/app/utils/printer/epson_printer";
import { patch } from "@web/core/utils/patch";

patch(EpsonPrinter.prototype, {
    // Clean up malformed URLs with duplicate protocol prefixes
    _cleanAddress(address) {
        if (!address) return address;
        
        // Remove duplicate protocol prefixes
        let cleanedAddress = address;
        
        // Handle cases like https://https://, http://http://, etc.
        while (cleanedAddress.match(/^(https?:\/\/){2,}/)) {
            cleanedAddress = cleanedAddress.replace(/^https?:\/\/https?:\/\//, 'https://');
        }
        
        // Handle mixed protocols like http://https://, https://http://
        cleanedAddress = cleanedAddress.replace(/^http:\/\/https:\/\//, 'https://');
        cleanedAddress = cleanedAddress.replace(/^https:\/\/http:\/\//, 'http://');
        
        // If no protocol is present, default to http://
        if (!cleanedAddress.match(/^https?:\/\//)) {
            cleanedAddress = 'http://' + cleanedAddress;
        }
        
        return cleanedAddress;
    },

    async sendPrintingJob(img) {
        if(window.isNeatPOSAndroidApp && window.useSelfSignedCertificates) {
            const cleanAddress = this._cleanAddress(this.address);
            const body = await new Promise((resolve) => {
                window.selfSignedFetch(cleanAddress, {
                    method: "POST",
                    body: img,
                    contentType: "application/xml; charset=utf-8"
                }, (result) => resolve(result));
            });
            if(body) {
                const parser = new DOMParser();
                const parsedBody = parser.parseFromString(body, "application/xml");
                const response = parsedBody.querySelector("response");
                return {
                    result: response.getAttribute("success") === "true",
                    printerErrorCode: response.getAttribute("code"),
                };
            }
            else {
                return {
                    result: false,
                    printerErrorCode: "OK",
                };
            }
        }

        return await super.sendPrintingJob(img);
    },
});