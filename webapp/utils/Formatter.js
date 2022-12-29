sap.ui.define([
], function () {
	"use strict";
    
	return {
		
		/**
		 * Returns formatted message type
		 *
		 * @public
		 * @param {string} sMessageType Message Type
		 * @returns {sap.ui.core.MessageType} Formatted Message Type
		 */
		fnFormatMsgType : function(sMessageType) {
			var sMsgType;
			switch(sMessageType) {
				case "S": 
					sMsgType = sap.ui.core.MessageType.Success;
					break;
				case "I":
					sMsgType = sap.ui.core.MessageType.Information;
					break;
				case "W": 
					sMsgType = sap.ui.core.MessageType.Warning; 
					break;
				default:
					sMsgType = sap.ui.core.MessageType.Error;
					break;
			}
			return sMsgType;
        }, 

		/**
		 * Returns formatted NF
		 *
		 * @public
		 * @param {string} sNFNumber NF Number
		 * @param {string} sSeries NF Series
		 * @returns {sap.ui.core.MessageType} Formatted NF
		 */
		formatNF: function(sNFNumber, sSeries) {
			return !sNFNumber ? "" : !sSeries ? sNFNumber : 
				`${sNFNumber}-${sSeries}`; 
		}
	};
});