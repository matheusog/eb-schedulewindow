sap.ui.define([
        "sap/ui/core/UIComponent",
        "sap/ui/core/message/ControlMessageProcessor",
        "sap/ui/model/json/JSONModel",
        "com/eldorado/sap/eblog/schedulewindow/model/models",
        "com/eldorado/sap/eblog/schedulewindow/model/AuthorityControl"
    ],
    function (UIComponent, ControlMessageProcessor, JSONModel, models, AuthorityControl) {
        "use strict";

        return UIComponent.extend("com.eldorado.sap.eblog.schedulewindow.Component", {
            metadata: {
                manifest: "json"
            },

            /**
             * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
             * @public
             * @override
             */
            init: function () {
                // call the base component's init function
                UIComponent.prototype.init.apply(this, arguments);

                //set Message handler
                this.setMessageHandler();

                // set the device model
                this.setModel(models.createDeviceModel(), "device");

                this._oAuthControl = new AuthorityControl(this.getModel());

                this.getModel().metadataLoaded()
                    .then(() => {
                        return this._oAuthControl.initializeAuthority();
                    }).then((oAuth) => {
                        this.setModel(new JSONModel(oAuth), "authority");
                        // enable routing
                        this.getRouter().initialize();
                    });

                
            },

            /**
             * @override
             */
             exit: function() {
                if(this._oMessageProcessor) {
                    this._oMessageProcessor.destroy(); 
                }                    

                UIComponent.prototype.exit.apply(this, arguments);			
            },
        
            /**
             * Setter for message handler
             * @public
             */
            setMessageHandler: function () {            
                this._oMessageProcessor = new ControlMessageProcessor();
                this._oMessageManager	= sap.ui.getCore().getMessageManager();
                this._oMessageManager.registerMessageProcessor(this._oMessageProcessor);
                //this._oMessageManager.registerObject(this._oView, true);
                
                sap.ui.getCore().attachValidationError(function (oEvent) {
                    oEvent.getParameter("element").setValueState(sap.ui.core.ValueState.Error);
                });
                sap.ui.getCore().attachValidationSuccess(function (oEvent) {
                    oEvent.getParameter("element").setValueState(sap.ui.core.ValueState.None);
                });
            }            
        });
    }
);