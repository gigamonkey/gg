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
        this.facet = Facet.fromSpec(spec);
    }

    /*
     * Return a function that will render the graphic using the given
     * data into the given HTML element (a div or span usually).
     */
    Graphic.prototype.render = function (data, where, opts) {
        var w  = opts.width;
        var h  = opts.height;
        var pX = opts.paddingX || opts.padding;
        var pY = opts.paddingY || opts.padding;

        var svg = where.append('svg').attr('width', w).attr('height', h);
        this.facet.render(0, 0, w, h, pX, pY, svg, data);
        /*
          var p = 12;
          this.facet.render(0, 0, w/2, h/2, p, p, svg, data);
          this.facet.render(w/2, 0, w/2, h/2, p, p, svg, data);
          this.facet.render(0, h/2, w/2, h/2, p, p, svg, data);
          this.facet.render(w/2, h/2, w/2, h/2, p, p, svg, data);
        */
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

    function Facet() {}

    Facet.fromSpec = function (spec) {
        return new ({
            single: SingleFacet,
            xy: XYFacet
        }[spec.facets ? spec.facets.facets : 'single'])(spec);
    }

    Facet.makeLayers = function (spec) {
        return _.map(spec.layers, function (s) { return new Layer(s); });
    }
    Facet.extractAesthetics = function (layers) {
        return _.uniq(_.flatten(_.map(_.pluck(layers, 'mappings'), _.keys)));
    }

    function SingleFacet(spec) {
        this.layers     = Facet.makeLayers(spec);
        this.scaleSpecs = spec.scales;
        this.aesthetics = Facet.extractAesthetics(this.layers);
    }

    SingleFacet.prototype.render = function (x, y, width, height, paddingX, paddingY, svg, data, scaleData) {

        function translate(x, y) { return 'translate(' + x + ',' + y + ')'; }
        function g () { return svg.append('g').attr('transform', translate(x, y)); }

        var scales = makeScales(this.scaleSpecs, this.layers, this.aesthetics, scaleData || data, width, height, paddingX, paddingY);

        svg.append('rect')
            .attr('class', 'base')
            .attr('x', x)
            .attr('y', y)
            .attr('width', width)
            .attr('height', height);

        var xAxis = d3.svg.axis()
            .scale(scales['x'].d3Scale)
            .tickSize(2 * paddingY - height)
            .orient('bottom');

        var yAxis = d3.svg.axis()
            .scale(scales['y'].d3Scale)
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
            .text(legend(scales, this.layers, 'x'))
            .attr('text-anchor', 'middle');

        svg.append('g')
            .attr('class', 'y legend')
            .attr('transform', translate(x + 10, y + (height / 2)) + ' rotate(270)')
            .append('text')
            .text(legend(scales, this.layers, 'y'))
            .attr('text-anchor', 'middle');


        _.each(this.layers, function (l) { l.render(g(), data, scales); }, this);
    };


    function XYFacet(spec) {
        this.spec = spec;
        this.x    = spec.facets.x;
        this.y    = spec.facets.y;
    }

    XYFacet.prototype.render = function (x, y, width, height, paddingX, paddingY, svg, data) {

        var xs = _.uniq(_.pluck(data, this.x));
        var ys = _.uniq(_.pluck(data, this.y));

        var subWidth  = Math.floor((width - (paddingX * (xs.length - 1))) / xs.length);
        var subHeight = Math.floor((height - (paddingY * (ys.length - 1))) / ys.length);

        var byX = _.bind(function (xs) { return _.groupBy(xs, this.x); }, this);
        var byY = _.bind(function (xs) { return _.sortBy(_.pairs(_.groupBy(xs, this.y)), function (x) { return x[0]; }); }, this);

        var grouped = _.sortBy(_.pairs(_.mapObject(byX(data), byY)), function (x) { return x[0]; });

        var subfacet = new SingleFacet(this.spec);

        _.each(grouped, function (xvalue, xindex) {
            var xlabel = xvalue[0];
            _.each(xvalue[1], function (yvalue, yindex) {
                var ylabel = yvalue[0];
                var facetdata = yvalue[1];
                console.log(xlabel + ' / ' + ylabel + ' (' + xindex + ', ' + yindex + ')');
                subfacet.render(xindex * subWidth, yindex * subHeight, subWidth, subHeight, paddingX, paddingY, svg, facetdata, data);
            });
        });
    };




    /*
     * Make the scales to render a specific data set.
     */
    function makeScales (specs, layers, aesthetics, data, width, height, paddingX, paddingY) {

        var scaleSpecs = _.object(_.map(specs, function (s) { return [ s.aesthetic, s ] }));

        // Get all possible values for aesthetic a.
        function allValues (a) {
            function hasAesthetic (layer) { return a in layer.mappings; }
            function vals (layer) {
                function v (d) { return layer.dataValues(d, a); }
                return _.flatten(_.map(layer.statistic.compute(data), v));
            }
            return _.uniq(_.flatten(_.map(_.filter(layers, hasAesthetic), vals)));
        }

        function makeScale (a) {
            var scale =  a in scaleSpecs ? Scale.fromSpec(scaleSpecs[a]) : Scale.defaultFor(a);
            if (!scale.domainSet) {
                scale.defaultDomain(allValues(a));
            }
            if (a === 'x') {
                scale.range([paddingX, width - paddingX]);
            } else if (a === 'y') {
                scale.range([height - paddingY, paddingY]);
            }
            return [ a, scale ];
        }

        return _.object(_.map(aesthetics, makeScale));
    };

    function legend (scales, layers, aesthetic) {
        return scales[aesthetic].legend || layers[0].legend(aesthetic);
    };

    ////////////////////////////////////////////////////////////////////////
    // Layers -- each layer is responsible for drawing one geometry
    // into the graphic to which the layer belongs. The layer is also
    // responsible for mapping data from the keys in the original data
    // to aesthetics.

    function Layer (spec) {
        this.geometry  = Geometry.fromSpec(spec);
        this.group     = spec.group
        this.statistic = Statistic.fromSpec(spec, this.geometry);
        this.mappings = _.object(_.without(_.map(this.geometry.aesthetics, function (a) {
            if (a in spec) {
                // This is where I wish we had first-class symbols
                // with a nice syntax. This means that any literal
                // values for things that could come from mappings
                // need to be specially encoded if their natural
                // representation is a as a string. So far color seems
                // like the only thing and maybe that can always be
                // done via CSS.
                return _.isString(spec[a]) ? [ a, spec[a] ] : null;
            } else {
                return [ a, false ]
            }
        }, this), null));
    }

    /**
     * Given a datum and an aesthetic, extract the corresponding value
     * (e.g. if the aesthetic is 'x' and it's mapped to the field
     * 'foo', extract the 'foo' field from d) and then scales it using
     * the appropriate scale for the aesthetic.
     */
    Layer.prototype.aestheticValue = function (scales, d, aesthetic, mapKey) {
        return this.scale(this.dataValue(d, mapKey || aesthetic), aesthetic, scales);
    };

    /**
     * For a given aesthetic, if there is a mapping for the aesthetic,
     * return a function that will extract the appropriate value from
     * the a datum and map it to the aesthetic value. Otherwise return
     * the default value.
     */
    Layer.prototype.attributeValue = function (scales, aesthetic, defaultValue) {
        return (this.mappings[aesthetic]) ?
            _.bind(function (d) { return this.aestheticValue(scales, d, aesthetic); }, this) : defaultValue;
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
        return this.geometry.valuesForAesthetic(datum, this.mappings[aesthetic], this);
    };

    /**
     * Given a value in data space and an aesthetic, scale it using
     * the appropriate scale for the aesthetic.
     */
    Layer.prototype.scale = function (v, aesthetic, scales) {
        return scales[aesthetic].scale(v);
    };

    Layer.prototype.scaledMin = function (aesthetic, scales) {
        var s = scales[aesthetic];
        return s.scale(s.min);
    };

    Layer.prototype.aesthetics = function () {
        return _.without(_.keys(this.mappings), 'group');
    };

    Layer.prototype.render = function (g, data, scales) {
        var s = this.statistic.compute(data)
        this.geometry.render(g, _.values(groupData(s, this.group)), this, scales);
    };

    Layer.prototype.legend = function (aesthetic) {
        return this.mappings[aesthetic] || this.statistic.variable;
    };

    ////////////////////////////////////////////////////////////////////////
    // Geometries -- objects that actually draw stuff onto the Graphic.
    // They only care about scaled values which they can get from
    // their layer.

    function Geometry (aesthetics) {
        this.aesthetics = aesthetics;
        this.defaultStatistic = 'identity'
    }

    Geometry.fromSpec = function (spec) {
        return new ({
            point:    PointGeometry,
            line:     LineGeometry,
            area:     AreaGeometry,
            interval: IntervalGeometry,
            box:      BoxPlotGeometry,
            arrow:    ArrowGeometry,
            text:     TextGeometry
        }[spec.geometry || 'point'])(spec);
    };

    Geometry.prototype.valuesForAesthetic = function (datum, field, layer) {
        return [ datum[field] ];
    };

    function PointGeometry (spec) {
        this.name = spec.name;
        this.size  = spec.size || 5;
        this.color = spec.color || 'black';
    }

    PointGeometry.prototype = new Geometry(['x', 'y', 'size', 'color']);

    PointGeometry.prototype.render = function (g, data, layer, scales) {
        if (this.name) g = g.attr('class', this.name);
        groups(g, 'circles', data).selectAll('circle')
            .data(Object)
            .enter()
            .append('circle')
            .attr('class', 'points')
            .attr('cx', function (d) { return layer.aestheticValue(scales, d, 'x'); })
            .attr('cy', function (d) { return layer.aestheticValue(scales, d, 'y'); })
            .attr('fill-opacity', 1)
            .attr('fill', layer.attributeValue(scales, 'color', this.color))
            .attr('r', layer.attributeValue(scales, 'size', this.size));
    };

    function AreaGeometry (spec) {
        this.color  = spec.color  || 'black';
        this.width  = spec.width  || 2;
        this.fill   = spec.fill   || 'black';
        this.alpha  = spec.alpha  || 1;
        this.stroke = spec.stroke || this.fill;
        this.smooth = spec.smooth || false;
    }

    AreaGeometry.prototype =  new Geometry(['x', 'y', 'color', 'y0', 'y1']);

    AreaGeometry.prototype.valuesForAesthetic = function (datum, field, layer) {
        return field
            ? [ datum[field] ]
            : _.map(['y0', 'y1'], function (x) { return layer.dataValue(datum, x); })
    }

    AreaGeometry.prototype.render = function (g, data, layer, scales) {
        var area = d3.svg.area()
            .x(function (d) { return layer.aestheticValue(scales, d, 'x') })
            .y1(function (d) { return layer.aestheticValue(scales, d, 'y', 'y1') })
            .y0(function (d) { return layer.aestheticValue(scales, d, 'y', 'y0') })
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
    LineGeometry.prototype = new Geometry(['x', 'y', 'color']);

    LineGeometry.prototype.render = function (g, data, layer, scales) {
        function scale (d, aesthetic) { return layer.aestheticValue(scales, d, aesthetic); }

        // Can't use attributeValue here like the other geometries
        // because we always group the data and then turn each group
        // into a single array to be used to draw a polyline.
        var color = layer.mappings.color ? function (d) { return scale(d[0], 'color'); } : this.color;

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
        this.name = spec.name;
        this.width = spec.width || 5;
        this.color = spec.color || 'black';
    }

    IntervalGeometry.prototype = new Geometry(['x', 'y', 'color']);

    IntervalGeometry.prototype.render = function (g, data, layer, scales) {
        var width = this.width;

        function scale (d, aesthetic) { return layer.aestheticValue(scales, d, aesthetic); }
        if (this.name) g = g.attr('class', this.name);
        groups(g, 'rects', data).selectAll('rect')
            .data(Object)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', function (d) { return scale(d, 'x') - width/2; })
            .attr('y', function (d) { return scale(d, 'y'); })
            .attr('width', width)
            .attr('height', function (d) { return layer.scaledMin('y', scales) - scale(d, 'y'); })
            .attr('fill', layer.attributeValue(scales, 'color', this.color));
    };

    function BoxPlotGeometry (spec) {
        this.width = spec.width || 10;
        this.color = spec.color || 'black';
    }

    BoxPlotGeometry.prototype = new Geometry(['x', 'y']);
    BoxPlotGeometry.prototype.defaultStatistic = 'box';

    BoxPlotGeometry.prototype.valuesForAesthetic = function (datum, mapped, layer) {
        return mapped
            ? [ datum[mapped] ]
            : _.values(_.omit(datum, ['group', 'outliers'])).concat(datum.outliers);
    }

    BoxPlotGeometry.prototype.render = function (g, data, layer, scales) {
        // Data points are { group, median, q1, q3, upper, lower, outliers }
        var width = this.width;

        function scale (v, a) { return layer.scale(v, a, scales); }

        function iqrBox(s) {
            s.append('rect')
                .attr('class', 'boxplot iqr')
                .attr('x', function (d) { return scale(d.group, 'x') - width/2; })
                .attr('y', function (d) { return scale(d.q3, 'y'); })
                .attr('width', width)
                .attr('height', function (d) { return scale(d.q1, 'y') - scale(d.q3, 'y'); })
                .attr('fill', 'none');
            s.call(medianLine);
        }

        function medianLine(s) {
            s.append('line')
                .attr('class', 'boxplot median')
                .attr('x1', function (d) { return scale(d.group, 'x') - width/2; })
                .attr('x2', function (d) { return scale(d.group, 'x') + width/2; })
                .attr('y1', function (d) { return scale(d.median, 'y'); })
                .attr('y2', function (d) { return scale(d.median, 'y'); });
        }

        function whisker(s, y1, y2) {
            s.append('line')
                .attr('class', 'boxplot whisker')
                .attr('x1', function (d) { return scale(d.group, 'x'); })
                .attr('x2', function (d) { return scale(d.group, 'x'); })
                .attr('y1', function (d) { return scale(d[y1], 'y'); })
                .attr('y2', function (d) { return scale(d[y2], 'y'); });
            s.call(whiskerTick, y2);
        }

        function whiskerTick(s, y) {
            s.append('line')
                .attr('class', 'boxplot whisker')
                .attr('x1', function (d) { return scale(d.group, 'x') - (width * 0.4); })
                .attr('x2', function (d) { return scale(d.group, 'x') + (width * 0.4); })
                .attr('y1', function (d) { return scale(d[y], 'y'); })
                .attr('y2', function (d) { return scale(d[y], 'y'); });
        }

        function outliers(s) {
            s.selectAll('circle')
                .data(function (d) { return _.map(d.outliers, function (o) { return { x: scale(d.group, 'x'), y: scale(o, 'y') }; }); })
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

        var color = ('color' in layer.mappings) ? function(d) { return scale(d, 'color'); } : this.color;

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

    ArrowGeometry.prototype = new Geometry(['x', 'y']);
    ArrowGeometry.prototype.defaultStatistic = 'arrow';

    ArrowGeometry.prototype.render = function (g, data, layer, scales) {
        var len       = this.arrowLength;
        var width     = this.arrowWidth;
        var color     = this.color;
        var linewidth = this.width;

        function scale (v, a) { return layer.scale(v, a, scales); }

        function arrowline (s) {
            s.append('line')
                .attr('x1', function (d) { return scale(d.tail.x, 'x'); })
                .attr('x2', function (d) { return scale(d.head.x, 'x'); })
                .attr('y1', function (d) { return scale(d.tail.y, 'y'); })
                .attr('y2', function (d) { return scale(d.head.y, 'y'); })
                .attr('fill', 'none')
                .attr('stroke-width', linewidth)
                .attr('stroke', color);
        }

        function arrowhead (s) {

            function arrowheadPoints (d, length, width) {
                var x1 = scale(d.tail.x, 'x');
                var y1 = scale(d.tail.y, 'y');
                var x2 = scale(d.head.x, 'x');
                var y2 = scale(d.head.y, 'y');

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

    TextGeometry.prototype = new Geometry(['x', 'y', 'size', 'color']);

    TextGeometry.prototype.render = function (g, data, layer, scales) {
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
            .attr('x', function (d) { return layer.aestheticValue(scales, d, 'x'); })
            .attr('y', function (d) { return layer.aestheticValue(scales, d, 'y'); })
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
    // values.

    function Scale () {}

    Scale.fromSpec = function (spec) {

        var nonLinearAesthetics = { color: 'color', fill:  'color' };

        var s = new ({
            linear:      LinearScale,
            time:        TimeScale,
            log:         LogScale,
            categorical: CategoricalScale,
            color:       ColorScale
        }[spec.type || nonLinearAesthetics[spec.aesthetic] || 'linear'])();

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
            values.sort(function (a, b) { return a - b; });
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

    Statistic.fromSpec = function (spec, geometry) {
        return new ({
            identity: IdentityStatistic,
            bin:      BinStatistic,
            box:      BoxPlotStatistic,
            arrow:    ArrowStatistic,
            sum:      SumStatistic
        }[spec.statistic || geometry.defaultStatistic])(spec, geometry);
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
                // Not clear to me how to implement the ndensity metric
                //ndensity: null
            };
        });
    };

    function SumStatistic (spec, geometry) {
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
        this.group         = spec.group || false;
        this.groupOrdering = spec.groupOrdering || function (x) { return x; };
        this.variable      = spec.variable || false;
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

        var groups   = groupData(data, this.group);
        var variable = this.variable;
        var ordering = this.groupOrdering;

        return _.map(_.sortBy(_.pairs(groups), function (p) { return ordering(p[0]); }), function (g) {
            var name   = g[0];
            var values = variable ? _.pluck(g[1], variable) : g[1];
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
        }, this);
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
        return _.isUndefined(groupBy) ? { 'data': data } : _.groupBy(data, groupBy);
    }

    ////////////////////////////////////////////////////////////////////////
    // API

    /*
     * Given a spec for a graphic, return a rendering function that
     * can render the graphic given data, a DOM element in which to
     * render it, and graphics options.
     */
    exports.gg = function gg () {
        var graphic = new Graphic({
            facets:  _.find(arguments, function (x) { return _.has(x, 'facets'); }),
            layers: _.filter(arguments, function (x) { return _.has(x, 'geometry'); }),
            scales: _.filter(arguments, function (x) { return _.has(x, 'aesthetic'); })
        });
        return function (data, where, opts) { graphic.render(data, where, opts); };
    };

})(this);
