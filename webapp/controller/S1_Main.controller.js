sap.ui.define([
    "com/eldorado/sap/eblog/schedulewindow/controller/BaseController", 
    "com/eldorado/sap/eblog/schedulewindow/model/MessageHandler",
    "com/eldorado/sap/eblog/schedulewindow/model/NotaFiscalPopUp",
    "com/eldorado/sap/eblog/schedulewindow/model/models", 
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/Fragment",
    "sap/ui/generic/app/navigation/service/NavigationHandler",
    "sap/ui/generic/app/navigation/service/NavType",    
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator", 
    "sap/m/MessageBox"
],
    /**
     * @param {object} BaseController
     * @param {object} MessageHandler
     * @param {object} NotaFiscalPopUp
     * @param {object} models
     * @param {sap.ui.core.Fragment} Fragment
     * @param {sap.ui.generic.app.navigation.service.NavigationHandler} NavigationHandler
     * @param {sap.ui.generic.app.navigation.service.NavType} NavType
     * @param {sap.ui.model.Filter} Filter
     * @param {sap.ui.model.FilterOperator} FilterOperator
     * @param {sap.m.MessageBox} MessageBox
     */
    function (BaseController, MessageHandler, NotaFiscalPopUp, models, DateFormat, Fragment, NavigationHandler, NavType, Filter, FilterOperator, MessageBox) {
        "use strict";

        return BaseController.extend("com.eldorado.sap.eblog.schedulewindow.controller.S1_Main", {
            /**
             * Init event for view
             * @public
             * @override
             */
            onInit: function () {
                this.setModel(models.createViewModel({}), "view");
                
                this.setMessageHandler(new MessageHandler(this));
                this.getMessageManager().registerObject(this.getView(), true);

                this._oSMTable  = this.getView().byId("smTable");
                this._oSMFilter = this.getView().byId("smartFilterBar");
                // create an instance of the navigation handler
                this._oNavigationHandler = new NavigationHandler(this);
                
                // create a new Application state (oAppState) for this Application instance
                // this._oAppState = 
                //     sap.ushell.Container
                //         .getService("CrossApplicationNavigation")
                //         .createEmptyAppState(this.getOwnerComponent());
                // this._bHashChanged = false; 

                this.setModel(
                    models.createViewModel({
                        "data": { 
                            "editable": false
                        }
                    }), "view");

                this._oNotaFiscalPopUp = new NotaFiscalPopUp(this.getModel(), this); 

                if(this._oSMFilter.isInitialised()) {
                    this._getURLParameters();
                    this._initStateHandler();
                } else {
                    this._oSMFilter.attachEvent("initialise", (oEvent) => {
                        this._getURLParameters();
                        this._initStateHandler();
                    }, this);
                }                
            },

            /**
             * Exit event for view
             * @public
             * @override
             */
             onExit: function() {                
                if(this._oSharePopover) {
                    this._oSharePopover.then((oPopover) => {
                        oPopover.destroy();
                    });
                }

                if(this._oNotaFiscalPopUp) {
                    this._oNotaFiscalPopUp.destroy();
                }

                this.destroy();
            },         

            /**
             * Retornar o total de itens selecionados
             * @public
             * @returns {integer} Total de itens marcados
             */
            getSelectedItemsCount: function() {
                let aItems = this._oSMTable.getTable().getSelectedItems();
                if(!aItems || aItems.length === 0) {
                    return 0; 
                } else { return aItems.length; }
            }, 

            /**
             * Ação de ativar as janelas
             * @public
             * @param {sap.ui.base.EventProvider} oEvent Evento do botão
             */
            onActivate: function(oEvent) {
                this.getModel("view").setProperty("/state/busy", true);
                this._getSelectedItems()
                    .then(this._doActiveInactivate.bind(this, true))
                    .then((oProcessing) => {
                        let aMessages = oProcessing ? (oProcessing.messages||undefined) : []; 
                        let bSuccess = oProcessing ? (oProcessing.success||false) : true; 
                        if(!aMessages) { aMessages = [] }
                        if(bSuccess) { 
                            aMessages.push( aMessages.length > 0 ? 
                                { Type: "I", Message: this.getText("message.activation_processed_alert") } :
                                { Type: "S", Message: this.getText("message.activation_processed") }); 
                        };
                        this._displayMessages(aMessages, true, null, null);
                    })
                    .catch((oError) => {
                        if(oError) {
                            let aMessages = this._mapOdataException2Message(oError);                
                            this._displayMessages(aMessages, false, null);
                        }
                    })
                    .finally(() => {
                        this.getModel("view").setProperty("/state/busy", false);
                    });         
            },

            /**
             * Evento antes do rebind da tabela
             * @public
             * @param {sap.ui.base.EventProvider} oEvent Evento de rebind
             */
            onBeforeRebind: function(oEvent) {
                let mBindingParams = oEvent.getParameter("bindingParams");
                mBindingParams.parameters["expand"] = "toSchedule,toPlant,toSchedType";

                let oActMultiCombobox   = this.getView().byId("selIsScheduleActive");
                let oAvailMultiCombobox = this.getView().byId("selScheduleAvail");
                let oDPSchedBegDate     = this.getView().byId("dpScheduleWindowBeginDatetime");
                let oDPSchedEndDate     = this.getView().byId("dpScheduleWindowEndDatetime");

                let aFilters = (mBindingParams["filters"] || []);
                aFilters.push(new Filter("IsDeleted", FilterOperator.EQ, false)); 
                
                //Status Active filter
                if(oActMultiCombobox && oActMultiCombobox.getSelectedKeys()) {
                    let aStatusFilter = [];
                    oActMultiCombobox.getSelectedKeys().forEach((oItem) => {
                        aStatusFilter.push(new Filter("IsScheduleActive", FilterOperator.EQ, oItem));
                    });
                    if(aStatusFilter.length > 0) {
                        aFilters.push(new Filter({ filters: aStatusFilter, and: false })); 
                    }
                }   
                
                //Availability Filter
                if(oAvailMultiCombobox && oAvailMultiCombobox.getSelectedKeys()) {
                    let aAvailFilter = [];
                    oAvailMultiCombobox.getSelectedKeys().forEach((oItem) => {
                        let bResult = oItem === "true";
                        aAvailFilter.push(new Filter("ScheduleCode", (bResult ? FilterOperator.NE : FilterOperator.EQ ), "0000000000"));
                    });
                    if(aAvailFilter.length > 0) {
                        aFilters.push(new Filter({ filters: aAvailFilter, and: false })); 
                    }
                }   

                //Begin and End Dates filters
                let oBegDate, oEndDate;
                let oDateFormat = DateFormat.getDateTimeInstance({ UTC: false });
                if(oDPSchedBegDate && oDPSchedBegDate.getDateValue()) {
                    oBegDate = oDateFormat.parse(oDateFormat.format(oDPSchedBegDate.getDateValue()), true);
                }

                if(oDPSchedEndDate && oDPSchedEndDate.getDateValue()) {
                    oEndDate = oDateFormat.parse(oDateFormat.format(oDPSchedEndDate.getDateValue()), true);
                }

                let sOperator = oBegDate && oEndDate ? FilterOperator.BT : 
                                    oBegDate ? FilterOperator.GE : FilterOperator.LE;
                if(oBegDate) {
                    aFilters.push(new Filter("ScheduleWindowBeginDatetime", sOperator, oBegDate, oEndDate));
                }
                if(oEndDate) {
                    aFilters.push(new Filter("ScheduleWindowEndDatetime", sOperator, (oBegDate || oEndDate) , oEndDate));
                }


                mBindingParams["filters"] = [new Filter({filters: aFilters, and: true})];
            }, 

            /**
             * Ação de cancelar a edição
             * @public
             * @param {sap.ui.base.EventProvider} oEvent Evento do botão
             */
            onCancel: function(oEvent) {                
                this._doCancel()
                    .then(() => {
                        this.getModel("view").setProperty("/data/editable", false);
                    })
                    .catch((oError) => {
                        if(oError) {
                            let aMessages = this._mapOdataException2Message(oError);                
                            this._displayMessages(aMessages, false, null);
                        }
                    });
                
            },

            /**
             * Ação de eliminar as janelas
             * @public
             * @param {sap.ui.base.EventProvider} oEvent Evento do botão
             */
            onDelete: function(oEvent) {
                this.getModel("view").setProperty("/state/busy", true);
                this._getSelectedItems()
                    .then(this._doDelete.bind(this))
                    .then((oProcessing) => {
                        let aMessages = oProcessing ? (oProcessing.messages||undefined) : []; 
                        let bSuccess = oProcessing ? (oProcessing.success||false) : true; 
                        if(!aMessages) { aMessages = [] }
                        if(bSuccess) { 
                            aMessages.push( aMessages.length > 0 ? 
                                { Type: "I", Message: this.getText("message.deletion_processed_alert") } :
                                { Type: "S", Message: this.getText("message.deletion_processed") }); 
                        };
                        this._displayMessages(aMessages, true, null, null);
                    })
                    .catch((oError) => {
                        if(oError) {
                            let aMessages = this._mapOdataException2Message(oError);                
                            this._displayMessages(aMessages, false, null);
                        }
                    })
                    .finally(() => {
                        this.getModel("view").setProperty("/state/busy", false);
                    });  
            },

            /**
             * Ação de editar os agendamentos das janelas
             * @public
             * @param {sap.ui.base.EventProvider} oEvent Evento do botão
             */
            onEdit: function(oEvent) {
                this.getModel("view").setProperty("/data/editable", true);
                /*
                let aKeys = Object.getOwnPropertyNames(this.getModel().getObject("/"))
                    	        .filter((oItem) => oItem.startsWith("ScheduleWindowSet"));
                aKeys.forEach((sKey) => {
                  this.getModel().setProperty("/".concat(sKey, "/UX_FC_Default"), 3); 
                });
                */
            },

            /**
             * Ação de envio de emails
             * @public
             * @param {sap.ui.base.EventProvider} oEvent Evento do botão
             */
            onEmailPress: function(oEvent) {
                sap.m.URLHelper.triggerEmail("", this.getText("commons.share.title"), window.location.href);
            },

            /**
             * Ação de inativar as janelas
             * @public
             * @param {sap.ui.base.EventProvider} oEvent Evento do botão
             */
            onInactivate: function(oEvent) {
                this.getModel("view").setProperty("/state/busy", true);
                this._getSelectedItems()
                    .then(this._doActiveInactivate.bind(this, false))
                    .then((oProcessing) => {
                        let aMessages = oProcessing ? (oProcessing.messages||undefined) : []; 
                        let bSuccess = oProcessing ? (oProcessing.success||false) : true; 
                        if(!aMessages) { aMessages = [] }
                        if(bSuccess) { 
                            aMessages.push( aMessages.length > 0 ? 
                                { Type: "I", Message: this.getText("message.inactivation_processed_alert") } :
                                { Type: "S", Message: this.getText("message.inactivation_processed") }); 
                        };
                        this._displayMessages(aMessages, true, null, null);
                    })
                    .catch((oError) => {
                        if(oError) {
                            let aMessages = this._mapOdataException2Message(oError);                
                            this._displayMessages(aMessages, false, null);
                        }
                    })
                    .finally(() => {
                        this.getModel("view").setProperty("/state/busy", false);
                    });                    
            },

            /**
             * Ação de abrir detalhes de nota fiscal
             * @public
             * @param {sap.ui.base.EventProvider} oEvent Evento do botão
             */
            onNFPress: function(oEvent) {
                let oContext = oEvent.getSource().getBindingContext(); 
                let oObject = oContext.getObject();
                let oFilters = new Filter({filters: [
                        new Filter("Scheduling", FilterOperator.EQ, oObject.ScheduleCode), 
                        new Filter("FiscalYear", FilterOperator.EQ, oObject.FiscalYear)
                    ], and: true}); 
                this._oNotaFiscalPopUp.getDialog(oFilters)
                    .then((oFrag) => { oFrag.open(); }); 
            },

            /**
             * Ação de salvar as janelas
             * @public
             * @param {sap.ui.base.EventProvider} oEvent Evento do botão
             */
            onSave: function(oEvent) {
                this.getModel("view").setProperty("/state/busy", true);
                this._doSave().then((oProcessing) => {
                    let aMessages = oProcessing ? (oProcessing.messages||undefined) : []; 
                    let bSuccess = oProcessing ? (oProcessing.success||false) : true; 
                    if(!aMessages) { aMessages = [] }
                    if(bSuccess) { 
                        this.getModel("view").setProperty("/data/editable", false);
                        aMessages.push( aMessages.length > 0 ? 
                            { Type: "I", Message: this.getText("message.save_processed_alert") } :
                            { Type: "S", Message: this.getText("message.save_processed") }); 
                    };
                    this._displayMessages(aMessages, true, null, null);
                })
                .catch((oError) => {
                    if(oError) {
                        let aMessages = this._mapOdataException2Message(oError);                
                        this._displayMessages(aMessages, false, null);
                    }
                })
                .finally(() => {
                    this.getModel("view").setProperty("/state/busy", false);
                });
                
            }, 

            /**
             * Ação de buscar dados
             * @public
             * @param {sap.ui.base.EventProvider} oEvent Evento do botão buscar
             */
            onSearch: function(oEvent) {
                let oTable  = this._oSMTable;
                let oFilt   = this._oSMFilter;
            
                let mInnerAppData = {
                    selectionVariant: oFilt.getDataSuiteFormat(),
                    tableVariantId: oTable.getCurrentVariantId()
                };

                // this._oAppState.setData(mInnerAppData); 
                // this._oAppState.save();

                // if(!this._bHashChanged) {
                //     this._bHashChanged  = true;
                //     let oHashChanger    = sap.ui.core.routing.HashChanger.getInstance();
                //     let sOldHash        = oHashChanger.getHash();
                //     let sNewHash        = sOldHash + "?" + "sap-iapp-state=" + this._oAppState.getKey();
                //     oHashChanger.replaceHash(sNewHash);
                // }

                this._oNavigationHandler.storeInnerAppState(mInnerAppData);
            },

            /**
             * Ação de compartilhar link do aplicativo (por e-mail ou via launchpad). 
             * @public
             * @param {sap.ui.base.EventProvider} oEvent Evento do botão compartilhar
             */
            onSharePress: function(oEvent) {
                var oButton = oEvent.getSource(),
				    oView   = this.getView();

                // create popover
                if (!this._oSharePopover) {
                    if(Fragment.load) {
                        this._oSharePopover =
                            Fragment.load({
                                id: oView.getId(),
                                name: "com.eldorado.sap.eblog.schedulewindow.view.fragments.commons.SharePopover",
                                controller: this, 
                                type: "XML"
                            }).then(function(oPopover) {
                                oView.addDependent(oPopover);
                                //oPopover.setModel("i18n", oView.getModel("i18n"));
                                return oPopover;
                            });
                        } else {
                            this._oSharePopover = new Promise((fnResolve, fnReject) => {
                                let oPopover = sap.ui.xmlfragment(oView.getId(), "com.eldorado.sap.eblog.schedulewindow.view.fragments.commons.SharePopover", this);
                                oView.addDependent(oPopover);
                                //oPopover.setModel("i18n", oView.getModel("i18n"));
                                fnResolve(oPopover);
                            });                          
                        }
                            
                } 
                this._oSharePopover.then(function(oPopover) {
                    oPopover.openBy(oButton);
                });
            },

            /**
             * Montagem da URL/chave de ScheduleWindow
             * @private
             * @param {object} oObject Objeto com as propriedades de ScheduleWindow
             * @returns {string} Chave retornada
             */
            _buildScheduleWindowKey: function(oObject) {
                let sPlant              = encodeURIComponent(oObject.Plant), 
                    sScheduleWindowTp   = encodeURIComponent(oObject.ScheduleWindowTp), 
                    sScheduleWindowGuid = encodeURIComponent(oObject.ScheduleWindowGuid);
                var sPath = `/ScheduleWindowSet(Plant='${sPlant}',ScheduleWindowTp='${sScheduleWindowTp}',ScheduleWindowGuid='${sScheduleWindowGuid}')`;
                return sPath; 
            },

            /**
             * Confirmação de alerta para o usuário
             * @private
             * @param {string} sMessage Mensagem de confirmação
             * @returns {Promise} Promessa de retorno
             */
            _confirmAction(sMessage) {
                return new Promise((fnResolve, fnReject) => {
                    MessageBox.warning(sMessage, {
                        onClose: (oAction) => {
                            if(oAction === MessageBox.Action.YES) {
                                fnResolve();
                            } else {
                                fnReject();
                            }
                        }, 
                        actions: [ MessageBox.Action.YES,
                                   MessageBox.Action.NO ],
                        emphasizedAction: MessageBox.Action.NO
                    });
                });
            },

            /**
             * Ação de ativar/desativar as janelas
             * @private
             * @param {Array} aItems Itens selecionados
             * @returns {Promise} Promise de retorno
             */
            _doActiveInactivate: function(bActivate, aItems) {   
                return new Promise((fnResolve, fnReject) => {
                    let oModel = this.getModel();
                    
                    let aContexts = 
                        aItems
                            .filter((oItem) => {
                                                let sScheduleCode = oItem.getBindingContext().getObject().ScheduleCode;
                                                return  oItem.getBindingContext().getObject().IsScheduleActive !== bActivate &&
                                                        ( sScheduleCode === "0000000000" || sScheduleCode === null || sScheduleCode === undefined ); })
                            .map((oItem) => oItem.getBindingContext() );
                    
                    if(!aContexts || !aContexts.length) {
                        fnReject(this._createMessageFromText("message.noValidItemSelected"));
                        return;
                    }
                    
                    let fnExec = () => {
                        aContexts.forEach((oContext) => {
                            let oObject = oContext.getObject();
                            let oParams= { "Plant": oObject.Plant, "ScheduleWindowTp": oObject.ScheduleWindowTp, 
                                        "ScheduleWindowGuid": oObject.ScheduleWindowGuid, "ActivationStatus": bActivate };
                            let sETag = 
                                this.getModel().getETag(this._buildScheduleWindowKey(oObject));
                            this._doFunctionCall("/ActivationChange", "POST", oParams, sETag, "toSchedule,toPlant");
                                // .then((oData, oResponse) => {
                                //     this._displayMessages([{ Type: "S", Message: this.getText("message.inactivation_processed", [ oObject.Tknum ]) }], true, null, null);
                                // }).catch((oError) => {
                                //     let aMessages = this._mapOdataException2Message(oError);
                                //     this._displayMessages(aMessages, false, null, null);
                                // })
                        });
                        
                        this.getModel().attachEventOnce("batchRequestCompleted", (oResponse) => {                        
                            let iHttpStatusCode = oResponse.getParameter("response").statusCode; 
                            if(iHttpStatusCode === 202) {
                                let aMessages = [];
                                let bSuccess = false;
                                if(oResponse && oResponse.getParameter("requests")) {                                
                                    let aReqs = oResponse.getParameter("requests").filter((oItem) => oItem.method === "POST");
                                        //oItem.hasOwnProperty("__changeResponses"))||[{"__changeResponses": [oResponse.__batchResponses[0]]}]); 
                                    let aResps = aReqs.map((oItem) => oItem.response); 
                                    aResps.forEach((oItem) => {
                                        if(oItem.headers["sap-message"]) {
                                            let oMessage = JSON.parse(oItem.headers["sap-message"]); 
                                            aMessages = aMessages.concat(this._mapOdataException2Message(oMessage)); 
                                        } else if(oItem.statusCode === "202" || oItem.statusCode === "201" || oItem.statusCode === "200") {
                                            bSuccess = true; 
                                        } else {
                                            aMessages = aMessages.concat(this._mapOdataException2Message(oItem));
                                        }
                                            
                                    });
                                }
                                fnResolve({ "messages": aMessages, "success": bSuccess });

                            } else {
                                fnReject(oResponse.getParameter("response"));
                            }
                            
                        }); 
                    };

                    if(aContexts.length === aItems.length) {
                        fnExec(); 
                    } else {
                        let sTextId = bActivate ? "message.activation_not_valid_warning" : "message.inactivation_not_valid_warning"; 
                        this._confirmAction(this.getText(sTextId))
                            .then(fnExec)
                            .catch(fnReject);
                    }
                });
            },

            /**
             * Ação de cancelar as janelas
             * @private
             */
            _doCancel: function() {   
                return new Promise((fnResolve, fnReject) => {
                    let oModel = this.getModel();
                    if(!oModel.hasPendingChanges()) {
                        fnResolve();
                    } else {    
                        //confirm
                        this._confirmAction(this.getText("message.pendingChanges"))
                            .then(() => {
                                oModel.resetChanges();
                                fnResolve();
                            })
                            .catch(fnReject);
                    }
                });
            },

            /**
             * Ação de eliminar as janelas
             * @private
             * @param {Array} aItems Itens selecionados
             */
            _doDelete: function(aItems) {   
                return new Promise((fnResolve, fnReject) => {
                    let oModel = this.getModel();

                    let aContexts = 
                        aItems
                            .filter((oItem) => !oItem.getBindingContext().getObject().IsScheduleActive )
                            .map((oItem) => oItem.getBindingContext() );
                    
                    if(!aContexts || !aContexts.length) {
                        fnReject(this._createMessageFromText("message.noValidItemSelected"));
                        return;
                    }

                    let fnExec = () => {
                        aContexts.forEach((oContext) => {
                            let oObject = oContext.getObject();
                            let oParams= { "Plant": oObject.Plant, "ScheduleWindowTp": oObject.ScheduleWindowTp, 
                                           "ScheduleWindowGuid": oObject.ScheduleWindowGuid };
                            let sETag = //"";
                              this.getModel().getETag(this._buildScheduleWindowKey(oObject));
                            this._doFunctionCall("/DeleteScheduleWindow", "POST", oParams, sETag, "toSchedule,toPlant");
                                // .then((oData, oResponse) => {
                                //     this._displayMessages([{ Type: "S", Message: this.getText("message.inactivation_processed", [ oObject.Tknum ]) }], true, null, null);
                                // }).catch((oError) => {
                                //     let aMessages = this._mapOdataException2Message(oError);
                                //     this._displayMessages(aMessages, false, null, null);
                                // })
                        });
                        
                        this.getModel().attachEventOnce("batchRequestCompleted", (oResponse) => {                        
                            let iHttpStatusCode = oResponse.getParameter("response").statusCode; 
                            if(iHttpStatusCode === 202) {
                                let aMessages = [];
                                let bSuccess = false;
                                if(oResponse && oResponse.getParameter("requests")) {                                
                                    let aReqs = oResponse.getParameter("requests").filter((oItem) => oItem.method === "POST");
                                        //oItem.hasOwnProperty("__changeResponses"))||[{"__changeResponses": [oResponse.__batchResponses[0]]}]); 
                                    let aResps = aReqs.map((oItem) => oItem.response); 
                                    aResps.forEach((oItem) => {
                                        if(oItem.headers["sap-message"]) {
                                            let oMessage = JSON.parse(oItem.headers["sap-message"]); 
                                            aMessages = aMessages.concat(this._mapOdataException2Message(oMessage)); 
                                        } else if(oItem.statusCode === "202" || oItem.statusCode === "201" || oItem.statusCode === "200") {
                                            bSuccess = true; 
                                        } else {
                                            aMessages = aMessages.concat(this._mapOdataException2Message(oItem));
                                        }
                                            
                                    });
                                }
                                fnResolve({ "messages": aMessages, "success": bSuccess });

                            } else {
                                fnReject(oResponse.getParameter("response"));
                            }
                            
                        }); 
                    };

                    if(aContexts.length === aItems.length) {
                        fnExec(); 
                    } else {
                        //let sTextId = 
                        this._confirmAction(this.getText("message.delete_not_valid_warning"))
                            .then(fnExec)
                            .catch(fnReject);
                    }
                    
                });
            },

            /**
             * Ação de editar as janelas
             * @private
             */
            _doEdit: function() {   
                return new Promise((fnResolve, fnReject) => {
                    let oModel = this.getModel();
                });
            },

            /**
             * Do call to the backend - OData function
             * @private
             * @returns {Promise} Return Promise for OData read
             */
            _doFunctionCall: function(sFunction, sMethod, oParams, sETag, sExpand) {
                return new Promise((fnResolve, fnReject) => {
                    this.getModel().callFunction(sFunction, {   // function import name
                        method: sMethod,                        // http method
                        //eTag: sETag,
                        headers: {
                          "zif-match": sETag
                        },
                        urlParameters: oParams,                 // function import parameters        
                        expand: sExpand,
                        success: fnResolve, 
                        error: fnReject
                    });

                    //this.getModel().submitChanges();
                });
            },

            /**
             * Ação de salvar modificações nas janelas
             * @private
             */
            _doSave: function() {   
                return new Promise((fnResolve, fnReject) => {
                    let oModel = this.getModel();
                    if(!oModel.hasPendingChanges()) {
                        fnResolve();
                        return;
                    }
                    oModel.submitChanges({
                        success: (oResponse) => {
                            let aMessages = [];
                            let bSuccess = false;
                            if(oResponse && oResponse.__batchResponses) {                                
                                let aResps = (oResponse.__batchResponses
                                    .filter((oItem) => oItem.hasOwnProperty("__changeResponses"))||[{"__changeResponses": [oResponse.__batchResponses[0]]}]); 
                                let oResps; 
                                if(aResps && aResps.length > 0) {
                                    oResps = aResps[0].__changeResponses;
                                } else {
                                    oResps = [];
                                    oResps.push(oResponse.__batchResponses[0]);
                                }
                                oResps.forEach((oItem) => {
                                    if(oItem.headers["sap-message"]) {
                                        let oMessage = JSON.parse(oItem.headers["sap-message"]); 
                                        aMessages = aMessages.concat(this._mapOdataException2Message(oMessage)); 
                                    } else {
                                        bSuccess = true; 
                                    }
                                        
                                });
                            }
                            fnResolve({ "messages": aMessages, "success": bSuccess });
                        },
                        error: fnReject.bind(this)
                    });
                });
            },

            /**
             * Retornar os itens selecionados
             * @private
             * @returns {Promise} Promise com itens marcados
             */
            _getSelectedItems: function() {
                return new Promise((fnResolve, fnReject) => {
                    let aItems = this._oSMTable.getTable().getSelectedItems();
                    if(!aItems || aItems.length === 0) {
                        fnReject(this._createMessageFromText("message.noItemSelected"));
                    } else { fnResolve(aItems); }
                    
                }); 
            }, 
            
            /**
             * Retornar os parametros de URL
             * @private
             * @returns {Array} Parameters on URL
             */
            _getURLParameters: function() {
                let oStartupParameters = 
                    this.getOwnerComponent().getComponentData() && this.getOwnerComponent().getComponentData().startupParameters ?                     
                        this.getOwnerComponent().getComponentData().startupParameters : {};
                
                let aProperties = Object.getOwnPropertyNames(oStartupParameters);
                let oCustomProps = Object.assign({},
                        aProperties.filter((sProp) => sProp === "ScheduleWindowBegDateFilter" ||
                                                      sProp === "ScheduleWindowEndDateFilter" ));
                aProperties = aProperties.filter((sProp) => sProp === "Plant" ||
                                                            sProp === "ScheduleWindowTp" ||
                                                            sProp === "ScheduleDate" ||
                                                            sProp === "ScheduleWindowBeginDatetime" ||
                                                            sProp === "ScheduleWindowEndDatetime" ||
                                                            sProp === "AvailMultiCombobox" ||
                                                            sProp === "ActMultiCombobox" );
                if(!aProperties || !aProperties.length === 0) {
                    return; 
                }

                let oActMultiCombobox   = this.getView().byId("selIsScheduleActive");
                let oAvailMultiCombobox = this.getView().byId("selScheduleAvail");
                let oDPSchedBegDate     = this.getView().byId("dpScheduleWindowBeginDatetime");
                let oDPSchedEndDate     = this.getView().byId("dpScheduleWindowEndDatetime");

                var oFilterData = {};
                aProperties.forEach((sProp) => {
                    var aRanges = [];
                    switch(sProp) {
                        case "ScheduleDate": 
                        case "ScheduleWindowBeginDatetime":
                        case "ScheduleWindowEndDatetime":

                            let oBegDate = null, oEndDate = null;
                            let oFormatOptions = { "pattern": "yyyy-MM-ddTHH:mm:ss.SSS", "UTC": false, "strictParsing": false };
                            let oDateInstance = sap.ui.core.format.DateFormat.getDateInstance(oFormatOptions, null);
                            if(sProp === "ScheduleDate") {  
                                oBegDate = oDateInstance.parse(oStartupParameters[sProp][0].substring(0,23));
                                oEndDate = oDateInstance.parse(oStartupParameters[sProp][0].substring(0,11).concat("23:59:59.000"));
                            } else {                                                                
                                if(sProp === "ScheduleWindowBeginDatetime") {
                                    let sBegDate = oStartupParameters["ScheduleWindowBegDateFilter"] && oStartupParameters["ScheduleWindowBegDateFilter"].length > 0 ? 
                                        oStartupParameters["ScheduleWindowBegDateFilter"][0].substring(0,23) : 
                                        oStartupParameters[sProp][0].substring(0,20);
                                    //oBegDate = new Date(oStartupParameters[sProp][0]);
                                    oBegDate = oDateInstance.parse(sBegDate);
                                }
                                if(sProp === "ScheduleWindowEndDatetime") {
                                    let sEndDate = oStartupParameters["ScheduleWindowEndDateFilter"] && oStartupParameters["ScheduleWindowEndDateFilter"].length > 0 ? 
                                        oStartupParameters["ScheduleWindowEndDateFilter"][0].substring(0,23) : 
                                        oStartupParameters[sProp][0].substring(0,20);
                                    //oEndDate = new Date(oStartupParameters[sProp][0]);
                                    oEndDate = oDateInstance.parse(sEndDate);
                                }
                            }
                            if(oBegDate) {
                                oDPSchedBegDate.setDateValue(oBegDate);
                            }
                            if(oEndDate) {
                                oDPSchedEndDate.setDateValue(oEndDate);
                            }
                            break;
                        case "AvailMultiCombobox": 
                            oStartupParameters[sProp].forEach((sValue) => { 
                                if(sValue) {
                                    aRanges.push(sValue);
                                }     
                            });    
                            oAvailMultiCombobox.setSelectedKeys(aRanges);
                            break;
                        case "ActMultiCombobox": 
                            oStartupParameters[sProp].forEach((sValue) => { 
                                if(sValue) {
                                    aRanges.push(sValue);
                                }   
                            });
                            oActMultiCombobox.setSelectedKeys(aRanges);
                            break;
                        default: 
                            oStartupParameters[sProp].forEach((sValue) => { 
                                aRanges.push({
                                    "exclude": false,
                                    "operation": FilterOperator.EQ,
                                    "keyField": sProp,
                                    "value1": sValue,
                                    "value2": null
                                });
                            });
                            oFilterData[sProp] = {
                                items: [],
                                ranges: aRanges,
                                value: null
                            };
                            break;
                    }
                });
                //this._oSMFilter.attachInitialized((oEvent) => {
                    if(oFilterData) {
                        this._oSMFilter.setFilterData(oFilterData);
                        oFilterData = undefined;
                    }
                //});
            }, 

            _initHashStateHandler: function() {
                let oHashChanger    = sap.ui.core.routing.HashChanger.getInstance();
                let sHash           = oHashChanger.getHash()
                let sAppStateKey    = /(?:sap-iapp-state=)([^&=]+)/.exec(sHash)[1]; 

                if(sAppStateKey) {
                    sap.ushell.Container
                        .getService("CrossApplicationNavigation")
                        .getAppState(sAppStateKey)
                        .done((oSavedAppState) => {
                            let oFilt = this._oSMFilter;
                            oFilt.setDataSuiteFormat(JSON.stringify(oSavedAppState.selectionVariant), true);
                        });
                }
            },

            _initStateHandler: function() {
                let sAppStateKey    = "";
                let sUrl            = window.location.href;
                let iIndx           = sUrl.search('sap-iapp-state');

                if (iIndx > 0) {
                    iIndx = iIndx + 15;
                    sAppStateKey = sUrl.substring(iIndx);
                }

                if (sAppStateKey) {
                    let sUrl1 = "/GlobalContainers('" + sAppStateKey + "')";
                    let oModel = this.getOwnerComponent().getModel('GlobalContainers');
                    var functionSucess = (oData, oController) => {
                        sap.ui.core.BusyIndicator.hide();
                        let oFilt       = this._oSMFilter;
                        let oTable      = this._oSMTable;
                        if(oData.value) {
                            let oAppState   = JSON.parse(oData.value);
                            if(oAppState && oAppState.selectionVariant) {
                                oFilt.setDataSuiteFormat(JSON.stringify(oAppState.selectionVariant), true);
                            }
                            if(oAppState && oAppState.tableVariantId) {
                                oTable.setCurrentVariantId(oAppState.tableVariantId);
                            } 
                        }                       
                    }

                    var functionError = (oError) => {
                        sap.ui.core.BusyIndicator.hide();
                    }

                    sap.ui.core.BusyIndicator.show();
                    let oParams = {
                        success: function(oData, oController) {
                            functionSucess(oData, oController);
                        },
                        error: function(oError) {
                            functionError(oError);
                        }
                    };

                    oModel.read(sUrl1, oParams);
                }
            }

            // onTogglePress: function(oEvent) {
            //      let bEditable = this._oSMTable.getEditable();
            //      let oModel = this.getModel();
            //     // return false;
            //     //oEvent.reset();
            // }
        });
    });
