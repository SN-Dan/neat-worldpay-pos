# -*- coding: utf-8 -*-
{
    'name': 'Neat Worldpay POS',
    'version': '1.0',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Integrate your POS with a Worldpay payment provider',
    'description': 'Pay using Odoo and Worldpay - Any Place, Any Time',
    'author': 'Neat Apps',
    'maintainer': 'Neat Apps',
    'data': [
        'security/ir.model.access.csv',
        'views/pos_payment_method_views.xml',
    ],
    'external_dependencies': {
        'python': ['cryptography', 'stomp']
    },
    'depends': ['point_of_sale'],
    'qweb': [],
    'images': ['static/description/landscape Neat POS.gif'],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_neatworldpay_ips/static/**/*',
        ]
    },
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'OPL-1',
}
