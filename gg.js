;(function (exports) {

    var _undefined;

    function identity (x) { return x; }

    function Graphic () {
        this.layers = [];
        this.scales = {};
        return this;
    }

    Graphic.prototype.rangeFor = function (aesthetic) {
        if (aesthetic === 'x') {
            return [10, this.width - 20];
        } else if (aesthetic === 'y') {
            return [this.height - 20, 10];
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
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('fill', '#dcb')
            .attr('fill-opacity', 1);

        _.each(this.layers, function (e) { e.render(this, data); }, this);
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
        /* Not used yet
           this.statistic  = identity;
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
                this.scales[aesthetic] = Scale.default(aesthetic);
            }
        }, this);
    };

    Layer.prototype.trainScales = function (data) {
        this.ensureScales();
        _.each(this.aesthetics(), function (aesthetic) {
            var s = this.scaleFor(aesthetic);
            if (! s.domainSet) {
                if (s._min === _undefined) {
                    s._min = this.graphic.dataMin(data, aesthetic);
                }
                if (s._max === _undefined) {
                    s._max = this.graphic.dataMax(data, aesthetic);
                }
                s.domain([s._min, s._max]);
            }
            s.range(this.graphic.rangeFor(aesthetic));
        }, this);


    };


    Layer.prototype.render = function (graphic, data) {
        this.trainScales(data);
        this.geometry.render(graphic.svg, data);
    };

    Layer.prototype.dataValue = function (datum, aesthetic) {
        return datum[this.mappings[aesthetic]];
    };

    Layer.prototype.dataMin = function (data, aesthetic) {
        var e = this;
        function key (d) { return e.dataValue(d, aesthetic); }
        return e.dataValue(_.min(data, key), aesthetic);
    };

    Layer.prototype.dataMax = function (data, aesthetic) {
        var e = this;
        function key (d) { return e.dataValue(d, aesthetic); }
        return e.dataValue(_.max(data, key), aesthetic);
    };

    ////////////////////////////////////////////////////////////////////////
    // Geometry objects are the ones that actually draw stuff onto the
    // Graphic. They only care about scaled values which they can get
    // from their layer.

    function Geometry () { return this; }

    function PointGeometry () { return this; }

    PointGeometry.prototype = new Geometry();

    PointGeometry.prototype.render = function (svg, data) {
        var layer = this.layer;
        var circle = svg.append('g').selectAll('circle')
            .data(data)
            .enter()
            .append('circle')
            .attr('cx', function (d) { return layer.scaledValue(d, 'x'); })
            .attr('cy', function (d) { return layer.scaledValue(d, 'y'); })
            .attr('r', 5);
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

    function IntervalGeometry () { return this; }

    IntervalGeometry.prototype = new Geometry();

    IntervalGeometry.prototype.render = function (svg, data) {
        var layer = this.layer;
        var rect = svg.append('g').selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('x', function (d) { return layer.scaledValue(d, 'x') - 2.5; })
            .attr('y', function (d) { return layer.scaledValue(d, 'y'); })
            .attr('width', 5)
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

    function makeLayer (spec, graphic) {
        var geometry = new {
            point: PointGeometry,
            line: LineGeometry,
            interval: IntervalGeometry,
        }[spec.geometry || 'point'];

        var layer = new Layer(geometry, graphic);
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

        spec.aesthetic !== _undefined && s.aesthetic(spec.aesthetic);
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
        _.each(spec.layers, function (s) { g.layer(makeLayer(s, g)); });
        _.each(spec.scales, function (s) { g.scale(makeScale(s)); });
        return g;
    }

    exports.gg = gg;


})(window);