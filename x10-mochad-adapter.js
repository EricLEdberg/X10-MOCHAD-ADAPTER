
'use strict';

const {
    Action,     // Action base class
    Adapter,    // Adapter base class
    Constants,  // Constants used throughout the package
    Database,   // Class for interacting with the gateway's settings database
    Deferred,   // Wrapper for a promise, primarily used internally
    Device,     // Device base class
    Event,      // Event base class
    Property,   // Property base class
    Utils,      // Utility functions
} = require('gateway-addon');

// Use Exec to execute commands
const {exec} = require('child_process');

var bDebug               = false;

// Build & execute Mochad commands when Device Actions are triggered
var clsMOCHAD            = require('./clsMOCHAD.js');
let objMOCHAD            = new clsMOCHAD;
objMOCHAD.Event          = Event;          // when child cmd completes it creates a success/err Event to notify X10Device
objMOCHAD.MochadWaitTime = "5";

// Command queue must be global across all X10 Devices to enforce sequential execution
var ChildProcessCommandQueue = new Array();

const manifest = require('./manifest.json');

// -------------------------------------------------------
// -------------------------------------------------------
const STATUS_PROP_MAP = {
    'ON':       { prop: 'on', value: true  },
    'OFF':      { prop: 'on', value: false },
    'DIM':      { prop: 'level', value: -1 },
    'BRIGHT':   { prop: 'level', value: 1 }
};


function bool() {
    return {
        name: 'on',
        value: false,
        metadata: {
            '@type': 'BooleanProperty',
            type: 'boolean'
        }
    }
}


function on() {
    return {
        name: 'on',
        value: false,
        metadata: {
            '@type': 'OnOffProperty',
            label: 'On/Off',
            type: 'boolean'
        }
    }
}


function brightness() {
    return {
        name: 'level',
        value: 100,
        metadata: {
            '@type': 'BrightnessProperty',
            label: 'Brightness',
            type: 'number',
            unit: 'percent'
        }
    }
}


function level() {
    return {
        name: 'level',
        value: 100,
        metadata: {
            '@type': 'LevelProperty',
            label: 'Level',
            type: 'number',
            unit: 'percent'
        }
    }
}


const x10LampModule = {
    name: 'Lamp Module',
    '@type': ['OnOffSwitch', 'Light'],
    type: 'dimmableLight',
    properties: [
        on(),
        brightness()
    ]
};


const x10ApplianceModule = {
    name: 'Appliance Module',
    '@type': ['OnOffSwitch', 'Light'],
    type: 'onOffLight',
    properties: [
        on()
    ]
};


const x10OnOffSwitch = {
    name: 'On/Off Switch',
    '@type': ['OnOffSwitch'],
    type: 'onOffSwitch',
    properties: [
        on()
    ]
};


const x10DimmerSwitch = {
    name: 'Dimmer Switch',
    '@type': ['OnOffSwitch', 'MultiLevelSwitch'],
    type: 'multiLevelSwitch',
    properties: [
        on(),
        level()
    ]
};


const x10OnOffSensor = {
    name: 'On/Off Sensor',
    '@type': ['BinarySensor'],
    type: 'binarySensor',
    properties: [
        bool()
    ]
};



const X10_DEVICE_TYPES = {
    'Lamp Module': x10LampModule,
    'Appliance Module': x10ApplianceModule,
    'On/Off Switch': x10OnOffSwitch,
    'Dimmer Switch': x10DimmerSwitch,
    'On/Off Sensor': x10OnOffSensor
};



// -------------------------------------------------------
// -------------------------------------------------------
class X10Property extends Property {
    
    constructor(device, name, descr, value) {
        super(device, name, descr);
        this.setCachedValue(value);

        if(this.name === 'level') {
            this.adjust = {
                'oldLevel': value,
                'func': 'bright',
                'amount': 0
            }
        }
    }

    setValue(value) {
        if(this.name === 'level') {
            var percentDiff = Math.abs(value - this.adjust.oldLevel);
            this.adjust.amount = Math.round(percentDiff / 100 * 22);    // The maximum value is 22

            if(value >= this.adjust.oldLevel) {
                this.adjust.func = 'bright';
            }
            else {
                this.adjust.func = 'dim';
            }

            this.adjust.oldLevel = value;
        }

        return new Promise(resolve => {
            this.setCachedValue(value);
            resolve(this.value);
            this.device.notifyPropertyChanged(this);
        });
    }
}

// -------------------------------------------------------
// -------------------------------------------------------
class X10Adapter extends Adapter {
    
    constructor(addonManager, config) {
        
        // Call Adapter Constructor() to instanciate this Adapter
        super(addonManager, 'x10-unknown', manifest.id);

        this.configuredModules = config.modules;

        // Initialize variable that MOCHAD will need to execute commands
        // Q:  could objMOCHAD obtain access to Adapter varaibles directly?
        objMOCHAD.config                   = config;
        objMOCHAD.exec                     = exec;
        objMOCHAD.ChildProcessCommandQueue = ChildProcessCommandQueue;
        objMOCHAD.MochadIpAddr             = config.mochadipaddr;
        objMOCHAD.MochadPort               = config.mochadport;
        objMOCHAD.MochadWaitTime           = config.mochadwaittime;
        objMOCHAD.MochadDebug              = config.mochaddebug;

//        this.objMOCHAD.on('unitStatus', (status) => {
//            this.unitStatusReported(status);
//        });

        // -----------------------------------------------------------------
        // Open legacy CM11 serial device
        //   should open TCP port to mochad server to monitor output
        // this.objMOCHAD.start(this.serialDevice);
        // -----------------------------------------------------------------
        
        addonManager.addAdapter(this);
        this.addModules();

        console.log('X10-MOCHAD-ADAPTER: contructor completed');
    }


