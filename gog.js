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
        return this;
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

    function LineElement () {
        return this;
    }

    LineElement.prototype.render = function (svg, data) {
        var polyline = svg.append('polyline')
            .attr('points', _.map(data, function (d) { return this.xFn(d) + ',' + this.yFn(d); }, this).join(' '))
            .attr('fill', 'none')
            .attr('stroke', 'black')
            .attr('stroke-width', 2);
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

    function line () {
        return applyArguments(arguments, new LineElement());
    }

    function applyArguments (args, obj) {
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
            y += Math.random() * 30;
            data.push({
                d: x,
                r: y,
            });
        });
        return data;
    }());

    $(document).ready(function() {
        graph(size('500px', '300px')).element(point(position('d*r'))).render('#example1', data);
        graph(size('500px', '300px')).element(line(position('d*r'))).render('#example2', data);
    });

})();