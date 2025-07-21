# -*- coding: utf-8 -*-
# Original Author: Daniel Stoynev
# Copyright (c) 2025 SNS Software Ltd. All rights reserved.
# This module extends Odoo's payment framework.
# Odoo is a trademark of Odoo S.A.
{
    'name': 'POS Worldpay',
    'version': '1.1',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Integrate your POS with a Worldpay payment terminal',
    'description': 'Pay using Odoo and Worldpay - Any Place, Any Time',
    'author': 'Neat Apps',
    'maintainer': 'Neat Apps',
    'data': [
        'security/ir.model.access.csv',
        'views/pos_payment_method_views.xml',
    ],
    'external_dependencies': {
        'python': ['cryptography']
    },
    'depends': ['point_of_sale'],
    'qweb': [],
    'images': ['static/description/landscape Neat POS.gif'],
    'assets': {
        'point_of_sale.assets': [
            'pos_neatworldpay/static/src/js/models.js',
            'pos_neatworldpay/static/src/js/payment_neatworldpay.js',
            'pos_neatworldpay/static/src/js/sn_printer_service.js',
            'pos_neatworldpay/static/src/js/sn_reprinter_service.js'
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
