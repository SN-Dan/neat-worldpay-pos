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
    ## POS license key, pos id, pos reference, pos activation code(one time password), publisher id(one per pos)
    neat_worldplay_terminal_device_code = fields.Char('Terminal ID', help='This is a uniquely generated identifier upon creation for each terminal used to login. The same Terminal ID should never be used for more than 1 terminal')
    neat_worldplay_terminal_master_pwd = fields.Char('Terminal Master Password', help='', groups="base.group_erp_manager")
    neat_worldplay_terminal_master_pwd_mock = fields.Char('Terminal Master Password', help='Password used to login in the terminal', default='', groups="base.group_erp_manager")
    neat_worldplay_terminal_pass_uuid = fields.Char('Terminal Pass UUID')

    @api.model
    def create(self, values):
        if values['use_payment_terminal'] == 'neatworldplay':
            if values['neat_worldplay_terminal_master_pwd_mock'] is False or values['neat_worldplay_terminal_master_pwd_mock'] == '' or len(
                values['neat_worldplay_terminal_master_pwd_mock']) < 6:
                raise ValidationError("Master Password must have at least 6 characters.")
            values['neat_worldplay_terminal_pass_uuid'] = self.generate_password_uuid()
            hashed_password = generate_password_hash(values['neat_worldplay_terminal_master_pwd_mock'])
            values['neat_worldplay_terminal_master_pwd'] = hashed_password
            del values['neat_worldplay_terminal_master_pwd_mock']
        return super(PosPaymentMethod, self).create(values)

    def write(self, values):
        if 'neat_worldplay_terminal_master_pwd_mock' in values:
            if values['neat_worldplay_terminal_master_pwd_mock'] is False or values[
                'neat_worldplay_terminal_master_pwd_mock'] == '' or len(
                    values['neat_worldplay_terminal_master_pwd_mock']) < 6:
                raise ValidationError("Master Password must have at least 6 characters.")
            values['neat_worldplay_terminal_pass_uuid'] = self.generate_password_uuid()
            hashed_password = generate_password_hash(values['neat_worldplay_terminal_master_pwd_mock'])
            values['neat_worldplay_terminal_master_pwd'] = hashed_password
            del values['neat_worldplay_terminal_master_pwd_mock']

        return super(PosPaymentMethod, self).write(values)

    def generate_password_uuid(self):
        return datetime.utcnow().strftime('%Y%m%d%H%M%S') + str(random.randint(1000, 9999))


