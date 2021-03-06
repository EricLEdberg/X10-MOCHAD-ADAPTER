
/******************************************************************************
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2020 Eric L. Edberg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 ******************************************************************************/

(function() {
    'use strict';

//    const SerialPort = require('serialport');
//    const cm11aCodes = require('./MOCHADCodes');
//    const transactions = require('./MOCHADTransactions');
//    const x10Address = require('./UnitAddress');

    var MOCHAD = {
        serial: {},
        running: false,
        currentTrans: undefined,
        transactionQueue: [],
        timer: undefined,

        // MOCHAD Commands
        start: Start,
        stop: Stop,
        stopped: Stopped,

        // Unit Function Commands
        turnOn: TurnOn,
        turnOff: TurnOff,
        dim: Dim,
        bright: Bright,
        status: Status,
        setClock: SetClock,

        // Internally called methods
        runTransaction: RunTransaction,
        runQueuedTransaction: RunQueuedTransaction,
        timeout: Timeout
    };

    /***
     * ELE TODO:  Start connection to Mochad server <here>
     * @returns {boolean}
     */
    function Start(device) {
        var ctrl = this;

        return new Promise(function(resolve, reject) {
            if (!ctrl.running) {

                ctrl.serial.on('data', function (data) {
                    ctrl.read(data);
                });
                
				ctrl.serial.on('error', HandleError);
                
				ctrl.serial.on('close', function () {
                    ctrl.stopped();
                });
                ctrl.running = true;

                // Wait for 1-1/2 seconds to see if we need to respond to a poll failure
                setTimeout(function() {
                    resolve(ctrl.running);
                }, 3000);
            }
        });
    }

    function Timeout() {
        if(this.currentTrans !== undefined) {
            this.currentTrans.handleMessage([]);
        }
    } 

    function HandleError(error) {
        console.log(error);
    }

    /***
     * @returns {boolean}
     */
    function Stop() {
        if(this.currentTrans) {
            /* For now, let the transaction complete gracefully
            this.currentTrans.error('Shutting Down.');
            */
            this.running = false;
        }
        else {
            // ELE:  Close connections or transactions to MOCHAD <here>
        }
    }

    function Stopped() {
        this.running = false;
    }

    // ------------------------------------------------------------------------------------------
    // ------------------------------------------------------------------------------------------
    
    function TurnOn(addr) {
        var command = "RF " + addr + ' ON';
        this.runTransaction(command);
    }


    function TurnOff(addr) {
        var command = "RF " + addr + ' OFF';
        this.runTransaction(command);
    }

    // TODO:  figure out correct DIM syntax
    function Dim(addr, level) {
        var command = "RF " + addr + ' DIM';
        this.runTransaction(command);
    }


    // TODO:  figure out correct BRIGHT syntax
    function Bright(addr, level) {
        var command = "RF " + addr + ' BRIGHT';
        this.runTransaction(command);
    }


    // ------------------------------------------------------------------------------------------
    // Transactions are used to execute commands serially sent to Mochad
    // ------------------------------------------------------------------------------------------
    function RunTransaction(trans) {
        var ctrl = this;
        
        console.log('MOCHAD.js:  RunTransaction: running: ' + ctrl.running + ', trans: ' + trans);
        
        return;

        if(ctrl.running) {
            if (ctrl.currentTrans === undefined) {
                ctrl.currentTrans = trans;
                ctrl.currentTrans.run().then(
                    function() {
                        ctrl.runQueuedTransaction();
                    },
                    function() {
                        ctrl.runQueuedTransaction();
                    });
            }
            else {
                ctrl.transactionQueue.push(trans);
            }
        }
    }


    function RunQueuedTransaction() {
        var ctrl = this;

        ctrl.currentTrans = undefined;

        if(ctrl.running) {
            if (ctrl.transactionQueue.length > 0) {
                ctrl.runTransaction(ctrl.transactionQueue.shift());
            }
        } else {
            // ELE TODO:  Close connection to Mochad server <here>
        }
    }

    function Status() {
        var status = transactions.StatusRequest(this);
        this.runTransaction(status);
    }


    function SetClock() {
        var setClock = transactions.SetClock(this, []);
        this.runTransaction(setClock);
    }

    // ------------------------------------------------------------------------------------------
    // ------------------------------------------------------------------------------------------
    
    function NewMochad() {
        var objMochad = Object.create(MOCHAD);
        return objMochad;
    }

    module.exports = NewMochad;

})();

