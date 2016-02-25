// shexiface-component-mocha.js

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.should();
chai.use(chaiAsPromised);

var _ = require('underscore');
var noflo = require('noflo');
var shexiface = require('../components/shexiface-component');


// Patient data has comments so use require to load it.
var fakeData = require("../CHCSfakePatient.js");
// Force local copy of @context.
fakeData["@context"] = require("../CHCSfakeContext.js")["@context"];

describe('shexiface', function() {
    it("should convert CHCS to FHIR without outputGraphURI", function() {
        return createNetwork({
            load: "rdf-components/rdf-load",
            shexiface: shexiface,
            jsonld: "rdf-components/rdf-jsonld"
        }).then(function(network){
            network.graph.addEdge('load', 'output', 'shexiface', 'input');
            network.graph.addEdge('shexiface', 'output', 'jsonld', 'input');
            return new Promise(function(done, fail) {
                ['load', 'shexiface', 'jsonld'].forEach(function(name) {
                    var error = noflo.internalSocket.createSocket();
                    var output = noflo.internalSocket.createSocket();
                    network.processes[name].component.outPorts.error.attach(error);
                    network.processes[name].component.outPorts.output.attach(output);
                    error.on('data', fail);
                    output.on('data', done);
                });
                network.graph.addInitial(fakeData, 'load', 'input');
            });
        }).should.eventually.eql({});
    });
});

/**
 * Creates and starts a noflo.Network with a component for every component module
 * given, however, no edges are present.
 * Usage:
 *  createNetwork({name:require('../components/rdf')}).then(function(network){
 *      network.processes.name.component is the component instance
 *      network.graph.addEdge('name', 'output', 'name', 'input') to add edge
 *      network.graph.addInitial(data, 'name', 'input') to send data
 *  });
 */
function createNetwork(componentModules) {
    var graph = new noflo.Graph();
    _.each(componentModules, function(module, name) {
        // maps node to factory
        graph.addNode(name, _.isString(module) ? module : name);
    });
    return new Promise(function(resolve, reject){
        noflo.createNetwork(graph, function(err, network) {
            if (err instanceof noflo.Network) network = err;
            else if (err) return reject(err);
            _.each(componentModules, function(module, name) {
                // maps factory to module
                if (_.isObject(module)) {
                    network.loader.components[name] = module;
                }
            });
            network.connect(function(err){
                if (err) return reject(err);
                network.start();
                resolve(network);
            });
        }, true);
    });
}
