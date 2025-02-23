import logging
from odoo import fields, models, api, _
from cryptography.fernet import Fernet

_logger = logging.getLogger(__name__)

class PosPaymentMethod(models.Model):
    _name = 'neat.worldplay.security'
    _description = 'Neat Worldplay Security'

    neat_worldplay_secret_key = fields.Char('Secret Key')

    def create(self, values):
        fernet_key = Fernet.generate_key()
        fernet_key_string = fernet_key.decode()
        values['neat_worldplay_secret_key'] = fernet_key_string
        return super(PosPaymentMethod, self).create(values)


    def write(self, values):
        if 'neat_worldplay_secret_key' in values:
            del values['neat_worldplay_secret_key']
        return super(PosPaymentMethod, self).write(values)

