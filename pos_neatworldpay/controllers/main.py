# coding: utf-8
import logging
import json
from odoo import http
from odoo.http import request
from datetime import datetime, timedelta
from werkzeug.security import check_password_hash
from .config import timeout_delta
from .payment_processor import is_order_the_same, create_payment_request, cancel_payment_request, check_request, request_processed, get_payment_history
from cryptography.fernet import Fernet

_logger = logging.getLogger(__name__)


class PosNeatWorldpayController(http.Controller):

    def decrypt(self, token, fernet_key):
        fernet = Fernet(fernet_key)
        return fernet.decrypt(token.encode()).decode()

    def encrypt(self, message, fernet_key):
        fernet = Fernet(fernet_key)
        return fernet.encrypt(message.encode()).decode()
    def get_secret_key(self):
        sc_rows = request.env['neat.worldplay.security'].sudo().search([]).read(['neat_worldpay_secret_key'])
        if len(sc_rows) == 0:
            pr = request.env['neat.worldplay.security'].sudo().create({'neat_worldplay_secret_key': 'str'})
            secret_key = pr.neat_worldplay_secret_key
        else:
            secret_key = sc_rows[0]['neat_worldplay_secret_key']
        return secret_key

    def generate_tokens(self, device_code, amount, transaction_id, start_date, is_refund, is_from_initial_request):
        pos_payment_methods = http.request.env['pos.payment.method'].sudo().search(
            [('neat_worldplay_terminal_device_code', '=', device_code)]).read(['neat_worldplay_terminal_pass_uuid'])
        if len(pos_payment_methods) == 0:
            return {'status': 404}
        payload = {
            'device_code': device_code,
            'pass_uuid': pos_payment_methods[0]['neat_worldplay_terminal_pass_uuid'],
            'amount': amount,
            'transaction_id': transaction_id,
            'start_date': start_date.timestamp(),
            'is_refund': is_refund,
            'is_from_initial_request': is_from_initial_request
        }

        secret_key = self.get_secret_key()
        token = self.encrypt(str(json.dumps(payload)), secret_key)
        return { 'payment_token': token, 'refresh_token': self.generate_refresh_token(device_code) }
    def auth_payment_token(self, payment_token, tid, amt, is_old_payment_token):
        secret_key = self.get_secret_key()
        decoded_token = json.loads(self.decrypt(payment_token, secret_key))
        device_code = decoded_token.get('device_code')
        pass_uuid = decoded_token.get('pass_uuid')
        start_date = datetime.utcfromtimestamp(decoded_token.get('start_date'))
        amount = decoded_token.get('amount')
        is_refund = decoded_token.get('is_refund')
        transaction_id = decoded_token.get('transaction_id')
        if is_old_payment_token:
            if not decoded_token['is_from_initial_request']:
                return { 'authenticated': False }
        else:
            current_datetime = datetime.utcnow()
            max_delta = timeout_delta
            delta = current_datetime - start_date
            if delta > max_delta:
                return { 'authenticated': False }

        if tid != transaction_id:
            return {'authenticated': False}
        if amt != amount:
            return {'authenticated': False}
        search_domain = [('neat_worldplay_terminal_device_code', '=', device_code)]
        if not is_old_payment_token:
            search_domain.append(('neat_worldplay_terminal_pass_uuid', '=', pass_uuid))
        pos_payment_methods = http.request.env['pos.payment.method'].sudo().search(search_domain).read(['neat_worldplay_terminal_device_code'])
        if len(pos_payment_methods) == 0:
            return { 'authenticated': False }
        current_payment_requests = http.request.env['neat.worldplay.payment.request'].sudo().search(
            [('terminal_id', '=', device_code), ('transaction_id', '=', transaction_id), ('amount', '=', amount), ('status', 'not like', 'processed_%')]).read(['status'])
        if len(current_payment_requests) == 0:
            return { 'authenticated': False }

        return { 'authenticated': True, 'device_code': device_code, 'transaction_id': transaction_id, 'amount': amount, 'is_refund': is_refund }
    def generate_refresh_token(self, device_code):
        pos_payment_methods = http.request.env['pos.payment.method'].sudo().search(
            [('neat_worldplay_terminal_device_code', '=', device_code)]).read(['neat_worldplay_terminal_pass_uuid'])
        if len(pos_payment_methods) == 0:
            return {'status': 404}
        payload = {
            'device_code': device_code,
            'timestamp': datetime.utcnow().timestamp(),
            'pass_uuid': pos_payment_methods[0]['neat_worldplay_terminal_pass_uuid']
        }

        secret_key = self.get_secret_key()
        token = self.encrypt(str(json.dumps(payload)), secret_key)
        return token
    def auth_refresh_token(self, refresh_token):
        secret_key = self.get_secret_key()
        decoded_token = json.loads(self.decrypt(refresh_token, secret_key))
        device_code = decoded_token['device_code']
        timestamp = decoded_token['timestamp']
        pass_uuid = decoded_token['pass_uuid']
        pos_payment_methods = http.request.env['pos.payment.method'].sudo().search(
            [('neat_worldplay_terminal_device_code', '=', device_code), ('neat_worldplay_terminal_pass_uuid', '=', pass_uuid)]).read(['neat_worldplay_terminal_device_code'])
        if len(pos_payment_methods) == 0:
            return { 'authenticated': False }
        token_datetime = datetime.utcfromtimestamp(timestamp)
        current_datetime = datetime.utcnow()
        max_delta = timedelta(days=180)
        delta = current_datetime - token_datetime
        if delta <= max_delta:
            return { 'authenticated': True, 'device_code': device_code }
        else:
            return { 'authenticated': False, 'device_code': device_code }

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
        r = json.loads(http.request.httprequest.data)
        device_code = r['device_code']
        master_password = r['master_password']
        refresh_token = r.get('refresh_token', None)
        if refresh_token:
            auth_result = self.auth_refresh_token(refresh_token)
            if auth_result['device_code'] != device_code:
                return json.dumps({'status': 403})
        pos_payment_methods = http.request.env['pos.payment.method'].sudo().search([('neat_worldplay_terminal_device_code', '=', device_code)]).read(['name', 'neat_worldplay_terminal_master_pwd'])
        if len(pos_payment_methods) == 0:
            return json.dumps({ 'status': 404 })

        if not check_password_hash(pos_payment_methods[0]['neat_worldplay_terminal_master_pwd'], master_password):
            return json.dumps({ 'status': 401 })
        token = self.generate_refresh_token(device_code)
        return json.dumps({ 'status': 200, 'data': { 'refresh_token': token } })

    @http.route('/neat_worldplay/payment_history', type='http', auth='public', methods=['POST'], csrf=False, cors='*')
    def payment_history(self):
        request_data = json.loads(http.request.httprequest.data)
        refresh_token = request_data.get('refresh_token')
        start_date_text = request_data.get('start_date')
        end_date_text = request_data.get('end_date')
        page = request_data.get('page') or 1
        filter_value = request_data.get('filter', '')

        date_format = "%Y-%m-%d"
        start_date = datetime.strptime(start_date_text, date_format)
        end_date = datetime.strptime(end_date_text, date_format)
        auth_result = self.auth_refresh_token(refresh_token)
        if not auth_result['authenticated']:
            return json.dumps({'status': 401})

        terminal_id = auth_result['device_code']
        response_data = get_payment_history(start_date, end_date, page, filter_value, terminal_id)

        return json.dumps(response_data)

    @http.route('/neat_worldplay/info',type='http', auth='public', methods=['POST'], csrf=False, cors='*')
    def info(self):
        r = json.loads(http.request.httprequest.data)
        refresh_token = r['refresh_token']
        res = self.auth_refresh_token(refresh_token)
        if not res['authenticated']:
            return json.dumps({ 'status': 401 })
        pos_payment_method = http.request.env['pos.payment.method'].sudo().search(
            [('neat_worldplay_terminal_device_code', '=', res['device_code'])]).read(['name'])
        if len(pos_payment_method) == 0:
            return json.dumps({ 'status': 404 })

        return json.dumps({ 'status': 200, 'data': { 'name': pos_payment_method[0]['name'] } })






