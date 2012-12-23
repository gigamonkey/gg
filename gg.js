;(function (exports, undefined) {

    var _ = exports._;
    var d3 = exports.d3;

    // Provide Node compatibility
    if (!_ && !d3 && typeof require !== 'undefined') {
        d3 = require('d3');
        _ = require('underscore');
    }

    function Graphic (opts) {
        this.layers = [];
        this.scales = {};

        opts = opts || { padding: 35 };
        this.paddingX = opts.paddingX || opts.padding;
        this.paddingY = opts.paddingY || opts.padding;
    }

    Graphic.fromSpec = function (spec, opts) {
        var g = new Graphic(opts);
        _.each(spec.layers, function (s) { g.layer(Layer.fromSpec(s, g)); });
        _.each(spec.scales, function (s) { g.scale(Scale.fromSpec(s)); });
        g.facets = Facets.fromSpec(spec.facets, g);
        return g;
    };

    Graphic.prototype.rangeFor = function (aesthetic) {
        if (aesthetic === 'x') {
            return [this.paddingX, this.width - this.paddingX];
        } else if (aesthetic === 'y') {
            return [this.height - this.paddingY, this.paddingY];
        } else {
            throw 'Only 2d graphics supported. Unknown aesthetic: ' + aesthetic;
        }
    };

    Graphic.prototype.ensureScales = function () {
        var aesthetics = _.union(_.flatten(_.invoke(this.layers, 'aesthetics')));
        _.each(aesthetics, function (aesthetic) {
            if (! this.scales[aesthetic]) {
                this.scales[aesthetic] = Scale.defaultFor(aesthetic);
            }
        }, this);
    };

    Graphic.prototype.prepareLayers = function (data) {
        _.each(this.layers, function (e) { e.prepare(data); });
    };

    Graphic.prototype.dataMin = function (data, aesthetic) {
        var layers = this.layersWithAesthetic(aesthetic);
        function key (layer) { return layer.dataMin(data, aesthetic); }
        return key(_.min(layers, key));
    };

    Graphic.prototype.dataMax = function (data, aesthetic) {
        var layers = this.layersWithAesthetic(aesthetic);
        function key (layer) { return layer.dataMax(data, aesthetic); }
        return key(_.max(layers, key));
    };

    Graphic.prototype.layersWithAesthetic = function(aesthetic){
        function hasAesthetic (layer) { return (aesthetic in layer.mappings); }
        return _.filter(this.layers, hasAesthetic);
    };

    Graphic.prototype.render = function (width, height, where, data) {
        // Render the graphic using the given data into the given HTML
        // element (a div or span usually).
        this.width = width;
        this.height = height;

        this.svg = where.append('svg')
            .attr('width', this.width)
            .attr('height', this.height);

        this.facets.render(width, height, this.svg, data);
    };

    Graphic.prototype.layer = function (e) {
        this.layers.push(e);
    };

    Graphic.prototype.scale = function (s) {
        this.scales[s.aesthetic] = s;
    };

    Graphic.prototype.legend = function (aesthetic) {
        return this.scales[aesthetic].legend || this.layers[0].legend(aesthetic);
    };


    ////////////////////////////////////////////////////////////////////////
    // Facets -- every graphic has at least one facet. (The simple
    // case is one trivial facet that renders the whole graphic.) The
    // Facet object knows how to split up the data into groups that
    // will each be rendered into a separate facet, and how to split
    // up the area of the graphic appropriately. There are five
    // layouts: horizontal, vertical, and horizontal flow, vertical
    // flow, and grid. The horizontal layout divides the graphic into
    // evenly sized elements that are arranged in a single row;
    // vertical divides the graphic into evenly sized elements that
    // are arranged in a single column. ...

    var Facets = {};

    Facets.fromSpec = function (spec, graphic) {
        if (spec === undefined) {
            return new SingleFacet(graphic);
        } else {
            throw 'Other facets not yet implemented.';
        }
    };

    // Used when the whole graphic is renderered in a single facet.
    function SingleFacet (graphic) {
        this.graphic = graphic;
    };

    SingleFacet.prototype.render = function (width, height, svg, data) {
        this.width  = width;
        this.height = height;

        svg.append('rect')
            .attr('class', 'base')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.width)
            .attr('height', this.height);

        this.graphic.ensureScales();
        this.graphic.prepareLayers(data);

        var xAxis = d3.svg.axis()
            .scale(this.graphic.scales['x'].d3Scale)
            .tickSize(2*this.graphic.paddingY - this.height)
            .orient('bottom');

        var yAxis = d3.svg.axis()
            .scale(this.graphic.scales['y'].d3Scale)
            .tickSize(2*this.graphic.paddingX - this.width)
            .orient('left');

        svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(0,' + (this.height - this.graphic.paddingY) + ')')
            .call(xAxis);

        svg.append('g')
            .attr('class', 'y axis')
            .attr('transform', 'translate(' + this.graphic.paddingX + ',0)')
            .call(yAxis);

        svg.append('g')
            .attr('class', 'x legend')
            .attr('transform', 'translate(' + (this.width / 2) + ',' + (this.height - 5) + ')')
            .append('text')
            .text(this.graphic.legend('x'))
            .attr('text-anchor', 'middle');

        svg.append('g')
            .attr('class', 'y legend')
            .attr('transform', 'translate(' + 10 + ',' + (this.height /2) + ') rotate(270)')
            .append('text')
            .text(this.graphic.legend('y'))
            .attr('text-anchor', 'middle');

        _.each(
            this.graphic.layers,
            function (layer) { layer.render(this.graphic.svg.append('g')); },
            this);
    };

    ////////////////////////////////////////////////////////////////////////
    // Layers

    function Layer (geometry, graphic) {
        this.geometry = geometry;
        this.graphic  = graphic;
        this.mappings = {};
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
            area: AreaGeometry,
            interval: IntervalGeometry,
            box: BoxPlotGeometry,
            text: TextGeometry
        }[spec.geometry || 'point'](spec);

        var layer = new Layer(geometry, graphic);
        geometry.layer = layer;
        spec.mapping !== undefined && (layer.mappings = spec.mapping);
        layer.statistic = Statistics.fromSpec(spec.statistic || { kind: 'identity' });
        return layer;
    };

    Layer.prototype.scaleExtracted = function (v, aesthetic, d) {
        return this.graphic.scales[aesthetic].scale(v, d);
    };

    Layer.prototype.scaledValue = function (d, aesthetic) {
        return this.scaleExtracted(this.dataValue(d, aesthetic), aesthetic, d);
    };

    Layer.prototype.scaledMin = function (aesthetic) {
        var s = this.graphic.scales[aesthetic];
        return s.scale(s.min);
    };

    Layer.prototype.aesthetics = function () {
        return _.without(_.keys(this.mappings), 'group');
    };

    Layer.prototype.trainScales = function (newData) {
        _.each(this.aesthetics(), function (aesthetic) {
            var s = this.graphic.scales[aesthetic];
            // This is not really right--if we have multiple layers
            // rendering via the same scale, they might have different
            // domains. So really we should adjust the domain of the
            // scale to encompass all the data of all the layers that
            // use it.
            if (aesthetic === 'text') {
                s.prepare(this, newData, aesthetic);
                return;
            }
            if (! s.domainSet) {
                s.defaultDomain(this, newData, aesthetic);
            }
            if (aesthetic === 'x' || aesthetic === 'y') {
                s.range(this.graphic.rangeFor(aesthetic));
            }
        }, this);
    };

    Layer.prototype.prepare = function (data) {
        this.newData = this.statistic.compute(data, this.mappings);
        this.newData = _.values(groupData(this.newData, this.mappings.group));
        this.trainScales(this.newData);
    };

    Layer.prototype.render = function (g) {
        this.geometry.render(g, this.newData);
    };

    Layer.prototype.dataValue = function (datum, aesthetic) {
        return datum[this.mappings[aesthetic]];
    };

    Layer.prototype.dataMin = function (data, aesthetic) {
        if (this.mappings[aesthetic]) {
            var e = this;
            function key (d) { return e.dataValue(d, aesthetic); }
            function min (d) { return _.min(d, key); }
            return key(min(_.map(data, min)))
        } else {
            return this.statistic.dataRange(data)[0];
        }
    };

    Layer.prototype.dataMax = function (data, aesthetic) {
        if (this.mappings[aesthetic]) {
            var e = this;
            function key (d) { return e.dataValue(d, aesthetic); }
            function max (d) { return _.max(d, key); }
            return key(max(_.map(data, max)))
        } else {
            return this.statistic.dataRange(data)[1];
        }
    };

    Layer.prototype.legend = function (aesthetic) {
        return this.mappings[aesthetic] || this.statistic.variable;
    };

    ////////////////////////////////////////////////////////////////////////
    // Geometry objects are the ones that actually draw stuff onto the
    // Graphic. They only care about scaled values which they can get
    // from their layer.

    function Geometry () {}

    function attributeValue (layer, aesthetic, defaultValue) {
        return (aesthetic in layer.mappings) ?
            function (d) { return layer.scaledValue(d, aesthetic); } : defaultValue;
    }

    function PointGeometry (spec) {
        this.size  = spec.size || 5;
        this.alpha = spec.alpha || 1;
        this.color = spec.color || 'black';
    }

    PointGeometry.prototype = new Geometry();

    PointGeometry.prototype.render = function (g, data) {
        var layer = this.layer;
        groups(g, 'circles', data).selectAll('circle')
            .data(Object)
            .enter()
            .append('circle')
            .attr('cx', function (d) { return layer.scaledValue(d, 'x'); })
            .attr('cy', function (d) { return layer.scaledValue(d, 'y'); })
            .attr('fill-opacity', this.alpha)
            .attr('fill', attributeValue(layer, 'color', this.color))
            .attr('r', attributeValue(layer, 'size', this.size));
    };

    function AreaGeometry (spec) {
        this.color = spec.color || 'black';
        this.width = spec.width || 2;
        this.fill = spec.fill || "black";
        this.alpha = spec.alpha || 1;
        this.stroke = spec.stroke || this.fill;
    }

    AreaGeometry.prototype =  new Geometry();

    AreaGeometry.prototype.render = function (g, data) {
        var layer = this.layer;
        function scale (d, key, aesthetic) { return layer.scaleExtracted(d[key], aesthetic, d); }

        var area = d3.svg.area()
                         .x(function (d) { return scale(d, "x", "x") })
                         .y1(function(d) { return scale(d, "y1", "y") })
                         .y0(function (d) { return scale(d, "y0", "y") })
                         .interpolate("basis")

        groups(g, 'lines', data).selectAll('polyline')
            .data(function(d) { return [d]; })
            .enter()
            .append("svg:path")
            .attr("d", area)
            .attr('stroke-width', this.width)
            .attr('stroke', this.stroke)
            .attr('fill', this.fill)
            .attr('fill-opacity', this.alpha)
            .attr('stroke-opacity', this.alpha)
    };

    function LineGeometry (spec) {
        this.color = spec.color || 'black';
        this.width = spec.width || 2;
    }

    LineGeometry.prototype = new Geometry();

    LineGeometry.prototype.render = function (g, data) {
        var layer = this.layer;
        function scale (d, aesthetic) { return layer.scaledValue(d, aesthetic); }
        var color = ('color' in layer.mappings) ?
            function(d) { return scale(d[0], 'color'); } : this.color;

        var line = d3.svg.line()
                         .x(function (d) { return scale(d, "x") })
                         .y(function (d) { return scale(d, "y") })
                         .interpolate("basis")

        groups(g, 'lines', data).selectAll('polyline')
            .data(function(d) { return [d]; })
            .enter()
            .append("svg:path")
            .attr("d", line)
            .attr('fill', 'none')
            .attr('stroke-width', this.width)
            .attr('stroke', color);
    };

    function IntervalGeometry (spec) {
        this.width = spec.width || 5;
        this.color = spec.color || 'black';
    }

    IntervalGeometry.prototype = new Geometry();

    IntervalGeometry.prototype.render = function (g, data) {
        var layer = this.layer;
        var width = this.width;

        function scale (d, aesthetic) { return layer.scaledValue(d, aesthetic); }

        groups(g, 'rects', data).selectAll('rect')
            .data(Object)
            .enter()
            .append('rect')
            .attr('x', function (d) { return scale(d, 'x') - width/2; })
            .attr('y', function (d) { return scale(d, 'y'); })
            .attr('width', width)
            .attr('height', function (d) { return layer.scaledMin('y') - scale(d, 'y'); })
            .attr('fill', attributeValue(layer, 'color', this.color));
    };

    function BoxPlotGeometry (spec) {
        this.width = spec.width || 10;
        this.color = spec.color || 'black';
    }

    BoxPlotGeometry.prototype = new Geometry();

    BoxPlotGeometry.prototype.render = function (g, data) {
        // Data points are { group, median, q1, q3, upper, lower, outliers }
        var layer = this.layer;
        var width = this.width;

        function scale (v, aesthetic) {
            return layer.scaleExtracted(v, aesthetic);
        }

        var color = ('color' in layer.mappings) ?
            function(d) { return scale(d, 'color'); } : this.color;

        var boxes = groups(g, 'boxes', data).selectAll('g').data(Object).enter();

        // IQR box
        boxes.append('rect')
            .attr('class', 'boxplot iqr')
            .attr('x', function (d) { return scale(d.group, 'x') - width/2; })
            .attr('y', function (d) { return scale(d.q3, 'y'); })
            .attr('width', width)
            .attr('height', function (d) { return scale(d.q1, 'y') - scale(d.q3, 'y'); })
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 1);

        // median line
        boxes.append('line')
            .attr('class', 'boxplot median')
            .attr('x1', function (d) { return scale(d.group, 'x') - width/2; })
            .attr('x2', function (d) { return scale(d.group, 'x') + width/2; })
            .attr('y1', function (d) { return scale(d.median, 'y'); })
            .attr('y2', function (d) { return scale(d.median, 'y'); })
            .attr('stroke', color)
            .attr('stroke-width', 1);

        // upper whisker
        boxes.append('line')
            .attr('class', 'boxplot whisker')
            .attr('x1', function (d) { return scale(d.group, 'x'); })
            .attr('x2', function (d) { return scale(d.group, 'x'); })
            .attr('y1', function (d) { return scale(d.q3, 'y'); })
            .attr('y2', function (d) { return scale(d.upper, 'y'); })
            .attr('stroke', color)
            .attr('stroke-width', 1);


        // upper whisker tick
        boxes.append('line')
            .attr('class', 'boxplot whisker')
            .attr('x1', function (d) { return scale(d.group, 'x') - (width * 0.4); })
            .attr('x2', function (d) { return scale(d.group, 'x') + (width * 0.4); })
            .attr('y1', function (d) { return scale(d.upper, 'y'); })
            .attr('y2', function (d) { return scale(d.upper, 'y'); })
            .attr('stroke', color)
            .attr('stroke-width', 1);


        // lower whisker
        boxes.append('line')
            .attr('class', 'boxplot whisker-tick')
            .attr('x1', function (d) { return scale(d.group, 'x'); })
            .attr('x2', function (d) { return scale(d.group, 'x'); })
            .attr('y1', function (d) { return scale(d.q1, 'y'); })
            .attr('y2', function (d) { return scale(d.lower, 'y'); })
            .attr('stroke', color)
            .attr('stroke-width', 1);


        // lower whisker tick
        boxes.append('line')
            .attr('class', 'boxplot whisker-tick')
            .attr('x1', function (d) { return scale(d.group, 'x') - (width * 0.4); })
            .attr('x2', function (d) { return scale(d.group, 'x') + (width * 0.4); })
            .attr('y1', function (d) { return scale(d.lower, 'y'); })
            .attr('y2', function (d) { return scale(d.lower, 'y'); })
            .attr('stroke', color)
            .attr('stroke-width', 1);

        // outliers
        var outliers = [];
        _.each(data, function (d) {
            _.each(d.outliers, function (o) {
                outliers.push({ group: d.group, value: o });
            });
        });

        var o = g.selectAll('circle.outliers').data(outliers).enter();
        o.append('circle')
            .attr('class', 'boxplot outliers')
            .attr('cx', function (d) { return scale(d.group, 'x'); })
            .attr('cy', function (d) { return scale(d.value, 'y'); })
            .attr('r', 2)
            .attr('fill', color);
    };

    function TextGeometry (spec) {
        this.show = spec.show;
    }

    TextGeometry.prototype = new Geometry();

    TextGeometry.prototype.render = function (g, data) {
        var layer = this.layer;
        var area = g.append('g');
        var text = groups(area, 'texts', data).selectAll('circle')
            .data(Object)
            .enter()
            .append('text')
            .attr('class', 'graphicText')
            .attr('x', function (d) { return layer.scaledValue(d, 'x'); })
            .attr('y', function (d) { return layer.scaledValue(d, 'y'); })
            .text(function(d) { return layer.scaledValue(d, 'text'); });

        if ( this.show === 'hover' ){
            text.attr('class', 'graphicText showOnHover');
        }
    };

    function groups (g, clazz, data) {
        return g.selectAll('g.' + clazz)
            .data(data)
            .enter()
            .append('g')
            .attr('class', clazz);
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
            linear:      LinearScale,
            time:        TimeScale,
            log:         LogScale,
            categorical: CategoricalScale,
            color:       ColorScale
        }[spec.type || 'linear'];

        spec.aesthetic !== undefined && (s.aesthetic = spec.aesthetic);
        spec.values    !== undefined && s.values(spec.values);
        spec.min       !== undefined && (s.min = spec.min);
        spec.max       !== undefined && (s.max = spec.max);
        spec.range     !== undefined && s.range(spec.range);
        spec.legend    !== undefined && (s.legend = spec.legend);
        spec.center    !== undefined && (s.center = spec.center);
        return s;
    };

    Scale.defaultFor = function (aesthetic) {
        var s = new {
            x:     LinearScale,
            y:     LinearScale,
            y0:    LinearScale,
            y1:    LinearScale,
            color: ColorScale,
            fill:  ColorScale,
            size:  LinearScale,
            text:  TextScale
        }[aesthetic]();
        s.aesthetic = aesthetic;
        return s;
    };

    Scale.prototype.defaultDomain = function (layer, data, aesthetic) {
        var extreme;

        if (this.min === undefined) {
            this.min = layer.graphic.dataMin(data, aesthetic);
        }
        if (this.max === undefined) {
            this.max = layer.graphic.dataMax(data, aesthetic);
        }
        this.domainSet = true;
        if (this.center !== undefined) {
            extreme = Math.max(this.max - this.center, Math.abs(this.min - this.center))
            this.domain([this.center - extreme, this.center + extreme]);
        } else {
            this.domain([this.min, this.max]);
        }
    };

    Scale.prototype.domain = function (interval) {
        this.d3Scale = this.d3Scale.domain(interval);
    };

    Scale.prototype.range = function (interval) {
        this.d3Scale = this.d3Scale.range(interval);
    };

    Scale.prototype.scale = function (v) {
        return this.d3Scale(v);
    };

    function LinearScale () { this.d3Scale = d3.scale.linear(); }

    LinearScale.prototype = new Scale();

    function TimeScale () { this.d3Scale = d3.time.scale(); }

    TimeScale.prototype = new Scale();

    function LogScale () { this.d3Scale = d3.scale.log(); }

    LogScale.prototype = new Scale();

    function CategoricalScale () {
        this.d3Scale = d3.scale.ordinal();
        // Setting padding to 1 seems to be required to get bars to
        // line up with axis ticks. Needs more investigation.
        this.padding = 1;
    }

    CategoricalScale.prototype = new Scale();

    CategoricalScale.prototype.values = function (values) {
        this.domainSet = true;
        this.d3Scale.domain(values);
    };

    CategoricalScale.prototype.defaultDomain = function (layer, data, aesthetic) {
        function val (d) { return layer.dataValue(d, aesthetic); }
        var values = _.uniq(_.map(_.flatten(data), val));
        values.sort(function (a,b) { return a - b; });
        this.values(values);
    };

    CategoricalScale.prototype.range = function (interval) {
        this.d3Scale = this.d3Scale.rangeBands(interval, this.padding);
    };

    function ColorScale() {
        this.d3Scale = d3.scale.category20();
    }

    ColorScale.prototype = new CategoricalScale();

    ColorScale.prototype.range = function (interval) {
        this.d3Scale = this.d3Scale.range(interval);
    };

    function TextScale(){ }

    TextScale.prototype = new Scale();

    TextScale.prototype.prepare = function (layer, newData, aesthetic) {
        this.pattern = layer.mappings[aesthetic];
        this.data = newData;
    };

    TextScale.prototype.scale = function (v, data) {
        function format (match, key) {
            var it = data[key];
            if ( typeof it === 'number' ) it = it.toFixed(2);
            return String(it);
        }
        return this.pattern.replace(/{(.*?)}/g, format);
    };

    ////////////////////////////////////////////////////////////////////////
    // Statistics

    var Statistics = {
        identity: IdentityStatistic,
        bin:      BinStatistic,
        box:      BoxPlotStatistic,
        sum:      SumStatistic
    };

    Statistics.fromSpec = function (spec) { return new this[spec.kind](spec); };

    function IdentityStatistic () {}

    IdentityStatistic.prototype.compute = function (data) { return data; };

    function BinStatistic (spec) {
        this.variable = spec.variable;
        this.bins     = spec.bins || 20;
    }

    BinStatistic.prototype.compute = function (data) {
        var values = _.pluck(data, this.variable);
        var histogram = d3.layout.histogram().bins(this.bins);
        var frequency = histogram(values);
        histogram.frequency(false);
        var density = histogram(values);
        return _.map(frequency, function (bin, i) {
            return {
                bin: i,
                count: bin.y,
                density: density[i].y,
                ncount: bin.y / data.length || 0
                // Not clear to me how to impelment the ndensity metric
                //ndensity: null
            };
        });
    };

    function SumStatistic (spec) {
        this.group    = spec.group || false;
        this.variable = spec.variable;
    }

    SumStatistic.prototype.compute = function (data) {
        var groups = groupData(data, this.group),
            value = _.bind(function(point) {
                return point[this.variable];
            }, this);
        return _.map(groups, function (values, name) {
            return {
                group: name,
                count: values.length,
                sum: d3.sum(values, value),
                min: d3.min(values, value),
                max: d3.max(values, value)
            };
        });
    };

    function BoxPlotStatistic (spec) {
        this.group = spec.group || false;
        this.variable = spec.variable || 'value';
    }

    BoxPlotStatistic.prototype.dataRange = function (data) {
        var flattened = _.flatten(data);
        return [
            _.min(_.pluck(flattened, 'min')),
            _.max(_.pluck(flattened, 'max'))
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

            var q1              = d3.quantile(values, 0.25);
            var median          = d3.quantile(values, 0.5);
            var q3              = d3.quantile(values, 0.75);
            var min             = values[0];
            var max             = values[values.length - 1];

            var fenceRange      = 1.5 * (q3 - q1);
            var lowerFenceIndex = d3.bisectLeft(values, q1 - fenceRange);
            var upperFenceIndex = d3.bisectRight(values, q3 + fenceRange, lowerFenceIndex) - 1;
            var lower           = values[lowerFenceIndex];
            var upper           = values[upperFenceIndex];
            var outliers        = values.slice(0, lowerFenceIndex).concat(values.slice(upperFenceIndex + 1));

            var r = {
                group:    name,
                q1:       q1,
                median:   median,
                q3:       q3,
                lower:    lower,
                upper:    upper,
                outliers: outliers,
                min:      min,
                max:      max
            };
            return r;
        });
    };

    /***
      * Returns a grouping of data based on a data set's attribute.
      * If groupBy is not defined returns the data nested as a single group.
      */
    function groupData(data, groupBy) {
        // By default group the entire set together
        if (_.isUndefined(groupBy) || _.isNull(groupBy)) return [data];
        return _.groupBy(data, groupBy);
    }

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

    exports.gg = function gg (spec, opts) { return Graphic.fromSpec(spec, opts); }

})(this);
