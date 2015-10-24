!function () {

    var s = 0.7;
    var b = 0.02;

    function effectiveness (eng, ee, s, b) {
        return (eng - ee) * (1 + (Math.pow(ee, s) * b));
    }

    function data (eng) {
        return _.map(_.range(eng + 1), function (x) {
            return { x: x, y: effectiveness(eng, x, s, b) }
        });
    }

    function maxY (data) {
        return _.max(data, function (d) { return d.y; });
    }

    function plotter(label) {
        return gg(
            { geometry: 'line', mapping: { x: 'x', y: 'y' }, smooth: true, width: 2, color: '#338'},
            {
                geometry: 'arrow',
                color: '#338',
                mapping: { x: 'x', y: 'y' },
                linewidth: 1,
                arrow: { length: 10, width: 3 },
                statistic: {
                    kind: 'arrow',
                    head: function (d) { return maxY(d); },
                    tail: function (d) { return { x: maxY(d).x, y: 0 }; }
                }
            },
            { aesthetic: 'x', legend: label },
            { aesthetic: 'y', legend: 'Net productivity' }
        )
    }

    var opts = { width: 500, height: 300, padding: 50 };

    var commify = d3.format(",d")

    _.map([10, 100, 1000, 10000], function (n) {
        var label = 'EE Engineers out of ' + commify(n) + ' (s = ' + s + '; b = ' + b + ')';
        plotter(label)(data(n), d3.select('#chart' + n), opts);
    });

}();
