odoo.define('pos_neatworldpay.PaymentScreenPaymentLines', function(require) {
    'use strict';

    const PaymentScreenPaymentLines = require('point_of_sale.PaymentScreenPaymentLines');
    const Registries = require('point_of_sale.Registries');
    const rpc = require('web.rpc');

    const PosNeatWorldpayPaymentScreenPaymentLines = (PaymentScreenPaymentLines) =>
        class extends PaymentScreenPaymentLines {
            /**
             * @override
             */
            formatLineAmount(paymentline) {
                return super.formatLineAmount(...arguments);
            }

            /**
             * @override
             */
            selectedLineClass(line) {
                return super.selectedLineClass(...arguments);
            }

            /**
             * @override
             */
            unselectedLineClass(line) {
                return super.unselectedLineClass(...arguments);
            }

            /**
             * Check if payment line is Neat WorldPay
             * @param {Object} line - The payment line
             * @returns {boolean}
             */
            isNeatWorldpayPayment(line) {
                return line.payment_method && line.payment_method.use_payment_terminal === 'neatworldpay';
            }

            /**
             * Handle resync button click for Neat WorldPay payments
             * @param {Object} line - The payment line
             */
            async onResyncNeatWorldpay(line) {
                try {
                    // Fetch today's done transactions
                    const result = await rpc.query({
                        route: '/pos_worldpay/today_done',
                        params: {}
                    });

                    if (result && result.data && result.data.results) {
                        // Show modal with today's done transactions
                        await this.showResyncModal(line, result.data.results);
                    } else {
                        console.error('No today done transactions found');
                    }
                } catch (error) {
                    console.error('Error fetching today done transactions:', error);
                }
            }

            /**
             * Show resync modal with today's done transactions
             * @param {Object} line - The payment line
             * @param {Array} transactions - Today's done transactions
             */
            async showResyncModal(line, transactions) {
                this.displayResyncModal(line, transactions);
            }

            /**
             * Display custom resync modal similar to displaySyncModal
             * @param {Object} line - The payment line
             * @param {Array} transactions - Today's done transactions
             */
            displayResyncModal(line, transactions) {
                if (document.querySelector('.resync-modal')) {
                    return; // Modal already exists, do nothing
                }

                const modal = document.createElement('div');
                modal.classList.add('resync-modal');
                
                // Get current payment amount for filtering
                const currentAmount = line.amount || 0;
                
                // Filter transactions by matching amount
                const matchingTransactions = transactions.filter(transaction => 
                    Math.abs((transaction.amount || 0) - currentAmount) < 0.01
                );
                
                // Create transaction list HTML for matching transactions only
                let transactionListHtml = '';
                matchingTransactions.forEach((transaction, index) => {
                    const amount = this.env.pos.format_currency_no_symbol(transaction.amount || 0);
                    const time = transaction.start_date || transaction.created_at || transaction.timestamp || 'Unknown time';
                    const transactionId = transaction.transaction_id || transaction.id || 'N/A';
                    transactionListHtml += `
                        <div class="transaction-item" data-index="${index}" data-transaction='${JSON.stringify(transaction)}'>
                            <div class="transaction-info">
                                <div class="transaction-amount">${amount}</div>
                                <div class="transaction-time">${time}</div>
                                <div class="transaction-id">ID: ${transactionId}</div>
                            </div>
                        </div>
                    `;
                });
                
                // Add "Load All" button if there are more transactions than matching ones
                const loadAllButton = transactions.length > matchingTransactions.length ? 
                    `<button class="resync-modal-button resync-modal-load-all" id="btnLoadAll">Load All Transactions (${transactions.length - matchingTransactions.length} more)</button>` : '';

                modal.innerHTML = `
                    <div class="resync-modal-content">
                        <h2 class="resync-modal-text">Select Transaction to Resync</h2>
                        <div class="transaction-list-container">
                            ${transactionListHtml}
                        </div>
                        ${loadAllButton}
                        <div class="resync-modal-buttons">
                            <button class="resync-modal-button resync-modal-cancel" id="btnCancel">Cancel</button>
                            <button class="resync-modal-button resync-modal-confirm" id="btnResync" disabled>Resync</button>
                        </div>
                    </div>
                `;

                // Add the modal to the document body
                document.body.appendChild(modal);

                // Function to close the modal
                const closeModal = () => {
                    if (document.body.contains(modal)) {
                        document.body.removeChild(modal);
                    }
                };

                // Function to handle transaction selection
                const handleTransactionClick = (transactionItem) => {
                    // Remove previous selection
                    document.querySelectorAll('.transaction-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    
                    // Add selection to clicked item
                    transactionItem.classList.add('selected');
                    
                    // Enable resync button
                    const resyncBtn = document.getElementById('btnResync');
                    resyncBtn.disabled = false;
                    
                    // Store selected transaction
                    modal.selectedTransaction = JSON.parse(transactionItem.dataset.transaction);
                };

                // Add event listeners
                const transactionItems = modal.querySelectorAll('.transaction-item');
                transactionItems.forEach(item => {
                    item.addEventListener('click', () => handleTransactionClick(item));
                });

                const cancelBtn = document.getElementById('btnCancel');
                const resyncBtn = document.getElementById('btnResync');
                const loadAllBtn = document.getElementById('btnLoadAll');

                cancelBtn.addEventListener('click', () => {
                    closeModal();
                });

                resyncBtn.addEventListener('click', async () => {
                    if (modal.selectedTransaction) {
                        await this.processResync(line, modal.selectedTransaction);
                        closeModal();
                    }
                });

                // Add event listener for Load All button
                if (loadAllBtn) {
                    loadAllBtn.addEventListener('click', () => {
                        // Create HTML for all transactions
                        let allTransactionsHtml = '';
                        transactions.forEach((transaction, index) => {
                            const amount = this.env.pos.format_currency_no_symbol(transaction.amount || 0);
                            const time = transaction.start_date || transaction.created_at || transaction.timestamp || 'Unknown time';
                            const transactionId = transaction.transaction_id || transaction.id || 'N/A';
                            allTransactionsHtml += `
                                <div class="transaction-item" data-index="${index}" data-transaction='${JSON.stringify(transaction)}'>
                                    <div class="transaction-info">
                                        <div class="transaction-amount">${amount}</div>
                                        <div class="transaction-time">${time}</div>
                                        <div class="transaction-id">ID: ${transactionId}</div>
                                    </div>
                                </div>
                            `;
                        });
                        
                        // Update the transaction list container
                        const transactionListContainer = modal.querySelector('.transaction-list-container');
                        transactionListContainer.innerHTML = allTransactionsHtml;
                        
                        // Remove the Load All button
                        loadAllBtn.remove();
                        
                        // Re-add event listeners to new transaction items
                        const newTransactionItems = modal.querySelectorAll('.transaction-item');
                        newTransactionItems.forEach(item => {
                            item.addEventListener('click', () => handleTransactionClick(item));
                        });
                    });
                }
            }



            /**
             * Process the resync with selected transaction
             * @param {Object} line - The payment line
             * @param {Object} selectedTransaction - The selected transaction
             */
            async processResync(line, selectedTransaction) {
                try {
                    // Update the payment line with the selected transaction data
                    if (selectedTransaction.transaction_id) {
                        line.transaction_id = selectedTransaction.transaction_id;
                    }
                    if (selectedTransaction.card_type) {
                        line.card_type = selectedTransaction.card_type;
                    }
                    if (selectedTransaction.cardholder_name) {
                        line.cardholder_name = selectedTransaction.cardholder_name;
                    }
                    if (selectedTransaction.amount) {
                        line.amount = selectedTransaction.amount;
                    }

                    // Set payment status to done
                    line.set_payment_status('done');

                    // Log the resync action
                    await this.logResyncAction(line, selectedTransaction);

                    // Trigger the resync event
                    this.trigger('resync-payment-line', { 
                        cid: line.cid, 
                        transaction: selectedTransaction 
                    });

                } catch (error) {
                    console.error('Error processing resync:', error);
                    line.set_payment_status('retry');
                }
            }

            /**
             * Log the resync action to chatter and UI logs
             * @param {Object} line - The payment line
             * @param {Object} selectedTransaction - The selected transaction
             */
            async logResyncAction(line, selectedTransaction) {
                try {
                    debugger;
                    const order = this.env.pos.get_order();
                    const amount = this.env.pos.format_currency_no_symbol(selectedTransaction.amount || 0);
                    const time = selectedTransaction.start_date || 'Unknown time';
                    
                    // Get current Odoo user info (not cashier/employee)
                    const currentUser = this.env.pos.user;
                    const userName = currentUser ? currentUser.name : "Unknown"
                    const userId = currentUser ? currentUser.id : "Unknown"
                    
                    // Create log message with user info
                    const logMessage = `Payment resynced with transaction ${selectedTransaction.transaction_id}. Amount: ${amount}, Time: ${time}. User: ${userName} (ID: ${userId})`;
                    
                    // Log to UI using log_message_ui endpoint
                    if (line.payment_method && line.payment_method.neat_worldpay_terminal_device_code) {
                        await rpc.query({
                            route: '/pos_worldpay/log_message_ui',
                            params: {
                                terminal_id: line.payment_method.neat_worldpay_terminal_device_code,
                                transaction_id: selectedTransaction.transaction_id,
                                type: 'info',
                                message: logMessage
                            }
                        });
                    }
                    
                    // Add -resync suffix to order name to trigger backend chatter message
                    order.name += `-resync`;

                } catch (error) {
                    console.error('Error logging resync action:', error);
                }
            }
        };

    Registries.Component.extend(PaymentScreenPaymentLines, PosNeatWorldpayPaymentScreenPaymentLines);

    return PosNeatWorldpayPaymentScreenPaymentLines;
});
