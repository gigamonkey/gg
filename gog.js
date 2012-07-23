;(function () {

    function Graph () {
        this.elements = [];
        this.scales   = {};
        this.d3Scales = {};
        return this;
    }

    Graph.prototype.render = function (id, data) {
        // Render the graph using the given data into the div with the given id.
        this.svg = d3.select(id).append('svg')
            .attr('width', this.width)
            .attr('height', this.height);

        this.svg.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('fill', '#dcb')
            .attr('fill-opacity', 1);

        this.d3Scales[1] = this.scales[1].d3Scale().range([0, this.width]);
        this.d3Scales[2] = this.scales[2].d3Scale().range([this.height, 0]);

        _.each(this.elements, function (e) { e.render(this, data); }, this)
    }


    Graph.prototype.element = function (e) {
        this.elements.push(e);
        return this;
    }

    Graph.prototype.scale = function (s) {
        this.scales[s.dim] = s;
        return this;
    }

    function PointElement () {
        this.rFn = function (d) { return 5; };
        return this;
    }

    PointElement.prototype.render = function (graph, data) {
        var that = this;
        var circle = graph.svg.selectAll('circle')
            .data(data)
            .enter()
            .append('circle')
            .attr('cx', function (d) { return graph.d3Scales[1](that.xFn(d)) })
            .attr('cy', function (d) { return graph.d3Scales[2](that.yFn(d)) })
            .attr('r', this.rFn);
    }

    function LineElement () {
        return this;
    }

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

    function LinearScale () { return this; }

    LinearScale.prototype.d3Scale = function () {
        return d3.scale.linear().domain([this.min, this.max]);
    }

    function LogScale () { return this; }

    LogScale.prototype.d3Scale = function () {
        return d3.scale.log().domain([this.min, this.max]);
    }

    ////////////////////////////////////////////////////////////////////////
    /// API

    function graph() { return build(Graph, arguments); }

    // Elements

    function point () { return build(PointElement, arguments); }

    function line () { return build(LineElement, arguments); }

    // Scales

    function linear () { return build(LinearScale, arguments); }

    function log () { return build(LogScale, arguments); }

   // Set the size of a graph.
    function size(w, h) {
        return function (g) {
            g.width = w;
            g.height = h;
        }
    }

    // Set the dimension of a scale.
    function dim (v) {
        return function (scale) { scale.dim = v; }
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
    function build (fn, args) {
        var obj = new fn();
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

    // Generate some random data.
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



    $(document).ready(function() {

        var n = 0;
        function ex () {
            var id = 'example' + n++;
            d3.select('body').append('div').attr('id', id);
            return '#' + id;
        }

        function xMinFn (data) {
            return _.min(data, function (d) { return d.d; }).d;
        }

        function xMaxFn (data) {
            return _.max(data, function (d) { return d.d; }).d;
        }

        function yMinFn (data) {
            return _.min(data, function (d) { return d.r; }).r;
        }

        function yMaxFn (data) {
            return _.max(data, function (d) { return d.r; }).r;
        }

        var xMin = xMinFn(data);
        var xMax = xMaxFn(data);
        var yMin = yMinFn(data);
        var yMax = yMaxFn(data);

        graph(size(250, 150))
            .element(point(position('d*r')))
            .scale(linear(dim(1), min(xMin), max(xMax)))
            .scale(linear(dim(2), min(yMin), max(yMax)))
            .render(ex(), data);

        graph(size(250, 150))
            .element(line(position('d*r')))
            .scale(linear(dim(1), min(xMin), max(xMax)))
            .scale(linear(dim(2), min(yMin), max(yMax)))
            .render(ex(), data);

        graph(size(250, 150))
            .element(point(position('d*r')))
            .element(line(position('d*r')))
            .scale(linear(dim(1), min(xMin), max(xMax)))
            .scale(linear(dim(2), min(yMin), max(yMax)))
            .render(ex(), data);

        graph(size(250, 150))
            .element(point(position('d*r')))
            .element(line(position('d*r')))
            .scale(linear(dim(1), min(xMinFn(semiLogData)), max(xMaxFn(semiLogData))))
            .scale(log(dim(2), min(yMinFn(semiLogData)), max(yMaxFn(semiLogData))))
            .render(ex(), semiLogData);



    });

})();