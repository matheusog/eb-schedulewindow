sap.ui.define([
	"sap/ui/core/mvc/Controller",
    "sap/ui/core/message/Message",
    "sap/ui/core/routing/History",
    "com/eldorado/sap/eblog/schedulewindow/utils/Constants",
    "com/eldorado/sap/eblog/schedulewindow/utils/Formatter"
], function(Controller, Message, History, Constants, Formatter) {
	"use strict";

	return Controller.extend("com.eldorado.sap.eblog.schedulewindow.controller.BaseController", {

        _oConstants: Constants, 
        _oFormmater: Formatter,
        _oMessageHandler: undefined,

        /**
		 * Event handler for navigating back.
		 * It there is a history entry we go one step back in the browser history
		 * If not, it will replace the current entry of the browser history with the master route.
		 * @public
		 */
		onNavBack : function() {
			var sPreviousHash = History.getInstance().getPreviousHash();

			if (sPreviousHash !== undefined) {
				// eslint-disable-next-line sap-no-history-manipulation
				history.go(-1);
			} else {
				this.getRouter().navTo("RouteS1_Main", {}, null, true);
			}
        }, 
        
        /**
		 * Convenience method for getting the message processor in every controller of the application.
		 * @public
		 * @returns {sap.ui.core.message.ControlMessageProcessor} Controle Message Processor
		 */
		getMessageProcessor : function () {
			return this.getOwnerComponent()._oMessageProcessor;
        },
        
        /**
		 * Convenience method for getting the message manager in every controller of the application.
		 * @public
		 * @returns {sap.ui.core.message.MessageManager} Message Manager
		 */
		getMessageManager : function () {
			return this.getOwnerComponent()._oMessageManager;
        },

        /**
		 * Convenience method for getting the message handler in every controller of the application.
		 * @public
		 * @returns Message Handler
		 */
        getMessageHandler : function () {
			return this._oMessageHandler;
        },

        /**
        * @public
        * Get global model
        * @param {string|undefined} [sModel] Model name
        * @returns {sap.ui.model.Model} Model object
        */
        getModel: function(sModel) {
            return this.getOwnerComponent().getModel(sModel);
        }, 

        /**
		 * Convenience method for accessing the router in every controller of the application.
		 * @public
		 * @returns {sap.ui.core.routing.Router} the router for this component
		 */
		getRouter : function () {
			return this.getOwnerComponent().getRouter();
		},

        /**
        * @public
        * Get global text
        * @param {string} sText Text id
        * @param {Array} [aArgs] Arguments for text
        * @returns {string} Text value
        */
        getText: function(sText, aArgs) {
            if(!sText) { return; }
            let oModel = this.getOwnerComponent().getModel("i18n");
            if(!oModel) { return; }
            return oModel.getResourceBundle().getText(sText, aArgs);
        }, 

        /**
		 * Convenience method for setting the message handler in every controller of the application.
		 * @public
         * @param  Message Handler
		 */
         setMessageHandler : function(oMessageHandler) {
            this._oMessageHandler = oMessageHandler;
        }, 

        /**
        * @public
        * Set global model
        * @param {sap.ui.model.Model|null|undefined} oModel Model object
        * @param {string|undefined} [sModel] Model Name
        * @return {sap.ui.base.ManagedObject} Setted Model
        */
        setModel: function(oModel, sModel) {
            return this.getOwnerComponent().setModel(oModel, sModel);
        }, 
        
        /**
        * @protected
        * Map odata response
        * @param {object|null|undefined} oResponse OData Response
        * @return {Array} Messages
        */
        _mapOdataException2Message : function (oResponse) {
            let aMessages = []; 

            if(oResponse.responseText){
                try {
                    let oError = JSON.parse(oResponse.responseText);
                    
                    if( oError.error &&
                        oError.error.innererror &&
                        oError.error.innererror.errordetails ) {
                        oError.error.innererror.errordetails.forEach((oErrorMessage) => {
                            aMessages.push({ Type: "E", Message: oErrorMessage.message });
                        });
                    } else if(oError.d &&
                            oError.d.toReturnLog &&
                            oError.d.toReturnLog.results &&
                            oError.d.toReturnLog.results.length > 0) {          
                        oError.d.toReturnLog.results.forEach((oErrorMessage) => {
                            aMessages.push({ Type: oErrorMessage.Return.Type, Message: oErrorMessage.Return.Message });
                        });
                    } else if(oError.error && oError.error.message){
                        aMessages.push({ Type: "E", Message: oError.error.message.value });
                    } else {
                        aMessages.push({ Type: "E", Message: oResponse.responseText });
                    }
                } catch(e) {
                    aMessages.push({ Type: "E", Message: oResponse.responseText });
                }
            } else if(oResponse.message){
                aMessages.push({ Type: "E", Message: oResponse.message });
            } else {
                aMessages.push({ Type: "E", Message: oResponse });
            }

            return aMessages;
        },

        /**
        * @protected
        * Map message
        * @param {object|null|undefined} oReturn OData Return Message
        * @return {sap.ui.core.message.Message} Message
        */
        _mapMessage: function(oReturn) {
            return 	new Message({
				        message: oReturn.Message,
				        type: this._oFormmater.fnFormatMsgType(oReturn.Type),
				        target: "",
				        processor: this.getMessageProcessor()
				     });
        }, 

        /**
        * @protected
        * Display messages
        * @param {Array} aReturn OData Return Messages
        * @param {boolean} bSuccess OData Return Messages
        * @param {function} fnSuccessCallback Success function for callback
        * @param {function} fnErrorCallback Error function for callback
        */
        _displayMessages: function (aReturn, bSuccess, fnSuccessCallback, fnErrorCallback) {
            if(!aReturn || !aReturn.length) {
                return; 
            }

            var aMessages = this.getMessageManager().getMessageModel().getData();
			if(aMessages){
				this.getMessageManager().removeMessages(aMessages);
            }
            
            aReturn.forEach(oReturn => {
                this.getMessageManager().addMessages(
		          this._mapMessage(oReturn)
                );	    
            });
            
            if(this.getMessageHandler()) {
                this.getMessageHandler().handleMessage(bSuccess).then(() => {
					(fnSuccessCallback || Function.prototype)(this);
				}).catch(() => {
					(fnErrorCallback || Function.prototype)(this);
				});
            }
            
        },

        /**
        * @public
        * Create message object
        * @param {string} sText Text id
        * @param {Array} [aArgs] Arguments for text
        * @returns {object} Message Object
        */
        _createMessageFromText : function(sText, aArgs) {            
            return { message: this.getText(sText, aArgs) };
        }

        /*
        _displaySingleMessage: function (oReturn, bSuccess, fnSuccessCallback, fnErrorCallback) {
            if(!oReturn) {
                return; 
            }

            var aMessages = this.getMessageManager().getMessageModel().getData();
			if(aMessages){
				this.getMessageManager().removeMessages(aMessages);
            }
            
			this.getMessageManager().addMessages(
		        this._mapMessage(oReturn)
            );	
            
            if(this.getMessageHandler()) {
				this.getMessageHandler().handleMessage(bSuccess).then(() => {
					(fnSuccessCallback || Function.prototype)(this);
				}).catch(() => {
					(fnErrorCallback || Function.prototype)(this);
				});
            }            
        }
        */
	});
});