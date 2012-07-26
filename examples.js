;(function () {

    // Generate some random data.
    var data = (function () {
        var data = [];
        var x = 0;
        var y = 0;
        _.times(20, function () {
            x += Math.random() * 30;
            y += 20 - Math.random() * 30;
            data.push({
                d: x,
                r: y,
            });
        });
        return data;
    }());

    // Generate some random data for plotting semi-log.
    var semiLogData = (function () {
        var data = [];
        var x = 0;
        var y = 1;
        _.times(20, function () {
            x += Math.random() * 30;
            y *= Math.random() * 5;
            data.push({
                d: x,
                r: y,
            });
        });
        return data;
    }());


    // Some categorical data
    var categoricalData = [
        { category: 'foo',  count: 100 },
        { category: 'bar',  count: 59 },
        { category: 'baz',  count: 212 },
        { category: 'quux', count: 76 }
    ];

    // Some random variables.
    var randomHeight   = d3.random.normal(66, 18);
    var randomBMI      = d3.random.normal(21.75, 3);
    var standardNormal = d3.random.normal();

    // bmi = lbs/inches^2 * 703.06958
    // lbs = bmi * inches^2 / 703.06958

    // Some data to be plotted with a histograpm
    var heightWeight = (function () {
        var data = [];
        _.times(20000, function () {
            var inches = randomHeight();
            var lbs    = randomBMI() * inches * inches / 703.06958;
            data.push({
                // These should really be correlated.
                height: inches,
                weight: lbs,
            });
        });
        return data;
    }());

    var normalData = _.map(_.range(20000), function (i) { return { v: standardNormal() }; });

    $(document).ready(function() {

        function ex () { return d3.select('#examples').append('span'); }

        var w = 300;
        var h = 200;

        // Define graphics ...
        var scatterplot = gg({
            width: w,
            height: h,
            layers: [{ geometry: 'point', mapping: { x: 'd', y: 'r' } }]
        });

        var linechart = gg({
            width: w,
            height: h,
            layers: [{ geometry: 'line', mapping: { x: 'd', y: 'r' } }]
        });

        var barchart = gg({
            width: w,
            height: h,
            layers: [{ geometry: 'interval', mapping: { x: 'd', y: 'r' }, width: 2 }]
        });

        var histogram = gg({
            width: w,
            height: h,
            layers: [{ geometry: 'interval', mapping: { x: 'category', y: 'count' }, width: 20 }],
            scales: [
                { type: 'categorical', aesthetic: 'x' },
                { type: 'linear', aesthetic: 'y', min: 0 }
            ]
        });

        var combined_points_and_line = gg({
            width: w,
            height: h,
            layers: [
                { geometry: 'point', mapping: { x: 'd', y: 'r' }, size: 3 },
                { geometry: 'line', mapping: { x: 'd', y: 'r' } },
                /*{ geometry: 'interval', mapping: { x: 'd', y: 'r' }, width: 2 },*/
            ],
        });

        var semi_log_scale = gg({
            width: w,
            height: h,
            layers: [
                { geometry: 'point', mapping: { x: 'd', y: 'r' }, size: 3 },
                { geometry: 'line', mapping: { x: 'd', y: 'r' } },
            ],
            scales: [ { type: 'log', aesthetic: 'y' } ]
        });

        var heightHistogram = gg({
            width: w,
            height: h,
            layers: [
                {
                    geometry: 'interval',
                    mapping: { x: 'bin', y: 'count' },
                    statistic: { kind: 'bin', variable: 'height', binsize: 4},
                }
            ],
            scales: [
                { type: 'categorical', aesthetic: 'x' },
                { type: 'linear', aesthetic: 'y', min: 0 }
            ]
        });

        var heightWeightScatter = gg({
            width: w,
            height: h,
            layers: [{ geometry: 'point', mapping: { x: 'height', y: 'weight' }, size: 1 }]
        });

        var normalHistogram = gg({
            width: w,
            height: h,
            layers: [
                {
                    geometry: 'interval',
                    mapping: { x: 'bin', y: 'count' },
                    statistic: { kind: 'bin', variable: 'v', binsize: .2},
                }
            ],
            scales: [
                { type: 'categorical', aesthetic: 'x' },
                { type: 'linear', aesthetic: 'y', min: 0 }
            ]
        })

        // ... and render 'em
        scatterplot.render(ex(), data);
        linechart.render(ex(), data);
        barchart.render(ex(), data);
        histogram.render(ex(), categoricalData);
        combined_points_and_line.render(ex(), data);
        semi_log_scale.render(ex(), semiLogData);
        heightHistogram.render(ex(), heightWeight);
        heightWeightScatter.render(ex(), heightWeight);
        normalHistogram.render(ex(), normalData);


    });

})();