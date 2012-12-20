// Example of running gg in node

var d3 = require('d3');
var _ = require('underscore');
var gg = require('./gg.js');

var linechart = gg.gg({
    layers: [
        { geometry: 'line', mapping: { x: 'd', y: 'r', group: 'subject', color: 'subject'} },
        { geometry: 'text', mapping: { x: 'd', y: 'r', text: '{d}, {r}' },  show: "hover" }
    ]
});

gg.sampleData = {};

gg.sampleData.upwardSubjects = (function () {
    var subjects = ['a', 'b', 'c', 'd'];
    var x = 0;
    var y = 0;
    return _.flatten(_.map(_.range(20), function (i) {
        x += Math.round(Math.random() * 30);
        y += Math.round(Math.abs(20 - Math.random() * 30));
        return _.map(subjects, function(subject, i) {
            var skew = i + 1;
            return { d: x, r: y * (Math.random() * skew), subject: subject };
        })
    }));
}());

var div = d3.select(document.createElement('div'));

var data = gg.sampleData;
var w    = 300;
var h    = 200;
var ex   = function () { return d3.select('#examples').append('span'); };

linechart.render(w, h, div, data.upwardSubjects);
console.log(div.html());

