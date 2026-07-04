/**
 * code.js - Real WebUSB iOS Bridge Polyfill
 * Overrides native browser layout and wires it directly to iOS CoreUSB hardware handles.
 */
(function() {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iosUSBBridge) {
        
        window.iosUSBCallbacks = window.iosUSBCallbacks || {};

        // Helper utilities to map binary objects across the text-based iOS script bridge
        const ArrayBufferToBase64 = (buffer) => {
            let binary = '';
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return window.btoa(binary);
        };

        const Base64ToArrayBuffer = (base64) => {
            const binaryString = window.atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        };

        // Bridge routing resolution execution targets called straight from Swift
        window.iosUSBBridgeResolve = function(id, data) {
            if (window.iosUSBCallbacks[id]) {
                window.iosUSBCallbacks[id].resolve(data);
                delete window.iosUSBCallbacks[id];
            }
        };

        window.iosUSBBridgeReject = function(id, error) {
            if (window.iosUSBCallbacks[id]) {
                window.iosUSBCallbacks[id].reject(new Error(error));
                delete window.iosUSBCallbacks[id];
            }
        };

        /**
         * Real USBDevice Wrapper Implementation
         */
        class RealUSBDevice {
            constructor(deviceMeta) {
                this.productName = deviceMeta.productName || "USB Accessory";
                this.vendorId = deviceMeta.vendorId;
                this.productId = deviceMeta.productId;
                this.opened = deviceMeta.opened || false;
            }

            async open() {
                return new Promise((resolve, reject) => {
                    const callbackId = Math.random().toString(36).substring(2);
                    window.iosUSBCallbacks[callbackId] = {
                        resolve: () => { this.opened = true; resolve(); },
                        reject
                    };
                    window.webkit.messageHandlers.iosUSBBridge.postMessage({
                        action: "open",
                        callbackId: callbackId
                    });
                });
            }

            async selectConfiguration(configurationValue) {
                return new Promise((resolve, reject) => {
                    const callbackId = Math.random().toString(36).substring(2);
                    window.iosUSBCallbacks[callbackId] = { resolve, reject };
                    window.webkit.messageHandlers.iosUSBBridge.postMessage({
                        action: "selectConfiguration",
                        callbackId: callbackId,
                        configurationValue: configurationValue
                    });
                });
            }

            async claimInterface(interfaceNumber) {
                return new Promise((resolve, reject) => {
                    const callbackId = Math.random().toString(36).substring(2);
                    window.iosUSBCallbacks[callbackId] = { resolve, reject };
                    window.webkit.messageHandlers.iosUSBBridge.postMessage({
                        action: "claimInterface",
                        callbackId: callbackId,
                        interfaceNumber: interfaceNumber
                    });
                });
            }

            async transferOut(endpointNumber, data) {
                // Extract raw buffer from DataView or ArrayBuffer input
                const rawBuffer = data.buffer ? data.buffer : data;
                const base64Payload = ArrayBufferToBase64(rawBuffer);

                return new Promise((resolve, reject) => {
                    const callbackId = Math.random().toString(36).substring(2);
                    window.iosUSBCallbacks[callbackId] = {
                        resolve: (bytesWritten) => {
                            resolve({ status: "ok", bytesWritten: bytesWritten || data.byteLength });
                        },
                        reject
                    };
                    window.webkit.messageHandlers.iosUSBBridge.postMessage({
                        action: "transferOut",
                        callbackId: callbackId,
                        endpointNumber: endpointNumber,
                        data: base64Payload
                    });
                });
            }

            async transferIn(endpointNumber, length) {
                return new Promise((resolve, reject) => {
                    const callbackId = Math.random().toString(36).substring(2);
                    window.iosUSBCallbacks[callbackId] = {
                        resolve: (base64Response) => {
                            const buffer = Base64ToArrayBuffer(base64Response);
                            resolve({ status: "ok", data: new DataView(buffer) });
                        },
                        reject
                    };
                    window.webkit.messageHandlers.iosUSBBridge.postMessage({
                        action: "transferIn",
                        callbackId: callbackId,
                        endpointNumber: endpointNumber,
                        length: length
                    });
                });
            }
        }

        const customUSB = {
            requestDevice: function(options) {
                return new Promise((resolve, reject) => {
                    const callbackId = Math.random().toString(36).substring(2);
                    window.iosUSBCallbacks[callbackId] = {
                        resolve: (deviceMeta) => { resolve(new RealUSBDevice(deviceMeta)); },
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
                return new Promise((resolve, reject) => {
                    const callbackId = Math.random().toString(36).substring(2);
                    window.iosUSBCallbacks[callbackId] = {
                        resolve: (deviceList) => {
                            resolve(deviceList.map(dev => new RealUSBDevice(dev)));
                        },
                        reject
                    };
                    window.webkit.messageHandlers.iosUSBBridge.postMessage({
                        action: "getDevices",
                        callbackId: callbackId
                    });
                });
            }
        };

        Object.defineProperty(navigator, "usb", {
            value: customUSB,
            writable: true,
            configurable: true
        });

        console.log("WebUSB Real iOS Bridge System Initialized.");
    }
})();
