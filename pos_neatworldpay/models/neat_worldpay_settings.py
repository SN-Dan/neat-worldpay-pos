# Original Author: Daniel Stoynev
# Copyright (c) 2025 SNS Software Ltd. All rights reserved.
import logging
from odoo import fields, models, api, _

_logger = logging.getLogger(__name__)

class NeatWorldpaySettings(models.Model):
    _name = 'neat.worldpay.settings'
    _description = 'NEAT Worldpay User Settings'

    promotion_displayed = fields.Boolean('Promotion Displayed')
    license_key = fields.Text('License Key', required=False, readonly=False, store=True)
