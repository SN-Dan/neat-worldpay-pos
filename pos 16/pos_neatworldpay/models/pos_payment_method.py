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
        return super(PosPaymentMethod, self)._get_payment_terminal_selection() + [('neatworldpay', 'NEAT Worldpay Terminal')]

    neat_worldpay_terminal_device_code = fields.Char('Terminal ID', help='This is a uniquely generated identifier upon creation for each terminal used to login. The same Terminal ID should never be used for more than 1 terminal')
    neat_worldpay_terminal_master_pwd = fields.Char('Terminal Master Password', help='', groups="base.group_erp_manager")
    neat_worldpay_terminal_master_pwd_mock = fields.Char('Terminal Master Password', help='Password used to login in the terminal', default='', groups="base.group_erp_manager")
    neat_worldpay_is_mobile = fields.Boolean(string='Use Mobile Redirect', help="Indicates if you will use Odoo on the mobile device that has the Neat POS Suite app so it can improve the user experience by redirecting to the app when needed.")
    neat_worldpay_is_desktop_mode = fields.Boolean(string='Use Desktop Mode', help="Indicates if you will use Odoo on a desktop device with the desktop mode local server so it can improve the user experience by triggering a payment on the terminal, enabling barcode scanning and receipt printing using the terminal.")
    neat_worldpay_ws_url = fields.Char('WS URL', help='The Websocket server url on your local network for Desktop Mode')
    neat_worldpay_ws_certificate = fields.Char('WS SSL Certificate', help='The certificate text that will be used on Neat POS Suite app.')
    neat_worldpay_terminal_pass_uuid = fields.Char('Terminal Pass UUID')

    neat_worldpay_device_type = fields.Selection(
        [('android', 'Android')],
        string='Device Type',
        help='Indicates what operating system the terminal will use. Example: If the Neat POS Suite App is installed on an Android then Android should be selected here.'
    )

    @api.model
    def _get_user_groups(self):
        ir_model_data = self.env['ir.model.data']
        groups = ir_model_data.search([('model', '=', 'res.groups')])
        return [(group.complete_name, group.name) for group in groups]

    neat_worldpay_terminal_manager_group_selection = fields.Selection(
        selection=_get_user_groups,
        string='Manager Group',
        help='Select a manager group that will be able to override payments that need resending.',
    )

    @api.model
    def create(self, values):
        if values['use_payment_terminal'] == 'neatworldpay':
            if values['neat_worldpay_terminal_master_pwd_mock'] is False or values['neat_worldpay_terminal_master_pwd_mock'] == '' or len(
                values['neat_worldpay_terminal_master_pwd_mock']) < 6:
                raise ValidationError("Master Password must have at least 6 characters.")
            values['neat_worldpay_terminal_pass_uuid'] = self.generate_password_uuid()
            hashed_password = generate_password_hash(values['neat_worldpay_terminal_master_pwd_mock'])
            values['neat_worldpay_terminal_master_pwd'] = hashed_password
            del values['neat_worldpay_terminal_master_pwd_mock']
        record = super(PosPaymentMethod, self).create(values)
        record.write({ "neat_worldpay_terminal_device_code": f"{record.id:04d}"})
        return record

    def write(self, values):
        if 'neat_worldpay_terminal_device_code' in values:
            del values['neat_worldpay_terminal_device_code']
        if 'neat_worldpay_terminal_master_pwd_mock' in values:
            if values['neat_worldpay_terminal_master_pwd_mock'] is False or values[
                'neat_worldpay_terminal_master_pwd_mock'] == '' or len(
                    values['neat_worldpay_terminal_master_pwd_mock']) < 6:
                raise ValidationError("Master Password must have at least 6 characters.")
            values['neat_worldpay_terminal_pass_uuid'] = self.generate_password_uuid()
            hashed_password = generate_password_hash(values['neat_worldpay_terminal_master_pwd_mock'])
            values['neat_worldpay_terminal_master_pwd'] = hashed_password
            del values['neat_worldpay_terminal_master_pwd_mock']

        return super(PosPaymentMethod, self).write(values)

    def generate_password_uuid(self):
        return datetime.utcnow().strftime('%Y%m%d%H%M%S') + str(random.randint(1000, 9999))

