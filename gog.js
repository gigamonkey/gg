;(function () {

    var _undefined;

    function identity (x) { return x; }

    function Graphic () {
        this.layers = [];
        this.scales = {};
        return this;
    }

    Graphic.prototype.x = function (d, layer) {
        return this.scales['x'].scale(layer.dataValue(d, 'x'));
    }

    Graphic.prototype.y = function (d, layer) {
        return this.scales['y'].scale(layer.dataValue(d, 'y'));
    }

    Graphic.prototype.yMin = function () {
        return this.scales['y'].scale(this.scales['y']._min)
    }

    Graphic.prototype.rangeFor = function (dim) {
        if (dim === 'x') {
            return [10, this.width - 20];
        } else if (dim === 'y') {
            return [this.height - 20, 10];
        } else {
            throw 'Only 2d graphics supported: Bad dim: ' + dim;
        }
    };

    Graphic.prototype.dataMin = function (data, aesthetic) {
        var e = this.layers[0];
        function key (d) { return e.dataValue(d, aesthetic); }
        return e.dataValue(_.min(data, key), aesthetic);
    }

    Graphic.prototype.dataMax = function (data, aesthetic) {
        var e = this.layers[0];
        function key (d) { return e.dataValue(d, aesthetic); }
        return e.dataValue(_.max(data, key), aesthetic);
    }

    Graphic.prototype.render = function (where, data) {
        // Render the graph using the given data into the given
        // HTML element (a div or span usually).
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
        _.each(['x', 'y'], function (dim) {
            if (this.scales[dim] === _undefined) {
                this.scale(new LinearScale().dim(dim));
            }
        }, this);

        // Default the scale's domains if they are not supplied.
        _.each(this.scales, function (s, dim) {
            if (! s.domainSet) {
                if (s._min === _undefined) {
                    s._min = this.dataMin(data, dim);
                }
                if (s._max === _undefined) {
                    s._max = this.dataMax(data, dim);
                }
                s.domain([s._min, s._max]);
            }
            s.range(this.rangeFor(dim));
        }, this);

        _.each(this.layers, function (e) { e.render(this, data); }, this);
    };

    Graphic.prototype.layer = function (e) {
        this.layers.push(e);
        return this;
    };

    Graphic.prototype.scale = function (s) {
        this.scales[s._dim] = s;
        return this;
    };

    function Layer (geometry) {
        this.geometry = geometry;
        this.mappings   = {};
        /* Not used yet
           this.statistic  = identity;
           this.positioner = null;
           this.data       = null;
        */
        return this;
    }

    Layer.prototype.render = function (graph, data) {
        this.geometry.render(graph, data);
    }

    Layer.prototype.dataValue = function (datum, aesthetic) {
        return datum[this.mappings[aesthetic]];
    };

    function Geometry () { return this; }

    function PointGeometry () {
        this.rFn = function (d) { return 5; };
        return this;
    }

    PointGeometry.prototype = new Geometry();

    PointGeometry.prototype.render = function (graph, data) {
        var that = this;
        var layer = this.layer;
        var circle = graph.svg.append('g').selectAll('circle')
            .data(data)
            .enter()
            .append('circle')
            .attr('cx', function (d) { return graph.x(d, layer); })
            .attr('cy', function (d) { return graph.y(d, layer); })
            .attr('r', this.rFn);
    };

    function LineGeometry () { return this; }

    LineGeometry.prototype = new Geometry();

    LineGeometry.prototype.render = function (graph, data) {
        var layer = this.layer;
        function x (d) { return graph.x(d, layer); }
        function y (d) { return graph.y(d, layer); }

        var polyline = graph.svg.append('polyline')
            .attr('points', _.map(data, function (d) { return x(d) + ',' + y(d); }, this).join(' '))
            .attr('fill', 'none')
            .attr('stroke', 'black')
            .attr('stroke-width', 2);
    }

    function IntervalGeometry () { return this; }

    IntervalGeometry.prototype = new Geometry();

    IntervalGeometry.prototype.render = function (graph, data) {
        var layer = this.layer;
        var rect = graph.svg.append('g').selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('x', function (d) { return graph.x(d, layer) - 2.5; })
            .attr('y', function (d) { return graph.y(d, layer); })
            .attr('width', 5)
            .attr('height', function (d) { return graph.yMin() - graph.y(d, layer); });
    };

    ////////////////////////////////////////////////////////////////////////
    // Scales

    function Scale () { return this; }

    Scale.prototype.dim = function (d) {
        this._dim = d;
        return this;
    }

    Scale.prototype.domain = function (interval) {
        this.d3Scale = this.d3Scale.domain(interval);
        return this;
    }

    Scale.prototype.range = function (interval) {
        this.d3Scale = this.d3Scale.range(interval);
        return this;
    }

    Scale.prototype.scale = function (v) {
        return this.d3Scale(v);
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
        this.padding = .5;
        return this;
    }

    CategoricalScale.prototype = new Scale();

    CategoricalScale.prototype.values = function (values) {
        this.domainSet = true;
        this.d3Scale.domain(values);
        return this;
    }

    CategoricalScale.prototype.range = function (interval) {
        this.d3Scale = this.d3Scale.rangeBands(interval, this.padding);
        return this;
    }

    function makeLayer (spec) {
        var geometry = new {
            point: PointGeometry,
            line: LineGeometry,
            interval: IntervalGeometry,
        }[spec.geometry || 'point'];

        var layer = new Layer(geometry);
        geometry.layer = layer;
        spec.mapping !== _undefined && (layer.mappings = spec.mapping);
        return layer;
    }

    function makeScale (spec) {
        var s = new {
            linear: LinearScale,
            log: LogScale,
            categorical: CategoricalScale,
        }[spec.type || 'linear'];

        spec.dim !== _undefined && s.dim(spec.dim);
        spec.values !== _undefined && s.values(spec.values);
        spec.min !== _undefined && s.min(spec.min);
        spec.max !== _undefined && s.min(spec.max);
        return s;
    }

    ////////////////////////////////////////////////////////////////////////
    // API

    function gg (spec) {
        var g = new Graphic();
        g.width = spec.width;
        g.height = spec.height;
        _.each(spec.layers, function (e) { g.layer(makeLayer(e)); });
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
                { type: 'categorical', dim: 'x', values: ['foo', 'bar', 'baz', 'quux'] },
                { type: 'linear', dim: 'y', min: 0 }
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
            scales: [ { type: 'log', dim: 'y' } ]
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