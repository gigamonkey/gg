;(function () {

    var _undefined;

    function Graph () {
        this.elements = [];
        this.scales   = {};
        this.d3Scales = {};
        return this;
    }

    Graph.prototype.rangeForDim = function (dim) {
        if (dim == 1) {
            return [10, this.width - 20];
        } else if (dim == 2) {
            return [this.height - 20, 10];
        } else {
            throw 'Only 2d graphics supported: Bad dim: ' + dim;
        }
    };

    Graph.prototype.xMin = function (data) {
        var e = this.elements[0];
        return e.xFn(_.min(data, function (d) { return e.xFn(d); }));
    };

    Graph.prototype.xMax = function (data) {
        var e = this.elements[0];
        return e.xFn(_.max(data, function (d) { return e.xFn(d); }));
    };

    Graph.prototype.yMin = function (data) {
        var e = this.elements[0];
        return e.yFn(_.min(data, function (d) { return e.yFn(d); }));
    };

    Graph.prototype.yMax = function (data) {
        var e = this.elements[0];
        return e.yFn(_.max(data, function (d) { return e.yFn(d); }));
    };

    Graph.prototype.size = function (w, h) {
        this.width = w;
        this.height = h;
        return this;
    }

    Graph.prototype.render = function (where, data) {
        // Render the graph using the given data into the given
        // element (a div or span usually).
        this.svg = where.append('svg')
            .attr('width', this.width)
            .attr('height', this.height);

        this.svg.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('fill', '#dcb')
            .attr('fill-opacity', 1);

        // Default to linear scales if not supplied.
        for (var i = 1; i < 3; i++) {
            if (typeof this.scales[i] === 'undefined') {
                this.scale(new LinearScale().dim(i));
            }
        }

        // Default the scale's domains if they are not supplied.
        _.each(this.scales, function (s, dim) {
            if (! s.domainSet) {
                if (typeof s._min === 'undefined') {
                    s._min = (dim == 1) ? this.xMin(data) : this.yMin(data);
                }
                if (typeof s._max === 'undefined') {
                    s._max = (dim == 1) ? this.xMax(data) : this.yMax(data);
                }
                this.d3Scales[dim] = s.d3Scale.domain([s._min, s._max]).range(this.rangeForDim(dim));
            } else {
                this.d3Scales[dim] = s.d3Scale.rangeBands(this.rangeForDim(dim), .5);
            }
        }, this);

        _.each(this.elements, function (e) { e.render(this, data); }, this);
    };

    Graph.prototype.element = function (e) {
        this.elements.push(e);
        return this;
    };

    Graph.prototype.scale = function (s) {
        this.scales[s._dim] = s;
        return this;
    };

    function Element () { return this; }

    Element.prototype.position = function (expr) {
        var parse = expr.split(/([*\/+])/);
        var operands = [];
        var operators = [];
        _.each(parse, function (e, i) {
            if (i % 2 == 0) {
                operands.push(e);
            } else {
                operators.push(e);
            }
        });

        if (_.any(operators, function (op) { return op !== '*'; })) {
            throw "/ and + not implemented.";
        }

        this.xFn = function (d) { return d[operands[0]]; }
        this.yFn = function (d) { return d[operands[1]]; }
        return this;
    }


    function PointElement () {
        this.rFn = function (d) { return 5; };
        return this;
    }

    PointElement.prototype = new Element();

    PointElement.prototype.render = function (graph, data) {
        var that = this;
        var circle = graph.svg.append('g').selectAll('circle')
            .data(data)
            .enter()
            .append('circle')
            .attr('cx', function (d) { return graph.d3Scales[1](that.xFn(d)) })
            .attr('cy', function (d) { return graph.d3Scales[2](that.yFn(d)) })
            .attr('r', this.rFn);
    };

    function LineElement () { return this; }

    LineElement.prototype = new Element();

    LineElement.prototype.render = function (graph, data) {
        var e = this;
        function x (d) { return graph.d3Scales[1](e.xFn(d)); }
        function y (d) { return graph.d3Scales[2](e.yFn(d)); }

        var polyline = graph.svg.append('polyline')
            .attr('points', _.map(data, function (d) { return x(d) + ',' + y(d); }, this).join(' '))
            .attr('fill', 'none')
            .attr('stroke', 'black')
            .attr('stroke-width', 2);
    }

    function IntervalElement () { return this; }

    IntervalElement.prototype = new Element();

    IntervalElement.prototype.render = function (graph, data) {
        var that = this;
        var rect = graph.svg.append('g').selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('x', function (d) { return graph.d3Scales[1](that.xFn(d)) - 2.5; })
            .attr('width', 5)
            .attr('y', function (d) { return graph.d3Scales[2](that.yFn(d)); })
            .attr('height', function (d) { return graph.d3Scales[2](graph.scales[2]._min) - graph.d3Scales[2](that.yFn(d)); });
    };

    // Scales

    function Scale () { return this; }

    Scale.prototype.dim = function (d) {
        this._dim = d;
        return this;
    }

    Scale.prototype.min = function (m) {
        this._min = m;
        return this;
    }

    Scale.prototype.max = function (m) {
        this._max = m;
        return this;
    }

    function LinearScale () {
        this.d3Scale = d3.scale.linear();
        return this;
    }

    LinearScale.prototype = new Scale();

    function LogScale () {
        this.d3Scale = d3.scale.log();
        return this;
    }

    LogScale.prototype = new Scale();

    function CategoricalScale () {
        this.d3Scale = d3.scale.ordinal();
        return this;
    }

    CategoricalScale.prototype = new Scale();

    CategoricalScale.prototype.values = function (values) {
        this.domainSet = true;
        this.d3Scale.domain(values);
        return this;
    }


    function makeElement (spec) {
        var elementClasses = {
            point: PointElement,
            line: LineElement,
            interval: IntervalElement,
        };
        var e = new elementClasses[spec.geometry || 'point'];
        spec.position !== _undefined && e.position(spec.position);
        return e;
    }

    function makeScale (spec) {
        var scaleClasses = {
            linear: LinearScale,
            log: LogScale,
            categorical: CategoricalScale,
        };
        var s = new scaleClasses[spec.type || 'linear'];
        spec.dim !== _undefined && s.dim(spec.dim);
        spec.values !== _undefined && s.values(spec.values);
        spec.min !== _undefined && s.min(spec.min);
        spec.max !== _undefined && s.min(spec.max);
        return s;
    }

    ////////////////////////////////////////////////////////////////////////
    // API

    function gg (spec) {
        var g = new Graph();
        g.width = spec.width;
        g.height = spec.height;
        _.each(spec.elements, function (e) { g.element(makeElement(e)); });
        _.each(spec.scales, function (s) { g.scale(makeScale(s)); });
        return g;
    }

    window.gg = gg;

    ////////////////////////////////////////////////////////////////////////
    /// Examples

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
        { category: 'foo', count: 100 },
        { category: 'bar', count: 59 },
        { category: 'baz', count: 212 },
        { category: 'quux', count: 76 }
    ];


    $(document).ready(function() {

        function ex () { return d3.select('#examples').append('span'); }

        var w = 250;
        var h = 150;

        // Define graphs ...
        var scatterplot = gg({
            width: w,
            height: h,
            elements: [{ geometry: 'point', position: 'd*r' }]
        });

        var linechart = gg({
            width: w,
            height: h,
            elements: [{ geometry: 'line', position: 'd*r' }]
        });

        var barchart = gg({
            width: w,
            height: h,
            elements: [{ geometry: 'interval', position: 'd*r' }]
        });

        var histogram = gg({
            width: w,
            height: h,
            elements: [{ geometry: 'interval', position: 'category*count' }],
            scales: [
                { type: 'categorical', dim: 1, values: ['foo', 'bar', 'baz', 'quux'] },
                { type: 'linear', dim: 2, min: 0 }
            ]
        });

        var combined_points_and_line = gg({
            width: w,
            height: h,
            elements: [
                { geometry: 'point', position: 'd*r' },
                { geometry: 'line', position: 'd*r' },
            ],
        });

        var semi_log_scale = gg({
            width: w,
            height: h,
            elements: [
                { geometry: 'point', position: 'd*r' },
                { geometry: 'line', position: 'd*r' },
            ],
            scales: [ { type: 'log', dim: 2 } ]
        });

        // ... and render 'em
        scatterplot.render(ex(), data);
        linechart.render(ex(), data);
        barchart.render(ex(), data);
        histogram.render(ex(), categoricalData);
        combined_points_and_line.render(ex(), data);
        semi_log_scale.render(ex(), semiLogData);

    });

})();