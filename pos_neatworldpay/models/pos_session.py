from odoo import models


class PosSession(models.Model):
    _inherit = 'pos.session'

    def _loader_params_pos_payment_method(self):
        result = super()._loader_params_pos_payment_method()
        result['search_params']['fields'].append('neat_worldpay_terminal_device_code')
        result['search_params']['fields'].append('neat_worldpay_is_mobile')
        result['search_params']['fields'].append('neat_worldpay_device_type')
        return result