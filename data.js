;(function (exports) {

    exports.gg.sampleData = {};

    // Random upward trending data
    gg.sampleData.upward = (function () {
        var x = 0;
        var y = 0;
        return _.map(_.range(20), function () {
            x += Math.random() * 30;
            y += 20 - Math.random() * 30;
            return { d: x, r: y, };
        });
    }());

    // Random purchases by four different groups
    gg.sampleData.purchases = (function () {
        var names = [ 'foo', 'bar', 'baz', 'quux' ];
        var randomMeans = d3.random.normal(200, 10);
        var groups = _.map(names, function (n) {
            var mean = randomMeans();
            return {
                name: n,
                rng: d3.random.normal(mean, mean/3)
            }
        });

        return _.map(_.range(20), function () {
            var g = groups[Math.floor(Math.random() * groups.length)];
            return {
                who: g.name,
                purchases: Math.round(Math.max(0, g.rng()))
            };
        });
    }());

    // Random data for plotting semi-log.
    gg.sampleData.semiLogData = (function () {
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


    // Random height weight data for binned histogram and scatter plot
    gg.sampleData.heightWeight = (function () {
        // Some random variables.
        var randomHeight   = d3.random.normal(66, 18);
        var randomBMI      = d3.random.normal(21.75, 3);
        var standardNormal = d3.random.normal();

        return _.map(_.range(20000), function () {
            var inches = randomHeight();
            var lbs    = randomBMI() * inches * inches / 703.06958;
            return {
                height: inches,
                weight: lbs,
            };
        });
    }());

    // Random data for box plot graphic
    gg.sampleData.forBoxPlots = (function () {
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
            return { grade: g.name, value: g.rng() };
        });
    }());


})(window);