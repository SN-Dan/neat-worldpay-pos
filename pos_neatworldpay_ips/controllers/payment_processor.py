# coding: utf-8
import logging
import uuid
from odoo import http
from odoo.http import request
from datetime import datetime, timedelta

from .config import timeout_delta
from decimal import Decimal

_logger = logging.getLogger(__name__)

def get_user_name(user_id):
    user = request.env['res.users'].browse(user_id)
    if user:
        return user.name

    return None
def get_refunds(refunded_order_line_id, amt):
    pos_orders = http.request.env['pos.order'].sudo().search([
        ('lines', 'in', refunded_order_line_id)
    ]).read(['pos_reference'])
    if len(pos_orders) == 0:
        return []
    order_id = pos_orders[0]['pos_reference']
    _logger.info('get_refunds pos_orders: %s, refunded_order_line_id: ', pos_orders, refunded_order_line_id)
    space_index = order_id.find(" ")
    if space_index != -1:
        order_id = order_id[space_index + 1:]
    paid_payments_ref = http.request.env['neat.worldplay.payment.request'].sudo().search(
        [('status', 'like', 'processed_%'), ('order_id', '=', order_id), ('amount', '>=', 0)])
    paid_payments = paid_payments_ref.read(['amount', 'refunded_amt', 'uncommited_refunded_amt', 'transaction_id', 'card_type'])
    refunds = []
    covered_sum = 0
    _logger.info("get_refunds payments: %s", paid_payments)
    for payment in paid_payments:
        remainder = abs(abs(amt) - covered_sum)
        left_for_refund_amount = abs(payment['amount'] - payment['refunded_amt'])
        if left_for_refund_amount > 0:
            refund = {'transaction_id': payment['transaction_id'], 'card_type': payment['card_type']}
            refunds.append(refund)
            if remainder >= left_for_refund_amount:
                refund['amount'] = left_for_refund_amount
            else:
                refund['amount'] = remainder
            covered_sum = covered_sum + refund['amount']
            ramount = refund['amount']
            refund['amount'] = -1 * refund['amount']
            _logger.info("get_refunds payment: %s, refund: %s", payment, refund)
            if remainder - ramount == 0:
                break

    return refunds
def commit_refunds(refunded_order_line_id):
    pos_orders = http.request.env['pos.order'].sudo().search([
        ('lines', 'in', refunded_order_line_id)
    ]).read(['pos_reference'])
    if len(pos_orders) == 0:
        return []
    order_id = pos_orders[0]['pos_reference']
    space_index = order_id.find(" ")
    if space_index != -1:
        order_id = order_id[space_index + 1:]
    paid_payments_ref = http.request.env['neat.worldplay.payment.request'].sudo().search(
        [('status', 'like', 'processed_%'), ('order_id', '=', order_id)])
    for refund in paid_payments_ref:
        refund.sudo().write({'refunded_amt': refund['uncommited_refunded_amt']})

def is_order_the_same(refunded_order_line_ids):
    pos_orders = http.request.env['pos.order'].sudo().search([
        ('lines', 'in', refunded_order_line_ids)
    ]).read(['pos_reference'])
    is_order_the_same = False
    if pos_orders:
        first_pos_reference = pos_orders[0]['pos_reference']
        all_same_pos_reference = all(order['pos_reference'] == first_pos_reference for order in pos_orders)
        is_order_the_same = all_same_pos_reference
    return {'status': 200, 'data': {'is_order_the_same': is_order_the_same }}


def create_payment_request(terminal_id, order_id, amount, user_id, refunded_order_line_id=None):
    if amount is not None:
        decimal_amount = Decimal(str(amount)) * Decimal('100')
        amount = int(decimal_amount)
    if amount == 0:
        return { 'status': 400 }
    current_datetime = datetime.utcnow()
    two_minutes_ago = current_datetime - timeout_delta
    current_payment_requests_ref = http.request.env['neat.worldplay.payment.request'].search(
        [('terminal_id', '=', terminal_id), ('status', '=', 'pending'), ('start_date', '>=', two_minutes_ago)])
    current_payment_requests = current_payment_requests_ref.read(['id', 'user_id', 'order_id', 'start_date', 'transaction_id'])
    current_resent_requests_ref = http.request.env['neat.worldplay.payment.request'].search(
        [('terminal_id', '=', terminal_id), ('status', 'like', 'resent_%'), ('status', 'not like', 'processed_%'), ('start_date', '>=', two_minutes_ago)])
    current_resent_requests = current_resent_requests_ref.read(
        ['id', 'user_id', 'order_id', 'start_date', 'transaction_id'])
    new_refunded_order_line_id = refunded_order_line_id
    if amount >= 0:
        new_refunded_order_line_id = None
    if len(current_resent_requests) == 0:
        if len(current_payment_requests) > 0:
            current_payment_request = current_payment_requests[0]
            current_payment_request_ref = current_payment_requests_ref[0]
            if current_payment_request['user_id'] != user_id or current_payment_request['order_id'] != order_id:
                return {'status': 403}
            current_payment_request_ref.write({'status': 'cancelled'})
        transaction_id = uuid.uuid4()
        payment_request = {
            'terminal_id': terminal_id,
            'order_id': order_id,
            'amount': amount,
            'status': 'pending',
            'start_date': datetime.utcnow(),
            'user_id': user_id,
            'refunded_order_line_id': new_refunded_order_line_id,
            'refunded_amt': 0,
            'uncommited_refunded_amt': 0,
            'transaction_id': transaction_id,
        }
        request.env['neat.worldplay.payment.request'].create(payment_request)
        return { 'status': 201, 'data': { 'transaction_id': transaction_id } }
    else:
        current_payment_request = current_resent_requests[0]
        current_payment_request_ref = current_resent_requests_ref[0]
        if current_payment_request['user_id'] != user_id:
            return { 'status': 403 }
        current_payment_request_ref.write({'start_date': datetime.utcnow(), 'order_id': order_id})
        if len(current_payment_requests_ref) > 0:
            current_payment_requests_ref[0].write({ 'status': 'cancelled' })
        return {'status': 200, 'data': {'transaction_id': current_payment_request['transaction_id']}}

