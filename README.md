# X10-MOCHAD-ADAPTER

The X10-MOCHAD-ADAPTER is a WebThings Gateway addon that allows the user to define X10 devices and control them using a CM15 or CM19 X10 controller connected to a servers USB connection using the MOCHAD application. The MOCHAD protocol listens for incoming tcp connections and transmits them to the X10 controller.

This adapter provides a simple and reliable tool to send 1-way commands to legacy X10 devices.  Note that it does not listen to the CM15 for state changes made by other X10 based applications so it cannot determine the current state of an X10 device.

There is another tool in the EricLEdberg Github repository that listens to X10 commands output from the CM15 controller and updates WebThings thing states and initiates WebThing actions.

## INSTALLATION

There are many steps to document.  These are just high level steps required.

1)  Install, build, and configure MOCHAD on the server hosting the X10 CM15 controller (can be co-resident with WebThings)
2)  Connect the CM15 to a free USB port and verify that the Mochad process started and is now listening on port 1099 (default)
3)  Install Netcat on the WebThings server:  apt install netcat
    Manually test that you can send "nc" commends to toggle an existing X10 module e.g.:   echo "PL O10 ON" | /usr/bin/nc -w 5 127.0.01 1099
    It should connect to the Mochad process on port 1099 and turn on X10 module O10....
4)  Manually clone X10-MOCHAD-ADAPTER from this repository in the WebThings addon folder:  x10-mochad-adapter
5)  Restart WebThings and verify that the X10 adapter was identified (it will not load initially because it's not enabled).
6)  Configure, enable debugging, and then enable the adapter
7)  Add a your first X10 device
8)  Test if you can turn a device on and off
    The adapter should execute the /usr/bin/nc command send a command to the mochad server
    Docker Note:  If WebThings states the  /usr/bin/nc command is not found, you will need to create a docker volume link so it's visible inside the container

Maybe some day I'll update these instructions like they should be.
I normally just write just enough to remind me what I need to do to re-install the application :-(
