/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { PaymentInterface } from "@point_of_sale/app/payment/payment_interface";
import { ErrorPopup } from "@point_of_sale/app/errors/popups/error_popup";
import { escape } from "@web/core/utils/strings";

export class PaymentNeatWorldpay extends PaymentInterface {
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    addCss() {
        const customModalStyles = `
            /* Modal styles */
            .neat-worldplay-modal-text {
                width: 380px;
                text-align: center;
            }
            .neat-worldplay-modal {
                display: inline-block;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
            }

            .neat-worldplay-modal-content {
                background-color: #fff;
                border-radius: 5px;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                padding: 20px;
                max-width: 400px;
            }

            /* Button styles */
            .neat-worldplay-modal-button {
                width: calc(100% - 20px);
                height: 55px;
                margin: 5px;
                cursor: pointer;
                font-size: 25px;
                border: none;
                background: darkseagreen;
                color: white;
            }
            /* Modal styles */
            .neat-worldplay-promo-modal-text {
                text-align: center;
            }
            .neat-worldplay-promo-modal {
                display: inline-block;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
            }

            .neat-worldplay-promo-modal-content {
                background-color: #fff;
                border-radius: 5px;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                padding: 20px;
            }

            /* Button styles */
            .neat-worldplay-promo-modal-button {
                padding: 10px 20px;
                margin: 5px;
                cursor: pointer;
                font-size: 16px;
            }
        `;

        // Create a <style> element and append it to the document's <head>
        const styleElement = document.createElement('style');
        styleElement.innerHTML = customModalStyles;
        document.head.appendChild(styleElement);
    }
    displayMessage(self, header, message, btnText = "Ok", btnId = "btnOk") {
            const modal = document.createElement('div');
            modal.classList.add('neat-worldplay-modal');
            modal.innerHTML = `
                <div class="neat-worldplay-modal-content">
                    <h2 class="neat-worldplay-modal-text">${header}</h2>
                    <p>${message}</p>
                    <div>
                        <button class="neat-worldplay-modal-button" id="${btnId}">${btnText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            function closeModal() {
                document.body.removeChild(modal);
            }
            document.getElementById(btnId).addEventListener("click", function() {
                closeModal();
            });
    }
    displayModal(self, deviceType) {
            var currentURL = window.location.href;
            var encodedURL = encodeURIComponent(currentURL);
            const modal = document.createElement('div');
            modal.classList.add('neat-worldplay-modal');
            modal.innerHTML = `
                <div class="neat-worldplay-modal-content">
                    <h2 class="neat-worldplay-modal-text">Select a Payment Type</h2>
                    <div>
                        <button class="neat-worldplay-modal-button" id="btnCard">Card</button>
                    </div>
                    <div>
                        <button class="neat-worldplay-modal-button" id="btnPayPal">PayPal</button>
                    </div>
                    <div>
                        <button class="neat-worldplay-modal-button" id="btnVenmo">Venmo</button>
                    </div>
                    <div>
                        <button class="neat-worldplay-modal-button" id="btnCancel">Cancel</button>
                    </div>
                </div>
            `;

            // Add the modal to the document body
            document.body.appendChild(modal);

            // Function to close the modal
            function closeModal() {
                document.body.removeChild(modal);
            }

            // Event listeners for button clicks
            document.getElementById("btnCard").addEventListener("click", function() {
                if(deviceType === "android") {
                    if(window.isNeatPOSAndroidApp) {
                        AndroidInterface.onPayment("btnCard")
                    }
                    else {
                        window.open("app://neat-worldpay-payment-android?paymentType=0&redirectUrl=" + encodedURL);
                    }
                }
                else {
                    window.webkit.messageHandlers.btnCard.postMessage(null);
                }
                closeModal();
            });

            document.getElementById("btnPayPal").addEventListener("click", function() {
                if(deviceType === "android") {
                    if(window.isNeatPOSAndroidApp) {
                        AndroidInterface.onPayment("btnPayPal")
                    }
                    else {
                        window.open("app://neat-worldpay-payment-android?paymentType=2&redirectUrl=" + encodedURL);
                    }
                }
                else {
                    window.webkit.messageHandlers.btnPayPal.postMessage(null);
                }
                closeModal();
            });

            document.getElementById("btnVenmo").addEventListener("click", function() {
                if(deviceType === "android") {
                    if(window.isNeatPOSAndroidApp) {
                        AndroidInterface.onPayment("btnVenmo")
                    }
                    else {
                        window.open("app://neat-worldpay-payment-android?paymentType=1&redirectUrl=" + encodedURL);
                    }
                }
                else {
                    window.webkit.messageHandlers.btnVenmo.postMessage(null);
                }
                closeModal();
            });

            document.getElementById("btnCancel").addEventListener("click", function() {
                closeModal();
            });
    }
    /**
     * @override
    */
    setup() {
        super.setup(...arguments);
        this.addCss()
    }
    /**
     * @override
    */
    async send_payment_request (cid) {
        try {
            super.send_payment_request(...arguments);
            const line = this.pos.get_order().selected_paymentline;
            const order = this.pos.get_order();
            const data = this._terminal_pay_data();
            const terminalId = data.PaymentMethod.neat_worldplay_terminal_device_code
            const refunded_order_line_ids = []

            for(let i = 0; i < order.orderlines.length; i++) {
                var orderline = order.orderlines[i]
                if(orderline.refunded_orderline_id) {
                    refunded_order_line_ids.push(orderline.refunded_orderline_id)
                }
            }

            if(refunded_order_line_ids.length > 1) {
                try {
                    const iosr = await this.env.services.rpc('/neat_worldplay/is_order_the_same', {
                            refunded_order_line_ids
                    })

                    if(!iosr || !iosr.data || !iosr.data.is_order_the_same) {
                        line.set_payment_status('retry');
                        throw new Error('Cannot have multiple refunds in an order.');
                        return
                    }
                }
                catch(e) {
                    line.set_payment_status('retry');
                    throw new Error('Cannot have multiple refunds in an order.');
                    return
                }
            }

            var refunded_order_line_id = undefined
            if(refunded_order_line_ids.length) {
                refunded_order_line_id = refunded_order_line_ids[0]
            }

            const params = {
                terminal_id: terminalId,
                order_id: data.OrderID,
                amount: data.RequestedAmount,
                user_id: order.cashier.id,
                refunded_order_line_id,
            }
            const result = await this.env.services.rpc('/neat_worldplay/create_payment_request', params)
            if(!result || result.status === 403 || result.status === 400) {
                line.set_payment_status('retry');
                return false
            }
            line.set_payment_status('waitingCard');
            while(true) {
                try {
                    const res = await this.env.services.rpc('/neat_worldplay/check_request', {
                        terminal_id: terminalId,
                        transaction_id: result.data.transaction_id,
                    })

                    if(res && res.status === 200) {
                        if(res.data.status === 'done' || res.data.status === 'refunded' || res.data.status === 'resent_done' || res.data.status === 'resent_refunded') {
                            const processed_result = await this.env.services.rpc('/neat_worldplay/request_processed', {
                                terminal_id: terminalId,
                                transaction_id: res.data.transaction_id,
                            })
                            if(processed_result && processed_result.status == 200) {
                                line.transaction_id = res.data.transaction_id;
                                line.card_type = res.data.card_type;
                                line.cardholder_name = res.data.cardholder_name
                                if(res.data.is_refund && line.amount !== res.data.refunded_amount) {
                                    if(res.data.refunded_amount < 0) {
                                        line.amount = res.data.refunded_amount
                                    }
                                    else {
                                        line.amount = -1 * res.data.refunded_amount
                                    }
                                }
                                else {
                                    line.amount = res.data.transaction_amount
                                }
                                line.set_payment_status('done');
                                return true
                            }
                        }
                        else if(res.data.status !== 'pending') {
                            line.set_payment_status('retry');
                            return false
                        }
                    }
                    else {
                        line.set_payment_status('retry');
                        return false
                    }
                }
                catch(e) {

                }
                await this.sleep(2000)
            }
            return true
        }
        catch(e) {
            line.set_payment_status('retry');
            return false
        }
    }
    /**
     * @override
    */
    async send_payment_cancel() {
        try {
            super.send_payment_cancel(...arguments);
            console.log('cancel')
            const line = this.pos.get_order().selected_paymentline;
            const data = this._terminal_pay_data();
            const terminalId = data.PaymentMethod.neat_worldplay_terminal_device_code
            const res = await this.env.services.rpc('/neat_worldplay/cancel_payment_request', {
                terminal_id: terminalId,
                order_id: data.OrderID,
            })
        }
        catch(e) {
            //this.displayMessage(this, "Error", "Connection with server lost. Please wait while the server reconnects and try again.", "Ok", "btnOkCancel");
        }
        return true;
    }
    _terminal_pay_data() {
          const order = this.pos.get_order();
          const line = order.selected_paymentline;
          const data = {
                'Name': order.name,
                'OrderID': order.uid,
                'Currency': this.pos.currency.name,
                'RequestedAmount': line.amount,
                'PaymentMethod': this.payment_method
          };
         return data;
    }
}


