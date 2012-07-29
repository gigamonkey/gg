;(function (exports) {

    // TODO:
    // 1. Use d3 svg API where possible.
    // 2. Make sure axes and actual plotting is lined up properly.

    var _undefined;

    var json = JSON.stringify;

    // This should obviously not be hard-wired here.
    var padding = 25;

    function Graphic () {
        this.layers = [];
        this.scales = {};
    }

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

    Graphic.prototype.render = function (width, height, where, data) {
        // Render the graphic using the given data into the given HTML
        // element (a div or span usually).
        this.width = width;
        this.height = height;

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

        this.svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(0,' + (this.height - padding) + ')')
            .call(xAxis);

        this.svg.append('g')
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

    ////////////////////////////////////////////////////////////////////////
    // Layers

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
    }

    Layer.fromSpec = function (spec, graphic) {
        var geometry = new {
            point: PointGeometry,
            line: LineGeometry,
            interval: IntervalGeometry,
            box: BoxPlotGeometry,
        }[spec.geometry || 'point'](spec);

        var layer = new Layer(geometry, graphic);
        geometry.layer = layer;
        spec.mapping !== _undefined && (layer.mappings = spec.mapping);
        layer.statistic = Statistic.fromSpec(spec.statistic || { kind: 'identity' });
        return layer;
    };



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

    Layer.prototype.trainScales = function (newData) {
        this.ensureScales();
        _.each(this.aesthetics(), function (aesthetic) {
            var s = this.scaleFor(aesthetic);
            if (! s.domainSet) {
                s.defaultDomain(this, newData, aesthetic);
            }
            if (aesthetic == 'x' || aesthetic == 'y') {
                s.range(this.graphic.rangeFor(aesthetic));
            }
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
        if (this.mappings[aesthetic]) {
            var e = this;
            function key (d) { return e.dataValue(d, aesthetic); }
            return key(_.min(data, key));
        } else {
            return this.statistic.dataRange(data)[0];
        }
    };

    Layer.prototype.dataMax = function (data, aesthetic) {
        if (this.mappings[aesthetic]) {
            var e = this;
            function key (d) { return e.dataValue(d, aesthetic); }
            return key(_.max(data, key));
        } else {
            return this.statistic.dataRange(data)[1];
        }
    };

    ////////////////////////////////////////////////////////////////////////
    // Geometry objects are the ones that actually draw stuff onto the
    // Graphic. They only care about scaled values which they can get
    // from their layer.

    function Geometry () {}

    function PointGeometry (spec) {
        this.size = spec.size || 5;
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

    function LineGeometry () {}

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
    }

    IntervalGeometry.prototype = new Geometry();

    IntervalGeometry.prototype.render = function (svg, data) {
        var layer = this.layer;
        var width = this.width;

        function scale (d, aesthetic) { return layer.scaledValue(d, aesthetic); }

        var rect = svg.append('g').selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('x', function (d) { return scale(d, 'x') - width/2; })
            .attr('y', function (d) { return scale(d, 'y'); })
            .attr('width', width)
            .attr('height', function (d) { return layer.scaledMin('y') - scale(d, 'y'); });

        if ('color' in layer.mappings) {
            rect.style('fill', function(d) { return scale(d, 'color'); });
        }
    };


    function BoxPlotGeometry (spec) {
        this.width = spec.width || 10;
    }

    BoxPlotGeometry.prototype = new Geometry();

    BoxPlotGeometry.prototype.render = function (svg, data) {
        // Data points are { group, median, q1, q3, upper, lower, outliers }
        var layer = this.layer;
        var width = this.width;

        function scale (v, aesthetic) {
            return layer.scaleFor(aesthetic).scale(v);
        }

        var boxes = svg.append('g').selectAll('g').data(data).enter();

        // IQR box
        boxes.append('rect')
            .attr('class', 'boxplot iqr')
            .attr('x', function (d) { return scale(d.group, 'x') - width/2; })
            .attr('y', function (d) { return scale(d.q3, 'y'); })
            .attr('width', width)
            .attr('height', function (d) {
                return scale(d.q1, 'y') - scale(d.q3, 'y');
            });

        // median line
        boxes.append('line')
            .attr('class', 'boxplot median')
            .attr('x1', function (d) { return scale(d.group, 'x') - width/2; })
            .attr('x2', function (d) { return scale(d.group, 'x') + width/2; })
            .attr('y1', function (d) { return scale(d.median, 'y'); })
            .attr('y2', function (d) { return scale(d.median, 'y'); });

        // upper whisker
        boxes.append('line')
            .attr('class', 'boxplot whisker')
            .attr('x1', function (d) { return scale(d.group, 'x'); })
            .attr('x2', function (d) { return scale(d.group, 'x'); })
            .attr('y1', function (d) { return scale(d.q3, 'y'); })
            .attr('y2', function (d) { return scale(d.upper, 'y'); });

        // upper whisker tick
        boxes.append('line')
            .attr('class', 'boxplot whisker')
            .attr('x1', function (d) { return scale(d.group, 'x') - (width * .4); })
            .attr('x2', function (d) { return scale(d.group, 'x') + (width * .4); })
            .attr('y1', function (d) { return scale(d.upper, 'y'); })
            .attr('y2', function (d) { return scale(d.upper, 'y'); });

        // lower whisker
        boxes.append('line')
            .attr('class', 'boxplot whisker-tick')
            .attr('x1', function (d) { return scale(d.group, 'x'); })
            .attr('x2', function (d) { return scale(d.group, 'x'); })
            .attr('y1', function (d) { return scale(d.q1, 'y'); })
            .attr('y2', function (d) { return scale(d.lower, 'y'); });

        // lower whisker tick
        boxes.append('line')
            .attr('class', 'boxplot whisker-tick')
            .attr('x1', function (d) { return scale(d.group, 'x') - (width * .4); })
            .attr('x2', function (d) { return scale(d.group, 'x') + (width * .4); })
            .attr('y1', function (d) { return scale(d.lower, 'y'); })
            .attr('y2', function (d) { return scale(d.lower, 'y'); });


        // outliers
        var outliers = [];
        _.each(data, function (d) {
            _.each(d.outliers, function (o) {
                outliers.push({ group: d.group, value: o });
            });
        });

        var o = svg.append('g').selectAll('circle.outliers').data(outliers).enter();
        o.append('circle')
            .attr('class', 'boxplot outliers')
            .attr('cx', function (d) { return scale(d.group, 'x'); })
            .attr('cy', function (d) { return scale(d.value, 'y'); })
            .attr('r', 2);
    }



    ////////////////////////////////////////////////////////////////////////
    // Scales -- a scale is used to map from data values to aesthetic
    // values. Each layer maps certain variables or expressions to
    // certain aesthetics (e.g. the data may contain 'height' and
    // 'weight' which are mapped to the standard 'x' and 'y'
    // aesthetics.)

    function Scale () {}

    Scale.fromSpec = function (spec) {
        var s = new {
            linear: LinearScale,
            log: LogScale,
            categorical: CategoricalScale,
            color: ColorScale
        }[spec.type || 'linear'];

        spec.aesthetic !== _undefined && s.aesthetic(spec.aesthetic);
        spec.values !== _undefined && s.values(spec.values);
        spec.min !== _undefined && s.min(spec.min);
        spec.max !== _undefined && s.max(spec.max);
        return s;
    };

    Scale.default = function (aesthetic) {
        var clazz = {
            x: LinearScale,
            y: LinearScale,
            color: ColorScale
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
        this.domainSet = true;
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

    function ColorScale() {
        this.d3Scale = d3.scale.category20();
    }

    ColorScale.prototype = new CategoricalScale();

    ////////////////////////////////////////////////////////////////////////
    // Statistics

    function Statistic () {}

    Statistic.fromSpec = function (spec) {
        return new {
            identity: IdentityStatistic,
            bin: BinStatistic,
            box: BoxPlotStatistic,
            sum: SumStatistic,
        }[spec.kind](spec);
    };

    function IdentityStatistic () {}

    IdentityStatistic.prototype = new Statistic();

    IdentityStatistic.prototype.compute = function (data) { return data; }

    function BinStatistic (spec) {
        this.variable = spec.variable;
        this.bins     = spec.bins || 20;
    }

    BinStatistic.prototype = new Statistic();

    BinStatistic.prototype.compute = function (data) {
        var values = _.pluck(data, this.variable);
        var bins = d3.layout.histogram().bins(this.bins)(values);
        return _.map(bins, function (bin, i) {
            return { bin: i, count: bin.y };
        });
    };

    function SumStatistic (spec) {
        this.group    = spec.group || false;
        this.variable = spec.variable;
    }

    SumStatistic.prototype = new Statistic();

    SumStatistic.prototype.compute = function (data) {
        var groups = splitByGroups(data, this.group, this.variable);
        return _.map(groups, function (values, name) {
            return {
                group: name,
                count: values.length,
                sum: d3.sum(values),
                min: d3.min(values),
                max: d3.max(values),
            }
        });
    };

    function BoxPlotStatistic (spec) {
        this.group = spec.group || false;
        this.variable = spec.variable || 'value';
    }

    BoxPlotStatistic.prototype = new Statistic();

    BoxPlotStatistic.prototype.dataRange = function (data) {
        return [
            _.min(_.pluck(data, 'min')),
            _.max(_.pluck(data, 'max'))
        ];
    };

    BoxPlotStatistic.prototype.compute = function (data) {
        // Split data by the group variable (if provided) and for each
        // group return an object with:
        //
        // {
        //   group:    <name of group ('data' if no group variable specified))>,
        //   median:   <median value>,
        //   q1:       <first quartile value>,
        //   q3:       <third quartile value>,
        //   upper:    <highest value within 1.5 IQR of q3>,
        //   lower:    <lowest value within 1.5 IQR of q1>,
        //   outliers: <list of values less than lower or greater than upper>
        //   min:      <the single minimum value>
        //   max:      <the single maximum value>
        // }

        var groups = splitByGroups(data, this.group, this.variable);

        return _.map(groups, function (values, name) {
            values.sort(d3.ascending);

            var q1       = d3.quantile(values, .25);
            var median   = d3.quantile(values, .5);
            var q3       = d3.quantile(values, .75);
            var lower    = q1;
            var upper    = q3;
            var min      = values[0];
            var max      = values[values.length - 1];
            var outliers = [];

            var fenceRange = 1.5 * (q3 - q1);
            var lowerFence = q1 - fenceRange;
            var upperFence = q3 + fenceRange;

            // This could be smarter if we only look at values outside
            // q1 and q3. Unfortunately, using d3.quantiles means we
            // don't know what the indices of q1 and q3 are.
            _.each(values, function (v) {
                if (v < lowerFence || v > upperFence) {
                    // outside the fences
                    outliers.push(v);
                } else if (v < lower) {
                    // inside fences and less than than current lower
                    lower = v;
                } else if (v > upper) {
                    // inside fences and more than than current upper
                    upper = v;
                }
            });

            var r = {
                group:    name,
                q1:       q1,
                median:   median,
                q3:       q3,
                lower:    lower,
                upper:    upper,
                outliers: outliers,
                min:      min,
                max:      max,
            };
            return r;
        });
    };

    function splitByGroups (data, group, variable) {
        var groups = {};
        if (group) {
            // Split values by group, if supplied.
            _.each(data, function (d) {
                var g = d[group];
                if (! groups[g]) { groups[g] = []; }
                groups[g].push(d[variable]);
            }, this);
        } else {
            // Or put all data in one 'data' group.
            groups['data'] = _.pluck(data, variable);
        }
        return groups;
    }

    ////////////////////////////////////////////////////////////////////////
    // API

    function gg (spec) {
        var g = new Graphic();
        _.each(spec.layers, function (s) { g.layer(Layer.fromSpec(s, g)); });
        _.each(spec.scales, function (s) { g.scale(Scale.fromSpec(s)); });
        return g;
    }

    exports.gg = gg;

})(window);