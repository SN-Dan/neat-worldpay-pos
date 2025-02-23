# coding: utf-8
import logging
import json
from odoo import http
from .payment_processor import is_order_the_same, create_payment_request, cancel_payment_request, check_request, request_processed

_logger = logging.getLogger(__name__)

class PosNeatWorldpayController(http.Controller):
    @http.route('/neat_worldplay/is_order_the_same', type='json', auth='user', methods=['POST'])
    def is_order_the_same(self, refunded_order_line_ids):
        return is_order_the_same(refunded_order_line_ids)

    @http.route('/neat_worldplay/create_payment_request', type='json', auth='user', methods=['POST'])
    def create_payment_request(self, terminal_id, order_id, amount, user_id, refunded_order_line_id=None):
        return create_payment_request(terminal_id, order_id, amount, user_id, refunded_order_line_id)

    @http.route('/neat_worldplay/cancel_payment_request', type='json', auth='user', methods=['POST'])
    def cancel_payment_request(self, terminal_id, order_id):
        return cancel_payment_request(terminal_id, order_id)

    @http.route('/neat_worldplay/check_request', type='json', auth='user', methods=['POST'])
    def check_request(self, terminal_id, transaction_id):
        return check_request(terminal_id, transaction_id)

    @http.route('/neat_worldplay/request_processed', type='json', auth='user', methods=['POST'])
    def request_processed(self, terminal_id, transaction_id):
        return request_processed(terminal_id, transaction_id)

    @http.route('/neat_worldplay/validate_connection', type='http', auth='public', methods=['POST'], csrf=False, cors='*')
    def validate_connection(self):
        return json.dumps({ 'status': 200 })







