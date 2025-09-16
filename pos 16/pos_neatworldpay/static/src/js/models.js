odoo.define('pos_neatworldpay.models', function(require) {
    'use strict';
    
    var models = require('point_of_sale.models');
    var PaymentTerminal = require('pos_neatworldpay.payment');
    var patch = require('web.utils').patch;
    
    models.register_payment_method('neatworldpay', PaymentTerminal);
    if(models.load_fields) {
        models.load_fields('pos.payment.method', ['neat_worldpay_terminal_device_code', 'neat_worldpay_is_mobile', 'neat_worldpay_is_desktop_mode', 'neat_worldpay_is_local_ws_server', 'neat_worldpay_ws_url', 'neat_worldpay_is_terminal_printer_communication_allowed', 'neat_worldpay_device_type']);
    }
    
    // Patch PosGlobalState with retry logic for _save_to_server
    patch(models.PosGlobalState.prototype, 'pos_neatworldpay.models', {
        _save_to_server: function(orders, options) {
            debugger
            var self = this;
            var maxRetries = 3;
            var retryDelay = 2000; // 2 seconds
            
            // Store reference to the original method
            var originalSaveToServer = this._super;
            
            console.log('pos_neatworldpay: _save_to_server called');
            console.log('pos_neatworldpay: Order data:', orders);
            
            function attemptSave(attemptNumber) {
                console.log('pos_neatworldpay: Attempt ' + (attemptNumber + 1) + ' of ' + (maxRetries + 1));
                
                // Call original method with correct context
                return originalSaveToServer.call(self, orders, options)
                    .then(function(result) {
                        console.log('pos_neatworldpay: _save_to_server success on attempt ' + (attemptNumber + 1));
                        console.log('pos_neatworldpay: Result:', result);
                        return result;
                    })
                    .catch(function(error) {
                        console.error('pos_neatworldpay: Attempt ' + (attemptNumber + 1) + ' failed:', error);
                        
                        if (error && attemptNumber < maxRetries) {
                            console.warn('pos_neatworldpay: Network error detected, retrying in ' + retryDelay + 'ms...');
                            return new Promise(function(resolve) {
                                setTimeout(function() {
                                    resolve(attemptSave(attemptNumber + 1));
                                }, retryDelay);
                            });
                        } else {
                            console.error('pos_neatworldpay: Max retries reached or non-network error:', error);
                            throw error;
                        }
                    });
            }
            
            return attemptSave(0);
        }
    });
});

