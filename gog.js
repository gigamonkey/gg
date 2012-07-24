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

    CategoricalScale.prototype.values = function () {
        this.domainSet = true;
        this.d3Scale.domain(arguments);
        return this;
    }

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

        // scatterplot
        new Graph().size(w, h)
            .element(new PointElement().position('d*r'))
            .render(ex(), data);

        // line chart
        new Graph().size(w, h)
            .element(new LineElement().position('d*r'))
            .render(ex(), data);

        // bar chart
        new Graph().size(w, h)
            .element(new IntervalElement().position('d*r'))
            .render(ex(), data);

        // histogram
        new Graph().size(w, h)
            .element(new IntervalElement().position('category*count'))
            .scale(new CategoricalScale().dim(1).values('foo', 'bar', 'baz', 'quux'))
            .scale(new LinearScale().dim(2).min(0))
            .render(ex(), categoricalData);

        // combined points and line
        new Graph().size(w, h)
            .element(new PointElement().position('d*r'))
            .element(new LineElement().position('d*r'))
            .render(ex(), data);

        // semi-log scale
        new Graph().size(w, h)
            .element(new PointElement().position('d*r'))
            .element(new LineElement().position('d*r'))
            .scale(new LogScale().dim(2))
            .render(ex(), semiLogData);

    });

})();