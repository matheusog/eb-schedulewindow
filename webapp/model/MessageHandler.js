sap.ui.define([
	"sap/ui/base/Object", 
	"sap/ui/Device",
	"sap/ui/model/json/JSONModel",
	//"sap/ui/core/syncStyleClass",
	"sap/ui/core/Fragment", 
	"sap/m/MessageToast",
	"sap/m/Dialog",
	"sap/m/Popover"
], function(BaseObject, Device, JSONModel, Fragment, MessageToast, Dialog, Popover) { //syncStyleClass
	"use strict";
	
	var mFragmentStores = {};
	//var sContentDensityClass = Device.support.touch ? "sapUiSizeCozy" : "sapUiSizeCompact"; 
	var sLocalModelName = "__messageView";
	var sDialogName = "com.eldorado.sap.eblog.schedulewindow.view.fragments.commons.MessageDialog";
	function getMethods(oController) {
		var fnYes, fnNo; // global functions which should be called when the user either accepts or rejects the operation
		var fnAfterClose; // global function that should be executed when the dialog is closed. Note that actions performed this way are decoupled from the closing operation.
		var oItemBinding;
		var oRet, oLocalModel; //, oMessageView;
		
        function destroy() {            
            let aProperties = Object.getOwnPropertyNames(mFragmentStores); 
            if(aProperties && aProperties.length) {
                aProperties.forEach(sProperty => {
                    let oFragmentStore = mFragmentStores[sProperty];
                    let oFragment = oFragmentStore[sDialogName];
                    if(oFragment) {
                        oFragment.destroy();
                    }
                    delete mFragmentStores[sProperty]; 
                });
                
            }

            BaseObject.prototype.destroy.apply(this, arguments);
        }

		// defines a dependency from oControl to a parent
		function fnAttachControlToParent(oControl, oParent) {
			//syncStyleClass(sContentDensityClass, oParent, oControl);
			oParent.addDependent(oControl);
		}
		function fnMakeBusyAware(oControl) {
				var sOpenFunction;
				if (oControl instanceof Dialog) {
					sOpenFunction = "open";
				} else if (oControl instanceof Popover ) { //|| oControl instanceof ActionSheet) {
					sOpenFunction = "openBy";
				}
				if (sOpenFunction) {
					var fnOpenFunction = oControl[sOpenFunction];
					oControl[sOpenFunction] = function() {
						fnOpenFunction.apply(oControl, arguments);
					};
				}
		}
			
		function getDialogFragmentForViewAsync(oView, sName, oFragmentController, sModel, fnOnFragmentCreated) {
				// @ts-ignore
				return new Promise(function (fnResolve) {
					var sViewId = oView.getId();
					var mFragmentStore = mFragmentStores[sViewId] || (mFragmentStores[sViewId] = {});
					var oFragment = mFragmentStore[sName];
					if (!oFragment) {
                        var fnFragmentLoadedfunction = function (oNewFragment) {
							oFragment = oNewFragment;
							fnAttachControlToParent(oNewFragment, oView);
							var oModel;
							if (sModel) {
								oModel = new JSONModel();
								oNewFragment.setModel(oModel, sModel);
							}
							(fnOnFragmentCreated || Function.prototype)(oNewFragment, oModel);
							mFragmentStore[sName] = oNewFragment;
							fnMakeBusyAware(oNewFragment);	
							fnResolve(oFragment);
						};
                        if(Fragment.load) {
                            Fragment.load({id: sViewId, name: sName, controller: oFragmentController, type: "XML"})
                            .then(fnFragmentLoadedfunction.bind(this));
                        } else {
                            let oFragSync = 
                                sap.ui.xmlfragment(sViewId, sName, oFragmentController);
                            fnFragmentLoadedfunction.bind(this)(oFragSync);
                        }
						return;
					}
					fnResolve(oFragment);
				});
				

		}
		
		function getConfiguredPopoverIfNeeded(bSuccess){
            //@ts-ignore
            return new Promise(function (fnResolve) {
				getDialogFragmentForViewAsync( oController.getView(),
				  "com.eldorado.sap.eblog.schedulewindow.view.fragments.commons.MessageDialog", {
					onMessageSelect: function(){
						oLocalModel.setProperty("/backbtnvisibility", true);
					},
					onBackButtonPress: function(){
						//oMessageView.navigateBack();
						oLocalModel.setProperty("/backbtnvisibility", false);
					},
					onAccept: function(){
						fnAfterClose = fnYes;
						oRet.close();
					},
					onReject: function(){
						fnAfterClose = fnNo;
						oRet.close();
					},
					onAfterClose: function(){
						fnYes = null;
						fnNo = null;
						//oMessageView.navigateBack();
						(fnAfterClose || Function.prototype)();
						fnAfterClose = null;
                    }, 
                    formatMsgIconColor : function(sType) {
                        return sType === sap.ui.core.MessageType.Success ? 
                                sap.ui.core.IconColor.Positive : 
                                sType === sap.ui.core.MessageType.Information ?
                                sap.ui.core.IconColor.Neutral : 
                                sType === sap.ui.core.MessageType.Warning ?
                                sap.ui.core.IconColor.Critical : 
                                sap.ui.core.IconColor.Negative;
                    }, 

                    formatMsgIcon : function(sType) {
                        return sType === sap.ui.core.MessageType.Success ? 
                                "sap-icon://message-success" : 
                                sType === sap.ui.core.MessageType.Information ?
                                "sap-icon://message-information" : 
                                sType === sap.ui.core.MessageType.Warning ?
                                "sap-icon://message-warning" : 
                                "sap-icon://message-error";

                    }
				}, sLocalModelName, function(oFragment){
					//oMessageView = oFragment.getContent()[0];
					oFragment.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "msg");
					oItemBinding = oFragment.getContent()[0].getBinding("items");
				}).then(function (oFragment) {
					oRet = oFragment;
					oLocalModel = oRet.getModel(sLocalModelName);
					oLocalModel.setProperty("/backbtnvisibility", false);
					oLocalModel.setProperty("/success", bSuccess ? bSuccess : false);
					oLocalModel.setProperty("/textSuccess", oRet.getModel("i18n").getProperty("CLOSE"));
					oLocalModel.setProperty("/title", oRet.getModel("i18n").getProperty("MESSAGE_VIEW_TITLE"));
					var aFilters = [];
					oItemBinding.filter(aFilters);
					fnResolve(oRet);
					
				});
			});
		}
		
		function hasMessageOnViews(bSuccess){
            // @ts-ignore
            return new Promise(function (fnResolve, fnReject) {
				getConfiguredPopoverIfNeeded(bSuccess).then(function (oPopup) {
					fnYes = fnResolve;
					fnNo = fnReject;
					let bMessageTemp = false;
					if( oController.getView().getElementBinding("settings") &&
                        oController.getView().getElementBinding("settings").getBoundContext()) {
                		bMessageTemp = oController.getView().getElementBinding("settings").getBoundContext().getObject().TemporaryMessage; 
                    }
					if(!bMessageTemp) {
						oPopup.open();
					} else {
						let aMessages = oRet.getModel("msg").getProperty("/"); 
						if(aMessages.length > 0) {
							let oMessage = aMessages[0];
							
							MessageToast.show( oMessage.description ? 
								`${ oMessage.message } - ${oMessage.description}` : oMessage.message);
							
							if(bSuccess) {
								fnResolve();
							} else {
								fnReject();
							}
						} else { fnReject(); }
						
					}
					
				});
			});
		}
		
		return {
            handleMessage: hasMessageOnViews, 
            destroy: destroy
		};
	}
	
	return BaseObject.extend("com.eldorado.sap.eblog.schedulewindow.model.MessageHandler", {
		constructor: function(oController) {
            $.extend(this, getMethods(oController));
        }
	});
});