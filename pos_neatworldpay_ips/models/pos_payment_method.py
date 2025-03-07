# coding: utf-8
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json
import logging
import pprint
import random
import requests
import string
from werkzeug.exceptions import Forbidden
from datetime import datetime
from werkzeug.security import generate_password_hash
from odoo import fields, models, api, _
from odoo.exceptions import ValidationError
import secrets
import re

_logger = logging.getLogger(__name__)

class PosPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'

    def _get_payment_terminal_selection(self):
        return super(PosPaymentMethod, self)._get_payment_terminal_selection() + [('neatworldplay', 'Neat Worldplay Terminal')]

    neat_worldpay_pos_license_key = fields.Char('POS License Key', help='Generated from other values and refreshed after some time.')
    neat_worldpay_pos_id = fields.Char('POS ID', help='This is for Worldpay to reference and track POS registrations for internal consolidation and reconciliation.')
    neat_worldpay_pos_reference = fields.Char('POS Reference',
                                       help='The POS reference entered during the POS activation in the IPS Control Center')
    neat_worldpay_pos_activation_code = fields.Char('POS Activation Code',
                                       help='Activation code generated during the POS activation. Acts as a one time password')
    neat_worldplay_terminal_device_code = fields.Char('Publisher ID', help='This is a uniquely generated identifier upon creation for each terminal used to login. The same Publisher ID should never be used for more than 1 terminal')

    @api.model
    def create(self, values):
        if values['use_payment_terminal'] == 'neatworldplay':
            values['neat_worldpay_terminal_device_code'] = self.generate_unique_datetime_id()
        return super(PosPaymentMethod, self).create(values)

    def write(self, values):
        if 'neat_worldpay_terminal_device_code' in values:
            del values['neat_worldpay_terminal_device_code']

        return super(PosPaymentMethod, self).write(values)
    def generate_unique_datetime_id(self):
        while True:
            # Generate a datetime string with milliseconds and the full year
            current_datetime = datetime.utcnow().strftime('%Y%m%d%H%M%S%f')[:-3]

            # Replace numbers with corresponding letters for uneven indexes
            transformed_id = ''.join(
                [chr(ord('a') + int(char)) if index % 2 != 0 else char for index, char in enumerate(current_datetime)])

            # Insert dashes every 3 characters
            formatted_id = '-'.join([transformed_id[i:i+3] for i in range(0, len(transformed_id), 3)])

            # Check if the generated ID already exists in the database
            existing_record = self.search([('neat_worldpay_terminal_device_code', '=', formatted_id)])

            # If no matching record found, return the unique ID
            if not existing_record:
                return formatted_id


