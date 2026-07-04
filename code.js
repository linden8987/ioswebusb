/**
 * code.js
 * 
 * This is the exact code fetched from the remote URL. It overrides 
 * the browser's global WebUSB API and pipes everything into the 
 * iOS custom bridge handler.
 */
(function() {
    // Verify the execution environment is inside our custom iOS App Container
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iosUSBBridge) {
        
        // Setup global callback container for asynchronous native-to-JS communication
        window.iosUSBCallbacks = window.iosUSBCallbacks || {};

        // Native pipeline resolution hook called from Swift when operations succeed
        window.iosUSBBridgeResolve = function(id, data) {
            if (window.iosUSBCallbacks[id]) {
                window.iosUSBCallbacks[id].resolve(data);
                delete window.iosUSBCallbacks[id];
            }
        };

        // Native pipeline rejection hook called from Swift when hardware fails or disconnects
        window.iosUSBBridgeReject = function(id, error) {
            if (window.iosUSBCallbacks[id]) {
                window.iosUSBCallbacks[id].reject(new Error(error));
                delete window.iosUSBCallbacks[id];
            }
        };

        /**
         * Mock USBDevice Object
         * Implements the standard W3C WebUSB interface spec so generic 
         * web applications can run their native methods without throwing errors.
         */
        class MockUSBDevice {
            constructor(nativeMeta) {
                this.productName = nativeMeta.productName || "iOS Connected USB Device";
                this.vendorId = nativeMeta.vendorId || 0x1234;
                this.productId = nativeMeta.productId || 0xabcd;
                this.opened = true;
            }

            async open() {
                return Promise.resolve();
            }

            async selectConfiguration(num) {
                return Promise.resolve();
            }

            async claimInterface(num) {
                return Promise.resolve();
            }

            /**
             * Intercepts standard outbound binary streams and translates them to text strings for Swift.
             */
            async transferOut(endpoint, data) {
                const decoder = new TextDecoder();
                const payloadText = decoder.decode(data);
                
                return new Promise((resolve, reject) => {
                    const callbackId = Math.random().toString(36).substring(2);
                    window.iosUSBCallbacks[callbackId] = {
                        resolve: (response) => {
                            resolve({ status: "ok", bytesWritten: data.byteLength });
                        },
                        reject
                    };
                    
                    window.webkit.messageHandlers.iosUSBBridge.postMessage({
                        action: "write",
                        callbackId: callbackId,
                        endpoint: endpoint,
                        data: payloadText
                    });
                });
            }

            /**
             * Intercepts standard inbound hardware requests and turns the text response back into a binary DataView.
             */
            async transferIn(endpoint, length) {
                return new Promise((resolve, reject) => {
                    const callbackId = Math.random().toString(36).substring(2);
                    window.iosUSBCallbacks[callbackId] = {
                        resolve: (response) => {
                            const encoder = new TextEncoder();
                            const view = encoder.encode(response);
                            resolve({ status: "ok", data: new DataView(view.buffer) });
                        },
                        reject
                    };
                    
                    window.webkit.messageHandlers.iosUSBBridge.postMessage({
                        action: "read",
                        callbackId: callbackId,
                        endpoint: endpoint,
                        length: length
                    });
                });
            }
        }

        /**
         * Custom Navigator.USB Interface Implementation
         */
        const customUSB = {
            requestDevice: function(options) {
                return new Promise((resolve, reject) => {
                    const callbackId = Math.random().toString(36).substring(2);
                    window.iosUSBCallbacks[callbackId] = {
                        resolve: (deviceMeta) => {
                            resolve(new MockUSBDevice(deviceMeta));
                        },
                        reject
                    };
                    
                    window.webkit.messageHandlers.iosUSBBridge.postMessage({
                        action: "requestDevice",
                        callbackId: callbackId,
                        options: options
                    });
                });
            },
            
            getDevices: function() {
                return Promise.resolve([]);
            }
        };

        // Overwrite the restricted property on navigator with our polyfill architecture
        Object.defineProperty(navigator, "usb", {
            value: customUSB,
            writable: true,
            configurable: true
        });

        console.log("WebUSB iOS Polyfill Core System Fully Activated.");
    } else {
        console.error("WebUSB Native Bridge Initialization Error: Native host context not found.");
    }
})();
