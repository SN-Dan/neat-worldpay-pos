# Original Author: Daniel Stoynev
# Copyright (c) 2025 SNS Software Ltd. All rights reserved.
# This module extends Odoo's payment framework.
# Odoo is a trademark of Odoo S.A.
import logging
from odoo import fields, models, api, _

_logger = logging.getLogger(__name__)

class NeatWorldpaySettings(models.Model):
    _name = 'neat.worldpay.settings'
    _description = 'NEAT Worldpay User Settings'

    @api.model
    def create(self, vals):
        # Handle both single dict and list of dicts for Odoo 19 compatibility
        if isinstance(vals, dict):
            vals = [vals]
        return super().create(vals)

    promotion_displayed = fields.Boolean('Promotion Displayed')
    license_key = fields.Text('License Key', required=False, readonly=False, store=True)
