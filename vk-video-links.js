// ==UserScript==
// @name         Vk Video Download
// @version      1.0
// @description  Try download vidosiki
// @author       ImoutoChan
// @match        https://vk.com/*
// @grant        none
// ==/UserScript==

(function () {
'use strict';

class Injection {
    constructor () {
        // TODO: Check is demon ready
        this.extensionId = window.vkfExtensionId;

        this.modules = {};
        this.cache = {};
        this.observer = null;

        this.hooks = {
            addedNodes: [],
            removedNodes: [],
            onSidebarChanged: [],
            onLocationChanged: []
        };

        this.hideStyles = [
            'opacity: 0 !important;',
            'position: fixed !important;',
            'z-index: -5 !important;',
            'height: 0 !important;',
            'width: 0 !important;',
            'max-height: 0 !important;',
            'max-width: 0 !important;',
            'overflow: hidden !important;',
            'left: -99999px !important;',
            'top: -99999px !important;',
            'display: block !important;'
        ].join(' ');

        this.loadModules();
        this.initObserver();

        this.initStyles();
    }

    getType (target) {
        return Object.prototype.toString.call(target).toLowerCase().match(/^\[\w+\s(\w+)\]$/)[1];
    }

    isObj (target) {
        return this.getType(target) === 'object';
    }

    initObserver () {
        this.subscribe({
            name: 'injection',
            events: {
                addedNodes: { callback: this.onAddNode, context: this },
            }
        });

        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                [ 'addedNodes', 'removedNodes' ].forEach((eventType) => {
                    mutation[eventType].forEach((node) => {
                        if (/^html.*element$/.test(this.getType(node)) && !node.vkfSkip) {
                            this.triggerEvent(eventType, node, mutation);
                        }
                    });
                });
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.checkLocation();

        this.triggerEvent('addedNodes', document.body, {});
    }

    checkLocation () {
        if (window.location.href !== this.cache.lastLocationHref) {
            this.cache.lastLocationHref = window.location.href;
            this.triggerEvent('onLocationChanged', Object.assign({}, window.location));
        }

        requestAnimationFrame(() => this.checkLocation());
    }

    subscribe (options) {
        for (let eventType in options.events) {
            this.hooks[eventType].push({
                name: options.name,
                callback: options.events[eventType].callback,
                context: options.events[eventType].context
            });
        }
    }

    onAddNode (node, mutation) {
        let sidebar = node.id == 'side_bar' ? node : node.querySelector('#side_bar');

        if (sidebar && sidebar !== this.cache.sidebar) {
            this.cache.sidebar = sidebar;
            this.triggerEvent('onSidebarChanged', sidebar);
        }
    }

    triggerEvent (eventType, ...handlerArgs) {
        this.hooks[eventType].forEach((hook) => {
            hook.callback.call(hook.context, ...handlerArgs);
        });
    }

    triggerDomEvent (target, eventType) {
        target.dispatchEvent(new Event(eventType));
    }

    loadModules () {
        this.modules.videoProcessor = new VideoProcessor(this);

        // Force redraw
        requestAnimationFrame(() => this.triggerDomEvent(window, 'scroll'));
    }

    clearFileTitle (title) {
        let htmlFilter = document.createElement('div');
        htmlFilter.innerHTML = title;
        return htmlFilter.innerText.replace(/[\\\/:\*\?"<>\|]/g, '').trim().replace(/\s+/g, ' ');
    }

    formatSize (bytes) {
        let size = '';

        if (bytes < 1000) {
            size = bytes + ' ' + 'b';
        } else if (bytes < 943718) {
            size = (Math.round(bytes / 1024 * 10) / 10).toFixed(1) + ' ' + 'kb';
        } else if (bytes < 966367642) {
            size = (Math.round(bytes / 1048576 * 10) / 10).toFixed(1) + ' ' + 'mb';
        } else {
            size = (Math.round(bytes / 1073741824 * 10) / 10).toFixed(2) + ' ' + 'gb';
        }

        return size;
    }

    bindEventHandler (target, eventFullName, handler, context) {
        let handlerWrap = (event) => {
            if (handler.call(context, event, target) === false) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        let [ eventName, eventNamespace ] = eventFullName.split('.');

        // Link handler with node for future unbind
        if (eventNamespace) {
            !target.vkfEventsMap && (target.vkfEventsMap = {});
            target.vkfEventsMap[eventFullName] = handlerWrap;
        }

        return target.addEventListener(eventName, handlerWrap, false);
    }

    unbindEventHandler (target, eventFullName) {
        let [ eventName, eventNamespace ] = eventFullName.split('.');

        if (!eventNamespace) {
            this.warn('unbindEventHandler: only events with namespace can be unbinded');
            return;
        }

        let handler = (target.vkfEventsMap || {})[eventFullName];
        handler && target.removeEventListener(eventName, handler, false);
    }

    downloadFile (e, target) {
        e.stopPropagation();

        switch (e.type) {
            case 'click':
                e.preventDefault();

                if (target.href) {
                   this.download({
                        href: target.href,
                        download: target.download || ''
                    });
                }

                break;

            case 'dragstart':
                if (target.tagName.toLowerCase() != 'a') {
                    target = target.querySelector('a');
                }

                if (target && target.href) {
                    let mimeType = target.dataset.type,
                        filename = target.download || target.href.split('/').pop();

                    if (mimeType) {
                        e.dataTransfer.setData('DownloadURL', `${mimeType}:${filename}:${target.href}`);
                    }
                }

                break;
        }
    }

    inArray (item, array) {
        return array.indexOf(item) !== -1;
    }

    createNode (model, parent) {
        let node;

        if (model.tag) {
            node = document.createElement(model.tag);
            delete model.tag;

            for (let key in model) {
                let val = model[key];

                if (this.inArray(key, ['href', 'id', 'innerHTML', 'innerText'])) {
                    node[key] = val;
                } else if (key == 'class') {
                    node.className = Array.isArray(val) ? val.join(' ') : val;
                } else if (key == 'child') {
                    val = Array.isArray(val) ? val : [val];
                    val.forEach((childModel) => this.createNode(childModel, node));
                } else if (key == 'data') {
                    for (let dataKey in val) {
                        node.dataset[dataKey] = val[dataKey];
                    }
                } else if (key == 'events') {
                    val.forEach((eventOptions) => this.bindEventHandler(node, ...eventOptions));
                } else {
                    node.setAttribute(key, val);
                }
            }

            node.vkfSkip = true;
        } else if ('text' in model) {
            node = document.createTextNode(model.text);
        }

        parent && parent.appendChild(node);

        return node;
    };

    prependNode (parentNode, childNode) {
        parentNode = this.isObj(parentNode) ? this.createNode(parentNode) : parentNode;
        childNode = this.isObj(childNode) ? this.createNode(childNode) : childNode;
        parentNode.insertBefore(childNode, parentNode.firstChild);
    }

    inputSelectAll (input) {
        input.setSelectionRange(0, input.value.length);
    }

    makeNodeInvisible (node) {
        node.removeAttribute('style');
        node.dataset.invisibleNode = 'true';
    }

    get_file_size (link, callback, timeout) {
        return 3;

        if (link) {
            $.ajax({
                url: link,
                type: 'HEAD',
                timeout: (timeout || 30) * 1000
            }).success(function (data, status, xhrObj) {
                var size = xhrObj.getResponseHeader('Content-Length');
                if (size !== null) {
                    size = parseInt(size, 10);
                    if (isNaN(size)) {
                        size = null;
                    }
                }
                callback(size);
            }).error(function (xhrObj) {
                // C.error('Get file size error:', link.split('/').pop(), xhrObj.status, xhrObj.statusText);
                callback(null);
            });
        } else {
            // C.error('[Size] Link is not defined.');
            callback(null);
        }
    };

    download (options) {
        let anchor = document.createElement('a');
        anchor.href = options.href;
        options.download && (anchor.download = options.download);
        anchor.click();
    };

    initStyles() {
        this.addGlobalStyle(`
#video-download-wrap {
    position: absolute;
    left: 0px;
    padding-left: 20px;
    transform: translateX(100%);
    user-select: none;
    box-sizing: border-box;
    z-index: 100;
}

#video-download-wrap.animate > div {
    opacity: 1;
    transform: translateX(0px);
}

#video-download-wrap > div {
    white-space: nowrap;
    float: left;
    clear: both;
    background-color: rgba(0, 0, 0, 0.4);
    width: 100%;
    opacity: 0;
    transform: translateX(-20px);
    border-radius: 4px;
    transition: transform 0.15s ease-out 0s, opacity 0.15s ease-out 0s;
    margin-top: 5px;
}

#video-download-wrap > div > a {
    opacity: 0.6;
    display: block;
    color: rgb(255, 255, 255);
    font-size: 16px;
    text-decoration: none;
    padding: 8px 15px 8px 36px;
    background: url(https://img.icons8.com/material-outlined/100/000000/download.png) 12px center no-repeat;
    transition: opacity 0.15s ease-out 0s;
}
                            `);
    }

    addGlobalStyle(css) {
        var head, style;
        head = document.getElementsByTagName('head')[0];
        if (!head) { return; }
        style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css.replace(/;/g, ' !important;');
        head.appendChild(style);
    }
}

class VideoProcessor {
    static get QUALITIES () {
        return [ 240, 360, 480, 720, 1080 ];
    }

    constructor (app) {
        this.app = app;

        this.videoId = null;
        this.videoWrap = null;
        this.prevVideoId = null;
        this.linksNode = null;
        this.layerNode = null;

        this.app.subscribe({
            name: 'videoProcessor',
            events: {
                onLocationChanged: {
                    callback: this.onLocationChanged,
                    context: this
                }
            }
        });
    }

    extractVideoExtension (url, defaultValue = '.mp4') {
        return (url.match(/^.*(\.\w+)(?:\?.*)?$/) || [ null, defaultValue ])[1];
    }

    extractVideoQuality (url, defaultValue = 720) {
        return Number((url.match(/^.*\.(\d+)\.\w+(?:\?.*)?$/) || [ null, defaultValue ])[1]);
    }

    onLocationChanged (location) {
        let videoIdMatch = location.href.match(/(?:\/|=)video(\-?\d+_\d+)/);

        this.videoWrap = null;

        if (this.linksNode) {
            this.linksNode.remove();
            this.linksNode = null;
        }

        if (this.layerNode) {
            this.app.unbindEventHandler(this.layerNode, 'scroll.layerScroll');
            this.layerNode = null;
        }

        if (videoIdMatch) {
            this.prevVideoId = this.videoId || null;
            this.videoId = videoIdMatch[1];
            setTimeout(() => this.findVideoBoxWrap(), 0); // fork
        } else {
            this.prevVideoId = null;
            this.videoId = null;
        }
    }

    findVideoBoxWrap () {
        if (!this.videoId) {
            return;
        }

        let videoWrap = document.querySelector('.video_box_wrap'),
            videoWrapId = videoWrap && videoWrap.id || '';

        if (videoWrap && (!this.prevVideoId || this.prevVideoId && videoWrapId.indexOf(this.prevVideoId) === -1)) {
            if (videoWrapId.indexOf(this.videoId) !== -1) {
                this.videoWrap = videoWrap;
                this.findVideoVars();
            }
        } else {
            if (!document.querySelector('.mv_video_unavailable_message_wrap')) { // !claimed
                setTimeout(() => this.findVideoBoxWrap(), 50);
            }
        }
    }

    findVideoVars () {
        if (!this.videoId) {
            return;
        }

        let videoVars = null;

        try { videoVars = mvcur.player.getVars(); } catch (e) {}

        if (videoVars && this.videoId == ((videoVars.oid || '') + '_' + (videoVars.vid || ''))) {
            this.processVideoVars(videoVars);
        } else {
            setTimeout(() => this.findVideoVars(), 50);
        }
    }

    processVideoVars (videoVars) {
        if (!this.videoId) {
            return;
        }

        let qualities = [];

        let title =
            this.app.clearFileTitle(
                videoVars.md_title ||
                this.videoWrap.closest('#mv_box').querySelector('#mv_title').innerText ||
                'Untitled'
            );

        VideoProcessor.QUALITIES.forEach((quality) => {
            let url = videoVars['url' + quality] || videoVars['cache' + quality];

            if (url) {
                qualities.push({
                    quality: quality,
                    filename: title + this.extractVideoExtension(url),
                    url: url,
                    size: null
                });
            }
        });

        if (!qualities.length && videoVars.postlive_mp4) {
            let url = videoVars.postlive_mp4;

            qualities.push({
                quality: this.extractVideoQuality(url),
                filename: title + this.extractVideoExtension(url),
                url: url,
                size: null
            });
        }

        if (qualities.length) {
            let playerNode = this.videoWrap.closest('#mv_main');

            if (false) {
                let requestCount = qualities.length;

                qualities.forEach((quality) => {
                    this.app.get_file_size(quality.url,
                        (size) => {
                            quality.size = size;
                            if (!--requestCount) {
                                this.showVideoLinks(playerNode, qualities);
                            }
                        }
                    );
                });
            } else {
                this.showVideoLinks(playerNode, qualities);
            }
        }
    }

    showVideoLinks (playerNode, qualities) {
        if (!this.videoId) {
            return;
        }

        let linksModel = {
            tag: 'div',
            id: 'video-download-wrap',
            child: []
        };

        qualities.forEach((quality) => {
            let linkModel = {
                tag: 'div',
                draggable: 'true',
                events: [ [ 'dragstart', this.app.downloadFile, this.app ] ],
                child: {
                    tag: 'a',
                    draggable: 'false',
                    href: quality.url,
                    download: quality.filename,
                    data: { type: 'video/mpeg' },
                    events: [ [ 'click', this.app.downloadFile, this.app ] ],
                    child: [
                        {
                            text: quality.quality + 'p'
                        }
                    ]
                }
            };

            if (false && quality.size !== null) {
                linkModel.child.child.push({
                    tag: 'span',
                    innerHTML: this.app.formatSize(quality.size)
                });
            }

            linksModel.child.push(linkModel);
        });

        this.linksNode = this.app.createNode(linksModel);

        playerNode.appendChild(this.linksNode);

        requestAnimationFrame(() => {
            this.linksNode.classList.add('animate');

            let linksNodeRect = this.linksNode.getBoundingClientRect();
            this.linksNode.style.width = linksNodeRect.width + 'px';
            this.linksNode.style.height = linksNodeRect.height + 'px';
        });

        // -------------------

        this.layerNode = playerNode.closest('#mv_layer_wrap');

        this.app.bindEventHandler(this.layerNode, 'scroll.layerScroll', (e) => {
            let playerNodeRect = playerNode.getBoundingClientRect();

            if (playerNodeRect.top <= 0) {
                if (!this.linksNode.classList.contains('sticky')) {
                    let linksNodeRect = this.linksNode.getBoundingClientRect();
                    this.linksNode.style.width = linksNodeRect.width + 'px';
                    this.linksNode.style.top = linksNodeRect.top + 'px';
                    this.linksNode.style.left = playerNodeRect.right + 'px';
                    this.linksNode.classList.add('sticky');
                }
            } else {
                if (this.linksNode.classList.contains('sticky')) {
                    this.linksNode.classList.remove('sticky');
                    this.linksNode.style.top = '';
                    this.linksNode.style.left = '';
                }
            }
        }, this);
    }
}

window.inject = new Injection();

})();
