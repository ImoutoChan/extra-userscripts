// ==UserScript==
// @name         Vk Wheel Photo Scroll
// @version      1.0
// @author       ImoutoChan
// @match        https://vk.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    window.addEventListener("wheel", function(e) {
        if (event.deltaY >= 0) {
            cur.pvClicked = true; Photoview.show(false, cur.pvIndex + 1, event);
        }
        else {
            cur.pvClicked = true; Photoview.show(false, cur.pvIndex - 1, event);
        }
    });
})();
