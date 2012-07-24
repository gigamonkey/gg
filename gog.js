;(function () {

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
                this.scale(linear(dim(i)))
            }
        }

        // Default the scale's domains if they are not supplied.
        _.each(this.scales, function (s, dim) {
            if (! s.domainSet) {
                if (typeof s.min === 'undefined') {
                    s.min = (dim == 1) ? this.xMin(data) : this.yMin(data);
                }
                if (typeof s.max === 'undefined') {
                    s.max = (dim == 1) ? this.xMax(data) : this.yMax(data);
                }
                this.d3Scales[dim] = s.d3Scale.domain([s.min, s.max]).range(this.rangeForDim(dim));
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
        this.scales[s.dim] = s;
        return this;
    };

    function PointElement () {
        this.rFn = function (d) { return 5; };
        return this;
    }

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

    IntervalElement.prototype.render = function (graph, data) {
        var that = this;
        var rect = graph.svg.append('g').selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('x', function (d) { return graph.d3Scales[1](that.xFn(d)) - 2.5; })
            .attr('width', 5)
            .attr('y', function (d) { return graph.d3Scales[2](that.yFn(d)); })
            .attr('height', function (d) { return graph.d3Scales[2](graph.scales[2].min) - graph.d3Scales[2](that.yFn(d)); });
    };

    // Scales

    function LinearScale () {
        this.d3Scale = d3.scale.linear();
        return this;
    }

    function LogScale () {
        this.d3Scale = d3.scale.log();
        return this;
    }

    function CategoricalScale () {
        this.d3Scale = d3.scale.ordinal();
        return this;
    }

    ////////////////////////////////////////////////////////////////////////
    /// API

    // Elements

    function point () { return build(PointElement, arguments); }

    function line () { return build(LineElement, arguments); }

    function interval () { return build(IntervalElement, arguments); }

    // Scales

    function linear () { return build(LinearScale, arguments); }

    function log () { return build(LogScale, arguments); }

    function cat () { return build(CategoricalScale, arguments); }

    // Set the dimension of a scale.
    function dim (v) {
        return function (scale) { scale.dim = v; }
    }

    function values () {
        var d = arguments;
        return function (scale) {
            scale.domainSet = true;
            scale.d3Scale.domain(d);
        }
    }

    // Set the minimum value of a scale.
    function min (v) {
        return function (scale) { scale.min = v; }
    }

    // Set the maximum value of a scale.
    function max (v) {
        return function (scale) { scale.max = v; }
    }

    function position(expr) {
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

        return function (e) {
            e.xFn = function (d) { return d[operands[0]]; }
            e.yFn = function (d) { return d[operands[1]]; }
        }
    }

    ////////////////////////////////////////////////////////////////////////
    /// Internals

    // This is a kind of goofy way to do things but it enables us to
    // follow the Graphics Production Language pretty closely.
    function build (constructor, args) {
        var obj = new constructor();
        _.each(args, function (fn) { fn(obj); });
        return obj;
    }

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

        var g = new Graph().size(250, 150);
        var p = new PointElement();
        position('d*r')(p);
        g.element(p).render(ex(), data);

        // scatterplot
        new Graph().size(w, h).element(point(position('d*r'))).render(ex(), data);

        // line chart
        new Graph().size(w, h).element(line(position('d*r'))).render(ex(), data);

        // bar chart
        new Graph().size(w, h).element(interval(position('d*r'))).render(ex(), data);

        // histogram
        new Graph().size(w, h)
            .element(interval(position('category*count')))
            .scale(cat(dim(1), values('foo', 'bar', 'baz', 'quux')))
            .scale(linear(dim(2), min(0)))
            .render(ex(), categoricalData);

        // combined points and line
        new Graph().size(w, h)
            .element(point(position('d*r')))
            .element(line(position('d*r')))
            .render(ex(), data);

        // semi-log scale
        new Graph().size(w, h)
            .element(point(position('d*r')))
            .element(line(position('d*r')))
            .scale(log(dim(2)))
            .render(ex(), semiLogData);

    });

})();