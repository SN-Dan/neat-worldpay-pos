# coding: utf-8
# Original Author: Daniel Stoynev
# Copyright (c) 2025 SNS Software Ltd. All rights reserved.
# This module extends Odoo's payment framework.
# Odoo is a trademark of Odoo S.A.

import logging
from odoo import models, fields, api

_logger = logging.getLogger(__name__)

class PosOrder(models.Model):
    _name = 'pos.order'  # keep the same model name
    _description = 'Point of Sale Order'
    _inherit = ['pos.order', 'mail.thread', 'mail.activity.mixin']
    
    # Add a field to track if this order should be resynced
    should_resync = fields.Boolean(string='Should Resync', default=False)
    
    @api.model
    def create(self, vals):
        # Check if the name ends with -resync
        name = vals.get('name', '')
        should_resync = False
        resync_user_name = "Unknown"
        resync_user_id = "Unknown"
        
        # Log at the top with name and should_resync status
        _logger.info(f"Creating POS Order - Name: {name}, Should Resync: {should_resync}")
        _logger.info(f"Creating POS Order - All vals: {vals}")
        
        if name and '-resync' in name:
            should_resync = True
            
            # Get the actual Odoo user who is creating this order
            current_user = self.env.user
            resync_user_name = current_user.name if current_user else "Unknown"
            resync_user_id = current_user.id if current_user else "Unknown"
            
            # Remove -resync suffix and restore original name
            original_name = name.replace('-resync', '')
            vals['name'] = original_name
            vals['should_resync'] = True
            
            # Update log with final status
            _logger.info(f"POS Order Resync Detected - Original Name: {original_name}, Should Resync: {should_resync}, User: {resync_user_name} (ID: {resync_user_id})")
        
        # Create the order
        order = super(PosOrder, self).create(vals)
        
        # If this was a resync order, add a chatter message with user info
        if should_resync and order.id:
            # Create detailed message
            message_body = f"""
            <p><strong>Payment Resync Action</strong></p>
            <p><strong>Original Order Name:</strong> {vals['name']}</p>
            <p><strong>Resynced By:</strong> {resync_user_name} (ID: {resync_user_id})</p>
            <p><strong>Date/Time:</strong> {fields.Datetime.now()}</p>
            <p><strong>Order ID:</strong> {order.id}</p>
            """
            
            order.message_post(
                body=message_body,
                message_type='comment'
            )
        
        return order