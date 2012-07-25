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

    // From http://www.protonfish.com/jslib/boxmuller.shtml
    function rnd_bmt() {
        var x = 0, y = 0, rds, c;

        // Get two random numbers from -1 to 1.
        // If the radius is zero or greater than 1, throw them out and pick two new ones
        // Rejection sampling throws away about 20% of the pairs.
        do {
            x = Math.random()*2-1;
            y = Math.random()*2-1;
            rds = x*x + y*y;
        }
        while (rds == 0 || rds > 1)

        // This magic is the Box-Muller Transform
        c = Math.sqrt(-2*Math.log(rds)/rds);

        // It always creates a pair of numbers. I'll return them in an
        // array. This function is quite efficient so don't be afraid
        // to throw one away if you don't need both.
        return [x*c, y*c];
    }

    function gaussian (mean, stddev) {
        return mean + rnd_bmt()[0] * stddev;
    }

    // Some data to be plotted with a histograpm
    var heightWeight = (function () {
        var data = [];
        _.times(20000, function () {
            data.push({
                // These should really be correlated.
                height: gaussian(66, 18), // in inches
                weight: gaussian(200, 50), // in lbs
            });
        });
        return data;
    }());

    var normalData = _.map(_.range(20000), function (i) { return { v: gaussian(0, 1) }; });

    $(document).ready(function() {

        function ex () { return d3.select('#examples').append('span'); }

        var w = 250;
        var h = 150;

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
            layers: [{ geometry: 'interval', mapping: { x: 'd', y: 'r' } }]
        });

        var histogram = gg({
            width: w,
            height: h,
            layers: [{ geometry: 'interval', mapping: { x: 'category', y: 'count' } }],
            scales: [
                { type: 'categorical', aesthetic: 'x' },
                { type: 'linear', aesthetic: 'y', min: 0 }
            ]
        });

        var combined_points_and_line = gg({
            width: w,
            height: h,
            layers: [
                { geometry: 'point', mapping: { x: 'd', y: 'r' } },
                { geometry: 'line', mapping: { x: 'd', y: 'r' } },
            ],
        });

        var semi_log_scale = gg({
            width: w,
            height: h,
            layers: [
                { geometry: 'point', mapping: { x: 'd', y: 'r' } },
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
        normalHistogram.render(ex(), normalData);


    });

})();