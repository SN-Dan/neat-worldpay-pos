import logging
from odoo import fields, models, api, _

_logger = logging.getLogger(__name__)

class NeatWorldpaySettings(models.Model):
    _name = 'neat.worldpay.settings'
    _description = 'NEAT Worldpay User Settings'

    promotion_displayed = fields.Boolean('Promotion Displayed')

