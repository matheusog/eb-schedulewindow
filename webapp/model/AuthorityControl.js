sap.ui.define([
	"sap/ui/base/ManagedObject"
], function(ManagedObject) {
	"use strict";
    
    var mModel = undefined; 
    var mInstance = undefined;

    function getMethods() {
        
        /**
         * Do authority check call
         * @private
         * @returns {Promise}
         */
        function _fnApplyAuth2Model(aAuths) {
            let oAuthority = {};
            aAuths
                .filter((oAuth) => oAuth.Process === "SCHED_WNDW" )
                .forEach((oAuth) => {
                    oAuthority[oAuth.Activity] = oAuth.Success
                });
            return oAuthority;
        }
        
        /**
         * Do authority check call
         * @private
         * @returns {Promise}
         */
        function _fnInitAuthority() {
            return new Promise((fnResolve, fnReject) => {
                mModel.callFunction("/AuthorityCheck", {    // function import name
                    method: "GET",                          // http method
                    urlParameters: null,                    // function import parameters        
                    expand: null,
                    success: (oData, oResponse) => { 
                        fnResolve(_fnApplyAuth2Model(oData.results));
                    },
                    error: fnReject
                });
            });
        }

        return {
            _initAuthority: _fnInitAuthority
        };
    }

	return ManagedObject.extend("com.eldorado.sap.eblog.schedulewindow.model.AuthorityControl", {
        

        /**
         * @override
         * @param {any} oModel OData Model to authority check
         * @returns {sap.ui.base.ManagedObject}
         */
        constructor: function(oModel) {
            //ManagedObject.prototype.constructor.apply(this, arguments);
            mInstance = $.extend(this, getMethods());
            
            mModel = oModel;
        
            return mInstance;
        }, 

        initializeAuthority: function() {
            return this._initAuthority();
        }
	});
});