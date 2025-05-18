/** @odoo-module **/

import { Component } from "@odoo/owl";

export class CategoryPopup extends Component {
    static template = "pos_category_popup.CategoryPopup";
    static props = {
        categories: Array,
        onClick: Function,
        closePopup: Function,
    };
}