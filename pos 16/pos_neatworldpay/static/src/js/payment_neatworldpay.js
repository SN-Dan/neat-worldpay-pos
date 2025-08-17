odoo.define('pos_neatworldpay.payment', function(require) {
"use strict";
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    function addCss() {
        const customModalStyles = `
            .neat-worldpay-modal-text {
                width: 380px;
                text-align: center;
            }
            .neat-worldpay-modal {
                display: inline-block;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
            }

            .neat-worldpay-modal-content {
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
            .neat-worldpay-modal-button {
                width: calc(100% - 20px);
                height: 55px;
                margin: 5px;
                cursor: pointer;
                font-size: 25px;
                border: none;
                background: darkseagreen;
                color: white;
            }
            .neat-worldpay-modal-input {
                width: calc(100% - 20px);
                height: 45px;
                margin: 5px;
                padding: 10px;
                font-size: 20px;
                border: 1px solid #ccc;
                border-radius: 4px;
                box-sizing: border-box;
            }
        `;

        // Create a <style> element and append it to the document's <head>
        const styleElement = document.createElement('style');
        styleElement.innerHTML = customModalStyles;
        document.head.appendChild(styleElement);
    }
    function displaySyncModal() {
        if (document.querySelector('.neat-worldpay-modal')) {
            return; // Modal already exists, do nothing
        }
        const modal = document.createElement('div');
        modal.classList.add('neat-worldpay-modal');
        modal.innerHTML = `
            <div class="neat-worldpay-modal-content">
                <h2 class="neat-worldpay-modal-text">Enter the terminal device code to sync.</h2>
                <div>
                    <input type="text" id="deviceCodeInput" placeholder="Device Code"
                        class="neat-worldpay-modal-input" />
                    <button class="neat-worldpay-modal-button" id="btnSync">Sync</button>
                </div>
            </div>
        `;

        // Add the modal to the document body
        document.body.appendChild(modal);

        // Function to close the modal
        function closeModal() {
            document.body.removeChild(modal);
        }
        var btn = document.getElementById("btnSync")
        // Event listeners for button clicks
        btn.addEventListener("click", function(e) {
            const deviceCode = document.getElementById('deviceCodeInput').value;
            localStorage.setItem('neatworldpay_synced_device_code', deviceCode)
            closeModal();
            socket_connect(true)
        });
    }
    function type_on_keyboard(inputString) {
        const barcodeInput = document.querySelector('body .o-barcode-input');
        console.log(barcodeInput);

        for (let i = 0; i < inputString.length; i++) {
            const char = inputString.charAt(i);
            const event = new KeyboardEvent('keydown', {
                key: char,
                bubbles: true,
                cancelable: true
            });
            console.log(char);
            document.body.dispatchEvent(event);
        }
    }

    window.is_printing_allowed_desktop_ws_map = {}
    function socket_connect(initialConnect = false) {
        if(!window.desktop_ws || !initialConnect) {
            window.desktop_ws = new WebSocket(window.desktop_ws_url)
            window.desktop_ws.onopen = () => {
                const syncedDeviceCode = localStorage.getItem("neatworldpay_synced_device_code")
                window.desktop_ws.send(JSON.stringify({ type: "register", deviceId: syncedDeviceCode + "-pc" }));
                console.log("Connected and registered.");
            }
            window.desktop_ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if(msg.msgType === 'barcode') {
                    type_on_keyboard(msg.msgPayload)
                }
                window.desktop_ws.send(JSON.stringify({ type: "ack", msgId: msg.msgId }));
            }
            window.desktop_ws.onerror = () => {
                window.desktop_ws.close()
                console.log("Disconnected, retrying...");
            }
            window.desktop_ws.onclose = () => {
                console.log("Disconnected, retrying...");
                setTimeout(socket_connect, 1000);
            }
        }
    }

    addCss()
    const core = require('web.core');
    const rpc = require('web.rpc');
    const PaymentInterface = require('point_of_sale.PaymentInterface');
    const { Gui } = require('point_of_sale.Gui');
    const _t = core._t;
    const PaymentTerminal = PaymentInterface.extend({
        init: function () {
            this._super.apply(this, arguments);
            const device = window.navigator.userAgent
            const isMobile = device.includes("Android") || window.isNeatPOSAndroidApp
            
            if(this.payment_method.neat_worldpay_is_desktop_mode && this.payment_method.neat_worldpay_is_local_ws_server && !isMobile){
                window.is_printing_allowed_desktop_ws_map[this.payment_method.neat_worldpay_terminal_device_code] = this.payment_method.neat_worldpay_is_terminal_printer_communication_allowed
                if(this.payment_method.neat_worldpay_ws_url) {
                    window.desktop_ws_url = this.payment_method.neat_worldpay_ws_url
                    if(localStorage.getItem("neatworldpay_synced_device_code")) {
                        socket_connect(true)
                    }
                    else {
                        displaySyncModal()
                    }
                }
            }
        },
        send_payment_request: async function(cid) {
            try {
                await this._super.apply(this, arguments);
                const line = this.pos.get_order().selected_paymentline;
                const order = this.pos.get_order();
                const data = this._terminal_pay_data();
                const terminalId = data.PaymentMethod.neat_worldpay_terminal_device_code
                const refunded_order_line_ids = []

                for(let i = 0; i < order.orderlines.length; i++) {
                    var orderline = null
                    if(Array.isArray(order.orderlines)) {
                        orderline = order.orderlines[i]
                    }
                    else {
                        orderline = order.orderlines.models[i]
                    }

                    if(orderline.refunded_orderline_id) {
                        refunded_order_line_ids.push(orderline.refunded_orderline_id)
                    }
                }

                if(refunded_order_line_ids.length > 1) {
                    const iosr = await rpc.query({
                        route: '/pos_worldpay/is_order_the_same',
                        params: {
                            refunded_order_line_ids
                        }
                    })

                    if(!iosr || !iosr.data || !iosr.data.is_order_the_same) {
                        line.set_payment_status('retry');
                        throw new Error('Cannot have multiple refunds in an order.');
                        return
                    }
                }

                var refunded_order_line_id = undefined
                if(refunded_order_line_ids.length) {
                    refunded_order_line_id = refunded_order_line_ids[0]
                }

                var user_id = null
                if(order.cashier) {
                    user_id = order.cashier.id
                }
                else {
                    user_id = order.employee.user_id[0]
                }

                const params = {
                    terminal_id: terminalId,
                    order_id: data.OrderID,
                    amount: data.RequestedAmount,
                    user_id: user_id,
                    refunded_order_line_id,
                }

                const result = await rpc.query({
                    route: '/pos_worldpay/create_payment_request',
                    params
                })
                if(!result || result.status === 403 || result.status === 400) {
                    line.set_payment_status('retry');
                    return false
                }
                const device = window.navigator.userAgent
                const isMobile = device.includes("Android") || window.isNeatPOSAndroidApp
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
                else if(result && result.status === 201 && data.PaymentMethod.neat_worldpay_is_desktop_mode && data.PaymentMethod.neat_worldpay_is_local_ws_server && data.PaymentMethod.neat_worldpay_ws_url && !isMobile && data.PaymentMethod.neat_worldpay_terminal_device_code === localStorage.getItem("neatworldpay_synced_device_code")) {
                    window.desktop_ws.send(JSON.stringify({ type: "message", msgType: "payment" }));
                }
                line.set_payment_status('waitingCard');
                while(true) {
                    try {
                        const res = await rpc.query({
                            route: '/pos_worldpay/check_request',
                            params: {
                                terminal_id: terminalId,
                                transaction_id: result.data.transaction_id,
                            }
                        })

                        if(res && res.status === 200) {
                            if(res.data.status === 'done' || res.data.status === 'refunded' || res.data.status === 'resent_done' || res.data.status === 'resent_refunded') {
                                const processed_result = await rpc.query({
                                    route: '/pos_worldpay/request_processed',
                                    params: {
                                        terminal_id: terminalId,
                                        transaction_id: res.data.transaction_id,
                                    }
                                })
                                if(processed_result && processed_result.status == 200) {
                                    try {
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
                                    catch(e) {
                                        console.log(e)
                                        await rpc.query({
                                            route: '/pos_worldpay/log_message_ui',
                                            params: {
                                                terminal_id: terminalId,
                                                transaction_id: res.data.transaction_id,
                                                type: 'error',
                                                message: 'Error setting payment status: ' + e.message
                                            }
                                        })
                                        return false;
                                    }
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
                        await sleep(8000)
                    }
                    await sleep(2000)
                }
                return true
            }
            catch(e) {
                line.set_payment_status('retry');
                return false
            }
         },
        send_payment_cancel: async function () {
            try {
                await this._super.apply(this, arguments);
                console.log('cancel')
                const line = this.pos.get_order().selected_paymentline;
                const data = this._terminal_pay_data();
                const terminalId = data.PaymentMethod.neat_worldpay_terminal_device_code
                const res = await rpc.query({
                    route: '/pos_worldpay/cancel_payment_request',
                    params: {
                        terminal_id: terminalId,
                        order_id: data.OrderID,
                    }
                })
            }
            catch(e) {

            }
            return true;
        },
       _terminal_pay_data: function() {
              const order = this.pos.get_order();
              const line = order.selected_paymentline;
              const data = {
                    'Name': order.name,
                    'OrderID': order.uid,
                    'TimeStamp': moment().format(),
                    'Currency': this.pos.currency.name,
                    'RequestedAmount': line.amount,
                    'PaymentMethod': this.payment_method
              };
             return data;
       }
     });
    return PaymentTerminal;
});
