class clsMOCHAD {
    
    constructor() {

        // globals defined/initialized in x10-mochad-adapter 
        var ChildProcessCommandQueue;
        var exec;                              // require(child_process)
        
        // Variables should be available directly in "config" array
        var Event;                             // Initialize GW Event method to support comand completion callback
        var config;                            // X10-mochad-adapter addon "Configure" menu
        var MochadIpAddr;
        var MochadPort;
        var MochadWaitTime;
        var MochadDebug;
        
    }  

    // ------------------------------------------------------------------------------------------
    // TODO:  RF/PL is a parameter of each Device.  Get it's value and correct xCommand.
    // ------------------------------------------------------------------------------------------
   
    TurnOn(X10Device) {
        var xCommand = "RF " + X10Device.x10Addr + ' ON';
        console.log('clsMOCHAD.js:  TurnOn: command: ' + xCommand);
        this.MochadPrepareCommand(X10Device, xCommand);
    }


    TurnOff(X10Device) {
       var xCommand = "RF " + X10Device.x10Addr + ' OFF';
       console.log('clsMOCHAD.js:  TurnOff: command: ' + xCommand);
       this.MochadPrepareCommand(X10Device, xCommand);
    }

    // TODO:  figure out correct DIM syntax
    Dim(X10Device) {
        var level    = X10Device.properties.get('level').value;
        var xCommand = "RF " + X10Device.x10Addr + ' DIM';
        this.MochadPrepareCommand(X10Device, xCommand);
    }


    // TODO:  figure out correct BRIGHT syntax
    Bright(X10Device) {
        var level    = X10Device.properties.get('level').value;
        var xCommand = "RF " + X10Device.x10Addr + ' BRIGHT';
        this.MochadPrepareCommand(X10Device, xCommand);
    }


    // ------------------------------------------------------------------------------------------
    // TODO:  Need to support global executing locking to maintain sequential execution
    //        - push X10Device to Command Queue too
    //        - only allow the first call to MochadPrepareCommand to execute. Other subsequent calls when something is
    //          already executing should be pushed onto the queue and executed later
    //        - Tricky timeout & call-back processing is required to manage  processing queue
    // ------------------------------------------------------------------------------------------
    
    MochadPrepareCommand(X10Device, xCommand) {
        
        if (xCommand===null) return;
        if (xCommand==="")   return;
        
        console.log('MochadPrepareCommand(): Preparing xCommand: ' + xCommand);     
        
        // global Command Queue array for all Devices
        this.ChildProcessCommandQueue.push(xCommand);
        var xArrCnt  = this.ChildProcessCommandQueue.length;
        // console.log('MochadPrepareCommand(): xArrCnt: ' + xArrCnt);
        
        var xCnt = 0;            
        while (xArrCnt--) {

            // Hard-coded safety exit (for now) to prevent runaway processes in case I mess up coding (GAK)
            // TODO:  xCnt should be a class global decremented when command completes
            xCnt++;
            if (xCnt > 5) {
                console.log('MochadPrepareCommand(): EXCEEDED MAX PROCCESS QUEUE(5)');
                return;
            }

            var xCmd1 = this.ChildProcessCommandQueue.shift();
            
            // TODO:  initialize to 5 seconds for legacy devices that don't have it set yet
            this.MochadWaitTime = "5";

            // Netcat path must be that inside a docker container (if using docker...)
            var xCmd2 = "/bin/echo \"" + xCmd1 + "\" | /home/node/.mozilla-iot/addons/nc -w " + this.MochadWaitTime + " " + this.MochadIpAddr + " " + this.MochadPort;
            
            this.ChildProcessExecute(X10Device, xCmd2);
        }

    }


    // -------------------------------------------------------
    // See:    https://nodejs.org/api/child_process.html
    // TODO:   resolve err, stdout & stderr callbacks...
    // -------------------------------------------------------

    ChildProcessExecute(X10Device, xCmd) {
        
        console.log('ChildProcessExecute(): Executing xCmd: ' + xCmd);

        return new Promise((resolve) => {
            this.exec(xCmd, (err, stdout, stderr) => {
                
                stderr = stderr.replace(/\n$/, '');
                if (stderr) {
                    const stderr_lines = stderr.split(/\n/g);
                    for (const stderr_line of stderr_lines) {
                        console.error(`ChildProcessExecute(): stderr: ${stderr_line}`);
                    }
                }
                
                stdout = stdout.replace(/\n$/, '');
                if (stdout) {
                    const stdout_lines = stdout.split(/\n/g);
                    for (const stdout_line of stdout_lines) {
                        console.log(`ChildProcessExecute(): stdout: ${stdout_line}`);
                        // TODO:   Inspect each line to confirm command was transmitted
                        //         When controller is configured as a Tranceiver for a house code and it obtains an RF instruction 
                        //          it will also Tx that command out the PL interface too so multiple Tx and Rx lines will appear
                    }
                    
                } else {
                    // TODO: If no commands were received in time alloted, Mochad process may be hung.
                    //       Initiate error that Mochad might need to be restarted
                }           
                
                if (err) {
                    X10Device.eventNotify(new this.Event(X10Device, 'error'));
                } else {
                    X10Device.eventNotify(new this.Event(X10Device, 'success'));
                }

                resolve();
            });
        });
    }
  
    // -------------------------------------------------------
    // TODO:  kill/stop all currently-executing child processes
    // -------------------------------------------------------

    Stop(xOptions)  {
        console.log('clsMOCHAD.Stop():  TODO:  Stop child_process(es) now if any are executing...');

    }
}

module.exports = clsMOCHAD;
