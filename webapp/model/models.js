sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], 
    /**
     * provide app-view type models (as in the first "V" in MVVC)
     * 
     * @param {typeof sap.ui.model.json.JSONModel} JSONModel
     * @param {typeof sap.ui.Device} Device
     * 
     * @returns {Function} createDeviceModel() for providing runtime info for the device the UI5 app is running on
     */
    function (JSONModel, Device) {
        "use strict";

        return {
            createDeviceModel: function () {
                var oModel = new JSONModel(Device);
                oModel.setDefaultBindingMode("OneWay");
                return oModel;
        }, 
        
        /**
         * provide app-view type models (as in the first "V" in MVVC)
         * 
         * @public
         * @param {object} [oExtension] - additional properties
         * @returns {sap.ui.model.Model} 
         */
         createViewModel: function (oExtension) {
            let oAdd = (oExtension||{});
            return new JSONModel($.extend(oAdd, {
                state: {
                    busy: false, 
                    delay: 1
                }
            }));
        }
    };
});