def cancel_payment_request(terminal_id, order_id):
    current_datetime = datetime.utcnow()
    two_minutes_ago = current_datetime - timeout_delta + timedelta(seconds=5)
    current_payment_requests = http.request.env['neat.worldplay.payment.request'].search(
        [('terminal_id', '=', terminal_id), ('order_id', '=', order_id), ('status', '=', 'pending'), ('start_date', '>=', two_minutes_ago)])
    _logger.info("cancel payment_requests: %s", current_payment_requests)
    current_resent_requests = http.request.env['neat.worldplay.payment.request'].search(
        [('terminal_id', '=', terminal_id), ('status', 'like', 'resent_%'), ('status', 'not like', 'processed_%'), ('start_date', '>=', two_minutes_ago)])
    _logger.info("cancel resent_requests: %s", current_payment_requests)
    if len(current_payment_requests) == 0 and len(current_resent_requests) == 0:
        return { 'status': 404 }
    for crr in current_resent_requests:
        crr.write({'status': 'cancelled'})
    for cpr in current_payment_requests:
        cpr.write({'status': 'cancelled'})
    return { 'status': 200 }

def check_request(terminal_id, transaction_id):
    current_datetime = datetime.utcnow()
    two_minutes_ago = current_datetime - timeout_delta
    current_payment_requests = http.request.env['neat.worldplay.payment.request'].search(
        [('transaction_id', '=', transaction_id), ('terminal_id', '=', terminal_id), ('status', 'not like', 'processed_%'), ('start_date', '>=', two_minutes_ago)], limit=1, order='start_date desc')
    if len(current_payment_requests) == 0:
        return { 'status': 404 }
    elif len(current_payment_requests) > 0 and current_payment_requests[0]['status'] != 'pending':
        current_payment_request = current_payment_requests[0]
        return { 'status': 200, 'data': {
                'status': current_payment_request['status'],
                'transaction_id': current_payment_request['transaction_id'],
                'card_type': current_payment_request['card_type'],
                'cardholder_name': current_payment_request['cardholder_name'],
                'refunded_amount': float(Decimal(str(current_payment_request['refunded_amt'])) / Decimal('100')),
                'is_refund': current_payment_request['refunded_order_line_id'] != False,
                'transaction_amount': float(Decimal(str(current_payment_request['amount'])) / Decimal('100'))
            }
        }
    else:
        return {'status': 200, 'data': { 'status': 'pending' }}

def request_processed(terminal_id, transaction_id):
    current_payment_requests = http.request.env['neat.worldplay.payment.request'].search(
        [('transaction_id', '=', transaction_id), ('terminal_id', '=', terminal_id)],
        limit=1, order='start_date desc')
    if len(current_payment_requests) == 0:
        return {'status': 404}
    cpr = current_payment_requests[0]
    if cpr['status'] != 'done' and cpr['status'] != 'refunded' and cpr['status'] != 'resent_refunded' and cpr['status'] != 'resent_done':
        return { 'status': 400 }
    if cpr['refunded_order_line_id']:
        commit_refunds(cpr['refunded_order_line_id'])
    cpr.write({ 'status': 'processed_' + cpr['status'] })
    return { 'status': 200 }

def get_payment_request(record):
    current_datetime = datetime.utcnow()
    two_minutes_ago = current_datetime - timeout_delta
    current_payment_requests = http.request.env['neat.worldplay.payment.request'].sudo().search([
        ('terminal_id', '=', record.terminal_id),
        ('status', '=', 'pending'),
        ('start_date', '>=', two_minutes_ago)
    ])

    if len(current_payment_requests) > 0:
        read_request = current_payment_requests.read(
            ['amount', 'order_id', 'start_date', 'transaction_id', 'refunded_order_line_id',
             'refunded_amt'])[0]
        if read_request['refunded_order_line_id']:
            refunds = get_refunds(read_request['refunded_order_line_id'], read_request['amount'])
            if len(refunds) == 0:
                return {'status': 404}
            current_payment_requests[0].write({'start_date': datetime.utcnow()})
            return {'status': 200, 'data': {'transaction_id': read_request['transaction_id'],
                                            'refunds': refunds,
                                            'amount': read_request['amount']}}
        current_payment_requests[0].write({'start_date': datetime.utcnow()})
        return {'status': 200, 'data': {'transaction_id': read_request['transaction_id'],
                                        'amount': read_request['amount']}}

