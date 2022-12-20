sap.ui.define([
    "com/eldorado/sap/eblog/schedulewindow/controller/BaseController", 
    "com/eldorado/sap/eblog/schedulewindow/model/MessageHandler",
    "com/eldorado/sap/eblog/schedulewindow/model/models",  
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator", 
    "sap/m/MessageBox"
],
    /**
     * @param {object} BaseController
     * @param {object} MessageHandler
     * @param {object} models
     * @param {sap.ui.model.Filter} Filter
     * @param {sap.ui.model.FilterOperator} FilterOperator
     * @param {sap.m.MessageBox} MessageBox
     */
    function (BaseController, MessageHandler, models, Filter, FilterOperator, MessageBox) {
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

                this._oSMTable = this.getView().byId("smTable");

                this.setModel(
                    models.createViewModel({
                        "data": { 
                            "editable": false
                        }
                    }), "view");
            },

            /**
             * Exit event for view
             * @public
             * @override
             */
             onExit: function() {                
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
                    .then((aMessages) => {
                        if(!aMessages) { aMessages = [] }
                        aMessages.push({ Type: "S", Message: this.getText("message.activation_processed") });
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
                mBindingParams.parameters["expand"] = "toSchedule,toPlant";

                let oMultiCombobox  = this.getView().byId("selIsScheduleActive");
                let oDPSchedBegDate = this.getView().byId("dpScheduleWindowBeginDatetime");
                let oDPSchedEndDate = this.getView().byId("dpScheduleWindowEndDatetime");

                let aFilters = (mBindingParams["filters"] || []);
                aFilters.push(new Filter("IsDeleted", FilterOperator.EQ, false)); 
                
                if(oMultiCombobox && oMultiCombobox.getSelectedKeys()) {
                    let aStatusFilter = [];
                    oMultiCombobox.getSelectedKeys().forEach((oItem) => {
                        aStatusFilter.push(new Filter("IsScheduleActive", FilterOperator.EQ, oItem));
                    });
                    if(aStatusFilter.length > 0) {
                        aFilters.push(new Filter({ filters: aStatusFilter, and: false })); 
                    }
                }   
                
                let oBegDate, oEndDate;
                if(oDPSchedBegDate && oDPSchedBegDate.getDateValue()) {
                    oBegDate = oDPSchedBegDate.getDateValue();
                }

                if(oDPSchedEndDate && oDPSchedEndDate.getDateValue()) {
                    oEndDate = oDPSchedEndDate.getDateValue();
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
                    .then((aMessages) => {
                        if(!aMessages) { aMessages = [] }
                        aMessages.push({ Type: "S", Message: this.getText("message.deletion_processed") });
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
                    .then((aMessages) => {
                        if(!aMessages) { aMessages = [] }
                        aMessages.push({ Type: "S", Message: this.getText("message.inactivation_processed") });
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
             * Ação de salvar as janelas
             * @public
             * @param {sap.ui.base.EventProvider} oEvent Evento do botão
             */
            onSave: function(oEvent) {
                this.getModel("view").setProperty("/data/editable", false);
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
                            this._doFunctionCall("/ActivationChange", "POST", oParams, "toSchedule,toPlant");
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
                                fnResolve();
                            } else {
                                fnReject(oResponse);
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
                            this._doFunctionCall("/DeleteScheduleWindow", "POST", oParams, "toSchedule,toPlant");
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
                                fnResolve();
                            } else {
                                fnReject(oResponse);
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
            _doFunctionCall: function(sFunction, sMethod, oParams, sExpand) {
                return new Promise((fnResolve, fnReject) => {
                    this.getModel().callFunction(sFunction, {   // function import name
                        method: sMethod,                        // http method
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


            // onTogglePress: function(oEvent) {
            //      let bEditable = this._oSMTable.getEditable();
            //      let oModel = this.getModel();
            //     // return false;
            //     //oEvent.reset();
            // }
        });
    });
