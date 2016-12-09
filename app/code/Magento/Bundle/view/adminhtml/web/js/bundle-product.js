/**
 * Copyright © 2016 Magento. All rights reserved.
 * See COPYING.txt for license details.
 */

/*global FORM_KEY*/
/*global bSelection*/
/*global $H*/
define([
    'jquery',
    'Magento_Catalog/js/product/weight-handler',
    'Magento_Ui/js/modal/modal',
    'jquery/ui',
    'mage/translate',
    'Magento_Theme/js/sortable',
    'prototype'
], function ($, weightHandler) {
    'use strict';

    $.widget('mage.bundleProduct', {
        /** @inheritdoc */
        _create: function () {
            this._initOptionBoxes()
                ._initSortableSelections()
                ._bindCheckboxHandlers()
                ._initCheckboxState()
                ._bindAddSelectionDialog()
                ._hideProductTypeSwitcher();
        },

        /**
         * @return {Object}
         * @private
         */
        _initOptionBoxes: function () {
            var syncOptionTitle;

            this.element.sortable({
                axis: 'y',
                handle: '[data-role=draggable-handle]',
                items: '.option-box',
                update: this._updateOptionBoxPositions,
                tolerance: 'pointer'
            });

            syncOptionTitle = function (event) {//jscs:ignore jsDoc
                var originalValue = $(event.target).attr('data-original-value'),
                    currentValue = $(event.target).val(),
                    optionBoxTitle = $('.title > span', $(event.target).closest('.option-box')),
                    newOptionTitle = $.mage.__('New Option');

                optionBoxTitle.text(currentValue === '' && !originalValue.length ? newOptionTitle : currentValue);
            };
            this._on({
                'change .field-option-title input[name$="[title]"]': syncOptionTitle,
                'keyup .field-option-title input[name$="[title]"]': syncOptionTitle,
                'paste .field-option-title input[name$="[title]"]': syncOptionTitle
            });

            return this;
        },

        /**
         * @return {Object}
         * @private
         */
        _initSortableSelections: function () {
            this.element.find('.option-box .form-list tbody').sortable({
                axis: 'y',
                handle: '[data-role=draggable-handle]',
                helper: function (event, ui) {//jscs:ignore jsDoc
                    ui.children().each(function () {
                        $(this).width($(this).width());
                    });

                    return ui;
                },
                update: this._updateSelectionsPositions,
                tolerance: 'pointer'
            });

            return this;
        },

        /**
         * @return {Object}
         * @private
         */
        _initCheckboxState: function () {
            this.element.find('.is-required').each(function () {
                $(this).prop('checked', $(this).closest('.option-box').find('[name$="[required]"]').val() > 0);
            });

            this.element.find('.is-user-defined-qty').each(function () {
                $(this).prop('checked', $(this).closest('.qty-box').find('.select').val() > 0);
            });

            return this;
        },

        /**
         * @return {Object}
         * @private
         */
        _bindAddSelectionDialog: function () {
            var widget = this;

            this._on({
                'click .add-selection': function (event) {//jscs:ignore jsDoc
                    var $optionBox = $(event.target).closest('.option-box'),
                        $selectionGrid = $optionBox.find('.selection-search').clone(),
                        optionIndex = $optionBox.attr('id').replace('bundle_option_', ''),
                        productIds = [],
                        productSkus = [],
                        selectedProductList = {};

                    $optionBox.find('[name$="[product_id]"]').each(function () {
                        if (!$(this).closest('tr').find('[name$="[delete]"]').val()) {
                            productIds.push($(this).val());
                            productSkus.push($(this).closest('tr').find('.col-sku').text());
                        }
                    });

                    bSelection.gridSelection.set(optionIndex, $H({}));
                    bSelection.gridRemoval = $H({});
                    bSelection.gridSelectedProductSkus = productSkus;

                    $selectionGrid.on('contentUpdated', bSelection.gridUpdateCallback);
                    $selectionGrid.on('change', '.col-id input', function () {
                        var tr = $(this).closest('tr');

                        if ($(this).is(':checked')) {
                            selectedProductList[$(this).val()] = {
                                name: $.trim(tr.find('.col-name').html()),
                                sku: $.trim(tr.find('.col-sku').html()),
                                'product_id': $(this).val(),
                                'option_id': $('bundle_selection_id_' + optionIndex).val(),
                                'selection_price_value': 0,
                                'selection_qty': 1
                            };
                        } else {
                            delete selectedProductList[$(this).val()];
                        }
                    });

                    $selectionGrid.modal({
                        title: $optionBox.find('input[name$="[title]"]').val() === '' ?
                            $.mage.__('Add Products to New Option') :
                            $.mage.__('Add Products to Option "%1"').replace(
                                '%1',
                                $('<div>').text($optionBox.find('input[name$="[title]"]').val()).html()
                            ),
                        modalClass: 'bundle',
                        type: 'slide',
                        closed: function (e, modalWindow) {//jscs:ignore jsDoc
                            modalWindow.modal.remove();
                        },
                        buttons: [{
                            text: $.mage.__('Add Selected Products'),
                            'class': 'action-primary action-add',
                            click: function () {//jscs:ignore jsDoc
                                $.each(selectedProductList, function () {
                                    window.bSelection.addRow(optionIndex, this);
                                });
                                bSelection.gridRemoval.each(function (pair) {
                                    $optionBox.find('.col-sku').filter(function () {
                                        return $.trim($(this).text()) === pair.key; // find row by SKU
                                    }).closest('tr').find('button.delete').trigger('click');
                                });
                                widget.refreshSortableElements();
                                widget._updateSelectionsPositions.apply(widget.element);
                                $selectionGrid.modal('closeModal');
                            }
                        }]
                    });
                    $.ajax({
                        url: bSelection.selectionSearchUrl,
                        dataType: 'html',
                        data: {
                            index: optionIndex,
                            products: productIds,
                            'selected_products': productIds,
                            'form_key': FORM_KEY
                        },
                        success: function (data) {//jscs:ignore jsDoc
                            $selectionGrid.html(data).modal('openModal');
                        },
                        context: $('body'),
                        showLoader: true
                    });
                }
            });

            return this;
        },

        /**
         * @private
         */
        _hideProductTypeSwitcher: function () {
            weightHandler.hideWeightSwitcher();
        },

        /**
         * @return {Object}
         * @private
         */
        _bindCheckboxHandlers: function () {
            this._on({
                'change .is-required': function (event) {//jscs:ignore jsDoc
                    var $this = $(event.target);

                    $this.closest('.option-box').find('[name$="[required]"]').val($this.is(':checked') ? 1 : 0);
                },
                'change .is-user-defined-qty': function (event) {//jscs:ignore jsDoc
                    var $this = $(event.target);

                    $this.closest('.qty-box').find('.select').val($this.is(':checked') ? 1 : 0);
                }
            });

            return this;
        },

        /**
         * @return {Object}
         * @private
         */
        _updateOptionBoxPositions: function () {
            $(this).find('[name^=bundle_options][name$="[position]"]').each(function (index) {
                $(this).val(index);
            });

            return this;
        },

        /**
         * @return {Object}
         * @private
         */
        _updateSelectionsPositions: function () {
            $(this).find('[name^=bundle_selections][name$="[position]"]').each(function (index) {
                $(this).val(index);
            });

            return this;
        },

        /**
         *
         * @return {Object}
         */
        refreshSortableElements: function () {
            this.element.sortable('refresh');
            this._updateOptionBoxPositions.apply(this.element);
            this._initSortableSelections();
            this._initCheckboxState();

            return this;
        }
    });

});
