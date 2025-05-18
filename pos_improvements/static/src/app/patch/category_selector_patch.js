/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { CategorySelector } from "@point_of_sale/app/generic_components/category_selector/category_selector";
import { CategoryPopup } from "../components/category_popup";
import { mountComponent } from "@web/env";
import { xml } from "@odoo/owl";

patch(CategorySelector.prototype, {
    setup() {
        super.setup();
        const rpc = this.env.services.rpc ? this.env.services.rpc : this.env.services.orm.rpc
        var pos = this.env.services.pos
        this.allCategories = []
        rpc('/web/dataset/call_kw', {
            method: "web_search_read",
            model: "pos.category",
            args: [],
            kwargs: {
                context: {
                    allowed_company_ids: [pos.company.id],
                    uid: pos.user.id
                },
                domain: [],
                specification: {
                    display_name: {},
                    image_128: {},
                    name: {},
                    parent_id: {fields: {display_name: {}}},
                    sequence: {},
                    write_date: {}
                }
            },
        })
        .then(res => {
            let categoryObjects = res.records.map(c => ({ ...c, image_128: c.image_128 ? c.image_128.startsWith("/9j/") ? "data:image/jpeg;base64," + c.image_128 : "data:image/png;base64," + c.image_128 : c.image_128 }))
            categoryObjects = [{ id: 0, name: "All"}, ...categoryObjects]
            this.allCategories = categoryObjects
            this.render()
        })

        this.onCategoryClick = function(categId) {
            const popupBg = document.querySelector(".sns-popup-bg");
            if (popupBg) {
                popupBg.style.display = "none";
            }
            
            this.props.onClick(categId)
        }

        this.onCategoryClick = this.onCategoryClick.bind(this)
    },

    togglePopup() {
        const popupBg = document.querySelector(".sns-popup-bg");
        if (popupBg) {
            popupBg.style.display = "flex";
        }
    },
    closePopup() {
        const popupBg = document.querySelector(".sns-popup-bg");
        if (popupBg) {
            popupBg.style.display = "none";
        }
    },
});

CategorySelector.template = xml/* xml */`
<t t-name="point_of_sale.CategorySelector">
    <div class="d-flex w-100 p-2" style="height: 33px;">
        <button class="btn btn-primary w-100" style="height: 33px;" t-on-click="togglePopup">
            Categories
        </button>
    </div>
    <style>
    .sns-popup-bg {
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
        box-sizing: border-box;
    }

    .sns-popup-content {
        background: white;
        border-radius: 10px;
        width: 100%;
        max-width: 900px;
        height: 90vh;
        display: flex;
        flex-direction: column;
        padding: 1rem;
        box-sizing: border-box;
    }

    .sns-category-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 10px;
        overflow-y: auto;
        flex-grow: 1;
    }

    .sns-category-cell {
        background: #f8f8f8;
        border-radius: 6px;
        padding: 0.5rem;
        text-align: center;
        cursor: pointer;
        height: 70px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-size: 0.9rem;
        user-select: none;
    }

    .sns-category-cell:hover {
        background: #ececec;
    }

    .sns-category-img {
        width: 100%;
        height: 100%;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        border-radius: 6px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 0.25rem;
        box-sizing: border-box;
    }

    .sns-category-name {
        background: rgba(255, 255, 255, 0.8);
        padding: 0.2rem 0.4rem;
        font-size: 0.75rem;
        font-weight: bold;
        border-radius: 4px;
        max-width: 100%;
        text-align: center;
        word-break: break-word;
        white-space: normal;
    }

    .sns-popup-content .btn {
        margin-top: 10px;
    }

    /* Mobile styles */
    @media (max-width: 480px) {
        .sns-popup-content {
            max-width: 100%;
            height: 90vh;
            padding: 0.75rem;
            border-radius: 0.75rem;
        }

        .sns-category-grid {
            grid-template-columns: repeat(3, 1fr);
        }

        .sns-category-cell {
            font-size: 0.8rem;
            height: 60px;
            padding: 0.4rem;
        }

        .sns-category-name {
            font-size: 0.75rem;
        }
    }

    /* Desktop-specific enhancements */
    @media (min-width: 1025px) {
        .sns-category-grid {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        }

        .sns-category-cell {
            height: 100px;
            font-size: 1rem;
            padding: 0.75rem;
            height: 90px;
        }

        .sns-category-name {
            font-size: 0.9rem;
        }

        .sns-category-img {
            height: 100%;
        }
    }
    </style>
    <div class="sns-popup-bg" t-on-click.stop="closePopup">
      <div class="sns-popup-content" t-on-click.stop="">
        <div class="sns-category-grid">
          <div t-foreach="allCategories" t-as="category" t-key="category.id"
               class="sns-category-cell" t-on-click="() => onCategoryClick(category.id)">
                <div t-if="category.image_128"
                    class="sns-category-img"
                    t-att-style="'background-image: url(' + category.image_128 + ');'">
                    <div class="sns-category-name" t-esc="category.name"/>
                </div>
                
                <div t-if="!category.image_128" class="sns-category-name" t-esc="category.name"/>
          </div>
        </div>
        <button style="margin-top: 10px;" class="btn btn-secondary w-100" t-on-click="closePopup">Close</button>
      </div>
    </div>
</t>
`;