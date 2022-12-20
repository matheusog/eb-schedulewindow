/*global QUnit*/

sap.ui.define([
	"comeldoradosapeblog/schedulewindow/controller/S0_App.controller"
], function (Controller) {
	"use strict";

	QUnit.module("S0_App Controller");

	QUnit.test("I should test the S0_App controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