def complete(status, refunds, card_type, transaction_id, device_code, is_refund):
    if status != 'done' and status != 'failed' and status != 'cancelled' and status != 'refunded' and status != 'resent_done' and status != 'resent_refunded':
        return { 'status': 400 }

    cardholder_name = "Not Specified"

    if status == "resent_done" or status == "resent_refunded":
        current_payment_requests = http.request.env['neat.worldplay.payment.request'].sudo().search(
            [('terminal_id', '=', device_code), ('transaction_id', '=', transaction_id),
             ('status', 'not like', 'processed_%')])
    else:
        current_datetime = datetime.utcnow()
        two_minutes_ago = current_datetime - timeout_delta
        current_payment_requests = http.request.env['neat.worldplay.payment.request'].sudo().search(
            [('terminal_id', '=', device_code), ('transaction_id', '=', transaction_id), ('status', '=', 'pending'),
             ('start_date', '>=', two_minutes_ago)])
    if len(current_payment_requests) == 0:
        return { 'status': 404 }
    total_refunded_amount = 0
    if is_refund:
        if refunds == None:
            return { 'status': 400 }
        tids = list(map(lambda x : x['transaction_id'], refunds))
        refunded_payment_refs = http.request.env['neat.worldplay.payment.request'].sudo().search([('transaction_id', 'in', tids), ('amount', '>=', 0)])
        refunded_payments = refunded_payment_refs.read(['refunded_amt', 'transaction_id'])
        if len(refunded_payments) == 0:
            return { 'status': 404 }
        index = 0
        for payment in refunded_payments:
            ramount = payment['refunded_amt']
            refund = next(filter(lambda x: x['transaction_id'] == payment['transaction_id'], refunds), None)
            if refund and refund['status'] == 'refunded':
                curr_ramount = abs(refund['amount'])
                total_refunded_amount = total_refunded_amount + curr_ramount
                new_refunded_amount = ramount + curr_ramount
                refunded_payment_refs[index].write({ 'uncommited_refunded_amt': new_refunded_amount })
            index+=1
    if status == 'done' or status == "resent_done":
        pr = {
            'card_type': card_type,
            'cardholder_name': cardholder_name,
            'status': status,
            'refunded_amt': total_refunded_amount,
            'start_date': datetime.utcnow()
        }
    else:
        pr = {
            'status': status,
            'refunded_amt': total_refunded_amount,
            'start_date': datetime.utcnow()
        }

    current_payment_requests[0].write(pr)
    return { 'status': 200 }

def get_payment_history(start_date, end_date, page, filter_value, terminal_id):
    per_page = 20
    offset = (page - 1) * per_page

    if filter_value != '':
        domain = [
            ('terminal_id', '=', terminal_id),
            ('start_date', '>=', start_date),
            ('start_date', '<=', end_date),
            '|',
            ('order_id', 'ilike', filter_value),
            ('transaction_id', 'ilike', filter_value),
        ]
    else:
        domain = [
            ('terminal_id', '=', terminal_id),
            ('start_date', '>=', start_date),
            ('start_date', '<=', end_date)
        ]

    total_records = http.request.env['neat.worldplay.payment.request'].sudo().search_count(domain)
    results = http.request.env['neat.worldplay.payment.request'].sudo().search(domain, offset=offset, limit=per_page, order='start_date desc').read(['create_date', 'order_id', 'user_id', 'transaction_id', 'amount', 'status', 'refunded_order_line_id', 'card_type'])
    final_results = []
    for result in results:
        date_format = "%Y-%m-%dT%H:%M:%S.%fZ"  # Use the desired format
        create_date = result['create_date'].strftime(date_format)
        if result['refunded_order_line_id']:
            refunds = get_refunds(result['refunded_order_line_id'], result['amount'])
            if len(refunds) > 0:
                user_name = get_user_name(result['user_id'])
                final_result = {**result, 'create_date': create_date, 'user_name': user_name, 'amount': result['amount'], 'refunds': refunds}
                del final_result['refunded_order_line_id']
                del final_result['user_id']
                final_results.append(final_result)
        else:
            user_name = get_user_name(result['user_id'])
            final_result = {**result, 'create_date': create_date, 'user_name': user_name, 'amount': result['amount']}
            del final_result['refunded_order_line_id']
            del final_result['user_id']
            final_results.append(final_result)

    # Calculate the total number of pages
    total_pages = -(-total_records // per_page)  # Ceiling division to ensure we get the correct number of pages

    # Return the results with pagination information
    response_data = {
        'status': 200,
        'data': {
            'results': final_results,
            'page': page,
            'total_pages': total_pages,
        },
    }

    return response_data






