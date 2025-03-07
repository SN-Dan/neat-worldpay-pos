odoo.define('pos_neatworldpay.models', function(require) {
    var models = require('point_of_sale.models');
    var PaymentTerminal = require('pos_neatworldpay.payment');
    models.register_payment_method('neatworldpay', PaymentTerminal);
    if(models.load_fields) {
        models.load_fields('pos.payment.method', ['neat_worldpay_terminal_device_code', 'neat_worldpay_is_mobile', 'neat_worldpay_device_type']);
    }
});

