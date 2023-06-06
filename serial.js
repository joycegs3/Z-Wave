var ZWave = require('openzwave-shared');
const express = require('express');
const app = express();
var request = require('request');
var zwave = new ZWave({
    ConsoleOutput: false,
    //NetworkKey: "0xBA, 0x2E, 0x22, 0x70, 0xD3, 0xE0, 0xBA, 0x94, 0xAC, 0x03, 0xFD, 0x63, 0xFA, 0x65, 0x24, 0xBA"
});

//var nodeAlreadyExists = false;
var info = undefined;
var nodes = [];
var homeID = undefined;
var znetwork = [];
var zwave_network = [];
var allNodesAdded = [];

zwave.on('driver ready', function(homeid) {
    console.log('scanning homeid=0x%s...', homeid.toString(16));
    homeID = homeid.toString(16);
});

zwave.on('driver failed', function() {
    console.log('failed to start driver');
    zwave.disconnect();
    process.exit();
});

zwave.on('node added', function(nodeid) {
    nodes[nodeid] = {
        manufacturer: '',
        manufacturerid: '',
        product: '',
        producttype: '',
        productid: '',
        type: '',
        name: '',
        loc: '',
        classes: {},
        ready: false,
    };

    allNodesAdded.push(nodeid);    

    console.log("New node added, NODE_ID: ", nodeid);

});

function currentDateTime() {
    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var dateTime = date+' '+time;
    return today;
}

async function getNodeInfo(info) {
    let time = currentDateTime();

    let data = {
        info,
        time
    }

    return new Promise(function (resolve, reject) {              
        request({
            url: "http://localhost:5050/receiveNodeInfo",
            method: "POST",
            json: true,
            body: data   // <--Very important!!!
        }, function (error, response, body) {
            resolve(response);
        });
    }).catch((error) => {
        console.log(error);
    });
}



zwave.on('value added', function(nodeid, comclass, valueId) {
    if (!nodes[nodeid]['classes'][comclass])
        nodes[nodeid]['classes'][comclass] = {};
    nodes[nodeid]['classes'][comclass][valueId.index] = valueId;
});

zwave.on('value changed', function(nodeid, comclass, value) {
    if (nodes[nodeid]['ready']) {
        console.log('node%d: changed: %d:%s:%s->%s', nodeid, comclass,
                value['label'],
                nodes[nodeid]['classes'][comclass][value.index]['value'],
                value['value']);
        
        info = value;
        getNodeInfo(info);
    }
    
    nodes[nodeid]['classes'][comclass][value.index] = value;
});

zwave.on('value removed', function(nodeid, comclass, index) {
    if (nodes[nodeid]['classes'][comclass] &&
        nodes[nodeid]['classes'][comclass][index])
        delete nodes[nodeid]['classes'][comclass][index];
});

zwave.on('node ready', function(nodeid, nodeinfo) {

    nodes[nodeid]['manufacturer'] = nodeinfo.manufacturer;
    nodes[nodeid]['manufacturerid'] = nodeinfo.manufacturerid;
    nodes[nodeid]['product'] = nodeinfo.product;
    nodes[nodeid]['producttype'] = nodeinfo.producttype;
    nodes[nodeid]['productid'] = nodeinfo.productid;
    nodes[nodeid]['type'] = nodeinfo.type;
    nodes[nodeid]['name'] = nodeinfo.name;
    nodes[nodeid]['loc'] = nodeinfo.loc;
    nodes[nodeid]['ready'] = true;

    console.log('node%d: %s, %s', nodeid,
            nodeinfo.manufacturer ? nodeinfo.manufacturer
                      : 'id=' + nodeinfo.manufacturerid,
            nodeinfo.product ? nodeinfo.product
                     : 'product=' + nodeinfo.productid +
                       ', type=' + nodeinfo.producttype);

    console.log('node%d: name="%s", type="%s", location="%s"', nodeid,
            nodeinfo.name,
            nodeinfo.type,
            nodeinfo.loc);
    for (comclass in nodes[nodeid]['classes']) {
      console.log('node%d: class %d', nodeid, comclass);
      switch (comclass) {
        case 0x25: // COMMAND_CLASS_SWITCH_BINARY
        case 0x26: // COMMAND_CLASS_SWITCH_MULTILEVEL
          var valueIds = nodes[nodeid]['classes'][comclass];
          for (valueId in valueIds) {
            zwave.enablePoll(valueId);
            break;
          }
          console.log('node%d:   %s=%s', nodeid, values[idx]['label'], values[idx]['value']);
      }
    }

    let nodeInfo = {
        node_id: nodeid,
        manufacturer: nodeinfo.manufacturer,
        manufacturerid: nodeinfo.manufacturerid,
        product: nodeinfo.product,
        producttype: nodeinfo.producttype,
        productid: nodeinfo.productid,
        type: nodeinfo.type,
        name: nodeinfo.name,
        location: nodeinfo.loc,
        time: currentDateTime(),
        zwave_homeID: homeID
    }

    znetwork.push(nodeInfo);
    var network = sortZwaveNetwork(znetwork);
    zwave_network = removeDuplicates(network);

    // for (let i = 0; i < nodes.length; i++) {

    //     for (let j = 0; j < znetwork.length; j++) {
           
    //         if (allNodesAdded[i] == znetwork[j].node_id && znetwork.length <= allNodesAdded.length) {
    //             zwave_network.push(znetwork[j]);
    //         }
            
    //     }

    //     // if (zwave_network[i]) {

    //     //     if (zwave_network[i].node_id == nodeid) {
    //     //         nodeAlreadyExists = true;
    //     //     }
            
    //     // }
        
    // }

    // if (nodeAlreadyExists == false) {
    //     zwave_network.push(nodeInfo);
    // } else {
    //     console.log("Nó já existe na rede Z-Wave!");
    // }

    //sendNodeInfo(nodeInfo);
    sendZwaveNetwork(zwave_network);
    
});

