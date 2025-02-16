# -*- coding: utf-8 -*-
import logging
import uuid
from odoo import api, fields, models, _
from pos_neatworldpay.controllers.payment_processor import get_payment_request, complete
from datetime import datetime
_logger = logging.getLogger(__name__)

class NeatWorldplayPaymentRequest(models.Model):
    _name = 'neat.worldplay.payment.request'
    _description = 'Neat Worldpay Payment Request'

    terminal_id = fields.Text('Terminal Id', required=True, readonly=False, store=True)
    order_id = fields.Text('Order Id', required=True, readonly=False, store=True)
    user_id = fields.Integer('User Id', required=True, readonly=False, store=True)
    refunded_order_line_id = fields.Integer('Refunded Order Line Id', required=False, readonly=False, store=True)
    start_date = fields.Datetime('Start Date', required=True, readonly=False, store=True)
    amount = fields.Integer('Amount', required=True, readonly=False, store=True, digits=(19, 0))
    refunded_amt = fields.Integer('Refunded', required=True, readonly=False, store=True, digits=(19, 0))
    uncommited_refunded_amt = fields.Integer('Uncommited Refunded', required=True, readonly=False, store=True, digits=(19, 0))
    status = fields.Text('Status', required=True, readonly=False, store=True)
    transaction_id = fields.Text('Transaction Id', required=True, readonly=False, store=True)
    card_type = fields.Text('Card Type', required=False, readonly=False, store=True)
    cardholder_name = fields.Text('Cardholder Name', required=False, readonly=False, store=True)

    @api.depends('status')
    def _check_pending_requests(self):
        """ This method is triggered when 'status' changes. """
        for record in self:
            if record.status == "pending":
                res = get_payment_request(record)


