// ==UserScript==
// @name         Boosty.to Link Copy
// @namespace    http://tampermonkey.net/
// @version      2024-06-08
// @description  Copies the URL with auth token appended when pressing CTRL+Q
// @author       ImoutoChan
// @match        *://*.boosty.to/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=boosty.to
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.keyCode === 81) {
            // Copy current URL
            const currentUrl = window.location.href;

            // Get the "auth" cookie
            const authCookie = document.cookie.split('; ').find(row => row.startsWith('auth='));

            if (authCookie) {
                // Parse the cookie value
                const authValue = decodeURIComponent(authCookie.split('=')[1]);
                const authJson = JSON.parse(authValue);

                // Extract the access token
                const accessToken = authJson.accessToken;

                // Append the access token to the URL as a query parameter
                const newUrl = new URL(currentUrl);
                newUrl.searchParams.set('auth', accessToken);

                // Copy the new URL to the clipboard
                GM_setClipboard(newUrl.toString());

                // Notify the user
                showNotification('URL with auth token copied to clipboard!');
            } else {
                showNotification('Auth cookie not found!');
            }
        }
    });

    function showNotification(message) {
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.bottom = '50%';
        notification.style.right = '50%';
        notification.style.transform = 'translate(50%, 50%)';
        notification.style.padding = '10px';
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        notification.style.color = 'white';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '2147483647'; // максимальный z-index
        notification.style.fontSize = '14px';
        notification.innerText = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }
})();
