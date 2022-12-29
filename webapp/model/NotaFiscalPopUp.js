sap.ui.define([
	"sap/ui/base/ManagedObject", 
    "sap/ui/Device",    	 
    "sap/ui/core/Fragment", 
    //"sap/ui/core/syncStyleClass", 
    "sap/ui/core/mvc/Controller", 
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], function(ManagedObject, Device, Fragment, Controller, Filter, FilterOperator, JSONModel) { //syncStyleClass
	"use strict";

    var mModel = undefined; 
    var mInstance = undefined;
    var sContentDensityClass = Device.support.touch ? "sapUiSizeCozy" : "sapUiSizeCompact"; 
    var mFragmentStores     = {};
    var mMessageHandler     = {}; 
    var sLocalModelName     = "__notafiscal";
    var sFragmentName = "com.eldorado.sap.eblog.schedulewindow.view.fragments.commons.NotaFiscalDialog";

    function getMethods(oController) {
        var mCurrentFragment, mLocalModel, mSMTable;

        // defines a dependency from oControl to a parent
		function fnAttachControlToParent(oControl, oParent) {
			//syncStyleClass(sContentDensityClass, oParent, oControl);
			oParent.addDependent(oControl);
        }

        function getController() {  
            // @ts-ignore
            return new Promise((fnResolve, fnReject) => {

                let oFragController = {
                    onBeforeRebind: function(oEvent) {
                        let mBindingParams = oEvent.getParameter("bindingParams");
                        mBindingParams["filters"] = mLocalModel.getProperty("/filters");
                    },
                    onClose: function(oEvent) {
                        mCurrentFragment.close();
                    },

                    onConfirm: function(oEvent) {
                        mCurrentFragment.close();
                    }
                }; 

                fnResolve(oFragController);
            });
        }

        function getDialogFragmentForViewAsync(oView, sName, sModel) {
            // @ts-ignore
            return new Promise((fnResolve, fnReject) => {
                var sViewId = oView.getId();
				var mFragmentStore = mFragmentStores[sViewId] || (mFragmentStores[sViewId] = {});
				var oFragment = mFragmentStore[sName];
				if (!oFragment) {
                    var fnFragmentLoaded = function (oNewFragment) {
                        oFragment = oNewFragment;
                        fnAttachControlToParent(oNewFragment, oView);
                        var oModel;
                        if (sModel) {
                            oModel = new JSONModel({busy: false, delay: 0});
                            oNewFragment.setModel(oModel, sModel);
                        }
                        //(fnOnFragmentCreated || Function.prototype)(oNewFragment, oModel);
                        mFragmentStore[sName] = oNewFragment;
                            
                        fnResolve(oFragment);
                    };

                    getController().then((oFragmentController) => {
                        if(Fragment.load) {
                            return Fragment.load({id: sViewId, name: sName, controller: oFragmentController, type: "XML"});
                        } else {
                            let oFragSync = 
                                sap.ui.xmlfragment(sViewId, sName, oFragmentController);
                            fnFragmentLoaded.bind(this)(oFragSync);
                        }
                    }).then(fnFragmentLoaded.bind(this))
                    .catch((oError) => {
                        fnReject();
                    });                                           
                } else {
                    fnResolve(oFragment);
                }
            });
        }

        function getConfiguredFragment() {
            // @ts-ignore
            return new Promise((fnResolve, fnReject) => {                
                var oView = oController.getView();

                getDialogFragmentForViewAsync(oView, sFragmentName, sLocalModelName)
                    .then((oFragment) => {
                        mCurrentFragment = oFragment;
                        mLocalModel = oFragment.getModel(sLocalModelName); 
                        mSMTable = oController.getView().byId("smTableNF");
                        fnResolve(oFragment);
                    }).catch( () => { fnReject(); });
            });
        }

        function _fnGetDialog(aFilters) {
            // @ts-ignore
            return new Promise((fnResolve, fnReject) => {
                getConfiguredFragment()
                    .then((oFragment)=> {
                        mLocalModel.setProperty("/filters", aFilters);
                        mSMTable.rebindTable(); 
                        fnResolve(oFragment);
                    })
                    .catch((oError) => {
                        fnReject(oError);
                    }); 
            });
        }

        function _fnDestroy() {            
            let aProperties = Object.getOwnPropertyNames(mFragmentStores); 
            if(aProperties && aProperties.length) {
                aProperties.forEach(sProperty => {
                    let oFragmentStore = mFragmentStores[sProperty];
                    let oFragment = oFragmentStore[sFragmentName];
                    if(oFragment) {
                        oFragment.destroy();
                    }
                    delete mFragmentStores[sProperty]; 
                });
                
            }

            ManagedObject.prototype.destroy.apply(this, arguments);
        }

        return {
            _getDialog: _fnGetDialog.bind(mInstance), 
            _destroy: _fnDestroy.bind(mInstance)
        };
    }

	return ManagedObject.extend("com.eldorado.sap.eblog.schedulewindow.model.NotaFiscalPopUp", {        

        /**
         * @override
         * @param {any} oModel OData Model to authority check
         * @returns {sap.ui.base.ManagedObject}
         */
        constructor: function(oModel, oController) {
            ManagedObject.prototype.constructor.apply(this, arguments);
            mInstance = $.extend(this, getMethods(oController));
            
            mModel = oModel;
        
            return mInstance;
        }, 

        destroy: function() {
            return this._destroy();
        }, 

        getDialog: function(oFilters) {
            return this._getDialog(oFilters);
        }
	});
});