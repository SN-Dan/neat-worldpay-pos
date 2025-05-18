{
    "name": "POS Improvements",
    "version": "1.0",
    "summary": "POS Improvements",
    "author": "Daniel Stoynev",
    "depends": ["point_of_sale"],
    "assets": {
        "point_of_sale._assets_pos": [
            "pos_improvements/static/src/app/components/category_popup.js",
            "pos_improvements/static/src/app/components/category_popup.xml",
            "pos_improvements/static/src/app/patch/category_selector_patch.js",
        ],
    },
    "installable": True,
    "application": False,
    "license": "LGPL-3",
}