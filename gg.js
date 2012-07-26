;(function (exports) {

    // TODO:
    // 1. Use d3 svg API where possible.
    // 2. Make sure axes and actual plotting is lined up properly.

    var _undefined;

    var json = JSON.stringify;

    function Graphic () {
        this.layers = [];
        this.scales = {};
        return this;
    }

    var padding = 25;

    Graphic.prototype.rangeFor = function (aesthetic) {
        if (aesthetic === 'x') {
            return [padding, this.width - padding];
        } else if (aesthetic === 'y') {
            return [this.height - padding, padding];
        } else {
            throw 'Only 2d graphics supported. Unknown aesthetic: ' + aesthetic;
        }
    };

    Graphic.prototype.dataMin = function (data, aesthetic) {
        function key (layer) { return layer.dataMin(data, aesthetic); }
        return key(_.min(this.layers, key));
    }

    Graphic.prototype.dataMax = function (data, aesthetic) {
        function key (layer) { return layer.dataMax(data, aesthetic); }
        return key(_.max(this.layers, key));
    }

    Graphic.prototype.render = function (where, data) {
        // Render the graphic using the given data into the given HTML
        // element (a div or span usually).
        this.svg = where.append('svg')
            .attr('width', this.width)
            .attr('height', this.height);

        this.svg.append('rect')
            .attr('class', 'base')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.width)
            .attr('height', this.height);

        _.each(this.layers, function (e) { e.prepare(data); });

        var xAxis = d3.svg.axis()
            .scale(this.scales['x'].d3Scale)
            .tickSize(-(this.height - (2*padding)))
            .orient('bottom');

        var yAxis = d3.svg.axis()
            .scale(this.scales['y'].d3Scale)
            .tickSize(-(this.width - (2*padding)))
            .orient('left');

        this.svg.append('svg:g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(0,' + (this.height - padding) + ')')
            .call(xAxis);

        this.svg.append('svg:g')
            .attr('class', 'y axis')
            .attr('transform', 'translate(' + padding + ',0)')
            .call(yAxis);

        _.each(this.layers, function (e) { e.render(this); }, this);

    };

    Graphic.prototype.layer = function (e) {
        this.layers.push(e);
        return this;
    };

    Graphic.prototype.scale = function (s) {
        this.scales[s._aesthetic] = s;
        return this;
    };

    function Layer (geometry, graphic) {
        this.geometry = geometry;
        this.graphic  = graphic;
        this.mappings = {};
        this.scales   = {};
        this.statistic = null;
        /* Not used yet
           this.positioner = null;
           this.data       = null;
        */
        return this;
    }

    Layer.prototype.scaleFor = function (aesthetic) {
        return this.scales[aesthetic] || this.graphic.scales[aesthetic]
    };

    Layer.prototype.scaledValue = function (d, aesthetic) {
        return this.scaleFor(aesthetic).scale(this.dataValue(d, aesthetic));
    };

    Layer.prototype.scaledMin = function (aesthetic) {
        var s = this.scaleFor(aesthetic);
        return s.scale(s._min);
    };

    Layer.prototype.aesthetics = function () {
        return _.keys(this.mappings);
    }

    Layer.prototype.ensureScales = function () {
        // Need a scale for each aesthetic we care about.
        _.each(this.aesthetics(), function (aesthetic) {
            if (! this.scaleFor(aesthetic)) {
                this.graphic.scales[aesthetic] = Scale.default(aesthetic);
            }
        }, this);
    };

    Layer.prototype.trainScales = function (data) {
        this.ensureScales();
        _.each(this.aesthetics(), function (aesthetic) {
            var s = this.scaleFor(aesthetic);
            if (! s.domainSet) {
                s.defaultDomain(this, data, aesthetic);
            }
            s.range(this.graphic.rangeFor(aesthetic));
        }, this);
    };

    Layer.prototype.prepare = function (data) {
        this.newData = this.statistic.compute(data);
        this.trainScales(this.newData);
    };

    Layer.prototype.render = function (graphic) {
        this.geometry.render(graphic.svg, this.newData);
    };

    Layer.prototype.dataValue = function (datum, aesthetic) {
        return datum[this.mappings[aesthetic]];
    };

    Layer.prototype.dataMin = function (data, aesthetic) {
        var e = this;
        function key (d) { return e.dataValue(d, aesthetic); }
        return key(_.min(data, key));
    };

    Layer.prototype.dataMax = function (data, aesthetic) {
        var e = this;
        function key (d) { return e.dataValue(d, aesthetic); }
        return key(_.max(data, key));
    };

    ////////////////////////////////////////////////////////////////////////
    // Geometry objects are the ones that actually draw stuff onto the
    // Graphic. They only care about scaled values which they can get
    // from their layer.

    function Geometry () { return this; }

    function PointGeometry (spec) {
        this.size = spec.size || 5;
        return this;
    }

    PointGeometry.prototype = new Geometry();

    PointGeometry.prototype.render = function (svg, data) {
        var layer = this.layer;
        var circle = svg.append('g').selectAll('circle')
            .data(data)
            .enter()
            .append('circle')
            .attr('cx', function (d) { return layer.scaledValue(d, 'x'); })
            .attr('cy', function (d) { return layer.scaledValue(d, 'y'); })
            .attr('r', this.size);
    };

    function LineGeometry () { return this; }

    LineGeometry.prototype = new Geometry();

    LineGeometry.prototype.render = function (svg, data) {
        var layer = this.layer;
        function x (d) { return layer.scaledValue(d, 'x'); }
        function y (d) { return layer.scaledValue(d, 'y'); }

        var polyline = svg.append('polyline')
            .attr('points', _.map(data, function (d) { return x(d) + ',' + y(d); }, this).join(' '))
            .attr('fill', 'none')
            .attr('stroke', 'black')
            .attr('stroke-width', 2);
    };

    function IntervalGeometry (spec) {
        this.width = spec.width || 5;
        return this;
    }

    IntervalGeometry.prototype = new Geometry();

    IntervalGeometry.prototype.render = function (svg, data) {
        var layer = this.layer;
        var width = this.width;
        var rect = svg.append('g').selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('x', function (d) { return layer.scaledValue(d, 'x') - width/2; })
            .attr('y', function (d) { return layer.scaledValue(d, 'y'); })
            .attr('width', width)
            .attr('height', function (d) { return layer.scaledMin('y') - layer.scaledValue(d, 'y'); });
    };

    ////////////////////////////////////////////////////////////////////////
    // Scales -- a scale is used to map from data values to aesthetic
    // values. Each layer maps certain variables or expressions to
    // certain aesthetics (e.g. the data may contain 'height' and
    // 'weight' which are mapped to the standard 'x' and 'y'
    // aesthetics.)

    function Scale () { return this; }

    Scale.default = function (aesthetic) {
        var clazz = {
            x: LinearScale,
            y: LinearScale,
        }[aesthetic];

        if (! clazz) {
            throw 'No default scale for aesthetic ' + aesthetic;
        }
        return new clazz().aesthetic(aesthetic);
    };

    Scale.prototype.aesthetic = function (a) {
        this._aesthetic = a;
        return this;
    }

    Scale.prototype.defaultDomain = function (layer, data, aesthetic) {
        if (this._min === _undefined) {
            this._min = layer.graphic.dataMin(data, aesthetic);
        }
        if (this._max === _undefined) {
            this._max = layer.graphic.dataMax(data, aesthetic);
        }
        this.domain([this._min, this._max]);

    };

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
        // Setting padding to 1 seems to be required to get bars to
        // line up with axis ticks. Needs more investigation.
        this.padding = 1;
        return this;
    }

    CategoricalScale.prototype = new Scale();

    CategoricalScale.prototype.values = function (values) {
        this.domainSet = true;
        this.d3Scale.domain(values);
        return this;
    }

    CategoricalScale.prototype.defaultDomain = function (layer, data, aesthetic) {
        function val (d) { return layer.dataValue(d, aesthetic); }
        var values = _.uniq(_.map(data, val));
        values.sort(function (a,b) { return a - b; });
        this.values(values);
    }

    CategoricalScale.prototype.range = function (interval) {
        this.d3Scale = this.d3Scale.rangeBands(interval, this.padding);
        return this;
    }

    function makeLayer (spec, graphic) {
        var geometry = new {
            point: PointGeometry,
            line: LineGeometry,
            interval: IntervalGeometry,
        }[spec.geometry || 'point'](spec);

        var layer = new Layer(geometry, graphic);
        geometry.layer = layer;
        spec.mapping !== _undefined && (layer.mappings = spec.mapping);
        layer.statistic = makeStatistic(spec.statistic || { kind: 'identity' });
        return layer;
    }

    function makeScale (spec) {
        var s = new {
            linear: LinearScale,
            log: LogScale,
            categorical: CategoricalScale,
        }[spec.type || 'linear'];

        spec.aesthetic !== _undefined && s.aesthetic(spec.aesthetic);
        spec.values !== _undefined && s.values(spec.values);
        spec.min !== _undefined && s.min(spec.min);
        spec.max !== _undefined && s.max(spec.max);
        return s;
    }

    function makeStatistic (spec) {
        return new {
            identity: Identity,
            bin: Bin,
        }[spec.kind](spec);
    }


    ////////////////////////////////////////////////////////////////////////
    // Statistics

    function Statistic () { return this; }

    function Identity () { return this; }

    Identity.prototype = new Statistic();

    Identity.prototype.compute = function (data) { return data; }

    function Bin (spec) {
        this.variable = spec.variable;
        this.binsize  = spec.binsize || 10;
        return this;
    }

    Bin.prototype = new Statistic();

    // Cannonical histogram. We have height/weight data for a few
    // thousand people. We want to see the distribution of weights so
    // we make a histogram of the number of people's whose weights
    // fall in 10lb bins => [ { min: 0, max: 10, count: 0 }, {min: 10, max: 20, count: 0 }, ... ]
    Bin.prototype.compute = function (data) {
        // Loop through the data counting the number of occurrences of
        // each value of a given variable (for categorical values) or
        // the number of values that fall in bins of a given size.
        var values = _.pluck(data, this.variable);
        var bins = {};
        _.each(values, function (v) {
            var bin = Math.ceil(v / this.binsize);
            if (bins[bin] === _undefined) {
                bins[bin] = 0;
            }
            bins[bin]++;
        }, this);
        var result = _.map(bins, function (count, bin) {
            return { bin: bin, count: count };
        });
        return result;
    };


    ////////////////////////////////////////////////////////////////////////
    // API

    function gg (spec) {
        var g = new Graphic();
        g.width = spec.width;
        g.height = spec.height;
        _.each(spec.layers, function (s) { g.layer(makeLayer(s, g)); });
        _.each(spec.scales, function (s) { g.scale(makeScale(s)); });
        return g;
    }

    exports.gg = gg;


})(window);