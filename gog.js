;(function () {

    function Graph () {
        // Make a graph object that knows how to render itself using d3.
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
    }

    function graph() {
        // Make a graph
        var g = new Graph();
        for (var i = 0; i < arguments.length; i++) {
            arguments[i](g);
        }
        return g;
    }

    // Set the size of a graph.
    function size(w, h) {
        return function (g) { g.setSize(w, h); }
    }

    $(document).ready(function() {
        var g = graph(size('500px', '300px'));
        g.render('#g1', null);
    });

})();