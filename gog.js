;(function () {

    function Graph () {
        // Make a graph object that knows how to render itself using d3.
        this.elements = [];
        return this;
    }

    Graph.prototype.setSize = function (width, height) {
        this.width  = width;
        this.height = height;
    }

    Graph.prototype.render = function (id, data) {
        // Render the graph using the given data into the div with the given id.
        var svg = d3.select(id).append('svg')
            .attr('width', this.width)
            .attr('height', this.height);

        svg.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('fill', '#aaa')
            .attr('fill-opacity', 1);

        _.each(this.elements, function (e) { e.render(svg, data); })
    }

    Graph.prototype.element = function (e) {
        this.elements.push(e);
    }

    function PointElement () {
        this.rFn = function (d) { return 10; };
        return this;
    }

    PointElement.prototype.render = function (svg, data) {
        var circle = svg.selectAll('circle')
            .data(data)
            .enter()
            .append('circle')
            .attr('cx', this.xFn)
            .attr('cy', this.yFn)
            .attr('r', this.rFn);
    }

    // Make a graph
    function graph() {
        return applyArguments(arguments, new Graph());
    }

    // Set the size of a graph.
    function size(w, h) {
        return function (g) { g.setSize(w, h); }
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

    function point () {
        return applyArguments(arguments, new PointElement());
    }

    function applyArguments (args, obj) {
        _.each(args, function (fn) { fn(obj); });
        return obj;
    }

    // Generate some random data.
    var data = _.map(_.range(20), function () {
        return {
            d: Math.random() * 500,
            r: Math.random() * 300
        }
    });

    $(document).ready(function() {
        var g = graph(size('500px', '300px'));
        g.element(point(position('d*r')));
        g.render('#g1', data);
    });

})();