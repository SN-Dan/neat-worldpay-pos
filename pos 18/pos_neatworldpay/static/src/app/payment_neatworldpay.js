/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { PaymentInterface } from "@point_of_sale/app/payment/payment_interface";

export class PaymentNeatWorldpay extends PaymentInterface {
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // displayMessage(self, header, message, btnText = "Ok", btnId = "btnOk") {
    //         const modal = document.createElement('div');
    //         modal.classList.add('neat-worldpay-modal');
    //         modal.innerHTML = `
    //             <div class="neat-worldpay-modal-content">
    //                 <h2 class="neat-worldpay-modal-text">${header}</h2>
    //                 <p>${message}</p>
    //                 <div>
    //                     <button class="neat-worldpay-modal-button" id="${btnId}">${btnText}</button>
    //                 </div>
    //             </div>
    //         `;

    //         document.body.appendChild(modal);
    //         function closeModal() {
    //             document.body.removeChild(modal);
    //         }
    //         document.getElementById(btnId).addEventListener("click", function() {
    //             closeModal();
    //         });
    // }
    /**
     * @override
    */
    setup() {
        super.setup(...arguments);
    }
    /**
     * @override
    */
    async send_payment_request (cid) {
        try {
            super.send_payment_request(...arguments);
            const line = this._get_payment_line();
            const order = this.pos.get_order();
            const data = this._terminal_pay_data();
            const terminalId = data.PaymentMethod.neat_worldpay_terminal_device_code
            const refunded_order_line_ids = []

            for(let i = 0; i < order.lines.length; i++) {
                var orderline = order.lines[i]
                if(orderline.refunded_orderline_id) {
                    refunded_order_line_ids.push(orderline.refunded_orderline_id.id)
                }
            }

            if(refunded_order_line_ids.length > 1) {
                try {
                    const iosr = await this.env.services.orm.rpc('/pos_worldpay/is_order_the_same', {
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
                user_id: order.user_id.id,
                refunded_order_line_id,
            }
            const result = await this.env.services.orm.rpc('/pos_worldpay/create_payment_request', params)
            if(!result || result.status === 403 || result.status === 400) {
                line.set_payment_status('retry');
                return false
            }
            const device = window.navigator.userAgent
            const isMobile = device.includes("Android") || window.isNeatPOSiOSApp
            if(result && result.status === 201 && data.PaymentMethod.neat_worldpay_is_mobile && isMobile) {
                if(window.isNeatPOSAndroidApp) {
                    AndroidInterface.onPayment("btnPayPal")
                }
                else {
                    var currentURL = window.location.href;
                    var encodedURL = encodeURIComponent(currentURL);
                    window.open("app://neat-worldpay-payment-android?paymentType=0&redirectUrl=" + encodedURL);
                }
            }
            line.set_payment_status('waitingCard');
            while(true) {
                try {
                    const res = await this.env.services.orm.rpc('/pos_worldpay/check_request', {
                        terminal_id: terminalId,
                        transaction_id: result.data.transaction_id,
                    })

                    if(res && res.status === 200) {
                        if(res.data.status === 'done' || res.data.status === 'refunded' || res.data.status === 'resent_done' || res.data.status === 'resent_refunded') {
                            const processed_result = await this.env.services.orm.rpc('/pos_worldpay/request_processed', {
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
            const line = this._get_payment_line();
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
            const line = this._get_payment_line();
            const data = this._terminal_pay_data();
            const terminalId = data.PaymentMethod.neat_worldpay_terminal_device_code
            const res = await this.env.services.orm.rpc('/pos_worldpay/cancel_payment_request', {
                terminal_id: terminalId,
                order_id: data.OrderID,
            })
        }
        catch(e) {
            //this.displayMessage(this, "Error", "Connection with server lost. Please wait while the server reconnects and try again.", "Ok", "btnOkCancel");
        }
        return true;
    }
    _get_payment_line() {
        var line = this.pos.get_order().selected_paymentline
        if(!line) {
            line = this.pos.get_order().get_selected_paymentline();
        }
        return line
    }
    _terminal_pay_data() {
          const order = this.pos.get_order();
          const line = this._get_payment_line();
          var orderId = order.uid
          if(!orderId) {
            orderId = order.pos_reference
          }
          var pm = this.payment_method
          if(!pm) {
            pm = this.payment_method_id
          }
          const data = {
                'Name': order.name,
                'OrderID': orderId,
                'Currency': this.pos.currency.name,
                'RequestedAmount': line.amount,
                'PaymentMethod': pm
          };
         return data;
    }
}