    startPairing() {
        this.addModules();
    }


    addModules() {
        console.log('X10-MOCHAD-Adapter: addModules(DOING)');

        for(let i = 0; i < this.configuredModules.length; i++) {
            var module  = this.configuredModules[i];
            // TODO:  id should not conflict with legacy X10 CM11 modules
            var id       = 'x10-' + module.houseCode + module.unitCode;
            var x10Addr  = module.houseCode + module.unitCode;

            if(!this.devices[id]) {
                new X10Device(this, id, x10Addr, module.moduleType, module.modulationMethod);
            }
        }
    }


    unitStatusReported(status) {
        console.log('X10-MOCHAD-Adapter: unitStatusReported: status' + status);

        if(STATUS_PROP_MAP.hasOwnProperty(status.x10Function)) {
            status.units.forEach((unit) => {
                var device = this.getDevice('x10-' + unit);

                if(device !== undefined) {
                    device.updatePropertyValue(STATUS_PROP_MAP[status.x10Function], status.level);
                }
            });
        }
    }

    unload() {
        return new Promise(resolve => {           
            console.log('X10Adapter.unload():  stopping x10-mochad-adapter process...')
            this.objMOCHAD.Stop();
            this.X10Adapter.stop();
        });
    }
}

// -------------------------------------------------------
// Multiple X10Devices are instanciated by the X10 Mochad Adapter
// -------------------------------------------------------
class X10Device extends Device {

    /**
     * @param {X10Adapter} adapter
     * @param {String} id            - A globally unique identifier
     * @param {Object} template      - the virtual thing to represent
     */
    
     constructor(adapter, id, x10Addr, moduleType, modulationMethod) {
        
        // Call WebThings Device Constructor() to instanciate a basic device
        super(adapter, id);

        var template  = X10_DEVICE_TYPES[moduleType];

        this.name             = 'X10 ' + template.name + ' (' + x10Addr + ')';
        this.type             = template.type;
        this['@type']         = template['@type'];
        this.x10Addr          = x10Addr;
        this.modulationMethod = modulationMethod;

        // Display Device's template to console.log
        console.log(template.properties);
        
        for (let prop of template.properties) {
            this.properties.set(prop.name,
                new X10Property(this, prop.name, prop.metadata, prop.value));
        }

        // Callback WebThings core success/error functions
        // When a device executes a  "child_process" e.g.: exec's netcat to Mochad
        this.addEvent('success');
        this.addEvent('error');
                
        this.adapter.handleDeviceAdded(this);

        console.log('X10-MOCHAD-DEVICE: constructor():  device added: ' + this.name + ' with address ' + this.x10Addr);
    }

    notifyPropertyChanged(property) {
        super.notifyPropertyChanged(property);

        console.log('X10-MOCHAD-DEVICE: notifyPropertyChanged: ' + this.x10Addr + ': ' + property.name + ' = ' + property.value);

        switch (property.name) {
            case 'on': {
                if (property.value) {

                    var level = 100;
                    if (this.hasProperty('level')) {
                        level = this.properties.get('level').value;
                    }
                  
                    objMOCHAD.TurnOn(this);

                    if (level < '100') {
                        // TODO: I believe there is an X10 Extended code to set the level before turning the device on.
                        var amount = Math.round((100 - level) / 100 * 22);
                        objMOCHAD.Dim(this, amount);
                    }

                } else {
                    objMOCHAD.TurnOff(this);
                }
                break;
            }

            case 'level': {
                // TODO:  Just what the heck is this doing?
                if (this.hasProperty('on') && this.properties.get('on').value) {
                    console.log('X10-MOCHAD-DEVICE: adjusting level: ' + property.adjust.func + ' = ' + property.adjust.amount);
                    objMOCHAD[property.adjust.func]([this.x10Addr], property.adjust.amount);
                }
                break;
            }
        }
    }


    updatePropertyValue(propMapEntry, propValue) {
        if (this.hasProperty(propMapEntry.prop)) {
            var property = this.properties.get(propMapEntry.prop);
            var newValue = property.value;

            if (propMapEntry.prop === 'level') {
                newValue += (propMapEntry.value * propValue);
                if(newValue > 100) { newValue = 100; }
                if(newValue <   0) { newValue =   0; }
            }
            else {
                newValue = propMapEntry.value;
            }

            if (property.value != newValue) {
                property.setCachedValue(newValue);
                super.notifyPropertyChanged(property);
            }
        }
    }
}

// -------------------------------------------------------
// -------------------------------------------------------
function LoadX10MochadAdapter(addonManager, _, errorCallback) {

    const db = new Database(manifest.id);
    db.open().then(() => {
        return db.loadConfig();
    }).then((config) => {
        bDebug = config.mochaddebug;
        new X10Adapter(addonManager, config);
        
    }).catch((e) => {
        errorCallback(manifest.id, `Failed to open database: ${e}`);
    });
}

module.exports = LoadX10MochadAdapter;