function removeDuplicates(array) {
    var newArray = [];

    let uniqueObject = {};

    for (let i in array) { 
      
        // Extract the node_id 
        let objNodeId = array[i]['node_id'];

        // Use the node_id as the index 
        uniqueObject[objNodeId] = array[i];
    } 

    // Loop to push unique object into array 
    for (i in uniqueObject) { 
        newArray.push(uniqueObject[i]); 
    }
    
    return newArray;
}

// async function sendNodeInfo(nodeInfo) {

//     return new Promise(function (resolve, reject) {   
//         request({
//             url: "http://localhost:3000/receiveNodeInfo",
//             method: "POST",
//             json: true,
//             body: nodeInfo   // <--Very important!!!
//         }, function (error, response, body) {
//             resolve(response);
//         });
//     }).catch((error) => {
//         console.log(error);
//     });
// }

async function sendZwaveNetwork(zwave_network) {
    return new Promise(function (resolve, reject) {
        
        //var network = sortZwaveNetwork(zwave_network);
        
        request({
            url: "http://localhost:3000/receiveZwaveNetwork",
            method: "POST",
            json: true,
            body: zwave_network   // <--Very important!!!
        }, function (error, response, body) {
            resolve(response);
        });
    }).catch((error) => {
        console.log(error);
    });
}

function sortZwaveNetwork(array) {
    return array.sort(function(a, b) {
        return a.node_id - b.node_id;
    })
}
 
zwave.on('notification', function(nodeid, notif) {
    switch (notif) {
    case 0:
        console.log('node%d: message complete', nodeid);
        break;
    case 1:
        console.log('node%d: timeout', nodeid);
        break;
    case 2:
        console.log('node%d: nop', nodeid);
        break;
    case 3:
        console.log('node%d: node awake', nodeid);
        break;
    case 4:
        console.log('node%d: node sleep', nodeid);
        break;
    case 5:
        console.log('node%d: node dead', nodeid);
        break;
    case 6:
        console.log('node%d: node alive', nodeid);
        break;
        }
});

zwave.on('scan complete', function() {
    console.log('====> scan complete, hit ^C to finish.');
    // set dimmer node 5 to 50%
    //zwave.setValue(5,38,1,0,50);
    //zwave.setValue( {node_id:5, class_id: 38, instance:1, index:0}, 50);
    // Add a new device to the ZWave controller
    if (zwave.hasOwnProperty('beginControllerCommand')) {
      // using legacy mode (OpenZWave version < 1.3) - no security
      zwave.beginControllerCommand('AddDevice', true);
    } else {
      // using new security API
      // set this to 'true' for secure devices eg. door locks
        zwave.addNode(false);
       
    }
});


zwave.on('controller command', function(r,s) {
    console.log('controller commmand feedback: r=%d, s=%d',r,s);
});

zwave.connect('/dev/ttyACM0');

process.on('SIGINT', function() {
    console.log('disconnecting...');
    zwave.disconnect('/dev/ttyACM0');
    process.exit();
});
