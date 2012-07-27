;(function (exports) {

    exports.ggData = {};

    // Generate some random data.
    ggData.data = (function () {
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
    ggData.semiLogData = (function () {
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
    ggData.categoricalData = [
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
    ggData.heightWeight = (function () {
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

    ggData.normalData = _.map(_.range(20000), function (i) { return { v: standardNormal() }; });

    // Pre-digested data for box plot geometry.
    ggData.boxPlotData = [
        { group: 'a', 'median': 200, 'q1': 50, 'q3': 275, 'lower': 25, 'upper': 360, 'outliers': [ -200, -175, 0, 10, 400, 500 ] },
        { group: 'b', 'median': 350, 'q1': 60, 'q3': 375, 'lower': 20, 'upper': 500, 'outliers': [ -150, -100, 0, 5, 550, 575, 650 ] },
    ];

    // Data intended to be digested for box plotting.
    ggData.dataForBoxPlots = (function () {
        var names         = ['a', 'b', 'c', 'd' ];
        var randomMeans   = d3.random.normal(500, 100);
        var randomStddevs = d3.random.normal(150, 20);
        var outlierRates  = d3.random.normal(.01, .001);

        function makeRNG (mean, stddev, outlierRate) {
            var baseRNG = d3.random.normal(mean, stddev);
            return function () {
                var r = baseRNG();
                var sign = Math.abs(r - mean) / (r - mean);
                return (Math.random() < outlierRate)
                    ? r + (sign * stddev * (3 + Math.random() * 2)) : r;
            }
        }

        var groups = _.map(names, function (n) {
            return {
                name: n,
                rng: makeRNG(randomMeans(), Math.abs(randomStddevs()), Math.abs(outlierRates()))
            }
        });

        return _.map(_.range(2000), function () {
            var g = groups[Math.floor(Math.random() * groups.length)];
            return {
                grade: g.name,
                value: g.rng()
            };
        });
    }());


})(window);