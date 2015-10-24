;(function (exports, undefined) {

    var _ = exports._;
    var d3 = exports.d3;

    // Provide Node compatibility
    if (!_ && !d3 && typeof require !== 'undefined') {
        d3 = require('d3');
        _  = require('underscore');
    }

    ////////////////////////////////////////////////////////////////////////
    // Graphic -- the outermost object responsible for rendering a
    // statistical graphic.

    function Graphic (spec) {
        var scales = makeScales(spec.scales, aesthetics(spec.layers));
        var layers = _.map(spec.layers, function (s) { return new Layer(s, scales); }, this);
        this.facet = new Facet(layers, scales);
    }

    /*
     * Return a function that will render the graphic using the given
     * data into the given HTML element (a div or span usually).
     */
    Graphic.prototype.renderer = function (where, opts) {
        var w  = opts.width;
        var h  = opts.height;
        var pX = opts.paddingX || opts.padding;
        var pY = opts.paddingY || opts.padding;

        function render (data) {
            var svg = where.append('svg').attr('width', w).attr('height', h);
            this.facet.render(0, 0, w, h, pX, pY, svg, data);
            /*
              var p = 12;
              this.facet.render(0, 0, w/2, h/2, p, p, svg, data);
              this.facet.render(w/2, 0, w/2, h/2, p, p, svg, data);
              this.facet.render(0, h/2, w/2, h/2, p, p, svg, data);
              this.facet.render(w/2, h/2, w/2, h/2, p, p, svg, data);
            */

        }

        return _.bind(render, this);
    };

    function aesthetics (layerSpecs) {
        return _.uniq(_.flatten(_.map(_.pluck(layerSpecs, 'mapping'), _.keys)));
    }

    function makeScales (scales, aesthetics) {
        var scaleSpecs = _.object(_.map(scales, function (s) { return [ s.aesthetic, s ] }));
        function makeScale (a) {
            return a in scaleSpecs ? Scale.fromSpec(scaleSpecs[a]) : Scale.defaultFor(a)
        }
        return _.object(_.map(aesthetics, function (a) { return [ a, makeScale(a) ]; }));
    };


    ////////////////////////////////////////////////////////////////////////
    // Facet -- Responsible for rendering into some rectangular area
    // of the graphic. A facet can contain sub-facets, each
    // responsible for rendering some subset of the data to some
    // rectangle of the graphic.
    //
    // The Facet object knows how to split up the data into groups
    // that will each be rendered into a separate facet, and how to
    // split up the area of the graphic appropriately. There are five
    // layouts: horizontal, vertical, and horizontal flow, vertical
    // flow, and grid. The horizontal layout divides the graphic into
    // evenly sized elements that are arranged in a single row;
    // vertical divides the graphic into evenly sized elements that
    // are arranged in a single column. ... (Note, none of this is
    // actually implemented yet except the trivial single facet case.
    // -Peter)

    function Facet(layers, scales) {
        this.layers    = layers;
        this.scales    = scales;
        this.subfacets = [];
    }

    Facet.prototype.render = function (x, y, width, height, paddingX, paddingY, svg, data) {
        this.setXYRanges(width, height, paddingX, paddingY);
        this.prepare(data);

        svg.append('rect')
            .attr('class', 'base')
            .attr('x', x)
            .attr('y', y)
            .attr('width', width)
            .attr('height', height);

        var xAxis = d3.svg.axis()
            .scale(this.scales['x'].d3Scale)
            .tickSize(2 * paddingY - height)
            .orient('bottom');

        var yAxis = d3.svg.axis()
            .scale(this.scales['y'].d3Scale)
            .tickSize(2 * paddingX - width)
            .orient('left');

        svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', translate(x, y + height - paddingY))
            .call(xAxis);

        svg.append('g')
            .attr('class', 'y axis')
            .attr('transform', translate(x + paddingX, y))
            .call(yAxis);

        svg.append('g')
            .attr('class', 'x legend')
            .attr('transform', translate(x + (width / 2), y + (height - 5)))
            .append('text')
            .text(this.legend('x'))
            .attr('text-anchor', 'middle');

        svg.append('g')
            .attr('class', 'y legend')
            .attr('transform', translate(x + 10, y + (height / 2)) + ' rotate(270)')
            .append('text')
            .text(this.legend('y'))
            .attr('text-anchor', 'middle');

        function g () {
            return svg.append('g').attr('transform', translate(x, y));
        }

        _.each(this.layers, function (l) { l.render(g(), data); }, this);
        _.each(this.subfacets, function (s) { s.render(); }, this);
    };

    function translate(x, y) { return 'translate(' + x + ',' + y + ')'; }

    /*
     * Once we know the graphical parameters, set the ranges of the X
     * and Y scales appropriately.
     */
    Facet.prototype.setXYRanges = function (width, height, paddingX, paddingY) {
        this.scales['x'].range([paddingX, width - paddingX]);
        this.scales['y'].range([height - paddingY, paddingY]);
    };

    /*
     * Prepare the layers and scales to render a specific data set.
     */
    Facet.prototype.prepare = function (data) {

        function values (a) {
            function hasAesthetic (layer) { return (a in layer.mappings); }
            function vals (layer) {
                function v (d) { return layer.dataValues(d, a); }
                return _.flatten(_.map(layer.statistic.compute(data), v));
            }
            return _.uniq(_.flatten(_.map(_.filter(this.layers, hasAesthetic), vals)));
        }

        _.each(this.scales, function (s) { s.prepare(_.bind(values, this)); }, this);
    };

    Facet.prototype.legend = function (aesthetic) {
        return this.scales[aesthetic].legend || this.layers[0].legend(aesthetic);
    };

    ////////////////////////////////////////////////////////////////////////
    // Layers -- each layer is responsible for drawing one geometry
    // into the graphic to which the layer belongs. The layer is also
    // responsible for mapping data from the keys in the original data
    // to aesthetics. It uses the graphics to get at the scales for
    // the different aesthetics.

    function Layer (spec, scales) {
        this.geometry  = Geometry.fromSpec(spec, this);
        this.statistic = Statistic.fromSpec(spec.statistic);
        this.scales    = scales;
        this.mappings  = spec.mapping !== undefined ? spec.mapping : {};
    }

    /**
     * Given a datum and an aesthetic, extract the corresponding value
     * (e.g. if the aesthetic is 'x' and it's mapped to the field
     * 'foo', extract the 'foo' field from d) and then scales it using
     * the appropriate scale for the aesthetic.
     */
    Layer.prototype.aestheticValue = function (d, aesthetic, mapKey) {
        return this.scale(this.dataValue(d, mapKey || aesthetic), aesthetic);
    };

    /**
     * For a given aesthetic, if there is a mapping for the aesthetic,
     * return a function that will extract the appropriate value from
     * the a datum and map it to the aesthetic value. Otherwise return
     * the default value.
     */
    Layer.prototype.attributeValue = function (aesthetic, defaultValue) {
        return (aesthetic in this.mappings) ?
            _.bind(function (d) { return this.aestheticValue(d, aesthetic); }, this) : defaultValue;
    }


    /**
     * Extract the field from the datum corresponding to the given
     * aesthetic.
     */
    Layer.prototype.dataValue = function (datum, mapKey) {
        return datum[this.mappings[mapKey]];
    };

    Layer.prototype.dataValues = function (datum, aesthetic) {
        // Given a datum (produced by a Statistic), return a list of
        // values for the given aesthetic. Most of the time this is
        // just the single value returned by mapping the aesthetic to
        // the field in the data. For the BoxStatistic, however, it's
        // all the fields except for whatever the x aesthetic maps to.
        return this.geometry.valuesForAesthetic(datum, aesthetic, this.mappings[aesthetic], this);
    };

    /**
     * Given a value in data space and an aesthetic, scale it using
     * the appropriate scale for the aesthetic.
     */
    Layer.prototype.scale = function (v, aesthetic) {
        return this.scales[aesthetic].scale(v);
    };

    Layer.prototype.scaledMin = function (aesthetic) {
        var s = this.scales[aesthetic];
        return s.scale(s.min);
    };

    Layer.prototype.aesthetics = function () {
        return _.without(_.keys(this.mappings), 'group');
    };

    Layer.prototype.render = function (g, data) {
        var s = this.statistic.compute(data)
        this.geometry.render(g, _.values(groupData(s, this.mappings.group)));
    };

    Layer.prototype.legend = function (aesthetic) {
        return this.mappings[aesthetic] || this.statistic.variable;
    };

    ////////////////////////////////////////////////////////////////////////
    // Geometries -- objects that actually draw stuff onto the Graphic.
    // They only care about scaled values which they can get from
    // their layer.

    function Geometry () {}

    Geometry.fromSpec = function (spec, layer) {
        var g = new ({
            point:    PointGeometry,
            line:     LineGeometry,
            area:     AreaGeometry,
            interval: IntervalGeometry,
            box:      BoxPlotGeometry,
            arrow:    ArrowGeometry,
            text:     TextGeometry
        }[spec.geometry || 'point'])(spec);
        g.layer = layer;
        return g;
    };

    Geometry.prototype.valuesForAesthetic = function (datum, aesthetic, mapped) {
        return [ datum[mapped] ];
    };

    function PointGeometry (spec) {
        this.name = spec.name;
        this.size  = spec.size || 5;
        this.color = spec.color || 'black';
    }

    PointGeometry.prototype = new Geometry();

    PointGeometry.prototype.render = function (g, data) {
        var layer = this.layer;
        if (this.name) g = g.attr('class', this.name);
        groups(g, 'circles', data).selectAll('circle')
            .data(Object)
            .enter()
            .append('circle')
            .attr('class', 'points')
            .attr('cx', function (d) { return layer.aestheticValue(d, 'x'); })
            .attr('cy', function (d) { return layer.aestheticValue(d, 'y'); })
            .attr('fill-opacity', 1)
            .attr('fill', layer.attributeValue('color', this.color))
            .attr('r', layer.attributeValue('size', this.size));
    };

    function AreaGeometry (spec) {
        this.color  = spec.color  || 'black';
        this.width  = spec.width  || 2;
        this.fill   = spec.fill   || 'black';
        this.alpha  = spec.alpha  || 1;
        this.stroke = spec.stroke || this.fill;
        this.smooth = spec.smooth || false;
    }

    AreaGeometry.prototype =  new Geometry();

    AreaGeometry.prototype.valuesForAesthetic = function (datum, aesthetic, mapped, layer) {
        return mapped
            ? [ datum[mapped] ]
            : _.map(['y0', 'y1'], function (x) { return layer.dataValue(datum, x); })
    }

    AreaGeometry.prototype.render = function (g, data) {
        var layer = this.layer;

        var area = d3.svg.area()
            .x(function (d) { return layer.aestheticValue(d, 'x') })
            .y1(function (d) { return layer.aestheticValue(d, 'y', 'y1') })
            .y0(function (d) { return layer.aestheticValue(d, 'y', 'y0') })
            .interpolate(this.smooth ? 'basis' : 'linear');

        groups(g, 'lines', data).selectAll('polyline')
            .data(function(d) { return [d]; })
            .enter()
            .append('svg:path')
            .attr('d', area)
            .attr('stroke-width', this.width)
            .attr('stroke', this.stroke)
            .attr('fill', this.fill)
            .attr('fill-opacity', this.alpha)
            .attr('stroke-opacity', this.alpha)
    };

    function LineGeometry (spec) {
        this.color = spec.color || 'black';
        this.width = spec.width || 2;
        this.smooth = spec.smooth || false;
    }


    /**
     * Line geometry draws one or more lines. Lines can be either
     * smoothed or straight from point to point. If there are multiple
     * lines, they can be colored differently with a color scale. The
     * lines path element are also given a class corresponding to the
     * name of the group so they can be styled with CSS.
     */
    LineGeometry.prototype = new Geometry();

    LineGeometry.prototype.render = function (g, data) {
        var layer = this.layer;

        function scale (d, aesthetic) { return layer.aestheticValue(d, aesthetic); }

        // Can't use attributeValue here like the other geometries
        // because we always group the data and then turn each group
        // into a single array to be used to draw a polyline.
        var color = ('color' in layer.mappings) ? function (d) { return scale(d[0], 'color'); } : this.color;

        function classname (d) {
            var g = layer.dataValue(d[0], 'group');
            return g ? 'line ' + g : 'line';
        }

        var line = d3.svg.line()
            .x(function (d) { return scale(d, 'x') })
            .y(function (d) { return scale(d, 'y') })
            .interpolate(this.smooth ? 'basis' : 'linear');

        groups(g, 'lines', data).selectAll('polyline')
            .data(function(d) { return [d]; })
            .enter()
            .append('svg:path')
            .attr('class', classname)
            .attr('d', line)
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

        function scale (d, aesthetic) { return layer.aestheticValue(d, aesthetic); }

        groups(g, 'rects', data).selectAll('rect')
            .data(Object)
            .enter()
            .append('rect')
            .attr('x', function (d) { return scale(d, 'x') - width/2; })
            .attr('y', function (d) { return scale(d, 'y'); })
            .attr('width', width)
            .attr('height', function (d) { return layer.scaledMin('y') - scale(d, 'y'); })
            .attr('fill', layer.attributeValue('color', this.color));
    };

    function BoxPlotGeometry (spec) {
        this.width = spec.width || 10;
        this.color = spec.color || 'black';
    }

    BoxPlotGeometry.prototype = new Geometry();

    BoxPlotGeometry.prototype.valuesForAesthetic = function (datum, aesthetic, mapped) {
        return mapped
            ? [ datum[mapped] ]
            : _.values(_.omit(datum, ['group', 'outliers'])).concat(datum.outliers);
    }

    BoxPlotGeometry.prototype.render = function (g, data) {
        // Data points are { group, median, q1, q3, upper, lower, outliers }
        var layer = this.layer;
        var width = this.width;

        function iqrBox(s) {
            s.append('rect')
                .attr('class', 'boxplot iqr')
                .attr('x', function (d) { return layer.scale(d.group, 'x') - width/2; })
                .attr('y', function (d) { return layer.scale(d.q3, 'y'); })
                .attr('width', width)
                .attr('height', function (d) { return layer.scale(d.q1, 'y') - layer.scale(d.q3, 'y'); })
                .attr('fill', 'none');
            s.call(medianLine);
        }

        function medianLine(s) {
            s.append('line')
                .attr('class', 'boxplot median')
                .attr('x1', function (d) { return layer.scale(d.group, 'x') - width/2; })
                .attr('x2', function (d) { return layer.scale(d.group, 'x') + width/2; })
                .attr('y1', function (d) { return layer.scale(d.median, 'y'); })
                .attr('y2', function (d) { return layer.scale(d.median, 'y'); });
        }

        function whisker(s, y1, y2) {
            s.append('line')
                .attr('class', 'boxplot whisker')
                .attr('x1', function (d) { return layer.scale(d.group, 'x'); })
                .attr('x2', function (d) { return layer.scale(d.group, 'x'); })
                .attr('y1', function (d) { return layer.scale(d[y1], 'y'); })
                .attr('y2', function (d) { return layer.scale(d[y2], 'y'); });
            s.call(whiskerTick, y2);
        }

        function whiskerTick(s, y) {
            s.append('line')
                .attr('class', 'boxplot whisker')
                .attr('x1', function (d) { return layer.scale(d.group, 'x') - (width * 0.4); })
                .attr('x2', function (d) { return layer.scale(d.group, 'x') + (width * 0.4); })
                .attr('y1', function (d) { return layer.scale(d[y], 'y'); })
                .attr('y2', function (d) { return layer.scale(d[y], 'y'); });
        }

        function outliers(s) {
            s.selectAll('circle')
                .data(function (d) { return _.map(d.outliers, function (o) { return { x: layer.scale(d.group, 'x'), y: layer.scale(o, 'y') }; }); })
                .enter()
                .append('circle')
                .attr('class', 'boxplot outlier')
                .attr('cx', function (o) { return o.x; })
                .attr('cy', function (o) { return o.y; })
                .attr('r', 2);
        }

        function render(s) {
            s.call(iqrBox).call(whisker, 'q3', 'upper').call(whisker, 'q1', 'lower').call(outliers);
        }

        var color = ('color' in layer.mappings) ?
            function(d) { return layer.scale(d, 'color'); } : this.color;

        g.selectAll('g.boxes')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'boxes')
            .selectAll('g')
            .data(Object)
            .enter()
            .append('g')
            .call(render);
    };

    function ArrowGeometry (spec) {
        this.arrowLength = spec.arrow.length || 10;
        this.arrowWidth  = spec.arrow.width || 3;
        this.color       = spec.color || 'black';
    }

    ArrowGeometry.prototype = new Geometry();

    ArrowGeometry.prototype.render = function (g, data) {
        var layer     = this.layer;
        var len       = this.arrowLength;
        var width     = this.arrowWidth;
        var color     = this.color;
        var linewidth = this.width;


        function arrowline (s) {
            s.append('line')
                .attr('x1', function (d) { return layer.scale(d.tail.x, 'x'); })
                .attr('x2', function (d) { return layer.scale(d.head.x, 'x'); })
                .attr('y1', function (d) { return layer.scale(d.tail.y, 'y'); })
                .attr('y2', function (d) { return layer.scale(d.head.y, 'y'); })
                .attr('fill', 'none')
                .attr('stroke-width', linewidth)
                .attr('stroke', color);
        }

        function arrowhead (s) {

            function arrowheadPoints (d, length, width) {
                var x1 = layer.scale(d.tail.x, 'x');
                var y1 = layer.scale(d.tail.y, 'y');
                var x2 = layer.scale(d.head.x, 'x');
                var y2 = layer.scale(d.head.y, 'y');

                var rise = y2 - y1;
                var run  = x2 - x1;

                var len = Math.sqrt((rise * rise) + (run * run));

                var cross_x = x2 - (length * (run / len));
                var cross_y = y2 - (length * (rise / len));

                return [
                    { x: x2, y: y2 }, // the point of the arrow.
                    { x: cross_x + width * rise/len, y: cross_y - width * run/len },
                    { x: cross_x - width * rise/len, y: cross_y + width * run/len }
                ];
            }

            var line = d3.svg.line()
                .x(function (d) { return d.x })
                .y(function (d) { return d.y })
                .interpolate('linear');

            s.append('svg:path')
                .attr('class', 'arrow')
                .attr('d', function (d) { return line(arrowheadPoints(d, len, width)) + 'Z'; })
                .attr('fill', color)
                .attr('stroke-width', linewidth)
                .attr('stroke', color);
        }

        function render (s) {
            s.call(arrowline).call(arrowhead);
        }

        g.selectAll('g.arrows')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'arrows')
            .call(render);

    };

    function TextGeometry (spec) {
        this.text = spec.text
        this.show = spec.show;
    }

    TextGeometry.prototype = new Geometry();

    TextGeometry.prototype.render = function (g, data) {
        var layer = this.layer;
        var text = this.text;

        function formatter (d) {
            function fmt (_, key) {
                var v = d[key];
                return String(typeof v === 'number' ? v.toFixed(2) : v);
            }
            return text.replace(/{(.*?)}/g, fmt);
        }

        var area = g.append('g');
        var text = groups(area, 'texts', data).selectAll('circle')
            .data(Object)
            .enter()
            .append('text')
            .attr('class', 'graphicText')
            .attr('x', function (d) { return layer.aestheticValue(d, 'x'); })
            .attr('y', function (d) { return layer.aestheticValue(d, 'y'); })
            .text(formatter);

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

    Scale.defaultTypes = {
        x:     'linear',
        y:     'linear',
        y0:    'linear',
        y1:    'linear',
        color: 'color',
        fill:  'color',
        size:  'linear',
    };

    Scale.fromSpec = function (spec) {

        var s = new ({
            linear:      LinearScale,
            time:        TimeScale,
            log:         LogScale,
            categorical: CategoricalScale,
            color:       ColorScale
        }[spec.type || (spec.aesthetic in Scale.defaultTypes ? Scale.defaultTypes[spec.aesthetic] : 'linear')])();

        spec.aesthetic !== undefined && (s.aesthetic = spec.aesthetic);
        spec.values    !== undefined && (s.values = spec.values);
        spec.min       !== undefined && (s.min = spec.min);
        spec.max       !== undefined && (s.max = spec.max);
        spec.range     !== undefined && s.range(spec.range);
        spec.legend    !== undefined && (s.legend = spec.legend);
        spec.center    !== undefined && (s.center = spec.center);
        return s;
    };

    Scale.defaultFor = function (aesthetic) {
        return Scale.fromSpec({ aesthetic: aesthetic });
    };

    Scale.prototype.prepare = function (values) {
        if (!this.domainSet) {
            this.defaultDomain(values(this.aesthetic));
        }
    };

    Scale.prototype.defaultDomain = function (values) {
        if (this.min === undefined) this.min = _.min(values)
        if (this.max === undefined) this.max = _.max(values);
        this.domain(this.center !== undefined ? centered(this.min, this.max, this.center) : [this.min, this.max])
        this.domainSet = true;
    };

    function centered (min, max, center) {
        var halfWidth = Math.max(max - center, Math.abs(min - center));
        return [center - halfWidth, center + halfWidth];
    }

    Scale.prototype.domain = function (interval) {
        this.d3Scale = this.d3Scale.domain(interval).nice();
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

    function CategoricalScale () { this.d3Scale = d3.scale.ordinal(); }

    CategoricalScale.prototype = new Scale();

    CategoricalScale.prototype.defaultDomain = function (values) {
        if (this.values !== undefined) {
            // Values were passed in the spec
            this.d3Scale.domain(this.values);
        } else {
            // Otherwise, extracted from data.
            values.sort(function (a,b) { return a - b; });
            this.d3Scale.domain(values);
        }
        this.domainSet = true;
    };

    CategoricalScale.prototype.range = function (interval) {
        // Setting padding to 1 seems to be required to get bars to
        // line up with axis ticks. Needs more investigation.
        this.d3Scale = this.d3Scale.rangeRoundBands(interval, 1);
    };

    function ColorScale() { this.d3Scale = d3.scale.category20(); }

    ColorScale.prototype = new Scale();

    ColorScale.prototype.defaultDomain = CategoricalScale.prototype.defaultDomain;


    ////////////////////////////////////////////////////////////////////////
    // Statistics

    function Statistic () {}

    Statistic.fromSpec = function (spec) {
        return new ({
            identity: IdentityStatistic,
            bin:      BinStatistic,
            box:      BoxPlotStatistic,
            arrow:    ArrowStatistic,
            sum:      SumStatistic
        }[spec ? spec.kind : 'identity'])(spec);
    };

    function IdentityStatistic () {}

    IdentityStatistic.prototype = new Statistic();

    IdentityStatistic.prototype.compute = function (data) { return data; };

    function BinStatistic (spec) {
        this.variable = spec.variable;
        this.bins     = spec.bins || 20;
    }

    BinStatistic.prototype = new Statistic();

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

    SumStatistic.prototype = new Statistic();

    SumStatistic.prototype.compute = function (data) {
        var groups = groupData(data, this.group);
        var value  = _.bind(function(point) { return point[this.variable]; }, this);
        return _.map(groups, function (values, name) {
            sum = d3.sum(values, value);
            return {
                group: name,
                count: values.length,
                sum: sum,
                min: d3.min(values, value),
                max: d3.max(values, value),
                mean: sum/values.length
            };
        });
    };

    function BoxPlotStatistic (spec) {
        this.group = spec.group || false;
        this.groupOrdering = spec.groupOrdering || function (x) { return x; };
        this.variable = spec.variable || 'value';
    }

    BoxPlotStatistic.prototype = new Statistic();

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
        var ordering = this.groupOrdering;

        return _.map(_.sortBy(_.pairs(groups), function (p) { return ordering(p[0]); }), function (g) {
            var name   = g[0];
            var values = g[1];
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

    function ArrowStatistic (spec) {
        // A function that returns the data point (in data space) the
        // arrow should point at.
        this.head = spec.head;

        // A function that returns the data point (in data space) the
        // arrow should point from.
        this.tail = spec.tail;
    }

    ArrowStatistic.prototype = new Statistic();

    ArrowStatistic.prototype.compute = function (data) {
        return {
            head: this.head(data),
            tail: this.tail(data)
        };
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

    exports.gg = function gg () {
        var graphic = new Graphic({
            layers: _.filter(arguments, function (x) { return _.has(x, 'geometry'); }),
            scales: _.filter(arguments, function (x) { return _.has(x, 'aesthetic'); })
        });
        return function (data, where, opts) {
            graphic.renderer(where, opts)(data);
        };
    };

})(this);
