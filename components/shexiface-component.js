// shexiface-component.js

var _ = require('underscore');
var noflo = require('noflo');

exports.getComponent = function() {
    return _.extend(new noflo.Component({
        outPorts: {
            output: {
                description: "RDF JS Interface Graph object",
                datatype: 'object'
            },
            error: {
                description: "Error object",
                datatype: 'object'
            }
        },
        inPorts: {
            graph: {
                description: "The name of the output Graph",
                datatype: 'string',
                process: on({data: assign('graphName')})
            },
            input: {
                description: "RDF JS Interface Graph object",
                datatype: 'object',
                required: true,
                process: on({data: execute})
            }
        }
    }), {
        description: "Converts an RDF JS Interface Graph object of a CHCS Person into FHIR",
        icon: 'edit'
    });
};

function on(type, callback) {
    return function(event, payload) {
        if (type[event]) type[event].call(this, payload);
    };
}

function assign(name){
    return function(data){
        this.nodeInstance[name] = data;
    };
}

function execute(inputGraph) {
    var inputGraphURI = inputGraph.graphURI;
    var outPorts = this.nodeInstance.outPorts;
    var outputGraphURI = this.nodeInstance.graphName || inputGraphURI ?
        inputGraphURI.replace(/#(.*)|$/, '#$1FHIR') : undefined;
    Promise.resolve(outputGraphURI).then(function(outputGraphURI){
        if (outputGraphURI) {
            return asRdfStore(graph).then(function(store){
                return denodeify(store, 'graph', outputGraphURI).then(function(outputGraph){
                    outputGraph.rdfstore = store;
                    outputGraph.graphURI = outputGraphURI;
                    return outputGraph;
                });
            });
        } else {
            return denodeify(rdfstore, 'create', {}).then(function(store){
                return denodeify(store, 'graph').then(function(outputGraph){
                    outputGraph.rdfstore = store;
                    return outputGraph;
                });
            });
        }
    }).then(function(outputGraph){
        return shexiface.ShExMapPerson(outputGraph.rdfstore, inputGraph, outputGraph);
    }).then(function(outputGraph){
        outPorts.output.send(outputGraph);
        outPorts.output.disconnect();
    }).catch(function(err){
        if (outPorts.error.listAttached().length) {
            outPorts.error.send(err);
            outPorts.error.disconnect();
        } else {
            console.error(err);
        }
    });
}

function asRdfStore(graph) {
    if (graph.rdfstore) return Promise.resolve(graph.rdfstore);
    else return denodeify(rdfstore, 'create', {}).then(function(store){
        return Promise.resolve(graph).then(function(graph){
            if (!graph.graphURI) return denodeify(store, 'insert', graph);
            else return denodeify(store, 'insert', graph, graph.graphURI);
        }).then(_.constant(store));
    });
}

function denodeify(object, functionName /* arguments */) {
    var args = _.toArray(arguments).slice(2);
    return Promise.denodeify(object[functionName]).apply(object, args);
}
