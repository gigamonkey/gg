;(function () {

    function Graph () {
        // Make a graph object that knows how to render itself using d3.
        this.elements = [];
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

        var xMin = _.min(data, function (d) { return d.d; }).d;
        var xMax = _.max(data, function (d) { return d.d; }).d;

        var yMin = _.min(data, function (d) { return d.r; }).r;
        var yMax = _.max(data, function (d) { return d.r; }).r;

        this.xscale = d3.scale.linear().domain([xMin, xMax]).range([0, this.width]);
        this.yscale = d3.scale.linear().domain([yMin, yMax]).range([this.height, 0]);

        _.each(this.elements, function (e) { e.render(this, data); }, this)
    }

    Graph.prototype.element = function (e) {
        this.elements.push(e);
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
            .attr('cx', function (d) { return graph.xscale(that.xFn(d)) })
            .attr('cy', function (d) { return graph.yscale(that.yFn(d)) })
            .attr('r', this.rFn);
    }

    function LineElement () {
        return this;
    }

    LineElement.prototype.render = function (graph, data) {
        var e = this;
        function x (d) { return graph.xscale(e.xFn(d)); }
        function y (d) { return graph.yscale(e.yFn(d)); }

        var polyline = graph.svg.append('polyline')
            .attr('points', _.map(data, function (d) { return x(d) + ',' + y(d); }, this).join(' '))
            .attr('fill', 'none')
            .attr('stroke', 'black')
            .attr('stroke-width', 2);
    }



    ////////////////////////////////////////////////////////////////////////
    /// API

    function graph() { return build(Graph, arguments); }

    function point () { return build(PointElement, arguments); }

    function line () { return build(LineElement, arguments); }

   // Set the size of a graph.
    function size(w, h) {
        return function (g) {
            g.width = w;
            g.height = h;
        }
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

    $(document).ready(function() {

        function ex (n) {
            var id = 'example' + n;
            d3.select('body').append('div').attr('id', id);
            return '#' + id;
        }

        graph(size(250, 150)).element(point(position('d*r'))).render(ex(1), data);
        graph(size(250, 150)).element(line(position('d*r'))).render(ex(2), data);

        graph(size(250, 150))
            .element(point(position('d*r')))
            .element(line(position('d*r')))
            .render(ex(3), data);
    });

})();